import express from 'express';
import UserProfile from '../models/UserProfile.js';

const router = express.Router();

/**
 * ============================================
 * FRIKSI #1: ENTRY FLOW ROUTES
 * ============================================
 * Endpoints untuk mendukung pure action flow
 * dimana user bertindak sebelum paham
 */

/**
 * Default meaning mappings for pure action choices
 * Maps symbol choice to approach style
 */
const MEANING_MAP = {
    'A': {
        approach: 'AGRESIF',
        description: {
            id: 'Kamu cenderung mengutamakan kecepatan dan hasil cepat.',
            en: 'You tend to prioritize speed and quick results.'
        },
        traits: {
            id: ['Berani mengambil risiko', 'Action-oriented', 'Kompetitif'],
            en: ['Risk-taker', 'Action-oriented', 'Competitive']
        },
        icon: '🔥',
        archetype_hint: 'risk_taker'
    },
    'B': {
        approach: 'ANALITIK',
        description: {
            id: 'Kamu cenderung mempertimbangkan data dan bukti sebelum bertindak.',
            en: 'You tend to consider data and evidence before acting.'
        },
        traits: {
            id: ['Teliti', 'Sistematis', 'Hati-hati'],
            en: ['Thorough', 'Systematic', 'Careful']
        },
        icon: '🧠',
        archetype_hint: 'analyst'
    },
    'C': {
        approach: 'KOLABORATIF',
        description: {
            id: 'Kamu cenderung mencari kesepakatan dan membangun harmoni.',
            en: 'You tend to seek consensus and build harmony.'
        },
        traits: {
            id: ['Empatis', 'Komunikatif', 'Diplomatis'],
            en: ['Empathetic', 'Communicative', 'Diplomatic']
        },
        icon: '🤝',
        archetype_hint: 'strategist'
    }
};

/**
 * Assign meaning to pure action choice
 * POST /api/entry/assign-meaning
 * 
 * User memilih simbol tanpa konteks, sistem assign makna setelahnya
 */
router.post('/assign-meaning', async (req, res) => {
    try {
        const { choice_id, problem_id, user_id } = req.body;

        if (!choice_id) {
            return res.status(400).json({ error: 'Missing choice_id' });
        }

        // Get user profile for language preference
        const profile = user_id ? await UserProfile.findOne({ user_id }) : null;
        const language = profile?.language || 'id';

        // Get meaning for choice
        const meaningData = MEANING_MAP[choice_id] || MEANING_MAP['A'];

        // Format response based on language
        const meaning = {
            approach: meaningData.approach,
            description: meaningData.description[language] || meaningData.description.id,
            traits: meaningData.traits[language] || meaningData.traits.id,
            icon: meaningData.icon,
            archetype_hint: meaningData.archetype_hint
        };

        res.json({
            success: true,
            choice_id,
            meaning,
            message: language === 'id'
                ? `Pilihan ${choice_id} menandakan gaya berpikir ${meaning.approach}`
                : `Choice ${choice_id} indicates ${meaning.approach} thinking style`
        });

    } catch (error) {
        console.error('Assign meaning error:', error);
        res.status(500).json({ error: 'Failed to assign meaning' });
    }
});

/**
 * Get available pure action choices
 * GET /api/entry/pure-choices
 * 
 * Returns available symbols for pure action screen
 */
router.get('/pure-choices', (req, res) => {
    const choices = [
        { id: 'A', symbol: '🔺', color: 'red' },
        { id: 'B', symbol: '🔷', color: 'blue' },
        { id: 'C', symbol: '🟡', color: 'yellow' }
    ];

    res.json({ choices });
});

/**
 * Record pure action choice
 * POST /api/entry/record-choice
 * 
 * Records user's pure action choice for analytics
 */
router.post('/record-choice', async (req, res) => {
    try {
        const { user_id, choice_id, meaning, problem_id, response_time_ms } = req.body;

        // For now, just acknowledge the recording
        // In future, this could be stored in analytics collection
        console.log('Pure action recorded:', {
            user_id,
            choice_id,
            meaning: meaning?.approach,
            problem_id,
            response_time_ms,
            timestamp: new Date()
        });

        res.json({
            success: true,
            recorded: true
        });

    } catch (error) {
        console.error('Record choice error:', error);
        res.status(500).json({ error: 'Failed to record choice' });
    }
});

export default router;
