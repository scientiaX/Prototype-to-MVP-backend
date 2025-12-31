import mongoose from 'mongoose';

/**
 * XPAuditLog - Immutable audit trail for all XP changes
 * 
 * SPEC #8: Rule Enforcement Priority
 * - All XP changes MUST be logged
 * - No updates or deletes allowed
 * - Source must be 'arena_submit' only
 */
const xpAuditLogSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ['award', 'freeze', 'penalty', 'stagnation_reset'],
        required: true
    },
    xp_before: {
        risk_taker: { type: Number, required: true },
        analyst: { type: Number, required: true },
        builder: { type: Number, required: true },
        strategist: { type: Number, required: true },
        total: { type: Number, required: true }
    },
    xp_after: {
        risk_taker: { type: Number, required: true },
        analyst: { type: Number, required: true },
        builder: { type: Number, required: true },
        strategist: { type: Number, required: true },
        total: { type: Number, required: true }
    },
    xp_change: {
        risk_taker: { type: Number, default: 0 },
        analyst: { type: Number, default: 0 },
        builder: { type: Number, default: 0 },
        strategist: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },
    source: {
        type: String,
        enum: ['arena_submit'], // ONLY source allowed - no admin injection
        required: true
    },
    session_id: {
        type: String,
        index: true
    },
    problem_id: {
        type: String
    },
    problem_difficulty: {
        type: Number
    },
    evaluation_summary: {
        type: String,
        maxLength: 500
    },
    metadata: {
        courage_xp: Number,
        accuracy_xp: Number,
        stagnation_detected: Boolean,
        exploit_detected: Boolean
    },
    created_at: {
        type: Date,
        default: Date.now,
        immutable: true // Cannot be changed after creation
    }
}, {
    timestamps: false // No updatedAt - this is immutable
});

// CRITICAL: Prevent any updates
xpAuditLogSchema.pre('findOneAndUpdate', function () {
    throw new Error('XP Audit Logs are immutable - updates not allowed');
});

xpAuditLogSchema.pre('updateOne', function () {
    throw new Error('XP Audit Logs are immutable - updates not allowed');
});

xpAuditLogSchema.pre('updateMany', function () {
    throw new Error('XP Audit Logs are immutable - updates not allowed');
});

// CRITICAL: Prevent deletes
xpAuditLogSchema.pre('findOneAndDelete', function () {
    throw new Error('XP Audit Logs are immutable - deletes not allowed');
});

xpAuditLogSchema.pre('deleteOne', function () {
    throw new Error('XP Audit Logs are immutable - deletes not allowed');
});

xpAuditLogSchema.pre('deleteMany', function () {
    throw new Error('XP Audit Logs are immutable - deletes not allowed');
});

// Indexes for efficient querying
xpAuditLogSchema.index({ user_id: 1, created_at: -1 });
xpAuditLogSchema.index({ session_id: 1 });
xpAuditLogSchema.index({ created_at: -1 });

export default mongoose.model('XPAuditLog', xpAuditLogSchema);
