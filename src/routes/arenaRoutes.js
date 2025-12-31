import express from 'express';
import ArenaSession from '../models/ArenaSession.js';
import UserProfile from '../models/UserProfile.js';
import Problem from '../models/Problem.js';
import Achievement from '../models/Achievement.js';
import Artifact from '../models/Artifact.js';
import { evaluateSolution } from '../services/aiService.js';
import { updateArchetype } from '../services/profileService.js';
import * as orchestratorService from '../services/orchestratorService.js';
import * as xpGuardService from '../services/xpGuardService.js';
import * as exploitDetectionService from '../services/exploitDetectionService.js';

const router = express.Router();

router.post('/start', async (req, res) => {
  try {
    const { user_id, problem_id } = req.body;

    if (!user_id || !problem_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const profile = await UserProfile.findOne({ user_id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // SPEC #3: Check if user is in exploit cooldown
    const cooldownCheck = await exploitDetectionService.isInCooldown(user_id);
    if (cooldownCheck.in_cooldown) {
      return res.status(429).json({
        error: 'Cooldown active',
        cooldown_until: cooldownCheck.until,
        remaining_seconds: cooldownCheck.remaining_seconds
      });
    }

    const session = await ArenaSession.create({
      user_id,
      problem_id,
      status: 'in_progress',
      started_at: new Date(),
      difficulty_at_start: profile.current_difficulty,
      archetype_at_start: profile.primary_archetype
    });

    res.json(session);
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const { session_id, solution, time_elapsed, session_data } = req.body;

    if (!session_id || !solution) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const session = await ArenaSession.findById(session_id);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const problem = await Problem.findOne({ problem_id: session.problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    const profile = await UserProfile.findOne({ user_id: session.user_id });
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // ==========================================
    // SPEC #6: Check XP Freeze State
    // ==========================================
    const freezeCheck = await xpGuardService.isXPFrozen(session.user_id);
    if (freezeCheck.frozen) {
      return res.status(429).json({
        error: 'XP is frozen',
        frozen_until: freezeCheck.until,
        reason: 'Your XP is temporarily frozen. You can still practice but will not earn XP.'
      });
    }

    // ==========================================
    // SPEC #3: Check Exploit Cooldown
    // ==========================================
    const cooldownCheck = await exploitDetectionService.isInCooldown(session.user_id);
    if (cooldownCheck.in_cooldown) {
      return res.status(429).json({
        error: 'Cooldown active',
        cooldown_until: cooldownCheck.until,
        remaining_seconds: cooldownCheck.remaining_seconds
      });
    }

    // ==========================================
    // SPEC #3: Run Exploit Detection BEFORE XP Award
    // ==========================================
    const exploitCheck = await exploitDetectionService.runFullExploitCheck(
      session.user_id,
      solution,
      session_id,
      problem.problem_id
    );

    if (exploitCheck.any_exploit_detected) {
      // Record exploit in profile history
      profile.exploit_history = profile.exploit_history || [];
      profile.exploit_history.push({
        detected_at: new Date(),
        exploit_type: exploitCheck.cooldown.reason.includes('pattern') ? 'pattern_replay' :
          exploitCheck.cooldown.reason.includes('switching') ? 'role_switching' : 'cooperative_farming',
        cooldown_applied: exploitCheck.cooldown.duration_ms
      });
      await profile.save();

      return res.status(429).json({
        error: 'Exploit detected',
        exploit_type: exploitCheck.cooldown.reason,
        cooldown_seconds: exploitCheck.cooldown.duration_ms / 1000,
        cooldown_until: new Date(Date.now() + exploitCheck.cooldown.duration_ms)
      });
    }

    // ==========================================
    // AI Evaluation (unchanged)
    // ==========================================
    const evaluation = await evaluateSolution(problem, solution, time_elapsed);

    // ==========================================
    // SPEC #1 & #8: Isolated XP Calculation with Audit
    // ==========================================
    // Capture XP before changes
    const xpBefore = {
      risk_taker: profile.xp_risk_taker,
      analyst: profile.xp_analyst,
      builder: profile.xp_builder,
      strategist: profile.xp_strategist
    };

    // Use isolated XP calculation (SPEC #1)
    const { totalXp, xpBreakdown, courageXP, accuracyXP } = await xpGuardService.calculateIsolatedXP(
      evaluation,
      problem,
      profile,
      session_data || {}
    );

    // Validate XP award (SPEC #8)
    const validation = xpGuardService.validateXPAward(xpBreakdown, 'arena_submit');
    if (!validation.valid) {
      console.error('XP validation failed:', validation.error);
      return res.status(400).json({ error: 'XP validation failed', details: validation.error });
    }

    // Update session
    session.status = 'evaluated';
    session.submitted_at = new Date();
    session.solution_text = solution;
    session.xp_earned = totalXp;
    session.xp_breakdown = xpBreakdown;
    session.level_up_achieved = evaluation.level_up_achieved;
    session.criteria_met = evaluation.criteria_met;
    session.ai_evaluation = evaluation.evaluation;
    session.ai_insight = evaluation.insight;
    session.time_spent_seconds = time_elapsed;
    await session.save();

    // Update profile XP
    profile.xp_risk_taker += xpBreakdown.risk_taker || 0;
    profile.xp_analyst += xpBreakdown.analyst || 0;
    profile.xp_builder += xpBreakdown.builder || 0;
    profile.xp_strategist += xpBreakdown.strategist || 0;
    profile.total_arenas_completed += 1;

    // Capture XP after changes
    const xpAfter = {
      risk_taker: profile.xp_risk_taker,
      analyst: profile.xp_analyst,
      builder: profile.xp_builder,
      strategist: profile.xp_strategist
    };

    // ==========================================
    // SPEC #8: Create Immutable Audit Log
    // ==========================================
    await xpGuardService.createXPAuditLog(
      session.user_id,
      'award',
      xpBefore,
      xpAfter,
      'arena_submit',
      {
        session_id: session_id,
        problem_id: problem.problem_id,
        problem_difficulty: problem.difficulty,
        evaluation_summary: evaluation.evaluation?.substring(0, 200),
        courage_xp: courageXP,
        accuracy_xp: accuracyXP,
        stagnation_detected: evaluation.stagnation_detected,
        exploit_detected: false
      }
    );

    // ==========================================
    // SPEC #6: Update Stagnation State
    // ==========================================
    await xpGuardService.updateStagnationState(session.user_id, totalXp);

    // Level up handling with IMMUTABLE Artifact (SPEC #4)
    if (evaluation.level_up_achieved && problem.difficulty > profile.current_difficulty) {
      profile.current_difficulty = problem.difficulty;
      profile.highest_difficulty_conquered = Math.max(
        profile.highest_difficulty_conquered,
        problem.difficulty
      );

      await Achievement.create({
        user_id: session.user_id,
        achievement_id: `ACH-${Date.now()}`,
        title: `Conquered Level ${problem.difficulty}`,
        description: `Menyelesaikan ${problem.title} di difficulty ${problem.difficulty}`,
        archetype_at_achievement: profile.primary_archetype,
        difficulty_level: problem.difficulty,
        problem_id: problem.problem_id,
        achieved_at: new Date(),
        badge_type: 'difficulty_jump',
        is_highest: problem.difficulty > profile.highest_difficulty_conquered
      });

      // Create IMMUTABLE Artifact with XP snapshot (SPEC #4)
      await Artifact.create({
        user_id: session.user_id,
        problem_id: problem.problem_id,
        problem_title: problem.title,
        difficulty: problem.difficulty,
        archetype_role: profile.primary_archetype,
        solution_summary: solution.substring(0, 500),
        insight: evaluation.insight,
        level_up_verified: true,
        arena_session_id: session._id.toString(),
        conquered_at: new Date(),
        event_source: 'level_up',
        xp_snapshot: xpAfter
      });
    }

    profile.primary_archetype = updateArchetype(profile);
    await profile.save();

    res.json({
      session,
      evaluation,
      xp_earned: totalXp,
      xp_breakdown: xpBreakdown,
      updated_profile: profile,
      xp_state: profile.xp_state,
      stagnation_count: profile.stagnation_count
    });
  } catch (error) {
    console.error('Submit session error:', error);
    res.status(500).json({ error: 'Failed to submit session' });
  }
});

router.post('/abandon', async (req, res) => {
  try {
    const { session_id } = req.body;

    const session = await ArenaSession.findByIdAndUpdate(
      session_id,
      { status: 'abandoned' },
      { new: true }
    );

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Also cleanup orchestrator session
    await orchestratorService.abandonSession(session_id);

    res.json(session);
  } catch (error) {
    console.error('Abandon session error:', error);
    res.status(500).json({ error: 'Failed to abandon session' });
  }
});

router.get('/user/:user_id', async (req, res) => {
  try {
    const sessions = await ArenaSession.find({ user_id: req.params.user_id })
      .sort({ started_at: -1 });

    res.json(sessions);
  } catch (error) {
    console.error('Get sessions error:', error);
    res.status(500).json({ error: 'Failed to get sessions' });
  }
});

// ==========================================
// REAL-TIME TRACKING ENDPOINTS
// ==========================================

/**
 * Initialize orchestrator session (called after /start)
 */
router.post('/init-session', async (req, res) => {
  try {
    const { session_id, problem_id, user_id } = req.body;

    if (!session_id || !problem_id || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await orchestratorService.initializeSession(session_id, problem_id, user_id);

    res.json({
      initialized: true,
      timeouts: result.timeouts
    });
  } catch (error) {
    console.error('Init session error:', error);
    res.status(500).json({ error: 'Failed to initialize session' });
  }
});

/**
 * Real-time keystroke tracking
 */
router.post('/track', async (req, res) => {
  try {
    const { session_id, keystroke_data } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Session ID required' });
    }

    const result = await orchestratorService.processUserKeystrokes(session_id, keystroke_data);
    res.json(result);
  } catch (error) {
    console.error('Track keystroke error:', error);
    res.status(500).json({ error: 'Failed to track keystroke' });
  }
});

/**
 * Get next AI action (polling endpoint for real-time interventions)
 */
router.get('/next-action/:session_id', async (req, res) => {
  try {
    const action = await orchestratorService.requestNextAction(req.params.session_id);
    res.json(action);
  } catch (error) {
    console.error('Next action error:', error);
    res.status(500).json({ error: 'Failed to get next action' });
  }
});

/**
 * Handle user response to AI intervention
 */
router.post('/intervention-response', async (req, res) => {
  try {
    const { session_id, response_type } = req.body;

    if (!session_id || !response_type) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await orchestratorService.handleInterventionResponse(session_id, response_type);
    res.json(result);
  } catch (error) {
    console.error('Intervention response error:', error);
    res.status(500).json({ error: 'Failed to handle intervention response' });
  }
});

/**
 * Get session metrics (for debugging/analytics)
 */
router.get('/metrics/:session_id', async (req, res) => {
  try {
    const ArenaSessionMetrics = (await import('../models/ArenaSessionMetrics.js')).default;
    const SessionMemory = (await import('../models/SessionMemory.js')).default;

    const metrics = await ArenaSessionMetrics.findOne({ session_id: req.params.session_id });
    const memory = await SessionMemory.findOne({ session_id: req.params.session_id });

    res.json({
      metrics: metrics || null,
      memory: memory ? {
        adaptive_state: memory.adaptive_state,
        conversation_count: memory.conversation?.length || 0,
        ai_decisions_count: memory.ai_decisions?.length || 0
      } : null
    });
  } catch (error) {
    console.error('Get metrics error:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

// ==========================================
// ENTRY FLOW ENDPOINTS (First 3 Minutes High-Impact)
// ==========================================

/**
 * Generate forced choice options for entry flow
 * Based on arena_first_3_minutes_high_impact_entry_design.md
 */
router.post('/entry/generate-choices', async (req, res) => {
  try {
    const { problem_id, user_id, context, objective } = req.body;

    if (!problem_id) {
      return res.status(400).json({ error: 'Problem ID required' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Import AI service for generating choices
    const { generateEntryFlowChoices } = await import('../services/aiService.js');

    const result = await generateEntryFlowChoices(problem, context || problem.context, objective || problem.objective);

    res.json({
      choices: result.choices || [
        { id: 'aggressive', text: 'Ambil langkah agresif', icon: '🔥', hint: 'Risiko tinggi, reward potensial tinggi' },
        { id: 'conservative', text: 'Pertahankan posisi aman', icon: '🛡️', hint: 'Lebih aman tapi lambat' },
        { id: 'collaborative', text: 'Cari bantuan eksternal', icon: '🤝', hint: 'Butuh networking dan trust' }
      ],
      reflection_question: result.reflection_question || `Kenapa kamu memilih opsi tersebut?`
    });
  } catch (error) {
    console.error('Generate choices error:', error);
    // Return default choices on error
    res.json({
      choices: [
        { id: 'aggressive', text: 'Ambil langkah agresif', icon: '🔥', hint: 'Risiko tinggi, reward potensial tinggi' },
        { id: 'conservative', text: 'Pertahankan posisi aman', icon: '🛡️', hint: 'Lebih aman tapi lambat' },
        { id: 'collaborative', text: 'Cari bantuan eksternal', icon: '🤝', hint: 'Butuh networking dan trust' }
      ],
      reflection_question: 'Kenapa kamu memilih opsi tersebut?'
    });
  }
});

/**
 * Generate consequence based on user's choice
 * Creates the "tamparan" moment - realizing choice has cost
 */
router.post('/entry/generate-consequence', async (req, res) => {
  try {
    const { problem_id, choice_id, choice_text, user_id, context } = req.body;

    if (!problem_id || !choice_id) {
      return res.status(400).json({ error: 'Problem ID and Choice ID required' });
    }

    const problem = await Problem.findOne({ problem_id });
    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    // Import AI service for generating consequences
    const { generateEntryFlowConsequence } = await import('../services/aiService.js');

    const result = await generateEntryFlowConsequence(problem, choice_id, choice_text, context || problem.context);

    res.json({
      consequences: result.consequences || ['Keputusanmu memiliki dampak yang akan terlihat nanti.'],
      insight: result.insight || 'Setiap keputusan punya biaya.'
    });
  } catch (error) {
    console.error('Generate consequence error:', error);
    // Return default consequence on error
    res.json({
      consequences: ['Keputusanmu akan membawa perubahan signifikan.', 'Ada trade-off yang harus kamu hadapi.'],
      insight: 'Setiap keputusan punya biaya.'
    });
  }
});

export default router;
