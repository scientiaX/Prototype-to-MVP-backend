import mongoose from 'mongoose';

/**
 * SessionMemory - Temporary storage for AI context during arena session
 * 
 * This model stores:
 * 1. Problem and profile snapshots for AI context
 * 2. Conversation history between AI and user
 * 3. AI decision logs for transparency and debugging
 * 4. Adaptive parameters that change in real-time
 * 
 * Expires after 24 hours to keep database clean
 */
const sessionMemorySchema = new mongoose.Schema({
    session_id: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Snapshots for AI context (stored at session start)
    problem_snapshot: {
        problem_id: String,
        title: String,
        context: String,
        objective: String,
        constraints: [String],
        difficulty: Number,
        role_label: String,
        level_up_criteria: [String]
    },

    user_profile_snapshot: {
        user_id: String,
        primary_archetype: String,
        risk_appetite: Number,
        decision_speed: Number,
        ambiguity_tolerance: Number,
        experience_depth: Number,
        current_difficulty: Number,
        xp_proportions: {
            risk_taker: Number,
            analyst: Number,
            builder: Number,
            strategist: Number
        },
        levels: {
            risk_taker: Number,
            analyst: Number,
            builder: Number,
            strategist: Number
        }
    },

    // Conversation history (for AI context window)
    conversation: [{
        role: {
            type: String,
            enum: ['system', 'ai_simple', 'ai_agent', 'user'],
            required: true
        },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now },
        intent: {
            type: String,
            enum: ['question', 'hint', 'stimulation', 'warning', 'evaluation',
                'answer', 'clarification', 'decision', 'follow_up']
        },
        metadata: {
            question_id: String,
            intervention_type: String,
            tokens_used: Number
        }
    }],

    // AI decision logs (for debugging and transparency)
    ai_decisions: [{
        layer: {
            type: String,
            enum: ['system', 'ai_simple', 'ai_agent'],
            required: true
        },
        decision_type: {
            type: String,
            enum: ['set_timeout', 'send_warning', 'comprehension_check',
                'evolve_question', 'delegate_to_agent', 'generate_pressure',
                'adjust_difficulty', 'evaluate_response', 'calculate_xp']
        },
        reasoning: String,
        input_metrics: Object,          // What data was used for decision
        output_action: Object,          // What action was taken
        timestamp: { type: Date, default: Date.now }
    }],

    // Adaptive parameters (updated in real-time by system layer)
    adaptive_state: {
        // Current time limits in seconds
        current_time_limits: {
            response_warning: { type: Number, default: 60 },
            comprehension_check: { type: Number, default: 90 },
            force_change: { type: Number, default: 120 }
        },

        // Pressure level (1-5, affects question intensity)
        current_pressure_level: { type: Number, default: 1, min: 1, max: 5 },

        // Question evolution state
        current_question_index: { type: Number, default: 0 },
        questions_asked: [String],

        // User state tracking
        user_state: {
            type: String,
            enum: ['active', 'idle', 'struggling', 'confident', 'finished'],
            default: 'active'
        },

        // Last activity timestamps
        last_keystroke_at: Date,
        last_response_at: Date,
        intervention_in_progress: { type: Boolean, default: false }
    },

    // Session state
    is_active: { type: Boolean, default: true },
    started_at: { type: Date, default: Date.now },

    // Auto-expire after 24 hours
    expires_at: {
        type: Date,
        default: () => new Date(Date.now() + 24 * 60 * 60 * 1000),
        index: { expireAfterSeconds: 0 }
    }
}, {
    timestamps: true
});

// Add conversation entry
sessionMemorySchema.methods.addConversation = function (role, content, intent, metadata = {}) {
    this.conversation.push({
        role,
        content,
        intent,
        timestamp: new Date(),
        metadata
    });

    // Keep only last 50 conversation entries to manage memory
    if (this.conversation.length > 50) {
        this.conversation = this.conversation.slice(-50);
    }

    return this;
};

// Log AI decision
sessionMemorySchema.methods.logDecision = function (layer, decisionType, reasoning, inputMetrics, outputAction) {
    this.ai_decisions.push({
        layer,
        decision_type: decisionType,
        reasoning,
        input_metrics: inputMetrics,
        output_action: outputAction,
        timestamp: new Date()
    });

    // Keep only last 100 decisions
    if (this.ai_decisions.length > 100) {
        this.ai_decisions = this.ai_decisions.slice(-100);
    }

    return this;
};

// Get context for AI (condensed version)
sessionMemorySchema.methods.getAIContext = function () {
    const recentConversation = this.conversation.slice(-10);
    const recentDecisions = this.ai_decisions.slice(-5);

    return {
        problem: this.problem_snapshot,
        user: this.user_profile_snapshot,
        conversation: recentConversation,
        recent_decisions: recentDecisions,
        current_state: this.adaptive_state
    };
};

export default mongoose.model('SessionMemory', sessionMemorySchema);
