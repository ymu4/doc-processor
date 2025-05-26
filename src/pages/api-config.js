// pages/api-config.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';

export default function ApiConfiguration() {
    const router = useRouter();
    const { configureApiProvider, apiKeysConfigured, currentUser } = useAuth();

    const [provider, setProvider] = useState('claude');
    const [claudeKey, setClaudeKey] = useState('');
    const [openaiKey, setOpenaiKey] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [keyVisibleClaude, setKeyVisibleClaude] = useState(false);
    const [keyVisibleOpenAI, setKeyVisibleOpenAI] = useState(false);
    const [success, setSuccess] = useState(false);

    // Redirect to home if already configured
    useEffect(() => {
        if (apiKeysConfigured) {
            router.push('/');
        }
    }, [apiKeysConfigured, router]);

    async function handleSubmit(e) {
        e.preventDefault();

        // Validate API keys based on provider
        if (provider === 'claude' && (!claudeKey || claudeKey.length < 10)) {
            return setError('Please enter a valid Claude API key');
        }
        if (provider === 'openai' && (!openaiKey || openaiKey.length < 10)) {
            return setError('Please enter a valid OpenAI API key');
        }
        if (provider === 'both' && (!claudeKey || !openaiKey || claudeKey.length < 10 || openaiKey.length < 10)) {
            return setError('Please enter valid API keys for both providers');
        }

        setError('');
        setLoading(true);

        try {
            await configureApiProvider(provider, {
                claudeKey: claudeKey,
                openaiKey: openaiKey
            });

            // Show success message
            setSuccess(true);

            // Redirect to home page after 2 seconds
            setTimeout(() => {
                router.push('/');
            }, 2000);
        } catch (error) {
            console.error('API configuration error:', error);
            setError('Failed to configure API provider: ' + error.message);
            setLoading(false);
        }
    }

    // If user is not logged in, redirect to login
    if (!currentUser) {
        return null; // This will be handled by RouteGuard in _app.js
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        Configure API Provider
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        To use the process optimization tool, you need to provide your own API key(s)
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border-l-4 border-red-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-700">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {success && (
                    <div className="bg-green-50 border-l-4 border-green-400 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-green-700">API configuration successful! Redirecting to home...</p>
                            </div>
                        </div>
                    </div>
                )}

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm">
                        <div className="mb-4">
                            <label htmlFor="api-provider" className="block text-sm font-medium text-gray-700 mb-1">
                                Select API Provider
                            </label>
                            <select
                                id="api-provider"
                                name="api-provider"
                                value={provider}
                                onChange={(e) => setProvider(e.target.value)}
                                className="block w-full px-3 py-2 border text-gray-500 border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            >
                                <option value="claude">Claude (Anthropic)</option>
                                <option value="openai">OpenAI</option>
                                <option value="both">Both (for fallback capabilities)</option>
                            </select>
                        </div>

                        {(provider === 'claude' || provider === 'both') && (
                            <div className="mb-4">
                                <label htmlFor="claude-api-key" className="block text-sm font-medium text-gray-700 mb-1">
                                    Claude API Key
                                </label>
                                <div className="relative">
                                    <input
                                        id="claude-api-key"
                                        name="claude-api-key"
                                        type={keyVisibleClaude ? "text" : "password"}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10 text-gray-500"
                                        placeholder="Enter your Claude API key"
                                        value={claudeKey}
                                        onChange={(e) => setClaudeKey(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                                        onClick={() => setKeyVisibleClaude(!keyVisibleClaude)}
                                    >
                                        {keyVisibleClaude ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    From <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">Anthropic Console</a>
                                </p>
                            </div>
                        )}

                        {(provider === 'openai' || provider === 'both') && (
                            <div className="mb-4">
                                <label htmlFor="openai-api-key" className="block text-sm font-medium text-gray-700 mb-1">
                                    OpenAI API Key
                                </label>
                                <div className="relative">
                                    <input
                                        id="openai-api-key"
                                        name="openai-api-key"
                                        type={keyVisibleOpenAI ? "text" : "password"}
                                        className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm pr-10 text-gray-500"
                                        placeholder="Enter your OpenAI API key"
                                        value={openaiKey}
                                        onChange={(e) => setOpenaiKey(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
                                        onClick={() => setKeyVisibleOpenAI(!keyVisibleOpenAI)}
                                    >
                                        {keyVisibleOpenAI ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                                                <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3.707 2.293a1 1 0 00-1.414 1.414l14 14a1 1 0 001.414-1.414l-1.473-1.473A10.014 10.014 0 0019.542 10C18.268 5.943 14.478 3 10 3a9.958 9.958 0 00-4.512 1.074l-1.78-1.781zm4.261 4.26l1.514 1.515a2.003 2.003 0 012.45 2.45l1.514 1.514a4 4 0 00-5.478-5.478z" clipRule="evenodd" />
                                                <path d="M12.454 16.697L9.75 13.992a4 4 0 01-3.742-3.741L2.335 6.578A9.98 9.98 0 00.458 10c1.274 4.057 5.065 7 9.542 7 .847 0 1.669-.105 2.454-.303z" />
                                            </svg>
                                        )}
                                    </button>
                                </div>
                                <p className="mt-1 text-xs text-gray-500">
                                    From <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">OpenAI API Keys</a>
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="text-sm text-gray-600 bg-blue-50 p-4 rounded-md border border-blue-100">
                        <p className="font-medium text-blue-800">Your API keys are stored securely</p>
                        <ul className="list-disc ml-5 mt-2 space-y-1">
                            <li>Keys are stored only in your browser's session storage</li>
                            <li>They are never sent to our servers or stored in databases</li>
                            <li>Keys are automatically cleared when you log out or close your browser</li>

                        </ul>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading || success}
                            className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white ${loading || success ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
                                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                            {loading ? 'Configuring...' : success ? 'Configured Successfully' : 'Configure API Provider'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}