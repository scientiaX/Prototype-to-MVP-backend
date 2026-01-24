/**
 * Groq AI Configuration - Multi-Key Rotation for Heavy Tasks
 * 
 * Environment Variables:
 * - AI_API: Primary Groq API Key
 * - AI_API2: Secondary Groq API Key (for load balancing/fallback)
 * 
 * Used for:
 * - Problem generation
 * - Solution evaluation
 * - Heavy planning during arena
 * - XP calculation
 */

import dotenv from 'dotenv';

dotenv.config();

// Model IDs
const MODEL_IDS = {
    MID: 'mixtral-8x7b-32768',
    AGENT: 'llama-3.3-70b-versatile'
};

// Track which key to use next (round-robin)
let currentKeyIndex = 0;

// Get API keys
const getApiKeys = () => {
    const keys = [];

    if (process.env.AI_API) {
        keys.push(process.env.AI_API);
    }
    if (process.env.AI_API2) {
        keys.push(process.env.AI_API2);
    }

    if (keys.length === 0) {
        console.warn('[Groq AI] No API keys configured (AI_API, AI_API2)');
        return null;
    }

    console.log(`[Groq AI] ${keys.length} API key(s) available for rotation`);
    return keys;
};

// Get next key with round-robin
const getNextKey = () => {
    const keys = getApiKeys();
    if (!keys) return null;

    const key = keys[currentKeyIndex];
    currentKeyIndex = (currentKeyIndex + 1) % keys.length;

    return key;
};

// Track rate limits per key
const rateLimitTracker = {};

// Check if key is rate limited
const isKeyRateLimited = (key) => {
    const tracker = rateLimitTracker[key];
    if (!tracker) return false;

    // Reset after 1 minute
    if (Date.now() - tracker.lastError > 60000) {
        delete rateLimitTracker[key];
        return false;
    }

    return tracker.errorCount >= 3;
};

// Mark key as rate limited
const markKeyRateLimited = (key) => {
    if (!rateLimitTracker[key]) {
        rateLimitTracker[key] = { errorCount: 0, lastError: Date.now() };
    }
    rateLimitTracker[key].errorCount++;
    rateLimitTracker[key].lastError = Date.now();
};

/**
 * Invoke Groq model with automatic key rotation and fallback
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const keys = getApiKeys();
    if (!keys) {
        throw new Error('Groq AI not configured. Check AI_API and AI_API2 environment variables.');
    }

    // Try each key until one works
    let lastError = null;
    for (let attempt = 0; attempt < keys.length; attempt++) {
        let apiKey = getNextKey();

        // Skip rate-limited keys
        if (isKeyRateLimited(apiKey)) {
            console.log(`[Groq AI] Skipping rate-limited key, trying next...`);
            continue;
        }

        const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

        let systemMessage = 'You are a helpful AI assistant.';
        if (jsonSchema) {
            systemMessage += ' You MUST respond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
        }

        const requestBody = {
            model: modelId,
            messages: [
                { role: 'system', content: systemMessage },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
        };

        if (jsonSchema) {
            requestBody.response_format = { type: 'json_object' };
        }

        const startTime = Date.now();

        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();

                // Check for rate limit
                if (response.status === 429) {
                    console.warn(`[Groq AI] Rate limited on key ${attempt + 1}, trying next...`);
                    markKeyRateLimited(apiKey);
                    lastError = new Error(`Rate limited: ${errorText}`);
                    continue;
                }

                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const elapsed = Date.now() - startTime;
            console.log(`[Groq AI - ${tier}] Model: ${modelId}, Time: ${elapsed}ms, Key: ${attempt + 1}`);

            let content = data.choices?.[0]?.message?.content || '';

            if (jsonSchema && content) {
                try {
                    const jsonMatch = content.match(/\{[\s\S]*\}/);
                    if (jsonMatch) {
                        return JSON.parse(jsonMatch[0]);
                    }
                    return JSON.parse(content);
                } catch (parseError) {
                    console.warn(`[Groq AI - ${tier}] Failed to parse JSON, returning raw`);
                    return content;
                }
            }

            return content;

        } catch (error) {
            const elapsed = Date.now() - startTime;
            console.error(`[Groq AI - ${tier}] Error after ${elapsed}ms:`, error.message);
            lastError = error;
            continue;
        }
    }

    throw lastError || new Error('All Groq API keys exhausted or rate limited');
};

// ==========================================
// TIER-SPECIFIC INVOKE FUNCTIONS (Heavy Tasks)
// ==========================================

/**
 * Mid-level AI (Mixtral 8x7B) - for planning and considerations
 * Used when task needs more reasoning but not full agent level
 */
export const invokeMidLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.MID, prompt, response_json_schema, 'Mid');
};

/**
 * Agent-level AI (Llama 3.3 70B) - Heavy tasks
 * Used for: Problem generation, XP calculation, full evaluation
 */
export const invokeAgentAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.AGENT, prompt, response_json_schema, 'Agent');
};

// Legacy compatibility
export const invokeLLM = async ({ prompt, response_json_schema = null }) => {
    return invokeAgentAI({ prompt, response_json_schema });
};

export default {
    invokeMidLevelAI,
    invokeAgentAI,
    invokeLLM,
    MODEL_IDS
};
