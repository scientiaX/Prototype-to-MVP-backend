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
// ARCHETYPE-SPECIFIC WARNING TEMPLATES
// ==========================================

const WARNING_TEMPLATES = {
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
};

const STIMULATION_PROMPTS = {
    challenge: "Apa yang membuatmu ragu? Sebutkan satu alasan terbesarmu.",
    what_if: "Bagaimana kalau kamu salah? Apa konsekuensi terburuknya?",
    alternative: "Apakah ada solusi lain yang kamu pertimbangkan tapi tidak pilih? Kenapa?",
    accountability: "Kalau kamu harus menjelaskan keputusan ini ke investor dalam 2 menit, apa yang akan kamu katakan?",
    stress_test: "Bagaimana kalau asumsi terbesarmu ternyata salah?"
};

// ==========================================
// WARNING MESSAGE GENERATION
// ==========================================

/**
 * Generate archetype-specific warning message
 */
export const generateWarningMessage = async (profile, context, sessionMemory = null) => {
    const archetype = profile?.primary_archetype || 'analyst';
    const templates = WARNING_TEMPLATES[archetype] || WARNING_TEMPLATES.analyst;

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
        const prompt = `Kamu adalah mentor yang tegas. User dengan archetype "${archetype}" sedang tidak aktif selama ${context.seconds} detik.
    
Konteks masalah: ${context.problem_title || 'Problem solving challenge'}

Beri 1 pesan singkat (1-2 kalimat) yang:
1. Tegas tapi supportive
2. Sesuai dengan profil ${archetype}
3. Mendorong user untuk segera menulis

Respond dalam Bahasa Indonesia saja, tanpa penjelasan.`;

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

        const prompt = `Kamu adalah mentor Socratic yang mendorong pemikiran kritis.

PROBLEM:
Title: ${problem.title}
Context: ${problem.context?.substring(0, 300)}
Objective: ${problem.objective}

USER ARCHETYPE: ${archetype}
SITUATION: User belum mulai menjawab atau stuck.

Generate 1 pertanyaan singkat yang:
1. Socratic - buat user berpikir sendiri
2. Tidak terlalu luas, tidak terlalu sempit
3. Sesuai archetype ${archetype}
4. Maksimal 1-2 kalimat

Contoh style:
- "Apa satu hal yang paling kamu takutkan kalau keputusan ini salah?"
- "Kalau harus memilih dalam 30 detik, opsi mana yang kamu condong?"
- "Apa trade-off terbesar yang harus kamu terima di sini?"

Respond HANYA pertanyaan dalam Bahasa Indonesia, tanpa penjelasan.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return typeof response === 'string' ? response : STIMULATION_PROMPTS.challenge;
    } catch (error) {
        console.error('AI stimulation question error:', error);
        // Fallback to random template
        const keys = Object.keys(STIMULATION_PROMPTS);
        return STIMULATION_PROMPTS[keys[Math.floor(Math.random() * keys.length)]];
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
        const prompt = `Kamu adalah mentor yang membantu tanpa memberikan jawaban langsung.

PROBLEM:
${problem.title}
${problem.objective}

USER'S PARTIAL ANSWER (if any):
${partialAnswer || '(Belum ada jawaban)'}

USER ARCHETYPE: ${profile?.primary_archetype || 'analyst'}

Berikan 1 hint singkat yang:
1. Tidak memberikan jawaban
2. Membantu user berpikir ke arah yang benar
3. Maksimal 2 kalimat

Respond dalam Bahasa Indonesia saja.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return typeof response === 'string' ? response : "Coba pikirkan: apa yang paling penting untuk diputuskan terlebih dahulu?";
    } catch (error) {
        console.error('AI hint generation error:', error);
        return "Coba pikirkan: apa yang paling penting untuk diputuskan terlebih dahulu?";
    }
};

// ==========================================
// COMPREHENSION CHECK
// ==========================================

/**
 * Generate comprehension check question
 */
export const generateComprehensionCheck = async (problem, currentQuestion) => {
    try {
        const prompt = `User belum menjawab pertanyaan ini: "${currentQuestion}"

Masalahnya tentang: ${problem.title}

Ubah pertanyaan menjadi lebih spesifik dan mudah dijawab. Maksimal 1 kalimat.

Contoh transformasi:
- "Apa solusimu?" → "Dari 2 opsi ini, mana yang kamu pilih: A atau B?"
- "Bagaimana strategimu?" → "Apa langkah PERTAMA yang akan kamu ambil?"

Respond dalam Bahasa Indonesia, HANYA pertanyaan baru tanpa penjelasan.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return typeof response === 'string' ? response : "Apa satu keputusan pertama yang akan kamu ambil?";
    } catch (error) {
        console.error('AI comprehension check error:', error);
        return "Apa satu keputusan pertama yang akan kamu ambil?";
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
export const generateSimpleFollowUp = async (problem, userResponse, responseQuality) => {
    try {
        // If response quality is low, ask clarifying question
        const qualityThreshold = 0.5;

        let promptType;
        if (responseQuality < qualityThreshold) {
            promptType = 'clarification';
        } else {
            promptType = 'stress_test';
        }

        const prompts = {
            clarification: `User menjawab: "${userResponse.substring(0, 200)}..."

Berikan 1 pertanyaan klarifikasi singkat untuk memahami keputusan mereka lebih jelas. Maksimal 1 kalimat dalam Bahasa Indonesia.`,

            stress_test: `User menjawab: "${userResponse.substring(0, 200)}..."

Masalah: ${problem.title}

Berikan 1 pertanyaan stress-test singkat yang menguji asumsi mereka. Contoh: "Bagaimana kalau X tidak bekerja?" Maksimal 1 kalimat dalam Bahasa Indonesia.`
        };

        const response = await invokeLLM({
            prompt: prompts[promptType],
            model: 'gpt-3.5-turbo'
        });

        return {
            question: typeof response === 'string' ? response : STIMULATION_PROMPTS.stress_test,
            type: promptType
        };
    } catch (error) {
        console.error('AI follow-up generation error:', error);
        return {
            question: STIMULATION_PROMPTS.stress_test,
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
        const pressureTypes = {
            1: 'time_reminder',
            2: 'consequence_highlight',
            3: 'competitor_mention',
            4: 'stakeholder_pressure',
            5: 'ultimatum'
        };

        const pressureType = pressureTypes[currentPressureLevel] || 'time_reminder';

        const prompt = `Generate tekanan level ${currentPressureLevel}/5 untuk problem solving.

PROBLEM: ${problem.title}
USER ARCHETYPE: ${profile?.primary_archetype}
PRESSURE TYPE: ${pressureType}

Buat 1 kalimat singkat yang menambah urgency. Contoh:
- Level 1: "Ingat, waktu terus berjalan."
- Level 3: "Kalau kamu tidak memutuskan, kompetitor yang akan memutuskan."
- Level 5: "Ini keputusan terakhir. Tidak ada waktu lagi untuk ragu."

Respond HANYA tekanan dalam Bahasa Indonesia.`;

        const response = await invokeLLM({
            prompt,
            model: 'gpt-3.5-turbo'
        });

        return {
            message: typeof response === 'string' ? response : "Waktu terus berjalan. Setiap detik delay adalah kehilangan momentum.",
            level: currentPressureLevel,
            type: pressureType
        };
    } catch (error) {
        console.error('AI pressure generation error:', error);
        return {
            message: "Waktu terus berjalan. Setiap detik delay adalah kehilangan momentum.",
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
