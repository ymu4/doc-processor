// pages/api/regenerate-document.js
import { generateFormattedDocument, extractProcessMetrics } from '@/utils/documentGenerator';
import { extractMetricsFromDocument } from '@/utils/metricsProcessor';
import { configureApiKeysFromRequest } from '../../middleware/apiKeyMiddleware';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Configure API keys from request headers
        const apiKeys = configureApiKeysFromRequest(req, res);

        // Set environment variables for this request
        if (apiKeys.claudeApiKey) {
            process.env.ANTHROPIC_API_KEY = apiKeys.claudeApiKey;
        }
        if (apiKeys.openaiApiKey) {
            process.env.OPENAI_API_KEY = apiKeys.openaiApiKey;
        }

        // Use the configured provider preference
        const preferredProvider = apiKeys.provider;

        const { extractedData, userFeedback } = req.body;

        if (!extractedData) {
            return res.status(400).json({ error: 'Missing document data' });
        }

        // Add user feedback to extracted data if provided
        const enhancedData = userFeedback
            ? {
                ...extractedData,
                userFeedback
            }
            : extractedData;

        console.log('Regenerating formatted document with feedback...');

        // Generate a new document with the enhanced prompt
        const formattedDocument = await generateFormattedDocument(enhancedData);
        console.log('Document regenerated successfully');

        // Extract metrics from the newly generated document
        console.log('Extracting metrics from regenerated document...');
        let documentMetrics;

        try {
            // First try to use the more thorough extraction method from documentGenerator
            documentMetrics = await extractProcessMetrics(formattedDocument.content);
            console.log('Metrics extracted using extractProcessMetrics');
        } catch (primaryError) {
            console.error('Error with primary metrics extraction:', primaryError);

            // Fall back to the simpler extraction method
            try {
                documentMetrics = await extractMetricsFromDocument(formattedDocument.content);
                console.log('Metrics extracted using fallback extractMetricsFromDocument');
            } catch (fallbackError) {
                console.error('Error with fallback metrics extraction:', fallbackError);
                documentMetrics = {
                    totalSteps: 0,
                    totalTime: "Unknown",
                    totalTimeMinutes: 0,
                    stepTimes: [],
                    source: 'document-extraction-error'
                };
            }
        }

        console.log('Extracted metrics:', JSON.stringify({
            totalSteps: documentMetrics.totalSteps,
            totalTime: documentMetrics.totalTime,
            stepTimesCount: documentMetrics.stepTimes?.length || 0
        }));

        return res.status(200).json({
            formattedDocument,
            documentMetrics,
            provider: formattedDocument.provider || preferredProvider
        });
    } catch (error) {
        console.error('Error regenerating document:', error);
        return res.status(500).json({
            error: 'Failed to regenerate document',
            message: error.message || 'An unexpected error occurred'
        });
    }
}