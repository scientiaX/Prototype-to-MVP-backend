/**
 * Test AWS Bedrock using different authentication methods
 */
import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.AWS_AI_API;
const REGION = process.env.AWS_REGION || 'ap-southeast-2';

console.log('=== Testing Different Auth Methods ===\n');
console.log('API Key:', API_KEY ? API_KEY.substring(0, 20) + '...' : 'MISSING');
console.log('Region:', REGION);
console.log('');

// Method 1: Bearer token (current method)
console.log('--- Method 1: Bearer Token ---');
const MODEL_ID = 'anthropic.claude-3-haiku-20240307-v1:0';
const endpoint1 = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/converse`;

const response1 = await fetch(endpoint1, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        messages: [{ role: 'user', content: [{ text: 'Hi' }] }],
        inferenceConfig: { maxTokens: 10 }
    })
});
console.log('Status:', response1.status);
const text1 = await response1.text();
console.log('Response:', text1.substring(0, 200));
console.log('');

// Method 2: x-api-key header
console.log('--- Method 2: x-api-key Header ---');
const response2 = await fetch(endpoint1, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        messages: [{ role: 'user', content: [{ text: 'Hi' }] }],
        inferenceConfig: { maxTokens: 10 }
    })
});
console.log('Status:', response2.status);
const text2 = await response2.text();
console.log('Response:', text2.substring(0, 200));
console.log('');

// Method 3: InvokeModel endpoint instead of Converse
console.log('--- Method 3: InvokeModel Endpoint ---');
const endpoint3 = `https://bedrock-runtime.${REGION}.amazonaws.com/model/${encodeURIComponent(MODEL_ID)}/invoke`;
const response3 = await fetch(endpoint3, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
    },
    body: JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
    })
});
console.log('Status:', response3.status);
const text3 = await response3.text();
console.log('Response:', text3.substring(0, 200));
