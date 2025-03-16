import OpenAI from 'openai';

// Check if the API key is a project key (starts with 'sk-proj-')
const apiKey = process.env.OPENAI_API_KEY || '';
const isProjectKey = apiKey.startsWith('sk-proj-');

console.log('OpenAI API key type:', isProjectKey ? 'Project key' : 'Standard key');
console.log('OpenAI API key length:', apiKey.length);

// Initialize OpenAI client with proper configuration for project keys
const openai = new OpenAI({
  apiKey: apiKey,
  dangerouslyAllowBrowser: false,
});

// Add a helper function to check if the API key is valid
export const isApiKeyValid = () => {
  const key = process.env.OPENAI_API_KEY || '';
  const valid = key.length > 20; // Simple length check
  console.log('API key validation result:', valid);
  return valid;
};

export default openai;
