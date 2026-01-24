/**
 * Google AI Configuration - 3-Tier AI System
 * 
 * Uses Google AI / Gemini API
 * 
 * Environment Variable: AI_API
 * Format: Your Google AI API Key from Google AI Studio
 * 
 * Model Tiers:
 * - Low (Gemini 1.5 Flash): Fast realtime responses, reminders, small steps
 * - Mid (Gemini 1.5 Flash): Planning, analysis, considerations during arena
 * - Agent (Gemini 1.5 Pro): Problem generation, XP calculation, evaluation
 */

import dotenv from 'dotenv';

dotenv.config();

// Model IDs for each tier
// Updated to use available models (gemini-1.5 models are deprecated)
const MODEL_IDS = {
    LOW: 'gemini-2.0-flash',
    MID: 'gemini-2.0-flash',
    AGENT: 'gemini-2.5-pro'
};

// Get configuration
const getConfig = () => {
    const apiKey = process.env.AI_API;

    if (!apiKey) {
        console.warn('[Google AI] AI_API not set. AI features will not work.');
        return null;
    }

    console.log('[Google AI] Using API key authentication');

    return { apiKey };
};

/**
 * Invoke a Google AI model
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const config = getConfig();
    if (!config) {
        throw new Error('Google AI not configured. Check AI_API environment variable.');
    }

    const { apiKey } = config;

    // Build the request for Google AI API
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

    // Format the message content
    let messageContent = prompt;
    if (jsonSchema) {
        messageContent += '\n\nRespond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
    }

    const requestBody = {
        contents: [
            {
                parts: [
                    {
                        text: messageContent
                    }
                ]
            }
        ],
        generationConfig: {
            maxOutputTokens: 2000,
            temperature: 0.7
        }
    };

    // If JSON schema is provided, request JSON output
    if (jsonSchema) {
        requestBody.generationConfig.responseMimeType = 'application/json';
    }

    const startTime = Date.now();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        console.log(`[Google AI - ${tier}] Model: ${modelId}, Time: ${elapsed}ms`);

        // Extract text from response
        let content = '';
        if (data.candidates && data.candidates[0]?.content?.parts) {
            content = data.candidates[0].content.parts
                .filter(p => p.text)
                .map(p => p.text)
                .join('');
        }

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
                console.warn(`[Google AI - ${tier}] Failed to parse JSON response, returning raw content`);
                return content;
            }
        }

        return content;

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Google AI - ${tier}] Error after ${elapsed}ms:`, error.message);
        throw new Error(`Google AI API Error (${tier}): ${error.message}`);
    }
};

// ==========================================
// TIER-SPECIFIC INVOKE FUNCTIONS
// ==========================================

/**
 * Low-level AI (Gemini Flash) - Fast realtime operations
 * Use for: reminders, next micro-steps, simple responses during arena
 */
export const invokeLowLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.LOW, prompt, response_json_schema, 'Low');
};

/**
 * Mid-level AI (Gemini Flash) - Balanced speed and accuracy
 * Use for: planning next steps, analysis, considerations during arena
 */
export const invokeMidLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.MID, prompt, response_json_schema, 'Mid');
};

/**
 * Agent-level AI (Gemini Pro) - High accuracy for complex tasks
 * Use for: problem generation, XP calculation, full evaluation
 */
export const invokeAgentAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.AGENT, prompt, response_json_schema, 'Agent');
};

// Legacy compatibility - uses Agent level by default
export const invokeLLM = async ({ prompt, response_json_schema = null, model = null }) => {
    console.warn('[Google AI] Using legacy invokeLLM - consider using tier-specific functions');
    return invokeAgentAI({ prompt, response_json_schema });
};

export default {
    invokeLowLevelAI,
    invokeMidLevelAI,
    invokeAgentAI,
    invokeLLM,
    MODEL_IDS
};
