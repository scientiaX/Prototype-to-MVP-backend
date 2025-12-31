import XPAuditLog from '../models/XPAuditLog.js';
import DifficultyBaseline from '../models/DifficultyBaseline.js';
import UserProfile from '../models/UserProfile.js';

/**
 * XP Guard Service - Core protection for XP integrity
 * 
 * SPEC #1: Selection Consistency at Scale
 * - XP calculation is independent of global statistics
 * - Thresholds are per-level, not per-population
 * 
 * SPEC #8: Rule Enforcement Priority
 * - XP rules executed in backend only
 * - No admin manual XP injection
 * - Full audit trail
 */

// ==========================================
// ISOLATED XP CALCULATION
// ==========================================

/**
 * Calculate XP in complete isolation from global statistics
 * This function ONLY considers:
 * - Problem difficulty (from baseline)
 * - User's response quality
 * - Session behavior metrics
 * 
 * It does NOT consider:
 * - Population statistics
 * - Other users' XP
 * - Global averages
 * - Traffic/retention metrics
 */
export const calculateIsolatedXP = async (evaluation, problem, profile, sessionData = {}) => {
    // Get baseline for this difficulty level
    const baseline = await DifficultyBaseline.getBaselineForLevel(problem.difficulty || 1);

    // Base XP per archetype from AI evaluation (capped at 20)
    const baseXP = {
        risk_taker: Math.min(20, Math.max(0, evaluation.xp_risk_taker || 0)),
        analyst: Math.min(20, Math.max(0, evaluation.xp_analyst || 0)),
        builder: Math.min(20, Math.max(0, evaluation.xp_builder || 0)),
        strategist: Math.min(20, Math.max(0, evaluation.xp_strategist || 0))
    };

    // Apply difficulty multiplier from baseline (NOT from population stats)
    const multiplier = baseline.baseline_metrics.xp_multiplier;

    const adjustedXP = {
        risk_taker: Math.round(baseXP.risk_taker * multiplier),
        analyst: Math.round(baseXP.analyst * multiplier),
        builder: Math.round(baseXP.builder * multiplier),
        strategist: Math.round(baseXP.strategist * multiplier)
    };

    // Calculate courage XP (for trying, not correctness)
    let courageXP = 0;
    const courageBreakdown = {};

    // XP for quick first action
    if (sessionData.first_action_time_ms && sessionData.first_action_time_ms < 30000) {
        courageBreakdown.quick_action = 5;
        courageXP += 5;
    }

    // XP for exploration
    if (sessionData.unique_approaches && sessionData.unique_approaches > 1) {
        const explorationXP = Math.min(sessionData.unique_approaches * 3, 12);
        courageBreakdown.exploration = explorationXP;
        courageXP += explorationXP;
    }

    // XP for completing entry flow
    if (sessionData.completed_entry_flow) {
        courageBreakdown.entry_flow = 8;
        courageXP += 8;
    }

    // XP for engagement (exchanges with AI)
    if (sessionData.exchange_count && sessionData.exchange_count >= 3) {
        const engagementXP = Math.min(sessionData.exchange_count * 2, 10);
        courageBreakdown.engagement = engagementXP;
        courageXP += engagementXP;
    }

    // Distribute courage XP evenly across archetypes
    const couragePerArchetype = Math.floor(courageXP / 4);

    const finalXP = {
        risk_taker: adjustedXP.risk_taker + couragePerArchetype,
        analyst: adjustedXP.analyst + couragePerArchetype,
        builder: adjustedXP.builder + couragePerArchetype,
        strategist: adjustedXP.strategist + couragePerArchetype
    };

    const totalXP = Object.values(finalXP).reduce((a, b) => a + b, 0);

    return {
        xpBreakdown: {
            ...finalXP,
            courage: courageXP,
            courage_breakdown: courageBreakdown
        },
        totalXp: totalXP,
        courageXP,
        accuracyXP: totalXP - courageXP,
        multiplier_used: multiplier,
        baseline_level: problem.difficulty
    };
};

// ==========================================
// XP VALIDATION
// ==========================================

/**
 * Validate XP award before applying
 * Ensures XP comes from valid source only
 */
export const validateXPAward = (xpBreakdown, source) => {
    // RULE: Only 'arena_submit' is allowed as source
    const validSources = ['arena_submit'];

    if (!validSources.includes(source)) {
        return {
            valid: false,
            error: `Invalid XP source: ${source}. Only arena_submit is allowed.`
        };
    }

    // Validate XP values are reasonable
    const archetypes = ['risk_taker', 'analyst', 'builder', 'strategist'];
    for (const arch of archetypes) {
        if (xpBreakdown[arch] < 0) {
            return {
                valid: false,
                error: `Negative XP not allowed for ${arch}`
            };
        }
        if (xpBreakdown[arch] > 100) {
            return {
                valid: false,
                error: `XP exceeds maximum for ${arch}: ${xpBreakdown[arch]}`
            };
        }
    }

    return { valid: true };
};

// ==========================================
// AUDIT LOGGING
// ==========================================

/**
 * Create immutable XP audit log
 * This is the ONLY way XP changes are recorded
 */
export const createXPAuditLog = async (userId, action, xpBefore, xpAfter, source, metadata = {}) => {
    const xpChange = {
        risk_taker: xpAfter.risk_taker - xpBefore.risk_taker,
        analyst: xpAfter.analyst - xpBefore.analyst,
        builder: xpAfter.builder - xpBefore.builder,
        strategist: xpAfter.strategist - xpBefore.strategist,
        total: (xpAfter.risk_taker + xpAfter.analyst + xpAfter.builder + xpAfter.strategist) -
            (xpBefore.risk_taker + xpBefore.analyst + xpBefore.builder + xpBefore.strategist)
    };

    const auditLog = await XPAuditLog.create({
        user_id: userId,
        action,
        xp_before: {
            risk_taker: xpBefore.risk_taker,
            analyst: xpBefore.analyst,
            builder: xpBefore.builder,
            strategist: xpBefore.strategist,
            total: xpBefore.risk_taker + xpBefore.analyst + xpBefore.builder + xpBefore.strategist
        },
        xp_after: {
            risk_taker: xpAfter.risk_taker,
            analyst: xpAfter.analyst,
            builder: xpAfter.builder,
            strategist: xpAfter.strategist,
            total: xpAfter.risk_taker + xpAfter.analyst + xpAfter.builder + xpAfter.strategist
        },
        xp_change,
        source,
        session_id: metadata.session_id,
        problem_id: metadata.problem_id,
        problem_difficulty: metadata.problem_difficulty,
        evaluation_summary: metadata.evaluation_summary,
        metadata: {
            courage_xp: metadata.courage_xp,
            accuracy_xp: metadata.accuracy_xp,
            stagnation_detected: metadata.stagnation_detected,
            exploit_detected: metadata.exploit_detected
        }
    });

    return auditLog;
};

/**
 * Get XP audit history for a user (read-only)
 */
export const getXPAuditHistory = async (userId, limit = 50) => {
    return await XPAuditLog.find({ user_id: userId })
        .sort({ created_at: -1 })
        .limit(limit)
        .lean();
};

// ==========================================
// STAGNATION MANAGEMENT
// ==========================================

/**
 * Check and update stagnation state
 * SPEC #6: XP Freeze & Stagnation State
 */
export const updateStagnationState = async (userId, totalXpGain) => {
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) return null;

    if (totalXpGain === 0) {
        // Increment stagnation counter
        profile.stagnation_count = (profile.stagnation_count || 0) + 1;

        if (profile.stagnation_count >= 3) {
            profile.xp_state = 'stagnating';
        }
    } else {
        // Reset stagnation on XP gain
        profile.stagnation_count = 0;
        profile.xp_state = 'progressing';
    }

    await profile.save();

    return {
        xp_state: profile.xp_state,
        stagnation_count: profile.stagnation_count
    };
};

/**
 * Freeze XP for a user (due to exploit detection)
 */
export const freezeXP = async (userId, durationMs, reason) => {
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) return null;

    profile.xp_state = 'frozen';
    profile.xp_frozen_until = new Date(Date.now() + durationMs);
    profile.exploit_cooldown_until = new Date(Date.now() + durationMs);

    await profile.save();

    // Create audit log for freeze action
    const currentXP = {
        risk_taker: profile.xp_risk_taker,
        analyst: profile.xp_analyst,
        builder: profile.xp_builder,
        strategist: profile.xp_strategist
    };

    await createXPAuditLog(
        userId,
        'freeze',
        currentXP,
        currentXP, // No change, just freeze
        'arena_submit', // Still must be valid source
        {
            evaluation_summary: `XP frozen for ${durationMs / 1000}s. Reason: ${reason}`
        }
    );

    return {
        frozen: true,
        until: profile.xp_frozen_until,
        reason
    };
};

/**
 * Check if user's XP is currently frozen
 */
export const isXPFrozen = async (userId) => {
    const profile = await UserProfile.findOne({ user_id: userId });
    if (!profile) return false;

    if (profile.xp_state === 'frozen' && profile.xp_frozen_until) {
        if (profile.xp_frozen_until > new Date()) {
            return {
                frozen: true,
                until: profile.xp_frozen_until
            };
        } else {
            // Freeze expired, reset state
            profile.xp_state = 'progressing';
            profile.xp_frozen_until = null;
            await profile.save();
        }
    }

    return { frozen: false };
};

export default {
    calculateIsolatedXP,
    validateXPAward,
    createXPAuditLog,
    getXPAuditHistory,
    updateStagnationState,
    freezeXP,
    isXPFrozen
};
