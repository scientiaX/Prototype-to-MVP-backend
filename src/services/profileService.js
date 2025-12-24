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

  // Avoided risk affects profile
  if (answers.avoided_risk === 'financial') {
    risk_appetite -= 0.1;
  } else if (answers.avoided_risk === 'reputation') {
    ambiguity_tolerance -= 0.1;
  } else if (answers.avoided_risk === 'time') {
    decision_speed += 0.1;
  } else if (answers.avoided_risk === 'opportunity') {
    risk_appetite += 0.05;
    decision_speed += 0.05;
  } else if (answers.avoided_risk === 'career') {
    ambiguity_tolerance -= 0.05;
    risk_appetite -= 0.05;
  } else if (answers.avoided_risk === 'disappointment') {
    experience_depth += 0.1;
  } else if (answers.avoided_risk === 'health') {
    decision_speed -= 0.1;
  }

  // Aspiration affects profile
  if (answers.aspiration === 'expert' || answers.aspiration === 'cto') {
    experience_depth = 0.7;
  } else if (answers.aspiration === 'founder' || answers.aspiration === 'ceo') {
    risk_appetite += 0.1;
  } else if (answers.aspiration === 'investor') {
    risk_appetite += 0.15;
    ambiguity_tolerance += 0.1;
  } else if (answers.aspiration === 'freelancer') {
    risk_appetite += 0.05;
    decision_speed += 0.1;
  } else if (answers.aspiration === 'product_lead') {
    decision_speed += 0.1;
    experience_depth += 0.05;
  } else if (answers.aspiration === 'creator' || answers.aspiration === 'artist') {
    ambiguity_tolerance += 0.1;
  } else if (answers.aspiration === 'leader' || answers.aspiration === 'cxo') {
    experience_depth += 0.1;
    ambiguity_tolerance += 0.05;
  } else if (answers.aspiration === 'strategist') {
    ambiguity_tolerance += 0.15;
    experience_depth += 0.1;
  } else if (answers.aspiration === 'innovator') {
    ambiguity_tolerance += 0.1;
    risk_appetite += 0.05;
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
 * ============================================
 * FRIKSI #2: COURAGE-BASED XP CALCULATION
 * ============================================
 * 
 * XP diberikan untuk KEBERANIAN, bukan hanya KEBENARAN.
 * Courage XP comes FIRST, accuracy XP comes second.
 * 
 * Prinsip: "Game memberi reward sebelum mastery"
 */

/**
 * Calculate courage XP - rewards for trying, not correctness
 * @param {Object} sessionData - Session metrics and behavior data
 */
export const calculateCourageXP = (sessionData = {}) => {
  let courageXP = 0;
  const courageBreakdown = {};

  // XP for quick first action (under 30 seconds)
  if (sessionData.first_action_time_ms && sessionData.first_action_time_ms < 30000) {
    const quickActionXP = 5;
    courageBreakdown.quick_action = quickActionXP;
    courageXP += quickActionXP;
  }

  // XP for trying different approaches
  if (sessionData.unique_approaches && sessionData.unique_approaches > 1) {
    const explorationXP = Math.min(sessionData.unique_approaches * 3, 12);
    courageBreakdown.exploration = explorationXP;
    courageXP += explorationXP;
  }

  // XP for completing reflection (even optional)
  if (sessionData.completed_reflection) {
    const reflectionXP = 10;
    courageBreakdown.reflection = reflectionXP;
    courageXP += reflectionXP;
  }

  // XP for making prediction attempt (regardless of accuracy)
  if (sessionData.made_prediction) {
    const predictionXP = 5;
    courageBreakdown.prediction = predictionXP;
    courageXP += predictionXP;
  }

  // XP for completing entry flow
  if (sessionData.completed_entry_flow) {
    const entryFlowXP = 8;
    courageBreakdown.entry_flow = entryFlowXP;
    courageXP += entryFlowXP;
  }

  // XP for engagement (number of exchanges)
  if (sessionData.exchange_count && sessionData.exchange_count >= 3) {
    const engagementXP = Math.min(sessionData.exchange_count * 2, 10);
    courageBreakdown.engagement = engagementXP;
    courageXP += engagementXP;
  }

  return { courageXP, courageBreakdown };
};

/**
 * Calculate XP distribution based on AI evaluation
 * Now includes COURAGE XP before accuracy XP (Friksi #2)
 */
export const calculateXPDistribution = (evaluation, selectedProblem, profile, sessionData = {}) => {
  // STEP 1: Calculate COURAGE XP first (Friksi #2)
  const { courageXP, courageBreakdown } = calculateCourageXP(sessionData);

  // STEP 2: Calculate accuracy-based XP from AI evaluation (0-20 per archetype)
  const accuracyBreakdown = {
    risk_taker: Math.max(0, Math.min(20, evaluation.xp_risk_taker || 0)),
    analyst: Math.max(0, Math.min(20, evaluation.xp_analyst || 0)),
    builder: Math.max(0, Math.min(20, evaluation.xp_builder || 0)),
    strategist: Math.max(0, Math.min(20, evaluation.xp_strategist || 0))
  };

  // Calculate base accuracy XP
  let accuracyXP = Object.values(accuracyBreakdown).reduce((a, b) => a + b, 0);

  // Apply difficulty multiplier if achieved level up
  if (selectedProblem.difficulty >= profile.current_difficulty && evaluation.level_up_achieved) {
    const difficultyBonus = 1 + (selectedProblem.difficulty - profile.current_difficulty) * 0.2;
    const qualityMultiplier = evaluation.quality_score || 1;

    Object.keys(accuracyBreakdown).forEach(key => {
      accuracyBreakdown[key] = Math.round(accuracyBreakdown[key] * difficultyBonus * qualityMultiplier);
    });

    accuracyXP = Math.round(accuracyXP * difficultyBonus * qualityMultiplier);
  }

  // If stagnation detected, reduce ACCURACY XP (not courage XP)
  if (evaluation.stagnation_detected) {
    Object.keys(accuracyBreakdown).forEach(key => {
      accuracyBreakdown[key] = Math.floor(accuracyBreakdown[key] * 0.3);
    });
    accuracyXP = Math.floor(accuracyXP * 0.3);
  }

  // STEP 3: Combine into final breakdown
  // Courage XP is distributed evenly across archetypes for now
  const couragePerArchetype = Math.floor(courageXP / 4);
  const xpBreakdown = {
    // NEW: Courage XP comes first
    courage: courageXP,
    courage_breakdown: courageBreakdown,
    // Then accuracy per archetype
    risk_taker: accuracyBreakdown.risk_taker + couragePerArchetype,
    analyst: accuracyBreakdown.analyst + couragePerArchetype,
    builder: accuracyBreakdown.builder + couragePerArchetype,
    strategist: accuracyBreakdown.strategist + couragePerArchetype
  };

  // Total XP = Courage + Accuracy
  const totalXp = courageXP + accuracyXP;

  return { totalXp, xpBreakdown, courageXP, accuracyXP };
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
  calculateCourageXP, // NEW: Friksi #2
  updateArchetype,
  calculateLevelProgression,
  calculateMicroDifficultyAdjustment,
  shouldIncreaseAggregateLevel
};

