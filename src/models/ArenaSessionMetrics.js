import mongoose from 'mongoose';

/**
 * ArenaSessionMetrics - Real-time tracking metrics for each arena session
 * 
 * This model stores detailed metrics about user behavior during arena sessions,
 * which are used for:
 * 1. AI-driven adaptive responses
 * 2. XP calculation based on response characteristics
 * 3. Identifying user strengths and weaknesses
 */
const arenaSessionMetricsSchema = new mongoose.Schema({
    session_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Response timing metrics per question/interaction
    response_times: [{
        question_id: String,
        question_text: String,
        time_to_start_typing_ms: Number,    // Time from question shown to first keystroke
        time_to_submit_ms: Number,          // Total time from question to submission
        pause_count: Number,                 // Number of pauses > threshold
        longest_pause_ms: Number,            // Longest single pause duration
        keystroke_rhythm: {
            type: String,
            enum: ['steady', 'bursts', 'hesitant', 'confident', 'mixed'],
            default: 'mixed'
        },
        response_length: Number,
        revision_count: Number,              // How many times user edited response
        timestamp: { type: Date, default: Date.now }
    }],

    // Aggregate metrics (calculated periodically during session)
    aggregate_metrics: {
        // Speed metrics (1-10 scale)
        avg_response_speed: { type: Number, default: 5, min: 1, max: 10 },
        response_speed_trend: {
            type: String,
            enum: ['improving', 'declining', 'stable'],
            default: 'stable'
        },

        // Quality metrics (0-1 scale)
        response_quality_consistency: { type: Number, default: 0.5, min: 0, max: 1 },
        understanding_clarity: { type: Number, default: 0.5, min: 0, max: 1 },

        // Decision metrics (1-10 scale)
        decision_confidence_score: { type: Number, default: 5, min: 1, max: 10 },
        decisiveness: { type: Number, default: 5, min: 1, max: 10 },

        // Trade-off awareness
        tradeoff_mentions: { type: Number, default: 0 },
        risk_acknowledgment: { type: Boolean, default: false }
    },

    // Intervention tracking
    interventions: [{
        type: {
            type: String,
            enum: ['warning', 'comprehension_check', 'countdown', 'question_change', 'hint', 'stimulation']
        },
        trigger_reason: String,              // Why this intervention was triggered
        timestamp: Date,
        user_response: {
            type: String,
            enum: ['understood', 'not_understood', 'ignored', 'started_typing', 'timeout']
        },
        response_delay_ms: Number,           // How long until user responded to intervention
        effectiveness: {                     // Did it help?
            user_started_typing: Boolean,
            quality_improved: Boolean
        }
    }],

    // Communication metrics (for multiplayer - future)
    communication: {
        frequency: { type: Number, default: 0 },
        quality_score: { type: Number, default: 0, min: 0, max: 10 },
        collaboration_level: {
            type: String,
            enum: ['none', 'passive', 'active', 'leader'],
            default: 'none'
        }
    },

    // Session state
    is_active: { type: Boolean, default: true },
    last_updated: { type: Date, default: Date.now }
}, {
    timestamps: true
});

// Indexes for efficient queries
arenaSessionMetricsSchema.index({ is_active: 1, last_updated: -1 });

// Method to calculate aggregate metrics from response_times
arenaSessionMetricsSchema.methods.recalculateAggregates = function () {
    if (this.response_times.length === 0) return;

    const times = this.response_times;

    // Calculate average response speed (normalized to 1-10)
    const avgTime = times.reduce((sum, t) => sum + (t.time_to_start_typing_ms || 0), 0) / times.length;
    // <5s = 10, >120s = 1
    this.aggregate_metrics.avg_response_speed = Math.max(1, Math.min(10,
        Math.round(10 - (avgTime / 1000 - 5) * (9 / 115))
    ));

    // Calculate decision confidence based on revision count
    const avgRevisions = times.reduce((sum, t) => sum + (t.revision_count || 0), 0) / times.length;
    // 0 revisions = 10, 10+ revisions = 1
    this.aggregate_metrics.decision_confidence_score = Math.max(1, Math.min(10,
        Math.round(10 - avgRevisions)
    ));

    return this.aggregate_metrics;
};

export default mongoose.model('ArenaSessionMetrics', arenaSessionMetricsSchema);
