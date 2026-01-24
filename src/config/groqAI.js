/**
 * Groq AI Configuration - 3-Tier AI System
 * 
 * Uses Groq API (OpenAI-compatible)
 * 
 * Environment Variable: GROQ_API_KEY
 * 
 * Model Tiers:
 * - Low (Llama 3.1 8B): Fast realtime responses
 * - Mid (Mixtral 8x7B): Balanced speed and accuracy
 * - Agent (Llama 3.3 70B): High accuracy for complex tasks
 */

import dotenv from 'dotenv';

dotenv.config();

// Model IDs for each tier
const MODEL_IDS = {
    LOW: 'llama-3.1-8b-instant',
    MID: 'mixtral-8x7b-32768',
    AGENT: 'llama-3.3-70b-versatile'
};

// Get configuration
const getConfig = () => {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        console.warn('[Groq AI] GROQ_API_KEY not set. AI features will not work.');
        return null;
    }

    console.log('[Groq AI] Using API key authentication');

    return { apiKey };
};

/**
 * Invoke a Groq AI model (OpenAI-compatible API)
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const config = getConfig();
    if (!config) {
        throw new Error('Groq AI not configured. Check GROQ_API_KEY environment variable.');
    }

    const { apiKey } = config;
    const endpoint = 'https://api.groq.com/openai/v1/chat/completions';

    // Build messages
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

    // Request JSON mode if schema provided
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
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        console.log(`[Groq AI - ${tier}] Model: ${modelId}, Time: ${elapsed}ms`);

        // Extract content from response
        let content = data.choices?.[0]?.message?.content || '';

        // Parse JSON if schema was provided
        if (jsonSchema && content) {
            try {
                // Try to extract JSON from the response
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(content);
            } catch (parseError) {
                console.warn(`[Groq AI - ${tier}] Failed to parse JSON response, returning raw content`);
                return content;
            }
        }

        return content;

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Groq AI - ${tier}] Error after ${elapsed}ms:`, error.message);
        throw new Error(`Groq AI API Error (${tier}): ${error.message}`);
    }
};

// ==========================================
// TIER-SPECIFIC INVOKE FUNCTIONS
// ==========================================

/**
 * Low-level AI (Llama 3.1 8B) - Fast realtime operations
 * Use for: reminders, next micro-steps, simple responses during arena
 */
export const invokeLowLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.LOW, prompt, response_json_schema, 'Low');
};

/**
 * Mid-level AI (Mixtral 8x7B) - Balanced speed and accuracy
 * Use for: planning next steps, analysis, considerations during arena
 */
export const invokeMidLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.MID, prompt, response_json_schema, 'Mid');
};

/**
 * Agent-level AI (Llama 3.3 70B) - High accuracy for complex tasks
 * Use for: problem generation, XP calculation, full evaluation
 */
export const invokeAgentAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.AGENT, prompt, response_json_schema, 'Agent');
};

// Legacy compatibility - uses Agent level by default
export const invokeLLM = async ({ prompt, response_json_schema = null, model = null }) => {
    console.warn('[Groq AI] Using legacy invokeLLM - consider using tier-specific functions');
    return invokeAgentAI({ prompt, response_json_schema });
};

export default {
    invokeLowLevelAI,
    invokeMidLevelAI,
    invokeAgentAI,
    invokeLLM,
    MODEL_IDS
};
