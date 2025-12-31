import mongoose from 'mongoose';

/**
 * DifficultyBaseline - Historical baseline benchmarks per level
 * 
 * SPEC #2: Pressure Invariance (Anti-Drift)
 * - Each difficulty level has a fixed baseline
 * - Evaluations are compared to historical baseline, NOT current population
 * - Prevents difficulty drift over time
 */
const difficultyBaselineSchema = new mongoose.Schema({
    level: {
        type: Number,
        required: true,
        unique: true,
        min: 1,
        max: 10
    },
    baseline_metrics: {
        // Minimum quality thresholds
        min_response_quality: {
            type: Number,
            required: true,
            min: 0,
            max: 1,
            default: 0.5
        },
        min_decision_depth: {
            type: Number,
            required: true,
            min: 1,
            max: 10,
            default: 3
        },
        min_tradeoff_consideration: {
            type: Number,
            required: true,
            min: 0,
            max: 5,
            default: 1
        },
        // Expected time range in seconds
        expected_time_range: {
            min: { type: Number, default: 60 },  // Minimum 1 minute
            max: { type: Number, default: 600 }  // Maximum 10 minutes
        },
        // XP thresholds
        xp_threshold_for_level_up: {
            type: Number,
            required: true,
            default: 100
        },
        xp_multiplier: {
            type: Number,
            default: 1.0
        }
    },
    // Validation criteria for this level
    validation_criteria: {
        requires_tradeoff_analysis: { type: Boolean, default: false },
        requires_risk_assessment: { type: Boolean, default: false },
        requires_multi_perspective: { type: Boolean, default: false },
        min_word_count: { type: Number, default: 50 }
    },
    // Metadata
    version: {
        type: Number,
        default: 1
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    created_by: {
        type: String,
        default: 'system'
    }
}, {
    timestamps: true
});

// Static method to get baseline for a level
difficultyBaselineSchema.statics.getBaselineForLevel = async function (level) {
    let baseline = await this.findOne({ level });

    // If no baseline exists, create default one
    if (!baseline) {
        baseline = await this.create({
            level,
            baseline_metrics: {
                min_response_quality: 0.3 + (level * 0.05), // Increases with level
                min_decision_depth: Math.min(level + 2, 10),
                min_tradeoff_consideration: Math.ceil(level / 3),
                expected_time_range: {
                    min: 30 + (level * 30),  // More time expected at higher levels
                    max: 300 + (level * 60)
                },
                xp_threshold_for_level_up: 100 * Math.pow(1.2, level - 1), // 20% increase per level
                xp_multiplier: 1 + (level * 0.1) // Higher levels give more XP
            },
            validation_criteria: {
                requires_tradeoff_analysis: level >= 3,
                requires_risk_assessment: level >= 5,
                requires_multi_perspective: level >= 7,
                min_word_count: 50 + (level * 20)
            }
        });
    }

    return baseline;
};

// Static method to validate response against baseline
difficultyBaselineSchema.statics.validateAgainstBaseline = async function (level, responseMetrics) {
    const baseline = await this.getBaselineForLevel(level);

    const validation = {
        passes_quality: responseMetrics.quality >= baseline.baseline_metrics.min_response_quality,
        passes_depth: responseMetrics.decision_depth >= baseline.baseline_metrics.min_decision_depth,
        passes_tradeoffs: responseMetrics.tradeoff_count >= baseline.baseline_metrics.min_tradeoff_consideration,
        passes_word_count: responseMetrics.word_count >= baseline.validation_criteria.min_word_count,
        within_time_range: (
            responseMetrics.time_seconds >= baseline.baseline_metrics.expected_time_range.min &&
            responseMetrics.time_seconds <= baseline.baseline_metrics.expected_time_range.max
        )
    };

    validation.overall_pass = Object.values(validation).every(v => v === true);
    validation.xp_multiplier = baseline.baseline_metrics.xp_multiplier;

    return validation;
};

export default mongoose.model('DifficultyBaseline', difficultyBaselineSchema);
