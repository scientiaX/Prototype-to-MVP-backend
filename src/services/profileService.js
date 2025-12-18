export const calculateProfile = (answers) => {
  let risk_appetite = 0.5;
  let decision_speed = 0.5;
  let ambiguity_tolerance = 0.5;
  let experience_depth = 0.5;

  if (answers.thinking_style === 'fast') {
    decision_speed = 0.8;
    risk_appetite += 0.1;
  } else if (answers.thinking_style === 'accurate') {
    decision_speed = 0.3;
    ambiguity_tolerance -= 0.1;
  } else if (answers.thinking_style === 'explorative') {
    ambiguity_tolerance = 0.7;
    decision_speed = 0.5;
  }

  if (answers.regret === 'too_slow') {
    risk_appetite -= 0.15;
  } else {
    risk_appetite += 0.15;
  }

  if (answers.avoided_risk === 'financial') {
    risk_appetite -= 0.1;
  } else if (answers.avoided_risk === 'reputation') {
    ambiguity_tolerance -= 0.1;
  } else if (answers.avoided_risk === 'time') {
    decision_speed += 0.1;
  }

  if (answers.aspiration === 'expert') {
    experience_depth = 0.7;
  } else if (answers.aspiration === 'founder') {
    risk_appetite += 0.1;
  }

  risk_appetite = Math.max(0.1, Math.min(0.9, risk_appetite));
  decision_speed = Math.max(0.1, Math.min(0.9, decision_speed));
  ambiguity_tolerance = Math.max(0.1, Math.min(0.9, ambiguity_tolerance));
  experience_depth = Math.max(0.1, Math.min(0.9, experience_depth));

  const avgScore = (risk_appetite + decision_speed + ambiguity_tolerance + experience_depth) / 4;
  let starting_difficulty = Math.ceil(avgScore * 5);
  starting_difficulty = Math.max(1, Math.min(5, starting_difficulty));

  const scores = {
    risk_taker: risk_appetite + (decision_speed * 0.5),
    analyst: (1 - risk_appetite) + experience_depth,
    builder: decision_speed + (1 - ambiguity_tolerance) * 0.5,
    strategist: ambiguity_tolerance + experience_depth
  };

  const primary_archetype = Object.entries(scores).reduce((a, b) =>
    scores[a[0]] > scores[b[0]] ? a : b
  )[0];

  return {
    risk_appetite,
    decision_speed,
    ambiguity_tolerance,
    experience_depth,
    current_difficulty: starting_difficulty,
    primary_archetype,
    xp_risk_taker: 0,
    xp_analyst: 0,
    xp_builder: 0,
    xp_strategist: 0,
    // New: Level per archetype
    level_risk_taker: 1,
    level_analyst: 1,
    level_builder: 1,
    level_strategist: 1,
    // New: XP thresholds for next level
    xp_to_next_level: {
      risk_taker: 100,
      analyst: 100,
      builder: 100,
      strategist: 100
    },
    // New: Micro-difficulty offset
    micro_difficulty_offset: 0,
    total_arenas_completed: 0,
    highest_difficulty_conquered: 0,
    calibration_completed: true,
    domain: answers.domain,
    aspiration: answers.aspiration,
    thinking_style: answers.thinking_style,
    last_stuck_experience: answers.stuck_experience,
    avoided_risk: answers.avoided_risk,
    common_regret: answers.regret
  };
};

/**
 * Calculate XP distribution based on AI evaluation
 * Now considers stagnation detection and assigns XP per archetype
 */
export const calculateXPDistribution = (evaluation, selectedProblem, profile) => {
  // Base XP from AI evaluation (0-20 per archetype)
  const xpBreakdown = {
    risk_taker: Math.max(0, Math.min(20, evaluation.xp_risk_taker || 0)),
    analyst: Math.max(0, Math.min(20, evaluation.xp_analyst || 0)),
    builder: Math.max(0, Math.min(20, evaluation.xp_builder || 0)),
    strategist: Math.max(0, Math.min(20, evaluation.xp_strategist || 0))
  };

  // Total XP as sum of archetype XP
  let totalXp = Object.values(xpBreakdown).reduce((a, b) => a + b, 0);

  // Apply difficulty multiplier if achieved level up
  if (selectedProblem.difficulty >= profile.current_difficulty && evaluation.level_up_achieved) {
    const difficultyBonus = 1 + (selectedProblem.difficulty - profile.current_difficulty) * 0.2;
    const qualityMultiplier = evaluation.quality_score || 1;

    Object.keys(xpBreakdown).forEach(key => {
      xpBreakdown[key] = Math.round(xpBreakdown[key] * difficultyBonus * qualityMultiplier);
    });

    totalXp = Math.round(totalXp * difficultyBonus * qualityMultiplier);
  }

  // If stagnation detected, reduce XP
  if (evaluation.stagnation_detected) {
    Object.keys(xpBreakdown).forEach(key => {
      xpBreakdown[key] = Math.floor(xpBreakdown[key] * 0.3); // 70% reduction
    });
    totalXp = Math.floor(totalXp * 0.3);
  }

  return { totalXp, xpBreakdown };
};

/**
 * Update primary archetype based on highest XP
 */
export const updateArchetype = (profile) => {
  const xpValues = {
    risk_taker: profile.xp_risk_taker || 0,
    analyst: profile.xp_analyst || 0,
    builder: profile.xp_builder || 0,
    strategist: profile.xp_strategist || 0
  };

  return Object.entries(xpValues).reduce((a, b) =>
    xpValues[a[0]] > xpValues[b[0]] ? a : b
  )[0];
};

/**
 * Calculate level progression for each archetype
 * Returns level changes and new thresholds
 */
export const calculateLevelProgression = (profile, xpBreakdown) => {
  const archetypes = ['risk_taker', 'analyst', 'builder', 'strategist'];
  const levelChanges = {};
  const newThresholds = { ...profile.xp_to_next_level };

  archetypes.forEach(archetype => {
    const currentXp = profile[`xp_${archetype}`] + xpBreakdown[archetype];
    const currentLevel = profile[`level_${archetype}`] || 1;
    const threshold = profile.xp_to_next_level?.[archetype] || 100;

    if (currentXp >= threshold) {
      // Level up!
      const newLevel = currentLevel + 1;
      const overflowXp = currentXp - threshold;

      // Next threshold increases by 20% per level
      const newThreshold = Math.round(threshold * 1.2);

      levelChanges[archetype] = {
        old_level: currentLevel,
        new_level: newLevel,
        overflow_xp: overflowXp
      };

      newThresholds[archetype] = newThreshold;
    }
  });

  return { levelChanges, newThresholds };
};

/**
 * Calculate micro-difficulty adjustment based on XP gain
 * This creates fine-grained difficulty scaling within the same level
 */
export const calculateMicroDifficultyAdjustment = (profile, totalXpGain) => {
  const currentOffset = profile.micro_difficulty_offset || 0;

  // If user gained XP, slightly increase micro-difficulty
  // If no XP gain, slightly decrease (make it slightly easier)
  let adjustment;
  if (totalXpGain > 30) {
    adjustment = 0.1; // Good performance, increase challenge
  } else if (totalXpGain > 10) {
    adjustment = 0.05; // Moderate performance
  } else if (totalXpGain > 0) {
    adjustment = 0.02; // Some performance
  } else {
    adjustment = -0.05; // No XP, decrease difficulty slightly
  }

  // Clamp between -0.5 and 0.5
  const newOffset = Math.max(-0.5, Math.min(0.5, currentOffset + adjustment));

  return newOffset;
};

/**
 * Check if aggregate level should increase
 * Aggregate level (current_difficulty) increases when multiple archetype levels advance
 */
export const shouldIncreaseAggregateLevel = (profile, levelChanges) => {
  // Calculate average archetype level
  const archetypes = ['risk_taker', 'analyst', 'builder', 'strategist'];
  let totalLevels = 0;

  archetypes.forEach(archetype => {
    const level = levelChanges[archetype]?.new_level || profile[`level_${archetype}`] || 1;
    totalLevels += level;
  });

  const avgLevel = totalLevels / 4;

  // If average level exceeds current difficulty, increase it
  return Math.floor(avgLevel) > profile.current_difficulty;
};

export default {
  calculateProfile,
  calculateXPDistribution,
  updateArchetype,
  calculateLevelProgression,
  calculateMicroDifficultyAdjustment,
  shouldIncreaseAggregateLevel
};
