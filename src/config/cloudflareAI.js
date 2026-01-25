/**
 * Cloudflare Workers AI Configuration - Realtime/Light Tasks
 * 
 * Environment Variables:
 * - AI_API_RESPONSE: Cloudflare API Token
 * - CLOUDFLARE_ACCOUNT_ID: Cloudflare Account ID
 * 
 * Used for:
 * - Realtime arena responses
 * - Light tasks (hints, reminders, acknowledgments)
 * - Quick considerations during arena
 * 
 * Benefits:
 * - No RPM limit (burst friendly)
 * - Edge deployment (low latency)
 * - 10k neurons/day free
 */

import dotenv from 'dotenv';

dotenv.config();

// Model IDs for Cloudflare Workers AI
const MODEL_IDS = {
    LOW: '@cf/meta/llama-3.1-8b-instruct',
    MID: '@cf/mistral/mistral-7b-instruct-v0.1'
};

// Get configuration
const getConfig = () => {
    const apiToken = process.env.AI_API_RESPONSE;
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;

    if (!apiToken) {
        console.error('[Cloudflare AI] ERROR: AI_API_RESPONSE not set!');
        return null;
    }

    if (!accountId) {
        console.error('[Cloudflare AI] ERROR: CLOUDFLARE_ACCOUNT_ID not set!');
        return null;
    }

    console.log(`[Cloudflare AI] Config OK - Account: ${accountId.substring(0, 8)}..., Token: ${apiToken.substring(0, 10)}...`);

    return { apiToken, accountId };
};

/**
 * Invoke Cloudflare Workers AI model
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const config = getConfig();

    // Fallback to Groq if Cloudflare not configured
    if (!config) {
        console.warn('[Cloudflare AI] Not configured, falling back to simple response');
        return null;
    }

    const { apiToken, accountId } = config;
    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${modelId}`;

    // Build messages
    let systemPrompt = 'You are a helpful, concise AI assistant for a problem-solving arena. Be brief and direct.';
    if (jsonSchema) {
        systemPrompt += ' Respond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
    }

    const requestBody = {
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
        ],
        max_tokens: 500 // Keep responses short for realtime
    };

    const startTime = Date.now();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        console.log(`[Cloudflare AI - ${tier}] Model: ${modelId}, Time: ${elapsed}ms`);

        // Extract content from Cloudflare response format
        let content = '';
        if (data.result?.response) {
            content = data.result.response;
        } else if (data.result?.choices?.[0]?.message?.content) {
            content = data.result.choices[0].message.content;
        } else if (typeof data.result === 'string') {
            content = data.result;
        }

        // Parse JSON if schema was provided
        if (jsonSchema && content) {
            try {
                const jsonMatch = content.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    return JSON.parse(jsonMatch[0]);
                }
                return JSON.parse(content);
            } catch (parseError) {
                console.warn(`[Cloudflare AI - ${tier}] Failed to parse JSON, returning raw`);
                return content;
            }
        }

        return content;

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[Cloudflare AI - ${tier}] Error after ${elapsed}ms:`, error.message);

        // Return null instead of throwing - caller should handle fallback
        return null;
    }
};

// ==========================================
// TIER-SPECIFIC INVOKE FUNCTIONS (Light/Realtime Tasks)
// ==========================================

/**
 * Low-level AI (Llama 3.1 8B) - Ultra fast realtime responses
 * Used for: Quick reminders, micro-steps, simple acknowledgments
 */
export const invokeLowLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.LOW, prompt, response_json_schema, 'Low');
};

/**
 * Mid-level AI (Mistral 7B) - Quick considerations
 * Used for: Hints, light analysis, quick follow-ups
 */
export const invokeMidLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.MID, prompt, response_json_schema, 'Mid');
};

export default {
    invokeLowLevelAI,
    invokeMidLevelAI,
    MODEL_IDS
};
