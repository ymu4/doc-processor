// utils/llmClient.js - Fixed for browser compatibility
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';

// Default models for each provider
const DEFAULT_OPENAI_MODEL = 'gpt-4o-2024-11-20';
const DEFAULT_CLAUDE_MODEL = 'claude-3-7-sonnet-20250219';

/**
 * Unified LLM client that abstracts away provider-specific implementations
 * Uses environment variables or user-provided API keys from session storage
 * @param {Object} options - Options for the LLM request
 * @param {string} options.provider - The provider to use ('openai', 'claude', or 'auto')
 * @param {string} options.model - The model to use (provider-specific)
 * @param {number} options.maxTokens - Maximum tokens for the response
 * @param {number} options.temperature - Temperature for response generation
 * @param {string} options.systemPrompt - System prompt/instruction
 * @param {string} options.userPrompt - User prompt/query
 * @returns {Promise<Object>} - The LLM response
 */
export async function callLLM(options) {
    const {
        provider = 'auto',
        model,
        maxTokens = 16384,
        temperature = 0.3,
        systemPrompt = '',
        userPrompt = '',
        directApiKeys = null
    } = options;

    // Check if we're running on client or server
    const isClient = typeof window !== 'undefined';

    // Get API keys - from multiple possible sources with priority
    let claudeKey, openaiKey, configuredProvider;

    // 1. Use directly provided API keys if available (highest priority)
    if (directApiKeys) {
        claudeKey = directApiKeys.claudeApiKey;
        openaiKey = directApiKeys.openaiApiKey;
        configuredProvider = directApiKeys.provider;
    }
    // 2. Otherwise, use environment or session storage based on environment
    else if (isClient) {
        // Client-side: use sessionStorage
        claudeKey = window.sessionStorage.getItem('claude_api_key');
        openaiKey = window.sessionStorage.getItem('openai_api_key');
        configuredProvider = window.sessionStorage.getItem('api_provider');
    } else {
        // Server-side: use session-passed keys through headers (stored in temp env vars)
        // No longer using permanent environment variables as requested
        claudeKey = process.env.CLAUDE_API_KEY_TEMP;
        openaiKey = process.env.OPENAI_API_KEY_TEMP;
        configuredProvider = process.env.API_PROVIDER_TEMP || provider;
    }

    // Determine which provider to use
    let primaryProvider = provider;

    if (provider === 'auto') {
        // Use the configured provider if specified
        if (configuredProvider && configuredProvider !== 'both' && configuredProvider !== 'auto') {
            primaryProvider = configuredProvider;
        } else if (configuredProvider === 'both') {
            // If both are configured, use Claude by default
            primaryProvider = 'claude';
        } else {
            // Determine based on available keys - this is where the bug was
            if (claudeKey) {
                primaryProvider = 'claude';
            } else if (openaiKey) {
                primaryProvider = 'openai';
            } else {
                throw new Error("No API keys available. Please configure at least one provider's API key.");
            }
        }
    }

    // Determine the correct model to use based on provider
    const actualModel = model || (primaryProvider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_CLAUDE_MODEL);

    try {
        if (primaryProvider === 'claude') {
            if (!claudeKey) {
                throw new Error("No Claude API key provided but 'claude' provider was specified");
            }
            return await callClaude(
                claudeKey,
                actualModel === DEFAULT_OPENAI_MODEL ? DEFAULT_CLAUDE_MODEL : actualModel,
                maxTokens,
                temperature,
                systemPrompt,
                userPrompt
            );
        } else if (primaryProvider === 'openai') {
            if (!openaiKey) {
                throw new Error("No OpenAI API key provided but 'openai' provider was specified");
            }
            return await callOpenAI(
                openaiKey,
                actualModel === DEFAULT_CLAUDE_MODEL ? DEFAULT_OPENAI_MODEL : actualModel,
                maxTokens,
                temperature,
                systemPrompt,
                userPrompt
            );
        } else {
            throw new Error(`Unknown provider: ${primaryProvider}`);
        }
    } catch (error) {
        console.error(`Error with ${primaryProvider}:`, error);

        // Fallback to the other provider if set to 'auto' and we have both keys
        if (provider === 'auto' && claudeKey && openaiKey && configuredProvider !== 'claude' && configuredProvider !== 'openai') {
            const fallbackProvider = primaryProvider === 'claude' ? 'openai' : 'claude';
            console.log(`Falling back to ${fallbackProvider}...`);

            try {
                if (fallbackProvider === 'claude') {
                    return await callClaude(
                        claudeKey,
                        DEFAULT_CLAUDE_MODEL,
                        maxTokens,
                        temperature,
                        systemPrompt,
                        userPrompt
                    );
                } else {
                    return await callOpenAI(
                        openaiKey,
                        DEFAULT_OPENAI_MODEL,
                        maxTokens,
                        temperature,
                        systemPrompt,
                        userPrompt
                    );
                }
            } catch (fallbackError) {
                console.error(`Fallback to ${fallbackProvider} also failed:`, fallbackError);
                throw fallbackError;
            }
        } else {
            // If not auto or no fallback available, just throw the original error
            throw error;
        }
    }
}

/**
 * Call Claude API with user's API key
 */
async function callClaude(apiKey, model, maxTokens, temperature, systemPrompt, userPrompt) {
    const anthropic = new Anthropic({
        apiKey: apiKey,
    });

    const response = await anthropic.messages.create({
        model: model,
        max_tokens: maxTokens,
        temperature: temperature,
        system: systemPrompt,
        messages: [
            {
                role: "user",
                content: userPrompt
            }
        ]
    });

    return {
        content: response.content[0].text,
        provider: 'claude',
        model: model
    };
}

/**
 * Call OpenAI API with user's API key
 */
async function callOpenAI(apiKey, model, maxTokens, temperature, systemPrompt, userPrompt) {
    // FIXED: Add dangerouslyAllowBrowser option for client-side usage
    const openai = new OpenAI({
        apiKey: apiKey,
        dangerouslyAllowBrowser: true  // IMPORTANT: This is the fix for browser usage
    });

    const messages = [];

    if (systemPrompt) {
        messages.push({
            role: "system",
            content: systemPrompt
        });
    }

    messages.push({
        role: "user",
        content: userPrompt
    });

    const response = await openai.chat.completions.create({
        model: model,
        messages: messages,
        max_tokens: maxTokens,
        temperature: temperature,
    });

    return {
        content: response.choices[0].message.content,
        provider: 'openai',
        model: model
    };
}

export default {
    callLLM
};