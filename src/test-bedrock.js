/**
 * Simple test for AWS Bedrock API
 */
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AWS_AI_API;
const REGION = process.env.AWS_REGION || 'ap-southeast-2';
const MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';

console.log('API Key:', API_KEY ? API_KEY.substring(0, 15) + '...' : 'MISSING');
console.log('Region:', REGION);
console.log('Model:', MODEL_ID);
console.log('');

const endpoint = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/converse`;
console.log('Endpoint:', endpoint);
console.log('');

const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        messages: [{ role: 'user', content: [{ text: 'Say hello' }] }],
        inferenceConfig: { maxTokens: 50 }
    })
});

console.log('Status:', response.status, response.statusText);
const text = await response.text();
console.log('');
console.log('Full Response:');
console.log(text);
