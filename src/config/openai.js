import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

// OpenRouter API Configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://openrouter.ai/api/v1'
});

// Default model for OpenRouter - using gpt-4o-mini (affordable and capable)
const DEFAULT_MODEL = 'openai/gpt-4o-mini';

// Default model - use env var or fallback
const getDefaultModel = () => {
  return process.env.MODEL_NAME || DEFAULT_MODEL;
};

export const invokeLLM = async ({ prompt, response_json_schema = null, model = getDefaultModel() }) => {
  try {
    const messages = [
      {
        role: 'user',
        content: prompt
      }
    ];

    const requestOptions = {
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000
    };

    if (response_json_schema) {
      requestOptions.response_format = {
        type: 'json_object'
      };
      // Add schema instruction to prompt
      messages[0].content = prompt + '\n\nRespond with valid JSON matching this schema: ' + JSON.stringify(response_json_schema);
    }

    const completion = await openai.chat.completions.create(requestOptions);

    const content = completion.choices[0].message.content;

    if (response_json_schema) {
      return JSON.parse(content);
    }

    return content;
  } catch (error) {
    console.error('OpenAI API Error:', error.message);
    console.error('Full error:', JSON.stringify(error, null, 2));
    throw new Error(`Failed to invoke LLM: ${error.message}`);
  }
};

export default openai;
