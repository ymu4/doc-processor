// contexts/AuthContext.js
import { createContext, useState, useEffect, useContext } from 'react';
import {
    getAuth,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    createUserWithEmailAndPassword
} from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

// Firebase configuration
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    if (!/already exists/.test(error.message)) {
        // console.error('Firebase initialization error', error.stack);
    }
}

const auth = getAuth(app);
const db = getFirestore(app);

// Create Authentication Context
const AuthContext = createContext();

export function useAuth() {
    return useContext(AuthContext);
}

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [userUnit, setUserUnit] = useState(null);
    const [apiProvider, setApiProvider] = useState(null);
    const [loading, setLoading] = useState(true);
    const [apiKeysConfigured, setApiKeysConfigured] = useState(false);

    async function login(email, password, unit) {
        try {
            // First login with Firebase Authentication
            const userCredential = await signInWithEmailAndPassword(auth, email, password);

            // Then store/update the user's unit in Firestore if provided
            if (unit) {
                const userRef = doc(db, 'users', userCredential.user.uid);
                await setDoc(userRef, { email, unit }, { merge: true });
                setUserUnit(unit);
            }

            return userCredential;
        } catch (error) {
            console.error("Login error:", error);
            throw error;
        }
    }

    async function signup(email, password, unit) {
        try {
            // Create new user with Firebase Authentication
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);

            // Store the user's unit in Firestore
            const userRef = doc(db, 'users', userCredential.user.uid);
            await setDoc(userRef, { email, unit, role: 'user' });

            setUserUnit(unit);

            return userCredential;
        } catch (error) {
            console.error("Signup error:", error);
            throw error;
        }
    }

    async function logout() {
        try {
            setLoading(true);

            // Clear all API keys from session storage
            sessionStorage.removeItem('claude_api_key');
            sessionStorage.removeItem('openai_api_key');
            sessionStorage.removeItem('api_provider');

            // Log this for debugging
            //  console.log("API keys cleared from session storage");

            // Your existing logout logic (Firebase or other auth provider)
            await auth.signOut();

            setCurrentUser(null);
            setApiKeysConfigured(false);
        } catch (error) {
            console.error("Error logging out:", error);
        } finally {
            setLoading(false);
        }
    }


    // Function to check if user is an admin
    async function isAdmin() {
        if (!currentUser) return false;

        try {
            const userRef = doc(db, 'users', currentUser.uid);
            const userDoc = await getDoc(userRef);

            // console.log("Admin check - user data:", userDoc.exists() ? userDoc.data() : "No user document");

            if (userDoc.exists() && userDoc.data().role === 'admin') {
                // console.log("User is confirmed as admin");
                return true;
            }

            // console.log("User is not an admin");
            return false;
        } catch (error) {
            console.error("Error checking admin status:", error);
            return false;
        }
    }

    // Function to configure API provider and keys
    async function configureApiProvider(provider, apiKeys) {
        try {
            if (!currentUser) throw new Error("User not authenticated");

            console.log("Configuring API provider:", provider);
            // console.log("API keys provided:", {
            //     claude: apiKeys.claudeKey ? "Present" : "Not present",
            //     openai: apiKeys.openaiKey ? "Present" : "Not present"
            // });

            // Validate API key format
            if (provider === 'claude' && (!apiKeys.claudeKey || apiKeys.claudeKey.length < 10)) {
                throw new Error("Invalid Claude API key");
            }
            if (provider === 'openai' && (!apiKeys.openaiKey || apiKeys.openaiKey.length < 10)) {
                throw new Error("Invalid OpenAI API key");
            }
            if (provider === 'both' && (!apiKeys.claudeKey || !apiKeys.openaiKey || apiKeys.claudeKey.length < 10 || apiKeys.openaiKey.length < 10)) {
                throw new Error("Invalid API keys");
            }

            // Set provider in state
            setApiProvider(provider);

            // Store provider preference in Firestore
            const userRef = doc(db, 'users', currentUser.uid);
            await setDoc(userRef, { apiProvider: provider }, { merge: true });

            // Store API keys in session storage (not Firebase for security)
            if (provider === 'claude' || provider === 'both') {
                sessionStorage.setItem('claude_api_key', apiKeys.claudeKey);
            }
            if (provider === 'openai' || provider === 'both') {
                sessionStorage.setItem('openai_api_key', apiKeys.openaiKey);
            }
            sessionStorage.setItem('api_provider', provider);

            // Update state and verify storage
            setApiKeysConfigured(true);
            checkStoredAPIKeys();

            return true;
        } catch (error) {
            console.error("Error configuring API provider:", error);
            throw error;
        }
    }


    // Function to get API keys from session storage
    function getApiKeys() {
        const provider = sessionStorage.getItem('api_provider') || apiProvider;
        const claudeKey = sessionStorage.getItem('claude_api_key') || null;
        const openaiKey = sessionStorage.getItem('openai_api_key') || null;

        return {
            provider,
            claudeKey,
            openaiKey
        };
    }

    function checkStoredAPIKeys() {
        const claudeKey = sessionStorage.getItem('claude_api_key');
        const openaiKey = sessionStorage.getItem('openai_api_key');
        const provider = sessionStorage.getItem('api_provider');

        // console.log("Stored API keys:", {
        //     claude: claudeKey ? "Present" : "Not present",
        //     openai: openaiKey ? "Present" : "Not present",
        //     provider: provider || "Not set"
        // });
    }
    // When logging in with Claude
    function handleClaudeLogin(apiKey) {
        // Clear any existing keys first
        sessionStorage.removeItem('openai_api_key');

        // Set only the Claude key
        sessionStorage.setItem('claude_api_key', apiKey);
        sessionStorage.setItem('api_provider', 'claude');

        //   console.log("Logged in with Claude API key");
    }

    // When logging in with OpenAI
    function handleOpenAILogin(apiKey) {
        // Clear any existing keys first
        sessionStorage.removeItem('claude_api_key');

        // Set only the OpenAI key
        sessionStorage.setItem('openai_api_key', apiKey);
        sessionStorage.setItem('api_provider', 'openai');

        //   console.log("Logged in with OpenAI API key");
    } useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUser(user);
                //console.log("User authenticated:", user.email);

                // Fetch user's data from Firestore
                try {
                    const userRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        setUserUnit(userData.unit);

                        // Check if user is admin
                        const userIsAdmin = userData.role === 'admin';
                        //  console.log("User admin status from Firestore:", userIsAdmin);

                        // Set API provider from user data
                        setApiProvider(userData.apiProvider || null);
                        //  console.log("API provider from Firestore:", userData.apiProvider || "Not set");

                        // For admin users with API provider set in Firestore, consider API keys configured
                        if (userIsAdmin && userData.apiProvider) {
                            //    console.log("Admin user with API provider configured, setting apiKeysConfigured = true");
                            setApiKeysConfigured(true);

                            // If no session storage keys exist, add a placeholder for admin users
                            if (!sessionStorage.getItem(userData.apiProvider + '_api_key')) {
                                sessionStorage.setItem('api_provider', userData.apiProvider);
                                // Use a placeholder key for admins if none exists
                                sessionStorage.setItem(userData.apiProvider + '_api_key', 'admin_placeholder_key');
                                // console.log("Added placeholder API key for admin");
                            }
                        }
                    }

                    // Check if API keys are in session storage for regular users
                    const storedProvider = sessionStorage.getItem('api_provider');
                    if (storedProvider) {
                        setApiProvider(storedProvider);
                        //  console.log("API provider from session storage:", storedProvider);

                        // Check if appropriate keys exist
                        let keysExist = false;
                        if (storedProvider === 'claude' && sessionStorage.getItem('claude_api_key')) {
                            keysExist = true;
                        } else if (storedProvider === 'openai' && sessionStorage.getItem('openai_api_key')) {
                            keysExist = true;
                        } else if (
                            storedProvider === 'both' &&
                            sessionStorage.getItem('claude_api_key') &&
                            sessionStorage.getItem('openai_api_key')
                        ) {
                            keysExist = true;
                        }

                        //  console.log("API keys exist in session storage:", keysExist);
                        setApiKeysConfigured(keysExist);
                    }

                    checkStoredAPIKeys();
                } catch (error) {
                    console.error("Error fetching user data:", error);
                }
            } else {
                setCurrentUser(null);
                setUserUnit(null);
                setApiProvider(null);
                setApiKeysConfigured(false);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userUnit,
        apiProvider,
        apiKeysConfigured,
        loading,
        login,
        signup,
        logout,
        isAdmin,
        configureApiProvider,
        getApiKeys,
        checkStoredAPIKeys
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}
