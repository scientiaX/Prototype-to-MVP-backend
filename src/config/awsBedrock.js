/**
 * AWS Bedrock Configuration - 3-Tier AI System
 * 
 * Uses Amazon Bedrock native API Keys (bearer token authentication)
 * 
 * Environment Variable: AWS_AI_API
 * Format: The full API key from Amazon Bedrock console (starts with ABSK...)
 * 
 * Model Tiers:
 * - Low (Mistral 7B): Fast realtime responses, reminders, small steps
 * - Mid (Claude 3 Haiku): Planning, analysis, considerations during arena
 * - Agent (Claude 3.5 Sonnet): Problem generation, XP calculation, evaluation
 */

import dotenv from 'dotenv';

dotenv.config();

// Model IDs for each tier
const MODEL_IDS = {
    LOW: 'mistral.mistral-7b-instruct-v0:2',
    MID: 'anthropic.claude-3-haiku-20240307-v1:0',
    AGENT: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
};

// Parse region from API key name (BedrockAPIKey-{identifier}-at-{accountId})
const parseRegionFromApiKey = (apiKey) => {
    try {
        // Decode the ABSK key to get the key name
        const decoded = Buffer.from(apiKey.substring(4), 'base64').toString('utf-8');
        // Try to find region pattern - default to us-east-1 if not found
        // The key name format is typically: BedrockAPIKey-{id}-at-{accountId}
        return 'us-east-1'; // Default region - user can override with AWS_REGION env var
    } catch (e) {
        return 'us-east-1';
    }
};

// Get configuration
const getConfig = () => {
    const apiKey = process.env.AWS_AI_API;
    const region = process.env.AWS_REGION || parseRegionFromApiKey(apiKey || '') || 'us-east-1';

    if (!apiKey) {
        console.warn('[AWS Bedrock] AWS_AI_API not set. AI features will not work.');
        return null;
    }

    console.log('[AWS Bedrock] Using API key authentication, region:', region);

    return { apiKey, region };
};

/**
 * Invoke a Bedrock model using the Converse API with API key authentication
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const config = getConfig();
    if (!config) {
        throw new Error('AWS Bedrock not configured. Check AWS_AI_API environment variable.');
    }

    const { apiKey, region } = config;

    // Build the request for Bedrock Converse API
    const endpoint = `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeURIComponent(modelId)}/converse`;

    // Format the message content
    let messageContent = prompt;
    if (jsonSchema) {
        messageContent += '\n\nRespond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
    }

    const requestBody = {
        messages: [
            {
                role: 'user',
                content: [
                    {
                        text: messageContent
                    }
                ]
            }
        ],
        inferenceConfig: {
            maxTokens: 2000,
            temperature: 0.7
        }
    };

    const startTime = Date.now();

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const elapsed = Date.now() - startTime;
        console.log(`[AWS Bedrock - ${tier}] Model: ${modelId}, Time: ${elapsed}ms`);

        // Extract text from response
        let content = '';
        if (data.output?.message?.content) {
            content = data.output.message.content
                .filter(c => c.text)
                .map(c => c.text)
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
                console.warn(`[AWS Bedrock - ${tier}] Failed to parse JSON response, returning raw content`);
                return content;
            }
        }

        return content;

    } catch (error) {
        const elapsed = Date.now() - startTime;
        console.error(`[AWS Bedrock - ${tier}] Error after ${elapsed}ms:`, error.message);
        throw new Error(`AWS Bedrock API Error (${tier}): ${error.message}`);
    }
};

// ==========================================
// TIER-SPECIFIC INVOKE FUNCTIONS
// ==========================================

/**
 * Low-level AI (Mistral 7B) - Fast realtime operations
 * Use for: reminders, next micro-steps, simple responses during arena
 */
export const invokeLowLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.LOW, prompt, response_json_schema, 'Low');
};

/**
 * Mid-level AI (Claude 3 Haiku) - Balanced speed and accuracy
 * Use for: planning next steps, analysis, considerations during arena
 */
export const invokeMidLevelAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.MID, prompt, response_json_schema, 'Mid');
};

/**
 * Agent-level AI (Claude 3.5 Sonnet) - High accuracy for complex tasks
 * Use for: problem generation, XP calculation, full evaluation
 */
export const invokeAgentAI = async ({ prompt, response_json_schema = null }) => {
    return invokeModel(MODEL_IDS.AGENT, prompt, response_json_schema, 'Agent');
};

// Legacy compatibility - uses Agent level by default
export const invokeLLM = async ({ prompt, response_json_schema = null, model = null }) => {
    console.warn('[AWS Bedrock] Using legacy invokeLLM - consider using tier-specific functions');
    return invokeAgentAI({ prompt, response_json_schema });
};

export default {
    invokeLowLevelAI,
    invokeMidLevelAI,
    invokeAgentAI,
    invokeLLM,
    MODEL_IDS
};
