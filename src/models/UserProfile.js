import mongoose from 'mongoose';

const userProfileSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    default: ''
  },
  language: {
    type: String,
    enum: ['en', 'id'],
    default: 'en'
  },
  risk_appetite: {
    type: Number,
    min: 0.1,
    max: 0.9,
    default: 0.5
  },
  decision_speed: {
    type: Number,
    min: 0.1,
    max: 0.9,
    default: 0.5
  },
  ambiguity_tolerance: {
    type: Number,
    min: 0.1,
    max: 0.9,
    default: 0.5
  },
  experience_depth: {
    type: Number,
    min: 0.1,
    max: 0.9,
    default: 0.5
  },
  current_difficulty: {
    type: Number,
    min: 1,
    max: 10,
    default: 1
  },
  highest_difficulty_conquered: {
    type: Number,
    min: 0,
    max: 10,
    default: 0
  },
  primary_archetype: {
    type: String,
    enum: ['risk_taker', 'analyst', 'builder', 'strategist'],
    default: 'analyst'
  },
  xp_risk_taker: {
    type: Number,
    default: 0
  },
  xp_analyst: {
    type: Number,
    default: 0
  },
  xp_builder: {
    type: Number,
    default: 0
  },
  xp_strategist: {
    type: Number,
    default: 0
  },
  // Level per archetype (independent progression)
  level_risk_taker: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  level_analyst: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  level_builder: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  level_strategist: {
    type: Number,
    default: 1,
    min: 1,
    max: 100
  },
  // XP thresholds for next level (personalized, increases with level)
  xp_to_next_level: {
    risk_taker: { type: Number, default: 100 },
    analyst: { type: Number, default: 100 },
    builder: { type: Number, default: 100 },
    strategist: { type: Number, default: 100 }
  },
  // Micro-difficulty adjustment (within same level for accuracy)
  micro_difficulty_offset: {
    type: Number,
    default: 0,
    min: -0.5,
    max: 0.5
  },
  total_arenas_completed: {
    type: Number,
    default: 0
  },
  // ==========================================
  // STREAK & PROGRESS TRACKING
  // ==========================================
  current_streak: {
    type: Number,
    default: 0
  },
  longest_streak: {
    type: Number,
    default: 0
  },
  last_arena_date: {
    type: Date
  },
  monthly_arenas: [{
    month: { type: String }, // Format: "2026-01"
    count: { type: Number, default: 0 }
  }],
  calibration_completed: {
    type: Boolean,
    default: false
  },
  // Age group for personalized experience
  age_group: {
    type: String,
    enum: ['smp', 'sma', 'adult'],
    default: 'adult'
  },
  domain: {
    type: String,
    enum: ['business', 'tech', 'creative', 'leadership', 'academic', 'gaming', 'social', 'explore', 'finance', 'science', 'product']
  },
  aspiration: {
    type: String,
    enum: ['founder', 'expert', 'leader', 'innovator', 'ceo', 'investor', 'freelancer', 'product_lead', 'cto', 'creator', 'artist', 'strategist', 'cxo']
  },
  thinking_style: {
    type: String,
    enum: ['fast', 'accurate', 'explorative', 'collaborative', 'creative', 'systematic', 'intuitive']
  },
  last_stuck_experience: {
    type: String,
    enum: ['decision', 'execution', 'direction', 'resource', 'scaling', 'delegation', 'perfectionism', 'overwhelm', 'confidence', 'motivation']
  },
  avoided_risk: {
    type: String,
    enum: ['financial', 'reputation', 'time', 'relationship', 'opportunity', 'career', 'disappointment', 'health']
  },
  common_regret: {
    type: String,
    enum: ['too_slow', 'too_reckless', 'too_safe']
  },
  // Experience level from onboarding
  experience_level: {
    type: String,
    enum: ['curious', 'beginner', 'learning', 'intermediate', 'advanced', 'expert']
  },
  // User's proof/achievements for their experience
  experience_proof: {
    type: String,
    maxLength: 1000
  },

  // ==========================================
  // SPEC #6: XP State Machine & Stagnation
  // ==========================================
  xp_state: {
    type: String,
    enum: ['progressing', 'stagnating', 'frozen'],
    default: 'progressing'
  },
  stagnation_count: {
    type: Number,
    default: 0
  },
  xp_frozen_until: {
    type: Date
  },

  // ==========================================
  // SPEC #3: Exploit Cooldown Tracking
  // ==========================================
  exploit_cooldown_until: {
    type: Date
  },
  exploit_history: [{
    detected_at: { type: Date, default: Date.now },
    exploit_type: { type: String, enum: ['pattern_replay', 'role_switching', 'cooperative_farming'] },
    cooldown_applied: { type: Number } // Duration in ms
  }],

  // ==========================================
  // SPEC #7: Identity Binding (Anti-Reset)
  // ==========================================
  device_fingerprints: [{
    fingerprint: { type: String },
    device_info: { type: String },
    first_seen: { type: Date, default: Date.now },
    last_seen: { type: Date, default: Date.now }
  }],
  linked_accounts: [{
    type: String // Other user_ids linked to this identity
  }]
}, {
  timestamps: true
});

userProfileSchema.methods.getTotalXP = function () {
  return this.xp_risk_taker + this.xp_analyst + this.xp_builder + this.xp_strategist;
};

export default mongoose.model('UserProfile', userProfileSchema);
