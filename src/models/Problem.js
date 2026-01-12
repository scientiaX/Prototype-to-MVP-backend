import mongoose from 'mongoose';

const problemSchema = new mongoose.Schema({
  problem_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  context: {
    type: String,
    required: true
  },
  objective: {
    type: String,
    required: true
  },
  constraints: [{
    type: String
  }],
  difficulty: {
    type: Number,
    min: 1,
    max: 10,
    required: true
  },
  level_up_criteria: [{
    type: String
  }],
  domain: {
    type: String,
    enum: ['business', 'tech', 'creative', 'leadership', 'mixed']
  },
  // Role label describes "who you are" in the problem, not which archetype
  role_label: {
    type: String,
    enum: ['ceo', 'product_manager', 'engineer', 'designer', 'founder',
      'consultant', 'investor', 'operations', 'team_lead', 'analyst']
  },
  // Keep archetype_focus for backward compatibility but deprecated
  archetype_focus: {
    type: String,
    enum: ['risk_taker', 'analyst', 'builder', 'strategist', 'all']
  },
  // Personalization metadata (for AI-generated problems)
  generated_for_user: {
    type: String,
    index: true
  },
  personalization_factors: {
    // Archetypes to train (user's weak points)
    target_archetype_training: [{
      type: String,
      enum: ['risk_taker', 'analyst', 'builder', 'strategist']
    }],
    // Archetypes to sharpen (user's strong points)
    target_archetype_sharpening: [{
      type: String,
      enum: ['risk_taker', 'analyst', 'builder', 'strategist']
    }],
    // Fine-tuned difficulty adjustment for this specific problem
    difficulty_micro_adjustment: {
      type: Number,
      default: 0,
      min: -1,
      max: 1
    },
    // Why this problem was generated
    generation_reasoning: String
  },
  estimated_time_minutes: {
    type: Number,
    default: 30
  },
  // Duration type label for arena classification
  duration_type: {
    type: String,
    enum: ['quick', 'standard'], // quick = 10 min, standard = 30 min
    default: 'standard'
  },
  is_active: {
    type: Boolean,
    default: true
  },
  created_by: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('Problem', problemSchema);
