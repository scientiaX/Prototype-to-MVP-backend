import UserProfile from '../models/UserProfile.js';

/**
 * Identity Service - Device fingerprinting and account linking
 * 
 * SPEC #7: Anti-Reset Identity
 * - Soft identity binding via device fingerprint
 * - Reset does not delete history from linked accounts
 * - Account linkage heuristics
 */

// ==========================================
// DEVICE FINGERPRINTING
// ==========================================

/**
 * Record a device fingerprint for a user
 * Called on login/registration with device info from frontend
 */
export const recordDeviceFingerprint = async (userId, fingerprintData) => {
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) return null;

    const fingerprint = fingerprintData.fingerprint ||
        generateSimpleFingerprint(fingerprintData);

    // Initialize array if not exists
    if (!profile.device_fingerprints) {
        profile.device_fingerprints = [];
    }

    // Check if fingerprint already exists
    const existingIndex = profile.device_fingerprints.findIndex(
        df => df.fingerprint === fingerprint
    );

    if (existingIndex >= 0) {
        // Update last seen
        profile.device_fingerprints[existingIndex].last_seen = new Date();
    } else {
        // Add new fingerprint
        profile.device_fingerprints.push({
            fingerprint,
            device_info: fingerprintData.device_info || fingerprintData.userAgent,
            first_seen: new Date(),
            last_seen: new Date()
        });
    }

    await profile.save();

    // Check for linked accounts with same fingerprint
    const linkedAccounts = await detectLinkedAccounts(fingerprint, userId);

    return {
        fingerprint_recorded: true,
        device_count: profile.device_fingerprints.length,
        linked_accounts_found: linkedAccounts.length
    };
};

/**
 * Generate a simple fingerprint from device info
 * In production, use a library like FingerprintJS on frontend
 */
const generateSimpleFingerprint = (data) => {
    // Combine available device info into a hash-like string
    const components = [
        data.userAgent || '',
        data.screenWidth || '',
        data.screenHeight || '',
        data.timezone || '',
        data.language || '',
        data.platform || ''
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < components.length; i++) {
        const char = components.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }

    return `fp_${Math.abs(hash).toString(36)}`;
};

// ==========================================
// ACCOUNT LINKING
// ==========================================

/**
 * Detect other accounts with the same fingerprint
 */
export const detectLinkedAccounts = async (fingerprint, currentUserId) => {
    const profiles = await UserProfile.find({
        user_id: { $ne: currentUserId },
        'device_fingerprints.fingerprint': fingerprint
    }).lean();

    return profiles.map(p => ({
        user_id: p.user_id,
        name: p.name,
        created_at: p.createdAt
    }));
};

/**
 * Link two accounts together (soft link)
 * Neither account can escape the shared history
 */
export const linkAccounts = async (userId1, userId2) => {
    const profile1 = await UserProfile.findOne({ user_id: userId1 });
    const profile2 = await UserProfile.findOne({ user_id: userId2 });

    if (!profile1 || !profile2) {
        return { success: false, error: 'One or both profiles not found' };
    }

    // Initialize arrays if not exists
    if (!profile1.linked_accounts) profile1.linked_accounts = [];
    if (!profile2.linked_accounts) profile2.linked_accounts = [];

    // Add bidirectional links
    if (!profile1.linked_accounts.includes(userId2)) {
        profile1.linked_accounts.push(userId2);
        await profile1.save();
    }

    if (!profile2.linked_accounts.includes(userId1)) {
        profile2.linked_accounts.push(userId1);
        await profile2.save();
    }

    return {
        success: true,
        linked: [userId1, userId2]
    };
};

/**
 * Get all linked accounts for a user (including transitive links)
 */
export const getAllLinkedAccounts = async (userId, visited = new Set()) => {
    if (visited.has(userId)) return [];
    visited.add(userId);

    const profile = await UserProfile.findOne({ user_id: userId }).lean();
    if (!profile) return [];

    const linkedIds = profile.linked_accounts || [];
    const allLinked = [...linkedIds];

    // Recursively get transitively linked accounts
    for (const linkedId of linkedIds) {
        const transitive = await getAllLinkedAccounts(linkedId, visited);
        allLinked.push(...transitive);
    }

    return [...new Set(allLinked)];
};

/**
 * Get combined history from all linked accounts
 * User cannot escape their history by creating new account
 */
export const getCombinedHistory = async (userId) => {
    const XPAuditLog = (await import('../models/XPAuditLog.js')).default;
    const ResponseHistory = (await import('../models/ResponseHistory.js')).default;

    // Get all linked account IDs
    const allAccountIds = [userId, ...await getAllLinkedAccounts(userId)];

    // Get combined XP audit logs
    const xpHistory = await XPAuditLog.find({
        user_id: { $in: allAccountIds }
    }).sort({ created_at: -1 }).limit(100).lean();

    // Get combined response history (for exploit detection)
    const responseHistory = await ResponseHistory.find({
        user_id: { $in: allAccountIds }
    }).sort({ created_at: -1 }).limit(50).lean();

    return {
        linked_accounts: allAccountIds,
        xp_history: xpHistory,
        response_history: responseHistory,
        total_records: xpHistory.length + responseHistory.length
    };
};

// ==========================================
// AUTO-LINKING ON LOGIN
// ==========================================

/**
 * Process login and auto-link accounts with same fingerprint
 */
export const processLoginFingerprint = async (userId, fingerprintData) => {
    // Record the fingerprint
    await recordDeviceFingerprint(userId, fingerprintData);

    const fingerprint = fingerprintData.fingerprint ||
        generateSimpleFingerprint(fingerprintData);

    // Find other accounts with same device
    const otherAccounts = await detectLinkedAccounts(fingerprint, userId);

    // Auto-link accounts (soft link - doesn't merge, just tracks)
    for (const account of otherAccounts) {
        await linkAccounts(userId, account.user_id);
    }

    return {
        fingerprint_processed: true,
        auto_linked_count: otherAccounts.length
    };
};

export default {
    recordDeviceFingerprint,
    detectLinkedAccounts,
    linkAccounts,
    getAllLinkedAccounts,
    getCombinedHistory,
    processLoginFingerprint
};
