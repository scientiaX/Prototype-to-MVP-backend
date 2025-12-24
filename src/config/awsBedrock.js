/**
 * AWS Bedrock Configuration - 3-Tier AI System
 * 
 * Environment Variable: AWS_AI_API
 * Format: ACCESS_KEY:SECRET_KEY:REGION
 * Example: AKIAIOSFODNN7EXAMPLE:wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY:us-east-1
 * 
 * Model Tiers:
 * - Low (Mistral 7B): Fast realtime responses, reminders, small steps
 * - Mid (Claude 3 Haiku): Planning, analysis, considerations during arena
 * - Agent (Claude 3.5 Sonnet): Problem generation, XP calculation, evaluation
 */

import { BedrockRuntimeClient, InvokeModelCommand } from '@aws-sdk/client-bedrock-runtime';
import dotenv from 'dotenv';

dotenv.config();

// Model IDs for each tier
const MODEL_IDS = {
    LOW: 'mistral.mistral-7b-instruct-v0:2',
    MID: 'anthropic.claude-3-haiku-20240307-v1:0',
    AGENT: 'anthropic.claude-3-5-sonnet-20241022-v2:0'
};

// Parse AWS credentials from environment
const parseAWSCredentials = () => {
    const awsApiKey = process.env.AWS_AI_API;

    if (!awsApiKey) {
        console.warn('[AWS Bedrock] AWS_AI_API not set. AI features will not work.');
        return null;
    }

    const parts = awsApiKey.split(':');
    if (parts.length < 3) {
        console.error('[AWS Bedrock] Invalid AWS_AI_API format. Expected: ACCESS_KEY:SECRET_KEY:REGION');
        return null;
    }

    return {
        accessKeyId: parts[0],
        secretAccessKey: parts[1],
        region: parts[2]
    };
};

// Create Bedrock client
let bedrockClient = null;

const getBedrockClient = () => {
    if (bedrockClient) return bedrockClient;

    const credentials = parseAWSCredentials();
    if (!credentials) return null;

    bedrockClient = new BedrockRuntimeClient({
        region: credentials.region,
        credentials: {
            accessKeyId: credentials.accessKeyId,
            secretAccessKey: credentials.secretAccessKey
        }
    });

    console.log('[AWS Bedrock] Client initialized for region:', credentials.region);
    return bedrockClient;
};

/**
 * Format prompt for Claude models (Anthropic)
 */
const formatClaudePrompt = (prompt, jsonSchema = null) => {
    let formattedPrompt = prompt;
    if (jsonSchema) {
        formattedPrompt += '\n\nRespond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
    }
    return formattedPrompt;
};

/**
 * Format prompt for Mistral models
 */
const formatMistralPrompt = (prompt, jsonSchema = null) => {
    let formattedPrompt = prompt;
    if (jsonSchema) {
        formattedPrompt += '\n\nRespond with valid JSON matching this schema: ' + JSON.stringify(jsonSchema);
    }
    return `<s>[INST] ${formattedPrompt} [/INST]`;
};

/**
 * Invoke a Bedrock model with the given prompt
 */
const invokeModel = async (modelId, prompt, jsonSchema = null, tier = 'UNKNOWN') => {
    const client = getBedrockClient();
    if (!client) {
        throw new Error('AWS Bedrock client not initialized. Check AWS_AI_API environment variable.');
    }

    let body;
    const isClaudeModel = modelId.startsWith('anthropic.');
    const isMistralModel = modelId.startsWith('mistral.');

    if (isClaudeModel) {
        // Claude model format
        body = JSON.stringify({
            anthropic_version: 'bedrock-2023-05-31',
            max_tokens: 2000,
            temperature: 0.7,
            messages: [
                {
                    role: 'user',
                    content: formatClaudePrompt(prompt, jsonSchema)
                }
            ]
        });
    } else if (isMistralModel) {
        // Mistral model format
        body = JSON.stringify({
            prompt: formatMistralPrompt(prompt, jsonSchema),
            max_tokens: 1000,
            temperature: 0.7
        });
    } else {
        throw new Error(`Unsupported model: ${modelId}`);
    }

    const startTime = Date.now();

    try {
        const command = new InvokeModelCommand({
            modelId,
            body,
            contentType: 'application/json',
            accept: 'application/json'
        });

        const response = await client.send(command);
        const responseBody = JSON.parse(new TextDecoder().decode(response.body));

        const elapsed = Date.now() - startTime;
        console.log(`[AWS Bedrock - ${tier}] Model: ${modelId}, Time: ${elapsed}ms`);

        // Extract text response based on model type
        let content;
        if (isClaudeModel) {
            content = responseBody.content?.[0]?.text || responseBody.completion || '';
        } else if (isMistralModel) {
            content = responseBody.outputs?.[0]?.text || responseBody.generation || '';
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
