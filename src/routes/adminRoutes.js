import express from 'express';
import XPAuditLog from '../models/XPAuditLog.js';
import ResponseHistory from '../models/ResponseHistory.js';
import UserProfile from '../models/UserProfile.js';
import * as identityService from '../services/identityService.js';

/**
 * Admin Routes - READ-ONLY Access
 * 
 * SPEC #8: Rule Enforcement Priority
 * - NO XP modification endpoints
 * - NO admin manual XP injection
 * - Read-only audit trail access
 */

const router = express.Router();

// ==========================================
// XP AUDIT LOGS (READ-ONLY)
// ==========================================

/**
 * Get XP audit history for a user
 * This is read-only - no modifications allowed
 */
router.get('/audit-logs/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;
        const { limit = 50, skip = 0 } = req.query;

        const logs = await XPAuditLog.find({ user_id })
            .sort({ created_at: -1 })
            .skip(parseInt(skip))
            .limit(parseInt(limit))
            .lean();

        const total = await XPAuditLog.countDocuments({ user_id });

        res.json({
            user_id,
            logs,
            total,
            limit: parseInt(limit),
            skip: parseInt(skip)
        });
    } catch (error) {
        console.error('Get audit logs error:', error);
        res.status(500).json({ error: 'Failed to get audit logs' });
    }
});

/**
 * Get XP audit summary for a user
 */
router.get('/audit-summary/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const logs = await XPAuditLog.find({ user_id }).lean();

        // Calculate totals
        let totalXpAwarded = 0;
        let totalCourageXp = 0;
        let totalAccuracyXp = 0;
        let exploitCount = 0;
        let stagnationCount = 0;

        for (const log of logs) {
            if (log.action === 'award') {
                totalXpAwarded += log.xp_change?.total || 0;
                totalCourageXp += log.metadata?.courage_xp || 0;
                totalAccuracyXp += log.metadata?.accuracy_xp || 0;
            }
            if (log.metadata?.exploit_detected) exploitCount++;
            if (log.metadata?.stagnation_detected) stagnationCount++;
        }

        res.json({
            user_id,
            total_logs: logs.length,
            total_xp_awarded: totalXpAwarded,
            total_courage_xp: totalCourageXp,
            total_accuracy_xp: totalAccuracyXp,
            exploit_detections: exploitCount,
            stagnation_detections: stagnationCount
        });
    } catch (error) {
        console.error('Get audit summary error:', error);
        res.status(500).json({ error: 'Failed to get audit summary' });
    }
});

// ==========================================
// EXPLOIT REPORTS (READ-ONLY)
// ==========================================

/**
 * Get all exploit reports
 */
router.get('/exploit-reports', async (req, res) => {
    try {
        const { limit = 50 } = req.query;

        // Get profiles with exploit history
        const profiles = await UserProfile.find({
            'exploit_history.0': { $exists: true }
        }).select('user_id name exploit_history exploit_cooldown_until').lean();

        // Get flagged responses
        const flaggedResponses = await ResponseHistory.find({
            exploit_flag: true
        }).sort({ created_at: -1 }).limit(parseInt(limit)).lean();

        res.json({
            profiles_with_exploits: profiles.length,
            flagged_responses: flaggedResponses.length,
            profiles: profiles.map(p => ({
                user_id: p.user_id,
                name: p.name,
                exploit_count: p.exploit_history?.length || 0,
                cooldown_active: p.exploit_cooldown_until && p.exploit_cooldown_until > new Date()
            })),
            recent_flags: flaggedResponses
        });
    } catch (error) {
        console.error('Get exploit reports error:', error);
        res.status(500).json({ error: 'Failed to get exploit reports' });
    }
});

// ==========================================
// STAGNATION REPORTS (READ-ONLY)
// ==========================================

/**
 * Get users in stagnation state
 */
router.get('/stagnation-reports', async (req, res) => {
    try {
        const stagnatingUsers = await UserProfile.find({
            xp_state: 'stagnating'
        }).select('user_id name xp_state stagnation_count total_arenas_completed').lean();

        const frozenUsers = await UserProfile.find({
            xp_state: 'frozen'
        }).select('user_id name xp_state xp_frozen_until').lean();

        res.json({
            stagnating_count: stagnatingUsers.length,
            frozen_count: frozenUsers.length,
            stagnating_users: stagnatingUsers,
            frozen_users: frozenUsers
        });
    } catch (error) {
        console.error('Get stagnation reports error:', error);
        res.status(500).json({ error: 'Failed to get stagnation reports' });
    }
});

// ==========================================
// LINKED ACCOUNTS (READ-ONLY)
// ==========================================

/**
 * Get linked accounts for a user
 */
router.get('/linked-accounts/:user_id', async (req, res) => {
    try {
        const { user_id } = req.params;

        const linkedAccounts = await identityService.getAllLinkedAccounts(user_id);
        const combinedHistory = await identityService.getCombinedHistory(user_id);

        res.json({
            user_id,
            linked_accounts: linkedAccounts,
            combined_records: combinedHistory.total_records
        });
    } catch (error) {
        console.error('Get linked accounts error:', error);
        res.status(500).json({ error: 'Failed to get linked accounts' });
    }
});

// ==========================================
// DIFFICULTY BASELINES (READ-ONLY)
// ==========================================

/**
 * Get all difficulty baselines
 */
router.get('/difficulty-baselines', async (req, res) => {
    try {
        const DifficultyBaseline = (await import('../models/DifficultyBaseline.js')).default;

        const baselines = await DifficultyBaseline.find({}).sort({ level: 1 }).lean();

        res.json({
            total: baselines.length,
            baselines
        });
    } catch (error) {
        console.error('Get difficulty baselines error:', error);
        res.status(500).json({ error: 'Failed to get difficulty baselines' });
    }
});

// ==========================================
// SYSTEM HEALTH (READ-ONLY)
// ==========================================

/**
 * Get system health metrics
 */
router.get('/system-health', async (req, res) => {
    try {
        const totalUsers = await UserProfile.countDocuments({});
        const activeUsers = await UserProfile.countDocuments({
            xp_state: 'progressing'
        });
        const stagnatingUsers = await UserProfile.countDocuments({
            xp_state: 'stagnating'
        });
        const frozenUsers = await UserProfile.countDocuments({
            xp_state: 'frozen'
        });
        const totalAuditLogs = await XPAuditLog.countDocuments({});
        const exploitFlags = await ResponseHistory.countDocuments({
            exploit_flag: true
        });

        res.json({
            timestamp: new Date(),
            users: {
                total: totalUsers,
                progressing: activeUsers,
                stagnating: stagnatingUsers,
                frozen: frozenUsers
            },
            audit: {
                total_logs: totalAuditLogs
            },
            security: {
                exploit_flags: exploitFlags
            }
        });
    } catch (error) {
        console.error('Get system health error:', error);
        res.status(500).json({ error: 'Failed to get system health' });
    }
});

// ==========================================
// BLOCKED ENDPOINTS (NO XP INJECTION)
// ==========================================

/**
 * BLOCKED: No XP injection allowed
 * SPEC #8: Rule Enforcement Priority
 */
router.post('/inject-xp', (req, res) => {
    res.status(403).json({
        error: 'BLOCKED',
        reason: 'XP injection is not allowed. XP can only be earned through arena_submit.',
        spec: 'SPEC #8: Rule Enforcement Priority'
    });
});

router.put('/modify-xp/:user_id', (req, res) => {
    res.status(403).json({
        error: 'BLOCKED',
        reason: 'XP modification is not allowed. XP audit logs are immutable.',
        spec: 'SPEC #8: Rule Enforcement Priority'
    });
});

router.delete('/reset-xp/:user_id', (req, res) => {
    res.status(403).json({
        error: 'BLOCKED',
        reason: 'XP reset is not allowed. History is permanent.',
        spec: 'SPEC #4: Irreversibility Formal'
    });
});

export default router;
