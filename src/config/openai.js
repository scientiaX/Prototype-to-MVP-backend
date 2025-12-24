/**
 * @deprecated This file is deprecated. Use ../config/awsBedrock.js instead.
 * 
 * This file previously used OpenRouter API for AI operations.
 * The system has been migrated to AWS Bedrock with 3-tier AI:
 * - Low: Mistral 7B (realtime)
 * - Mid: Claude 3 Haiku (analysis)
 * - Agent: Claude 3.5 Sonnet (generation)
 * 
 * Import from awsBedrock.js instead:
 * import { invokeLowLevelAI, invokeMidLevelAI, invokeAgentAI } from '../config/awsBedrock.js';
 */

import dotenv from 'dotenv';

dotenv.config();

console.warn('⚠️  [DEPRECATED] openai.js is deprecated. Please migrate to awsBedrock.js');

// Legacy exports for backward compatibility
export const invokeLLM = async ({ prompt, response_json_schema = null, model = null }) => {
  console.warn('⚠️  [DEPRECATED] invokeLLM from openai.js is deprecated. Use awsBedrock.js functions.');

  // Forward to AWS Bedrock
  const { invokeAgentAI } = await import('./awsBedrock.js');
  return invokeAgentAI({ prompt, response_json_schema });
};

export default {
  invokeLLM
};
