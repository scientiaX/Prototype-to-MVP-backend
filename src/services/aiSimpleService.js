/**
 * AI Simple Service - Layer 2 of 3-Layer AI Engine
 * 
 * This layer handles:
 * - Lightweight AI operations (warnings, hints, simple questions)
 * - Quick responses that don't need complex reasoning
 * - Decision to delegate to AI Agent
 * 
 * Cost: LOW (~$0.0005 per call using GPT-3.5-turbo / Claude Haiku)
 */

import { invokeLLM } from '../config/openai.js';
import SessionMemory from '../models/SessionMemory.js';

// ==========================================
// LANGUAGE HELPER
// ==========================================

/**
 * Get language instruction for AI prompts
 */
const getLanguageInstruction = (profile) => {
    const lang = profile?.language || 'en';
    return lang === 'id' ? 'Respond in Indonesian (Bahasa Indonesia).' : 'Respond in English.';
};

// ==========================================
// ARCHETYPE-SPECIFIC WARNING TEMPLATES (Bilingual)
// ==========================================

const WARNING_TEMPLATES = {
    en: {
        analyst: {
            over_analysis: "You're over-thinking. Data won't be more complete in 10 minutes. Decide with what you have.",
            pause: "It's been {seconds} seconds without input. Analysis is enough - time to decide.",
            hesitant: "Pattern is clear. Perfect clarity won't come. Start writing your decision."
        },
        risk_taker: {
            over_analysis: "You're being too cautious for a risk-taker. Make a decision, correct later.",
            pause: "It's been {seconds} seconds with no output. In the real world, competitors are already moving.",
            hesitant: "Your instinct is usually right. Trust it. Write something now."
        },
        builder: {
            over_analysis: "Execution starts with the first decision. Write something, polish later.",
            pause: "Builders excel at execution, not analysis paralysis. Start with a rough draft.",
            hesitant: "A prototype is better than a perfect plan. Start building now."
        },
        strategist: {
            over_analysis: "The best strategists know when to stop planning and start moving. Now is the time.",
            pause: "Pattern is clear. Don't wait for perfect clarity that won't come.",
            hesitant: "Chess masters don't wait to see all possibilities. Make your first move."
        }
    },
    id: {
        analyst: {
            over_analysis: "Kamu over-thinking. Data tidak akan lebih lengkap 10 menit lagi. Putuskan dengan informasi yang ada.",
            pause: "Sudah {seconds} detik tanpa input. Analisis sudah cukup - sekarang saatnya memutuskan.",
            hesitant: "Pola sudah terlihat. Perfect clarity tidak akan datang. Mulai tulis keputusanmu."
        },
        risk_taker: {
            over_analysis: "Kamu terlalu berhati-hati untuk seorang risk-taker. Ambil keputusan, perbaiki nanti.",
            pause: "Sudah {seconds} detik tidak menulis apa-apa. Di dunia nyata, kompetitor sudah bergerak.",
            hesitant: "Instinct-mu biasanya benar. Trust it. Tulis sesuatu sekarang."
        },
        builder: {
            over_analysis: "Eksekusi dimulai dari keputusan pertama. Tulis sesuatu, polish nanti.",
            pause: "Builder bagus di eksekusi, bukan di analysis paralysis. Mulai dari draft kasar.",
            hesitant: "Prototype lebih baik dari rencana sempurna. Mulai bangun sekarang."
        },
        strategist: {
            over_analysis: "Strategist terbaik tahu kapan berhenti merencanakan dan mulai bergerak. Sekarang waktunya.",
            pause: "Pola sudah terlihat. Jangan tunggu perfect clarity yang tidak akan datang.",
            hesitant: "Chess master tidak menunggu melihat semua kemungkinan. Buat langkah pertamamu."
        }
    }
};

const STIMULATION_PROMPTS = {
    en: {
        challenge: "What's making you hesitate? Name your biggest concern.",
        what_if: "What if you're wrong? What's the worst consequence?",
        alternative: "Is there another solution you considered but didn't choose? Why?",
        accountability: "If you had to explain this decision to an investor in 2 minutes, what would you say?",
        stress_test: "What if your biggest assumption turns out to be wrong?"
    },
    id: {
        challenge: "Apa yang membuatmu ragu? Sebutkan satu alasan terbesarmu.",
        what_if: "Bagaimana kalau kamu salah? Apa konsekuensi terburuknya?",
        alternative: "Apakah ada solusi lain yang kamu pertimbangkan tapi tidak pilih? Kenapa?",
        accountability: "Kalau kamu harus menjelaskan keputusan ini ke investor dalam 2 menit, apa yang akan kamu katakan?",
        stress_test: "Bagaimana kalau asumsi terbesarmu ternyata salah?"
    }
};

// Helper to get templates by language
const getWarningTemplates = (profile) => {
    const lang = profile?.language || 'en';
    return WARNING_TEMPLATES[lang] || WARNING_TEMPLATES.en;
};

const getStimulationPrompts = (profile) => {
    const lang = profile?.language || 'en';
    return STIMULATION_PROMPTS[lang] || STIMULATION_PROMPTS.en;
};

// ==========================================
// WARNING MESSAGE GENERATION
// ==========================================

/**
 * Generate archetype-specific warning message
 */
export const generateWarningMessage = async (profile, context, sessionMemory = null) => {
    const archetype = profile?.primary_archetype || 'analyst';
    const langTemplates = getWarningTemplates(profile);
    const templates = langTemplates[archetype] || langTemplates.analyst;

    // For simple warnings, use template (no AI call)
    if (context.type === 'over_analysis') {
        return templates.over_analysis;
    } else if (context.type === 'pause') {
        return templates.pause.replace('{seconds}', context.seconds || '60');
    } else if (context.type === 'hesitant') {
        return templates.hesitant;
    }

    // For complex warnings, use AI (low-cost model)
    try {
        const langInst = getLanguageInstruction(profile);
        const prompt = `You are a firm mentor. User with archetype "${archetype}" has been inactive for ${context.seconds} seconds.
    
Problem context: ${context.problem_title || 'Problem solving challenge'}

Give 1 short message (1-2 sentences) that:
1. Firm but supportive
2. Matches the ${archetype} profile
3. Encourages user to start writing

${langInst} No explanation, just the message.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo' // Use lightweight model
        });

        return typeof response === 'string' ? response : templates.pause.replace('{seconds}', context.seconds || '60');
    } catch (error) {
        console.error('AI warning generation error:', error);
        return templates.pause.replace('{seconds}', context.seconds || '60');
    }
};

// ==========================================
// STIMULATION QUESTION GENERATION
// ==========================================

/**
 * Generate stimulation question to nudge user thinking
 */
export const generateStimulationQuestion = async (problem, profile, context = 'pause') => {
    try {
        const archetype = profile?.primary_archetype || 'analyst';
        const langInst = getLanguageInstruction(profile);
        const stimPrompts = getStimulationPrompts(profile);

        const prompt = `You are a Socratic mentor who pushes critical thinking.

PROBLEM:
Title: ${problem.title}
Context: ${problem.context?.substring(0, 300)}
Objective: ${problem.objective}

USER ARCHETYPE: ${archetype}
SITUATION: User hasn't started answering or is stuck.

Generate 1 short question that:
1. Socratic - make user think for themselves
2. Not too broad, not too narrow
3. Matches archetype ${archetype}
4. Maximum 1-2 sentences

${langInst} No explanation, just the question.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return typeof response === 'string' ? response : stimPrompts.challenge;
    } catch (error) {
        console.error('AI stimulation question error:', error);
        const stimPrompts = getStimulationPrompts(profile);
        const keys = Object.keys(stimPrompts);
        return stimPrompts[keys[Math.floor(Math.random() * keys.length)]];
    }
};

// ==========================================
// HINT GENERATION
// ==========================================

/**
 * Generate hint based on partial answer (if user is struggling)
 */
export const generateHint = async (problem, profile, partialAnswer = '') => {
    try {
        const langInst = getLanguageInstruction(profile);
        const noAnswer = profile?.language === 'id' ? '(Belum ada jawaban)' : '(No answer yet)';

        const prompt = `You are a mentor who helps without giving direct answers.

PROBLEM:
${problem.title}
${problem.objective}

USER'S PARTIAL ANSWER (if any):
${partialAnswer || noAnswer}

USER ARCHETYPE: ${profile?.primary_archetype || 'analyst'}

Give 1 short hint that:
1. Doesn't give the answer
2. Helps user think in the right direction
3. Maximum 2 sentences

${langInst}`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        const fallback = profile?.language === 'id'
            ? "Coba pikirkan: apa yang paling penting untuk diputuskan terlebih dahulu?"
            : "Think about: what's the most important thing to decide first?";
        return typeof response === 'string' ? response : fallback;
    } catch (error) {
        console.error('AI hint generation error:', error);
        const fallback = profile?.language === 'id'
            ? "Coba pikirkan: apa yang paling penting untuk diputuskan terlebih dahulu?"
            : "Think about: what's the most important thing to decide first?";
        return fallback;
    }
};

// ==========================================
// COMPREHENSION CHECK
// ==========================================

/**
 * Generate comprehension check question
 */
export const generateComprehensionCheck = async (problem, currentQuestion, profile = null) => {
    try {
        const langInst = getLanguageInstruction(profile);
        const prompt = `User hasn't answered this question: "${currentQuestion}"

The problem is about: ${problem.title}

Transform the question to be more specific and easier to answer. Maximum 1 sentence.

Example transformations:
- "What's your solution?" → "Of these 2 options, which do you choose: A or B?"
- "What's your strategy?" → "What's the FIRST step you'll take?"

${langInst} Only the new question, no explanation.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        const fallback = profile?.language === 'id'
            ? "Apa satu keputusan pertama yang akan kamu ambil?"
            : "What's your first decision?";
        return typeof response === 'string' ? response : fallback;
    } catch (error) {
        console.error('AI comprehension check error:', error);
        const fallback = profile?.language === 'id'
            ? "Apa satu keputusan pertama yang akan kamu ambil?"
            : "What's your first decision?";
        return fallback;
    }
};

// ==========================================
// DELEGATION DECISION
// ==========================================

/**
 * Decide if task should be delegated to AI Agent (expensive model)
 */
export const shouldDelegateToAgent = async (context) => {
    // Tasks that always go to AI Agent
    const agentTasks = [
        'problem_generation',
        'xp_calculation',
        'full_evaluation',
        'follow_up_questions',
        'stress_test'
    ];

    if (agentTasks.includes(context.task_type)) {
        return {
            delegate: true,
            reason: `Task type "${context.task_type}" requires AI Agent`
        };
    }

    // Complex conversation handling
    if (context.conversation_length > 10) {
        return {
            delegate: true,
            reason: 'Complex conversation requires deeper reasoning'
        };
    }

    // User showing signs of confusion
    if (context.intervention_count >= 3) {
        return {
            delegate: true,
            reason: 'Multiple interventions suggest need for adaptive approach'
        };
    }

    return { delegate: false };
};

// ==========================================
// FOLLOW-UP QUESTION (Simple)
// ==========================================

/**
 * Generate simple follow-up question after user response
 */
export const generateSimpleFollowUp = async (problem, userResponse, responseQuality, profile = null) => {
    try {
        const langInst = getLanguageInstruction(profile);
        const stimPrompts = getStimulationPrompts(profile);

        // If response quality is low, ask clarifying question
        const qualityThreshold = 0.5;

        let promptType;
        if (responseQuality < qualityThreshold) {
            promptType = 'clarification';
        } else {
            promptType = 'stress_test';
        }

        const clarificationText = profile?.language === 'id'
            ? 'Berikan 1 pertanyaan klarifikasi singkat untuk memahami keputusan mereka lebih jelas. Maksimal 1 kalimat.'
            : 'Give 1 short clarifying question to better understand their decision. Maximum 1 sentence.';

        const stressTestText = profile?.language === 'id'
            ? 'Berikan 1 pertanyaan stress-test singkat yang menguji asumsi mereka. Contoh: "Bagaimana kalau X tidak bekerja?" Maksimal 1 kalimat.'
            : 'Give 1 short stress-test question that tests their assumptions. Example: "What if X doesn\'t work?" Maximum 1 sentence.';

        const prompt = promptType === 'clarification'
            ? `User answered: "${userResponse.substring(0, 200)}..."\n\n${clarificationText} ${langInst}`
            : `User answered: "${userResponse.substring(0, 200)}..."\n\nProblem: ${problem.title}\n\n${stressTestText} ${langInst}`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return {
            question: typeof response === 'string' ? response : stimPrompts.stress_test,
            type: promptType
        };
    } catch (error) {
        console.error('AI follow-up generation error:', error);
        const stimPrompts = getStimulationPrompts(profile);
        return {
            question: stimPrompts.stress_test,
            type: 'stress_test'
        };
    }
};

// ==========================================
// PRESSURE GENERATION
// ==========================================

/**
 * Generate pressure/dilemma element to add urgency
 */
export const generatePressure = async (problem, profile, currentPressureLevel) => {
    try {
        const langInst = getLanguageInstruction(profile);
        const pressureTypes = {
            1: 'time_reminder',
            2: 'consequence_highlight',
            3: 'competitor_mention',
            4: 'stakeholder_pressure',
            5: 'ultimatum'
        };

        const pressureType = pressureTypes[currentPressureLevel] || 'time_reminder';

        const prompt = `Generate pressure level ${currentPressureLevel}/5 for problem solving.

PROBLEM: ${problem.title}
USER ARCHETYPE: ${profile?.primary_archetype}
PRESSURE TYPE: ${pressureType}

Create 1 short sentence that adds urgency. Examples:
- Level 1: "Remember, time is ticking."
- Level 3: "If you don't decide, your competitor will."
- Level 5: "This is your final decision. No more time to hesitate."

${langInst} Only the pressure message.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        const defaultMsg = profile?.language === 'id'
            ? "Waktu terus berjalan. Setiap detik delay adalah kehilangan momentum."
            : "Time is running. Every second of delay is lost momentum.";

        return {
            message: typeof response === 'string' ? response : defaultMsg,
            level: currentPressureLevel,
            type: pressureType
        };
    } catch (error) {
        console.error('AI pressure generation error:', error);
        const defaultMsg = profile?.language === 'id'
            ? "Waktu terus berjalan. Setiap detik delay adalah kehilangan momentum."
            : "Time is running. Every second of delay is lost momentum.";
        return {
            message: defaultMsg,
            level: currentPressureLevel,
            type: 'time_reminder'
        };
    }
};

export default {
    generateWarningMessage,
    generateStimulationQuestion,
    generateHint,
    generateComprehensionCheck,
    shouldDelegateToAgent,
    generateSimpleFollowUp,
    generatePressure,
    WARNING_TEMPLATES,
    STIMULATION_PROMPTS
};
