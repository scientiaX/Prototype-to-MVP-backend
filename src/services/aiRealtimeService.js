/**
 * AI Realtime Service - Layer 1 of 3-Layer AI Engine (Realtime/Lightweight)
 * 
 * This layer handles:
 * - Ultra-fast responses during arena sessions
 * - Simple reminders and encouragements
 * - Quick next-step suggestions that don't need deep reasoning
 * 
 * Uses Cloudflare Workers AI for realtime responses (no RPM limit)
 * Fallback: Uses templates if AI unavailable
 */

import { invokeLowLevelAI } from '../config/cloudflareAI.js';

// ==========================================
// LANGUAGE HELPER
// ==========================================

const getLanguageInstruction = (profile) => {
    const lang = profile?.language || 'en';
    return lang === 'id' ? 'Respond in Indonesian (Bahasa Indonesia).' : 'Respond in English.';
};

// ==========================================
// QUICK REMINDERS
// ==========================================

/**
 * Generate a quick reminder message during arena
 * Used for time-sensitive nudges that don't need complex reasoning
 */
export const generateQuickReminder = async (profile, secondsIdle) => {
    const lang = profile?.language || 'en';
    const archetype = profile?.primary_archetype || 'analyst';

    // For very simple reminders, use template (fastest)
    if (secondsIdle < 45) {
        const reminders = {
            en: [
                "Time is ticking. Keep moving.",
                "Stay focused. What's your next step?",
                "Don't overthink. Start writing."
            ],
            id: [
                "Waktu terus berjalan. Teruskan.",
                "Tetap fokus. Apa langkah selanjutnya?",
                "Jangan overthinking. Mulai menulis."
            ]
        };
        const messages = reminders[lang] || reminders.en;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    // For longer idle times, generate personalized reminder
    try {
        const prompt = `Generate 1 short reminder (max 10 words) for someone who has been idle for ${secondsIdle} seconds.
Archetype: ${archetype}
${getLanguageInstruction(profile)}
Just the message, no explanation.`;

        const response = await invokeLowLevelAI({ prompt });
        return typeof response === 'string' ? response.trim() : "Keep going. Don't stop now.";
    } catch (error) {
        console.error('Quick reminder generation error:', error);
        return lang === 'id' ? "Teruskan. Jangan berhenti sekarang." : "Keep going. Don't stop now.";
    }
};

// ==========================================
// NEXT MICRO STEP
// ==========================================

/**
 * Generate quick next micro-step suggestion
 * For arena realtime guidance without deep analysis
 */
export const generateNextMicroStep = async (problem, currentProgress, profile) => {
    const lang = profile?.language || 'en';

    try {
        const prompt = `Problem: ${problem.title}
Current progress: ${currentProgress || 'Just started'}

Suggest 1 micro-step (max 15 words) the user should do NOW.
Not a full solution, just the next small action.
${getLanguageInstruction(profile)}
Just the step, no explanation.`;

        const response = await invokeLowLevelAI({ prompt });
        return typeof response === 'string' ? response.trim() : (lang === 'id' ? "Identifikasi masalah utama terlebih dahulu." : "Identify the main problem first.");
    } catch (error) {
        console.error('Next micro step generation error:', error);
        return lang === 'id' ? "Identifikasi masalah utama terlebih dahulu." : "Identify the main problem first.";
    }
};

// ==========================================
// SIMPLE ACKNOWLEDGMENT
// ==========================================

/**
 * Generate quick acknowledgment for user input
 * Used to keep user engaged without deep analysis
 */
export const generateSimpleAcknowledgment = async (userInput, profile) => {
    const lang = profile?.language || 'en';

    // For very short inputs, use template
    if (userInput.length < 50) {
        const acks = {
            en: ["Got it.", "Noted.", "Okay, continue.", "I see."],
            id: ["Dicatat.", "Oke.", "Lanjutkan.", "Saya mengerti."]
        };
        const messages = acks[lang] || acks.en;
        return messages[Math.floor(Math.random() * messages.length)];
    }

    try {
        const prompt = `User said: "${userInput.substring(0, 100)}..."

Give 1 very short acknowledgment (max 8 words) that:
1. Shows you heard them
2. Encourages them to continue
${getLanguageInstruction(profile)}
Just the acknowledgment.`;

        const response = await invokeLowLevelAI({ prompt });
        return typeof response === 'string' ? response.trim() : (lang === 'id' ? "Dicatat. Lanjutkan." : "Got it. Continue.");
    } catch (error) {
        console.error('Simple acknowledgment error:', error);
        return lang === 'id' ? "Dicatat. Lanjutkan." : "Got it. Continue.";
    }
};

// ==========================================
// QUICK ENCOURAGEMENT
// ==========================================

/**
 * Generate quick encouragement message
 * For positive reinforcement without complex analysis
 */
export const generateQuickEncouragement = async (profile, context = 'general') => {
    const lang = profile?.language || 'en';
    const archetype = profile?.primary_archetype || 'analyst';

    const encouragements = {
        en: {
            analyst: ["Good analysis.", "Clear thinking.", "Data-driven approach."],
            risk_taker: ["Bold move.", "Decisive.", "Taking action."],
            builder: ["Good execution.", "Making progress.", "Building momentum."],
            strategist: ["Smart positioning.", "Good foresight.", "Big picture view."]
        },
        id: {
            analyst: ["Analisis bagus.", "Pemikiran yang jelas.", "Pendekatan berbasis data."],
            risk_taker: ["Langkah berani.", "Tegas.", "Mengambil tindakan."],
            builder: ["Eksekusi bagus.", "Membuat kemajuan.", "Membangun momentum."],
            strategist: ["Posisi cerdas.", "Pandangan jauh.", "Gambaran besar."]
        }
    };

    const archMessages = encouragements[lang]?.[archetype] || encouragements.en[archetype] || encouragements.en.analyst;
    return archMessages[Math.floor(Math.random() * archMessages.length)];
};

export default {
    generateQuickReminder,
    generateNextMicroStep,
    generateSimpleAcknowledgment,
    generateQuickEncouragement
};
