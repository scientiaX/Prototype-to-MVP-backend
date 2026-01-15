/**
 * Onboarding Arena Routes
 * 
 * API endpoints for the Arena Onboarding PBL flow
 */

import express from 'express';
import UserProfile from '../models/UserProfile.js';
import User from '../models/User.js';
import * as onboardingArenaService from '../services/onboardingArenaService.js';

const router = express.Router();

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

export default router;
