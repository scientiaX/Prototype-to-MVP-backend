/**
 * Onboarding Arena Routes
 * 
 * API endpoints for the Arena Onboarding PBL flow
 */

import express from 'express';
import crypto from 'crypto';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import ArenaSessionMetrics from '../models/ArenaSessionMetrics.js';
import SessionMemory from '../models/SessionMemory.js';
import * as onboardingArenaService from '../services/onboardingArenaService.js';
import * as systemLayer from '../services/systemLayerService.js';

const router = express.Router();

function inferPrimaryArchetypeFromCounts(counts) {
    const safeCounts = counts || {};
    const candidates = ['risk_taker', 'analyst', 'builder', 'strategist'];
    let best = { key: 'analyst', value: -1 };
    for (const key of candidates) {
        const value = Number(safeCounts[key] || 0);
        if (value > best.value) best = { key, value };
    }
    return best.key || 'analyst';
}

/**
 * Generate onboarding problem
 * POST /api/onboarding-arena/generate-problem
 */
router.post('/generate-problem', async (req, res) => {
    try {
        const { domain, language, age_group, use_ai } = req.body;

        if (!domain) {
            return res.status(400).json({ error: 'Domain is required' });
        }

        let problem;

        if (use_ai) {
            // Use AI to generate problem (more varied but slower)
            problem = await onboardingArenaService.generateAIOnboardingProblem(
                domain,
                language || 'id',
                age_group || 'adult'
            );
        } else {
            // Use curated problem pool (faster, consistent)
            problem = onboardingArenaService.getOnboardingProblem(domain, language || 'id');
        }

        // Get choice options
        const choices = onboardingArenaService.getChoiceOptions(problem.id, language || 'id');

        res.json({
            problem,
            choices
        });
    } catch (error) {
        console.error('Generate onboarding problem error:', error);
        res.status(500).json({ error: 'Failed to generate problem' });
    }
});

/**
 * Get consequence for a decision
 * POST /api/onboarding-arena/get-consequence
 */
router.post('/get-consequence', async (req, res) => {
    try {
        const { choice_id, archetype_signal, language } = req.body;

        if (!choice_id) {
            return res.status(400).json({ error: 'Choice ID is required' });
        }

        const consequence = onboardingArenaService.getConsequence(choice_id, language || 'id');
        const insight = onboardingArenaService.getInsight(archetype_signal || 'strategist', language || 'id');

        res.json({
            consequence,
            insight
        });
    } catch (error) {
        console.error('Get consequence error:', error);
        res.status(500).json({ error: 'Failed to get consequence' });
    }
});

/**
 * Complete onboarding arena and calibrate profile
 * POST /api/onboarding-arena/complete
 */
router.post('/complete', async (req, res) => {
    try {
        const { user_id, email, domain, language, age_group, decisions, name } = req.body;

        if (!user_id || !email || !decisions || !Array.isArray(decisions)) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Calculate profile from silent calibration
        const calibratedProfile = onboardingArenaService.calculateSilentCalibration(
            decisions,
            age_group || 'adult'
        );

        // Add domain and language
        calibratedProfile.domain = domain;
        calibratedProfile.language = language || 'id';

        // Get user's name if not provided
        let userName = name || '';
        if (!userName) {
            const user = await User.findOne({ email: email.toLowerCase() });
            userName = user?.name || '';
        }

        // Check for existing profile
        let profile = await UserProfile.findOne({ user_id });

        if (profile) {
            // Update existing profile
            Object.assign(profile, calibratedProfile);
            profile.name = userName || profile.name;
            await profile.save();
        } else {
            // Create new profile
            profile = await UserProfile.create({
                user_id,
                email,
                name: userName,
                ...calibratedProfile
            });
        }

        // Calculate XP earned (small dopamine hit)
        const xp_earned = 5; // Small XP for completing onboarding

        res.json({
            profile,
            xp_earned,
            message: language === 'en' ? 'Calibration complete' : 'Kalibrasi selesai'
        });
    } catch (error) {
        console.error('Complete onboarding arena error:', error);
        res.status(500).json({ error: 'Failed to complete onboarding' });
    }
});

router.post('/init-session', async (req, res) => {
    try {
        const { user_id, domain, language, age_group, problem_snapshot } = req.body || {};

        const session_id = `onb_${crypto.randomUUID()}`;
        const lang = language === 'en' ? 'en' : 'id';

        const seededProfile = {
            user_id: user_id || null,
            primary_archetype: 'analyst',
            risk_appetite: 0.5,
            decision_speed: 0.5,
            ambiguity_tolerance: 0.5,
            experience_depth: 0.5,
            current_difficulty: 3,
            xp_proportions: { risk_taker: 0, analyst: 0, builder: 0, strategist: 0 },
            levels: { risk_taker: 1, analyst: 1, builder: 1, strategist: 1 }
        };

        const seededProblem = {
            problem_id: String(problem_snapshot?.problem_id || `onboarding_${domain || 'general'}_${Date.now()}`),
            title: String(problem_snapshot?.title || (lang === 'en' ? 'Opening Arena' : 'Arena Pembukaan')),
            context: String(problem_snapshot?.context || ''),
            objective: String(problem_snapshot?.objective || ''),
            constraints: Array.isArray(problem_snapshot?.constraints) ? problem_snapshot.constraints : [],
            difficulty: Number(problem_snapshot?.difficulty ?? 3),
            role_label: String(problem_snapshot?.role_label || ''),
            level_up_criteria: Array.isArray(problem_snapshot?.level_up_criteria) ? problem_snapshot.level_up_criteria : []
        };

        const timeouts = systemLayer.getAdaptiveTimeouts(
            seededProfile,
            seededProblem.difficulty,
            'simple'
        );

        await ArenaSessionMetrics.create({ session_id, is_active: true });

        const memory = await SessionMemory.create({
            session_id,
            problem_snapshot: seededProblem,
            user_profile_snapshot: seededProfile,
            adaptive_state: {
                current_time_limits: {
                    response_warning: timeouts.warning,
                    comprehension_check: timeouts.check,
                    force_change: timeouts.force
                },
                current_pressure_level: 1,
                current_question_index: 0,
                questions_asked: seededProblem.objective ? [seededProblem.objective] : [],
                user_state: 'active',
                last_keystroke_at: new Date(),
                intervention_in_progress: false
            },
            is_active: true
        });

        memory.logDecision(
            'system',
            'set_timeout',
            'Initialized onboarding timeouts',
            { domain: domain || 'general', age_group: age_group || 'adult' },
            { timeouts }
        );
        await memory.save();

        res.json({ session_id, timeouts });
    } catch (error) {
        console.error('Init onboarding session error:', error);
        res.status(500).json({ error: 'Failed to initialize onboarding session' });
    }
});

router.post('/track', async (req, res) => {
    try {
        const { session_id, keystroke_data } = req.body || {};
        if (!session_id) return res.status(400).json({ error: 'Session ID required' });

        await systemLayer.trackKeystroke(session_id, keystroke_data || {});
        res.json({ tracked: true });
    } catch (error) {
        console.error('Onboarding track error:', error);
        res.status(500).json({ error: 'Failed to track activity' });
    }
});

router.post('/record-decision', async (req, res) => {
    try {
        const { session_id, decision, problem_snapshot } = req.body || {};
        if (!session_id || !decision) return res.status(400).json({ error: 'Missing required fields' });

        const memory = await SessionMemory.findOne({ session_id });
        const metrics = await ArenaSessionMetrics.findOne({ session_id });
        if (!memory || !metrics) return res.status(404).json({ error: 'Session not found' });

        if (problem_snapshot && typeof problem_snapshot === 'object') {
            memory.problem_snapshot = {
                ...memory.problem_snapshot,
                ...(problem_snapshot.problem_id ? { problem_id: String(problem_snapshot.problem_id) } : {}),
                ...(problem_snapshot.title ? { title: String(problem_snapshot.title) } : {}),
                ...(problem_snapshot.context ? { context: String(problem_snapshot.context) } : {}),
                ...(problem_snapshot.objective ? { objective: String(problem_snapshot.objective) } : {}),
                ...(problem_snapshot.difficulty !== undefined ? { difficulty: Number(problem_snapshot.difficulty) } : {}),
                ...(problem_snapshot.role_label ? { role_label: String(problem_snapshot.role_label) } : {})
            };
        }

        const timeToFirstTap = Number(decision.time_to_first_tap ?? decision.time_to_decide ?? 0);
        const timeToDecide = Number(decision.time_to_decide ?? 0);
        const revisionCount = Number(decision.change_of_mind_count ?? 0);

        await systemLayer.recordResponseTiming(session_id, {
            question_id: `onboarding_${memory.adaptive_state.current_question_index}`,
            question_text: memory.problem_snapshot?.objective || '',
            time_to_start_typing_ms: timeToFirstTap,
            time_to_submit_ms: timeToDecide,
            response_length: 0,
            revision_count: revisionCount,
            keystrokeTimes: []
        });

        const signal = decision.archetype_signal;
        const prevCounts = memory.user_profile_snapshot?.xp_proportions || { risk_taker: 0, analyst: 0, builder: 0, strategist: 0 };
        const nextCounts = { ...prevCounts };
        if (signal && nextCounts[signal] !== undefined) nextCounts[signal] = Number(nextCounts[signal] || 0) + 1;

        const primary = inferPrimaryArchetypeFromCounts(nextCounts);
        memory.user_profile_snapshot = {
            ...(memory.user_profile_snapshot || {}),
            xp_proportions: nextCounts,
            primary_archetype: primary
        };

        const timeouts = systemLayer.getAdaptiveTimeouts(
            memory.user_profile_snapshot,
            Number(memory.problem_snapshot?.difficulty ?? 3),
            'simple'
        );

        memory.adaptive_state.current_time_limits = {
            response_warning: timeouts.warning,
            comprehension_check: timeouts.check,
            force_change: timeouts.force
        };
        memory.adaptive_state.current_question_index = Number(memory.adaptive_state.current_question_index || 0) + 1;
        memory.adaptive_state.last_keystroke_at = new Date();
        memory.adaptive_state.user_state = 'active';
        memory.adaptive_state.intervention_in_progress = false;
        await memory.save();

        res.json({ recorded: true, timeouts, primary_archetype: primary });
    } catch (error) {
        console.error('Onboarding record decision error:', error);
        res.status(500).json({ error: 'Failed to record decision' });
    }
});

router.get('/next-action/:session_id', async (req, res) => {
    try {
        const sessionId = req.params.session_id;
        const lang = req.query?.lang === 'en' ? 'en' : 'id';

        const memory = await SessionMemory.findOne({ session_id: sessionId });
        if (!memory || !memory.is_active) return res.json({ action: 'none', reason: 'session_inactive' });

        const check = await systemLayer.checkInterventionNeeded(sessionId);
        if (!check?.needed) return res.json({ action: 'none', reason: check?.reason || 'ok' });

        if (check.type === 'warning') {
            await systemLayer.recordIntervention(sessionId, {
                type: 'warning',
                reason: `User idle for ${check.seconds_idle}s`,
                user_state: memory.adaptive_state.user_state
            });
            return res.json({
                action: 'show_nudge',
                message: lang === 'en' ? 'Pick one option. We move.' : 'Pilih salah satu. Lanjut.',
                seconds_idle: check.seconds_idle
            });
        }

        if (check.type === 'comprehension_check') {
            await systemLayer.recordIntervention(sessionId, {
                type: 'comprehension_check',
                reason: `User still idle after warning (${check.seconds_idle}s)`,
                user_state: memory.adaptive_state.user_state
            });
            return res.json({
                action: 'offer_simplify',
                message: lang === 'en' ? 'Too many words? Want a shorter version?' : 'Terlalu panjang? Mau versi ringkas?',
                options: ['simplify', 'continue'],
                seconds_idle: check.seconds_idle
            });
        }

        if (check.type === 'force_change') {
            await systemLayer.recordIntervention(sessionId, {
                type: 'question_change',
                reason: `User idle beyond force threshold (${check.seconds_idle}s)`,
                user_state: memory.adaptive_state.user_state
            });
            const currentPrimary = memory.user_profile_snapshot?.primary_archetype || 'analyst';
            const recommended_archetype = currentPrimary === 'analyst' ? 'builder' : currentPrimary === 'strategist' ? 'builder' : 'strategist';
            return res.json({
                action: 'force_pick',
                message: lang === 'en' ? 'Auto-pick to keep momentum.' : 'Auto-pick biar momentum jalan.',
                recommended_archetype,
                seconds_idle: check.seconds_idle
            });
        }

        res.json({ action: 'none' });
    } catch (error) {
        console.error('Onboarding next action error:', error);
        res.status(500).json({ error: 'Failed to get next action' });
    }
});

router.post('/intervention-response', async (req, res) => {
    try {
        const { session_id, response_type } = req.body || {};
        if (!session_id || !response_type) return res.status(400).json({ error: 'Missing required fields' });

        const memory = await SessionMemory.findOne({ session_id });
        const metrics = await ArenaSessionMetrics.findOne({ session_id });
        if (!memory || !metrics) return res.status(404).json({ error: 'Session not found' });

        memory.adaptive_state.intervention_in_progress = false;
        memory.adaptive_state.last_keystroke_at = new Date();
        memory.adaptive_state.last_response_at = new Date();
        memory.adaptive_state.user_state = 'active';

        let mapped = 'ignored';
        if (response_type === 'continue') mapped = 'understood';
        if (response_type === 'simplify') mapped = 'not_understood';
        if (response_type === 'picked') mapped = 'started_typing';
        if (response_type === 'active') mapped = 'started_typing';
        if (response_type === 'timeout') mapped = 'timeout';

        const idx = [...metrics.interventions].reverse().findIndex(i => !i.user_response);
        if (idx >= 0) {
            const targetIndex = metrics.interventions.length - 1 - idx;
            metrics.interventions[targetIndex].user_response = mapped;
            metrics.interventions[targetIndex].response_delay_ms = 0;
        }

        memory.logDecision(
            'system',
            'evaluate_response',
            `User responded with "${response_type}" to onboarding intervention`,
            { response_type },
            { cleared: true }
        );

        await memory.save();
        await metrics.save();

        res.json({ cleared: true });
    } catch (error) {
        console.error('Onboarding intervention response error:', error);
        res.status(500).json({ error: 'Failed to handle intervention response' });
    }
});

export default router;
