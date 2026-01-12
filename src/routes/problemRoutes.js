import express from 'express';
import Problem from '../models/Problem.js';
import ArenaSession from '../models/ArenaSession.js';
import { generateProblem } from '../services/aiService.js';

const router = express.Router();

router.post('/generate', async (req, res) => {
  try {
    const { profile, customization, user_id } = req.body;

    if (!profile || !user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Fetch user's completed arena sessions to avoid duplicate problems
    const completedSessions = await ArenaSession.find({
      user_id: user_id,
      status: 'evaluated'
    }).select('problem_id').limit(20).sort({ submitted_at: -1 });

    // Get the problem details for completed sessions
    const completedProblemIds = completedSessions.map(s => s.problem_id);
    const completedProblems = await Problem.find({
      problem_id: { $in: completedProblemIds }
    }).select('title context objective domain role_label');

    // Format completed problems for AI context
    const completedProblemsContext = completedProblems.map(p => ({
      title: p.title,
      context_summary: p.context?.substring(0, 150) + '...',
      domain: p.domain,
      role: p.role_label
    }));

    // Pass completed problems to AI for uniqueness
    const enhancedCustomization = {
      ...customization,
      completedProblems: completedProblemsContext
    };

    const generatedProblem = await generateProblem(profile, enhancedCustomization);

    // Determine duration type
    const durationMinutes = customization?.durationMinutes || 30;
    const durationType = durationMinutes <= 10 ? 'quick' : 'standard';

    // Normalize LLM output to match schema requirements
    const normalizedProblem = {
      ...generatedProblem,
      created_by: user_id,
      is_active: true,
      duration_type: durationType,
      estimated_time_minutes: durationMinutes,
      // Normalize enum values to lowercase
      domain: generatedProblem.domain?.toLowerCase() || 'business',
      archetype_focus: generatedProblem.archetype_focus?.toLowerCase()?.replace(/\s+/g, '_') || 'strategist'
    };

    // Map common variations to valid enum values
    const domainMap = {
      'business': 'business', 'tech': 'tech', 'technology': 'tech',
      'creative': 'creative', 'leadership': 'leadership', 'mixed': 'mixed'
    };
    const archetypeMap = {
      'risk_taker': 'risk_taker', 'risktaker': 'risk_taker',
      'analyst': 'analyst', 'builder': 'builder',
      'strategist': 'strategist', 'all': 'all'
    };

    normalizedProblem.domain = domainMap[normalizedProblem.domain] || 'business';
    normalizedProblem.archetype_focus = archetypeMap[normalizedProblem.archetype_focus] || 'strategist';

    const problem = await Problem.create(normalizedProblem);

    res.json(problem);
  } catch (error) {
    console.error('Generate problem error:', error);
    res.status(500).json({
      error: 'Failed to generate problem',
      message: error.message,
      details: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { difficulty_min, difficulty_max, is_active = true, user_id } = req.query;

    const filter = { is_active: is_active === 'true' || is_active === true };

    if (difficulty_min || difficulty_max) {
      filter.difficulty = {};
      if (difficulty_min) filter.difficulty.$gte = parseInt(difficulty_min);
      if (difficulty_max) filter.difficulty.$lte = parseInt(difficulty_max);
    }

    // Filter problems: show only user's personalized problems OR global (no generated_for_user)
    if (user_id) {
      filter.$or = [
        { generated_for_user: user_id },
        { generated_for_user: { $exists: false } },
        { generated_for_user: null }
      ];
    }

    const problems = await Problem.find(filter).sort({ createdAt: -1 });

    res.json(problems);
  } catch (error) {
    console.error('Get problems error:', error);
    res.status(500).json({ error: 'Failed to get problems' });
  }
});

router.get('/:problem_id', async (req, res) => {
  try {
    const problem = await Problem.findOne({ problem_id: req.params.problem_id });

    if (!problem) {
      return res.status(404).json({ error: 'Problem not found' });
    }

    res.json(problem);
  } catch (error) {
    console.error('Get problem error:', error);
    res.status(500).json({ error: 'Failed to get problem' });
  }
});

export default router;
