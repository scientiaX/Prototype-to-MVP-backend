/**
 * System Layer Service - Layer 1 of 3-Layer AI Engine
 * 
 * This layer handles:
 * - Pure logic operations (no AI calls)
 * - Metrics tracking and calculations
 * - Timeout management
 * - Decision rules based on thresholds
 * 
 * Cost: FREE (no AI API calls)
 */

import ArenaSessionMetrics from '../models/ArenaSessionMetrics.js';
import SessionMemory from '../models/SessionMemory.js';

// ==========================================
// TIMEOUT CONFIGURATION
// ==========================================

const BASE_TIMEOUTS = {
    // Seconds until each intervention stage
    analyst: { warning: 90, check: 120, force: 150 },
    risk_taker: { warning: 45, check: 60, force: 90 },
    builder: { warning: 60, check: 90, force: 120 },
    strategist: { warning: 75, check: 105, force: 135 }
};

const DIFFICULTY_MULTIPLIER_RANGE = { min: 0.84, max: 1.2 }; // difficulty 1-10
const QUESTION_TYPE_MULTIPLIERS = {
    simple: 0.7,
    normal: 1.0,
    complex: 1.3,
    critical: 1.5
};

// ==========================================
// KEYSTROKE RHYTHM ANALYSIS
// ==========================================

/**
 * Analyze keystroke timing patterns to determine rhythm type
 */
export const analyzeKeystrokeRhythm = (keystrokeTimes) => {
    if (!keystrokeTimes || keystrokeTimes.length < 5) {
        return 'mixed';
    }

    const intervals = [];
    for (let i = 1; i < keystrokeTimes.length; i++) {
        intervals.push(keystrokeTimes[i] - keystrokeTimes[i - 1]);
    }

    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    const variance = intervals.reduce((sum, val) => sum + Math.pow(val - avgInterval, 2), 0) / intervals.length;
    const stdDev = Math.sqrt(variance);
    const coeffOfVariation = stdDev / avgInterval;

    // Long pauses detection
    const longPauses = intervals.filter(i => i > 3000).length;
    const pauseRatio = longPauses / intervals.length;

    // Determine rhythm type
    if (coeffOfVariation < 0.3 && avgInterval < 300) {
        return 'confident';     // Consistent, fast typing
    } else if (coeffOfVariation < 0.5 && avgInterval < 500) {
        return 'steady';        // Consistent, moderate pace
    } else if (pauseRatio > 0.3) {
        return 'hesitant';      // Many long pauses
    } else if (coeffOfVariation > 0.8) {
        return 'bursts';        // Inconsistent - bursts of typing
    }

    return 'mixed';
};

/**
 * Calculate response speed score (1-10) from timing data
 */
export const calculateResponseSpeedScore = (timeToStartTypingMs) => {
    // Thresholds in milliseconds
    // <5s = 10, 5-15s = 8-9, 15-30s = 6-7, 30-60s = 4-5, 60-120s = 2-3, >120s = 1
    const seconds = timeToStartTypingMs / 1000;

    if (seconds < 5) return 10;
    if (seconds < 10) return 9;
    if (seconds < 15) return 8;
    if (seconds < 20) return 7;
    if (seconds < 30) return 6;
    if (seconds < 45) return 5;
    if (seconds < 60) return 4;
    if (seconds < 90) return 3;
    if (seconds < 120) return 2;
    return 1;
};

// ==========================================
// ADAPTIVE TIMEOUT CALCULATION
// ==========================================

/**
 * Calculate adaptive timeouts based on user profile, problem difficulty, and question type
 */
export const getAdaptiveTimeouts = (profile, problemDifficulty, questionType = 'normal') => {
    const archetype = profile?.primary_archetype || 'analyst';
    const baseTimeouts = BASE_TIMEOUTS[archetype] || BASE_TIMEOUTS.analyst;

    // Difficulty multiplier: harder problems get more time
    // difficulty 1 = 0.84x, difficulty 10 = 1.2x
    const diffRange = DIFFICULTY_MULTIPLIER_RANGE.max - DIFFICULTY_MULTIPLIER_RANGE.min;
    const difficultyMultiplier = DIFFICULTY_MULTIPLIER_RANGE.min + (problemDifficulty / 10) * diffRange;

    // Question type multiplier
    const questionMultiplier = QUESTION_TYPE_MULTIPLIERS[questionType] || 1.0;

    // Final calculation
    return {
        warning: Math.round(baseTimeouts.warning * difficultyMultiplier * questionMultiplier),
        check: Math.round(baseTimeouts.check * difficultyMultiplier * questionMultiplier),
        force: Math.round(baseTimeouts.force * difficultyMultiplier * questionMultiplier)
    };
};

// ==========================================
// METRICS TRACKING
// ==========================================

/**
 * Track keystroke data for a session
 */
export const trackKeystroke = async (sessionId, keystrokeData) => {
    try {
        const metrics = await ArenaSessionMetrics.findOne({ session_id: sessionId });
        if (!metrics) return null;

        // Update last keystroke time in session memory
        await SessionMemory.findOneAndUpdate(
            { session_id: sessionId },
            {
                'adaptive_state.last_keystroke_at': new Date(),
                'adaptive_state.user_state': 'active'
            }
        );

        return { tracked: true };
    } catch (error) {
        console.error('Error tracking keystroke:', error);
        return null;
    }
};

/**
 * Add response timing entry to metrics
 */
export const recordResponseTiming = async (sessionId, timingData) => {
    try {
        const metrics = await ArenaSessionMetrics.findOne({ session_id: sessionId });
        if (!metrics) return null;

        const rhythm = analyzeKeystrokeRhythm(timingData.keystrokeTimes);
        const speedScore = calculateResponseSpeedScore(timingData.time_to_start_typing_ms);

        const responseEntry = {
            question_id: timingData.question_id,
            question_text: timingData.question_text,
            time_to_start_typing_ms: timingData.time_to_start_typing_ms,
            time_to_submit_ms: timingData.time_to_submit_ms,
            pause_count: timingData.pause_count || 0,
            longest_pause_ms: timingData.longest_pause_ms || 0,
            keystroke_rhythm: rhythm,
            response_length: timingData.response_length,
            revision_count: timingData.revision_count || 0,
            timestamp: new Date()
        };

        metrics.response_times.push(responseEntry);
        metrics.aggregate_metrics.avg_response_speed = speedScore;
        metrics.last_updated = new Date();

        await metrics.save();

        return { recorded: true, rhythm, speedScore };
    } catch (error) {
        console.error('Error recording response timing:', error);
        return null;
    }
};

/**
 * Record intervention in metrics
 */
export const recordIntervention = async (sessionId, interventionData) => {
    try {
        const metrics = await ArenaSessionMetrics.findOne({ session_id: sessionId });
        if (!metrics) return null;

        metrics.interventions.push({
            type: interventionData.type,
            trigger_reason: interventionData.reason,
            timestamp: new Date(),
            user_response: interventionData.user_response || 'pending',
            response_delay_ms: interventionData.response_delay_ms || 0,
            effectiveness: {
                user_started_typing: false,
                quality_improved: false
            }
        });

        metrics.last_updated = new Date();
        await metrics.save();

        // Also log to session memory
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        if (memory) {
            memory.logDecision(
                'system',
                interventionData.type === 'warning' ? 'send_warning' :
                    interventionData.type === 'comprehension_check' ? 'comprehension_check' : 'evolve_question',
                interventionData.reason,
                { user_state: interventionData.user_state },
                { intervention_type: interventionData.type }
            );
            memory.adaptive_state.intervention_in_progress = true;
            await memory.save();
        }

        return { recorded: true };
    } catch (error) {
        console.error('Error recording intervention:', error);
        return null;
    }
};

// ==========================================
// DECISION RULES (NO AI)
// ==========================================

/**
 * Determine if intervention is needed based on pure timing rules
 */
export const checkInterventionNeeded = async (sessionId) => {
    try {
        const memory = await SessionMemory.findOne({ session_id: sessionId });
        if (!memory || !memory.is_active) return { needed: false };

        const now = new Date();
        const lastKeystroke = memory.adaptive_state.last_keystroke_at || memory.started_at;
        const timeSinceKeystrokeMs = now - lastKeystroke;
        const timeSinceKeystrokeSec = timeSinceKeystrokeMs / 1000;

        const timeouts = memory.adaptive_state.current_time_limits;

        // Check if intervention already in progress
        if (memory.adaptive_state.intervention_in_progress) {
            return { needed: false, reason: 'intervention_in_progress' };
        }

        // Determine intervention level
        if (timeSinceKeystrokeSec >= timeouts.force_change) {
            return {
                needed: true,
                type: 'force_change',
                seconds_idle: Math.round(timeSinceKeystrokeSec)
            };
        } else if (timeSinceKeystrokeSec >= timeouts.comprehension_check) {
            return {
                needed: true,
                type: 'comprehension_check',
                seconds_idle: Math.round(timeSinceKeystrokeSec)
            };
        } else if (timeSinceKeystrokeSec >= timeouts.response_warning) {
            return {
                needed: true,
                type: 'warning',
                seconds_idle: Math.round(timeSinceKeystrokeSec)
            };
        }

        return { needed: false };
    } catch (error) {
        console.error('Error checking intervention:', error);
        return { needed: false, error: error.message };
    }
};

/**
 * Identify weak and strong archetypes from profile
 */
export const identifyArchetypeStrengths = (profile) => {
    const xpValues = {
        risk_taker: profile.xp_risk_taker || 0,
        analyst: profile.xp_analyst || 0,
        builder: profile.xp_builder || 0,
        strategist: profile.xp_strategist || 0
    };

    const total = Object.values(xpValues).reduce((a, b) => a + b, 0);
    if (total === 0) {
        return {
            weak: ['risk_taker', 'analyst', 'builder', 'strategist'],
            strong: [],
            balanced: true
        };
    }

    const proportions = {};
    Object.keys(xpValues).forEach(key => {
        proportions[key] = xpValues[key] / total;
    });

    const avgProportion = 0.25; // 1/4 for each
    const weak = [];
    const strong = [];

    Object.entries(proportions).forEach(([key, value]) => {
        if (value < avgProportion - 0.1) {
            weak.push(key);
        } else if (value > avgProportion + 0.1) {
            strong.push(key);
        }
    });

    return { weak, strong, balanced: weak.length === 0 && strong.length === 0 };
};

/**
 * Calculate effective difficulty for problem generation
 */
export const calculateEffectiveDifficulty = (profile) => {
    const baseDifficulty = profile.current_difficulty || 1;
    const microOffset = profile.micro_difficulty_offset || 0;

    // Clamp between 1 and 10
    return Math.max(1, Math.min(10, baseDifficulty + microOffset));
};

export default {
    analyzeKeystrokeRhythm,
    calculateResponseSpeedScore,
    getAdaptiveTimeouts,
    trackKeystroke,
    recordResponseTiming,
    recordIntervention,
    checkInterventionNeeded,
    identifyArchetypeStrengths,
    calculateEffectiveDifficulty
};
