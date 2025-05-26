// middleware/apiKeyMiddleware.js
// This middleware helps configure API keys from the browser to be used in API routes

// Function to get API keys from request headers and configure them for use in an API route
export function configureApiKeysFromRequest(req, res) {
    // Check if req and req.headers exist
    if (!req || !req.headers) {
        console.warn('Request or headers undefined in configureApiKeysFromRequest');
        return {
            claudeApiKey: null,
            openaiApiKey: null,
            provider: 'auto'
        };
    }

    // Extract API keys from headers (if they exist)
    const claudeApiKey = req.headers['x-claude-api-key'];
    const openaiApiKey = req.headers['x-openai-api-key'];
    const provider = req.headers['x-api-provider'];

    // console.log('API Keys in headers:', {
    //     provider,
    //     claude: claudeApiKey ? 'Present' : 'Not present',
    //     openai: openaiApiKey ? 'Present' : 'Not present'
    // });

    // Set environment variables for this request only (won't persist beyond this request)
    if (claudeApiKey) {
        process.env.CLAUDE_API_KEY_TEMP = claudeApiKey;
    }

    if (openaiApiKey) {
        process.env.OPENAI_API_KEY_TEMP = openaiApiKey;
    }

    if (provider) {
        process.env.API_PROVIDER_TEMP = provider;
    }

    // Return the provider and available keys for the route to use
    return {
        claudeApiKey,
        openaiApiKey,
        provider: provider || 'auto'
    };
}

// This function is meant to be used on the client side to add API keys to fetch requests
export function addApiKeysToRequest(options = {}) {
    // Get API keys from session storage
    const claudeApiKey = sessionStorage.getItem('claude_api_key');
    const openaiApiKey = sessionStorage.getItem('openai_api_key');
    const provider = sessionStorage.getItem('api_provider');

    // Create headers if they don't exist
    if (!options.headers) {
        options.headers = {};
    }

    // Add API keys to headers
    if (claudeApiKey) {
        options.headers['X-Claude-API-Key'] = claudeApiKey;
    }

    if (openaiApiKey) {
        options.headers['X-OpenAI-API-Key'] = openaiApiKey;
    }

    if (provider) {
        options.headers['X-API-Provider'] = provider;
    }

    return options;
}