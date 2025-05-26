// utils/analyticsService.js

import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { parseTimeToMinutes } from './metricsProcessor';
import { getAuth } from "firebase/auth";

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
let db;
let auth;

try {
    // Check if Firebase is already initialized
    app = initializeApp(firebaseConfig);
} catch (error) {
    // Firebase already initialized
    if (!/already exists/.test(error.message)) {
        console.error('Firebase initialization error', error.stack);
    }
}

// Get Firestore instance
db = getFirestore(app);
auth = getAuth(app);

/**
 * Get current user's unit
 * @returns {Promise<string|null>} - Unit ID or null if not logged in
 */
async function getCurrentUserUnit() {
    const currentUser = auth.currentUser;

    if (!currentUser) return null;

    try {
        const userRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
            return userDoc.data().unit || null;
        }

        return null;
    } catch (error) {
        console.error('Error getting user unit:', error);
        return null;
    }
}
/**
 * Sanitize data for Firestore by removing undefined values
 * @param {Object} data - Data to sanitize
 * @returns {Object} - Sanitized data
 */
function sanitizeData(data) {
    if (!data || typeof data !== 'object') return {};

    // Create a new object to avoid modifying the original
    const sanitized = {};

    // Copy all defined values
    Object.entries(data).forEach(([key, value]) => {
        // Skip undefined values
        if (value === undefined) return;

        // Recursively sanitize objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[key] = sanitizeData(value);
        } else if (Array.isArray(value)) {
            // Filter out undefined values from arrays
            sanitized[key] = value.filter(item => item !== undefined);
        } else {
            sanitized[key] = value;
        }
    });

    return sanitized;
}

/**
 * Record an analytics event
 * @param {string} eventType - Type of event (documentUpload, optimization, workflowRegeneration)
 * @param {Object} data - Additional data for the event
 */
export async function recordAnalyticEvent(eventType, data = {}) {
    try {
        // Get current user's unit
        const unit = await getCurrentUserUnit();

        // Add current user data
        const currentUser = auth.currentUser;
        const userData = currentUser ? {
            userId: currentUser.uid,
            userEmail: currentUser.email,
            unit
        } : {
            guest: true,
            unit: null
        };

        // Sanitize the data to remove undefined values
        const sanitizedData = sanitizeData({
            ...data,
            user: userData
        });

        console.log(`Recording ${eventType} event for unit: ${unit || 'guest'}`);

        await addDoc(collection(db, 'analytics'), {
            type: eventType,
            data: sanitizedData,
            unit,  // Add unit at the top level for easier querying
            timestamp: serverTimestamp(),
            userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
        });

        console.log(`Recorded ${eventType} event successfully`);
    } catch (error) {
        // Log error but don't disrupt the user experience
        console.error('Error recording analytics:', error);
    }
}
/**
 * Record a document upload event
 * @param {Object} data - Upload data including file count, types, etc.
 */
export function recordDocumentUpload(data) {
    return recordAnalyticEvent('documentUpload', {
        fileCount: data.documentCount || 0,
        fileTypes: data.processedFiles?.map(file => file.type) || [],
        success: true
    });
}

/**
 * Record a workflow regeneration event
 * @param {Object} workflowData - Data about the regenerated workflow
 */

/**
 * Record a workflow regeneration event
 * @param {Object} data - Data about the regeneration
 */
export default function recordWorkflowRegeneration(data) {
    return recordAnalyticEvent('workflowRegeneration', {
        reason: data.reason || 'user_initiated',

    });
}




/**
 * Record an optimization event with proper data extraction
 * @param {Object} optimizationData - Data about the optimization
 */
export function recordOptimization(optimizationData) {
    try {
        console.log("Raw optimization data:", JSON.stringify(optimizationData, null, 2));

        // Extract original and optimized time values consistently
        const originalTime = optimizationData.originalMetrics?.totalTime || "Unknown";
        const optimizedTime = optimizationData.metrics?.totalTime || "Unknown";

        // Get original and optimized minutes
        const originalMinutes = parseTimeToMinutes(originalTime);
        const optimizedMinutes = parseTimeToMinutes(optimizedTime);

        // Calculate time saved and percentage
        let timeSavedMinutes = 0;
        let timeSavingsPercent = 0;

        if (originalMinutes && optimizedMinutes && originalMinutes > 0) {
            timeSavedMinutes = Math.max(0, originalMinutes - optimizedMinutes);
            timeSavingsPercent = Math.round((timeSavedMinutes / originalMinutes) * 100);
        } else {
            // Fallback to step-based calculation
            const originalSteps = optimizationData.originalMetrics?.totalSteps || 0;
            const optimizedSteps = optimizationData.metrics?.totalSteps || 0;

            if (originalSteps > 0) {
                const stepReduction = Math.max(0, originalSteps - optimizedSteps);
                timeSavingsPercent = Math.round((stepReduction / originalSteps) * 100);

                // Estimate time savings based on step reduction if we have original time but not optimized
                if (originalMinutes && !optimizedMinutes) {
                    timeSavedMinutes = Math.round(originalMinutes * (timeSavingsPercent / 100));
                }
            }
        }

        // Log the calculated values for debugging
        console.log("Time calculation values:", {
            originalTime,
            optimizedTime,
            originalMinutes,
            optimizedMinutes,
            timeSavedMinutes,
            timeSavingsPercent
        });



        // Create the analytics data object
        const analyticsData = {
            originalSteps: optimizationData.originalMetrics?.totalSteps || 0,
            optimizedSteps: optimizationData.metrics?.totalSteps || 0,
            timeSavedMinutes,
            timeSavingsPercent,
            provider: optimizationData.provider || 'unknown',
            isRegenerated: optimizationData.isRegenerated || false  // Track regenerations
        };

        // Record the event with the corrected data
        return recordAnalyticEvent('optimization', analyticsData);
    } catch (error) {
        console.error('Error recording optimization metrics:', error);
        return recordAnalyticEvent('optimization_error', { error: error.message });
    }

}


// // Test that Firebase is connected
// console.log("Firebase initialized with project:", firebaseConfig.projectId || 'unknown');
// recordAnalyticEvent('app_initialized', { test: true })
//     .then(() => console.log("Test analytics event recorded successfully"))
//     .catch(err => console.error("Failed to record test event:", err));