import mongoose from 'mongoose';

/**
 * Artifact Model - IMMUTABLE by design
 * 
 * SPEC #4: Irreversibility Formal
 * - Artifacts are immutable by default
 * - No hard delete allowed
 * - Changes only via append/versioning
 */
const artifactSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  problem_id: {
    type: String,
    required: true
  },
  problem_title: {
    type: String,
    required: true
  },
  difficulty: {
    type: Number,
    required: true
  },
  archetype_role: {
    type: String,
    enum: ['risk_taker', 'analyst', 'builder', 'strategist']
  },
  solution_summary: {
    type: String,
    required: true
  },
  insight: {
    type: String
  },
  level_up_verified: {
    type: Boolean,
    default: false
  },
  arena_session_id: {
    type: String,
    required: true
  },
  conquered_at: {
    type: Date,
    default: Date.now
  },

  // ==========================================
  // SPEC #4: Immutability & Versioning
  // ==========================================
  is_immutable: {
    type: Boolean,
    default: true
  },
  version: {
    type: Number,
    default: 1
  },
  supersedes: {
    type: String // Previous artifact _id if this is an updated version
  },
  superseded_by: {
    type: String // New artifact _id that superseded this one
  },
  event_source: {
    type: String,
    enum: ['arena_completion', 'level_up', 'achievement'],
    default: 'arena_completion'
  },
  // XP at the time of artifact creation (snapshot)
  xp_snapshot: {
    risk_taker: { type: Number, default: 0 },
    analyst: { type: Number, default: 0 },
    builder: { type: Number, default: 0 },
    strategist: { type: Number, default: 0 }
  }
}, {
  timestamps: true
});

// ==========================================
// IMMUTABILITY MIDDLEWARE
// ==========================================

// Prevent direct updates
artifactSchema.pre('findOneAndUpdate', function (next) {
  const error = new Error('Artifacts are immutable - updates not allowed. Create a new version instead.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

artifactSchema.pre('updateOne', function (next) {
  const error = new Error('Artifacts are immutable - updates not allowed. Create a new version instead.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

artifactSchema.pre('updateMany', function (next) {
  const error = new Error('Artifacts are immutable - updates not allowed. Create a new version instead.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

// Prevent direct deletes
artifactSchema.pre('findOneAndDelete', function (next) {
  const error = new Error('Artifacts are immutable - deletes not allowed.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

artifactSchema.pre('deleteOne', function (next) {
  const error = new Error('Artifacts are immutable - deletes not allowed.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

artifactSchema.pre('deleteMany', function (next) {
  const error = new Error('Artifacts are immutable - deletes not allowed.');
  error.code = 'IMMUTABLE_ARTIFACT';
  return next(error);
});

// ==========================================
// VERSIONING METHODS
// ==========================================

/**
 * Create a new version of an artifact (append-only update)
 * Instead of updating, we create a new artifact and link them
 */
artifactSchema.statics.createNewVersion = async function (originalId, updates) {
  const original = await this.findById(originalId);
  if (!original) {
    throw new Error('Original artifact not found');
  }

  // Create new artifact with updated data
  const newArtifact = await this.create({
    ...original.toObject(),
    _id: new mongoose.Types.ObjectId(),
    version: original.version + 1,
    supersedes: original._id.toString(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...updates
  });

  // Mark original as superseded (bypass middleware for this specific case)
  await this.collection.updateOne(
    { _id: original._id },
    { $set: { superseded_by: newArtifact._id.toString() } }
  );

  return newArtifact;
};

/**
 * Get artifact history (all versions)
 */
artifactSchema.statics.getArtifactHistory = async function (artifactId) {
  const artifact = await this.findById(artifactId);
  if (!artifact) return [];

  const history = [artifact];

  // Get all previous versions
  let current = artifact;
  while (current.supersedes) {
    const prev = await this.findById(current.supersedes);
    if (!prev) break;
    history.unshift(prev);
    current = prev;
  }

  // Get all newer versions
  current = artifact;
  while (current.superseded_by) {
    const next = await this.findById(current.superseded_by);
    if (!next) break;
    history.push(next);
    current = next;
  }

  return history;
};

export default mongoose.model('Artifact', artifactSchema);

