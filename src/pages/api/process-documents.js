// pages/api/process-documents.js - Fixed version

import { IncomingForm } from 'formidable';
import fs from 'fs';
import path from 'path';
import { parseDocument } from '@/utils/documentParser';
import { extractProcessMetrics, generateFormattedDocument } from '@/utils/documentGenerator';
// FIX: Change the import to match how generateWorkflow is exported
// Option 1: If using named export
// import { generateWorkflow } from '@/utils/workflowGenerator';

// OR Option 2: If you need to use the default export
import workflowGenerator from '@/utils/workflowGenerator';
const { generateWorkflow } = workflowGenerator;

import { extractMetricsFromWorkflow, mergeMetrics } from '@/utils/metricsProcessor';
import { configureApiKeysFromRequest } from '../../middleware/apiKeyMiddleware';

// Disable the default body parser
export const config = {
    api: {
        bodyParser: false,
    },
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Configure API keys from the request headers
        const apiKeys = configureApiKeysFromRequest(req, res);

        // Set the environment variables for this request only
        if (apiKeys.claudeApiKey) {
            process.env.ANTHROPIC_API_KEY = apiKeys.claudeApiKey;
        }
        if (apiKeys.openaiApiKey) {
            process.env.OPENAI_API_KEY = apiKeys.openaiApiKey;
        }

        // Parse the incoming form data
        const form = new IncomingForm({
            uploadDir: path.join(process.cwd(), 'tmp'),
            keepExtensions: true,
            multiples: true, // Handle multiple files
        });

        // Ensure upload directory exists
        if (!fs.existsSync(form.uploadDir)) {
            fs.mkdirSync(form.uploadDir, { recursive: true });
        }

        // Parse the form
        const [fields, files] = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) reject(err);
                resolve([fields, files]);
            });
        });

        // Get all document files (they will be named document0, document1, etc.)
        const documentFiles = [];
        for (let i = 0; i < 5; i++) {  // Check for up to 5 files
            const key = `document${i}`;
            if (files[key]) {
                // If the file is an array, extract each file in it
                if (Array.isArray(files[key])) {
                    files[key].forEach(file => documentFiles.push(file));
                } else {
                    documentFiles.push(files[key]);
                }
            }
        }

        console.log(`Received ${documentFiles.length} files for processing`);

        if (documentFiles.length === 0) {
            return res.status(400).json({ error: 'No documents uploaded' });
        }

        // Process each file
        const processedDocuments = [];
        for (const documentFile of documentFiles) {
            // Get file path - check both path and filepath properties
            const filePath = documentFile.filepath || documentFile.path;
            if (!filePath) {
                console.error('File object has no path:', documentFile);
                // Instead of just continuing, add to processed documents with error
                processedDocuments.push({
                    fileName: documentFile.originalFilename || 'unknown',
                    error: 'File path could not be determined',
                    parsed: false
                });
                continue;
            }

            // Get file name and mime type
            const fileName = documentFile.originalFilename || documentFile.name || 'unknown';
            const mimeType = documentFile.mimetype || documentFile.type || 'text/plain';

            console.log('Processing file:', fileName, 'with MIME type:', mimeType);

            // Read the file
            let fileContent;
            try {
                if (mimeType.includes('text') || mimeType.includes('csv')) {
                    fileContent = fs.readFileSync(filePath, 'utf-8');
                } else {
                    // For binary files like PDFs, read as buffer
                    fileContent = fs.readFileSync(filePath);
                }
            } catch (readError) {
                console.error('Error reading file:', readError);
                processedDocuments.push({
                    fileName,
                    error: `Failed to read file: ${readError.message}`,
                    parsed: false
                });
                continue;
            }

            // Parse the document
            try {
                const extractedData = await parseDocument(fileContent, mimeType, fileName);
                extractedData.fileName = fileName;

                // Add to processed documents
                processedDocuments.push({
                    fileName,
                    extractedData,
                    parsed: extractedData.parsed
                });

                // Clean up the temporary file
                try {
                    fs.unlinkSync(filePath);
                } catch (unlinkError) {
                    console.error('Error deleting temporary file:', unlinkError);
                }
            } catch (parseError) {
                console.error(`Error parsing ${fileName}:`, parseError);
                processedDocuments.push({
                    fileName,
                    error: `Failed to parse file: ${parseError.message}`,
                    parsed: false
                });
            }
        }

        // If no documents were successfully processed, return an error
        if (processedDocuments.every(doc => !doc.parsed)) {
            return res.status(400).json({
                error: 'None of the uploaded documents could be processed',
                details: processedDocuments.map(doc => ({
                    fileName: doc.fileName,
                    error: doc.error
                }))
            });
        }

        // Now that we have processed all documents, generate combined output
        const combinedExtractedData = combineDocumentData(processedDocuments);

        // Generate a formatted document based on the combined data
        console.log('Generating formatted document from combined data...');
        const formattedDocument = await generateFormattedDocument(combinedExtractedData);
        console.log('Combined document generated successfully');

        // Generate a unified workflow diagram
        console.log('Generating workflow diagram from combined data...');

        // FIX: Debug the function to ensure it exists
        console.log('generateWorkflow function type:', typeof generateWorkflow);

        // FIX: Call the function with proper parameters
        const workflowDiagram = await generateWorkflow(combinedExtractedData);
        console.log('Workflow generated successfully');

        // Extract process metrics
        console.log('Extracting process metrics...');

        const documentMetrics = await extractProcessMetrics(formattedDocument.content);
        const workflowMetrics = extractMetricsFromWorkflow(workflowDiagram.diagram);

        // Merge metrics for consistency
        const processMetrics = mergeMetrics(workflowMetrics, documentMetrics);

        console.log('Process metrics extracted:', JSON.stringify({
            totalSteps: processMetrics.totalSteps,
            totalTime: processMetrics.totalTime,
            stepTimesCount: processMetrics.stepTimes.length
        }));

        // Return the results with API provider information
        return res.status(200).json({
            success: true,
            documentCount: documentFiles.length,
            processedFiles: processedDocuments.map(doc => ({
                fileName: doc.fileName,
                parsed: doc.parsed,
                type: doc.extractedData?.type || 'unknown'
            })),
            formattedDocument,
            workflowDiagram,
            processMetrics,
            apiProvider: apiKeys.provider // Add the API provider used
        });
    } catch (error) {
        console.error('Error processing documents:', error);
        return res.status(500).json({
            error: 'Failed to process documents',
            message: error.message,
            stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}

/**
 * Combine data from multiple documents into a single structure
 * for unified processing
 */
function combineDocumentData(processedDocuments) {
    // Skip documents that weren't parsed successfully
    const validDocuments = processedDocuments.filter(doc => doc.parsed);

    if (validDocuments.length === 0) {
        return {
            content: "No valid documents to process",
            type: 'text',
            parsed: false
        };
    }

    if (validDocuments.length === 1) {
        // If there's only one document, just return its extracted data
        return validDocuments[0].extractedData;
    }

    // Check if all documents are the same type
    const docTypes = new Set(validDocuments.map(doc => doc.extractedData.type));

    // If all documents are tabular (CSV or Excel)
    if (docTypes.size === 1 && (docTypes.has('csv') || docTypes.has('excel'))) {
        // Merge tabular data
        const mergedData = {
            type: docTypes.values().next().value,
            parsed: true,
            content: [],
            headers: [],
            fileNames: validDocuments.map(doc => doc.fileName)
        };

        // Collect all unique headers
        const allHeaders = new Set();
        validDocuments.forEach(doc => {
            if (doc.extractedData.headers) {
                doc.extractedData.headers.forEach(header => allHeaders.add(header));
            }
        });

        mergedData.headers = Array.from(allHeaders);

        // Combine all rows, filling in missing values
        validDocuments.forEach(doc => {
            if (Array.isArray(doc.extractedData.content)) {
                doc.extractedData.content.forEach(row => {
                    const standardizedRow = {};

                    // Initialize with all headers as empty
                    mergedData.headers.forEach(header => {
                        standardizedRow[header] = '';
                    });

                    // Fill in available values
                    Object.entries(row).forEach(([key, value]) => {
                        if (mergedData.headers.includes(key)) {
                            standardizedRow[key] = value;
                        }
                    });

                    // Add source file information
                    standardizedRow['Source File'] = doc.fileName;

                    mergedData.content.push(standardizedRow);
                });
            }
        });

        // Add Source File to headers if not already there
        if (!mergedData.headers.includes('Source File')) {
            mergedData.headers.push('Source File');
        }

        return mergedData;
    }

    // For text-based documents (PDF, DOCX, TXT)
    if (docTypes.has('pdf') || docTypes.has('docx') || docTypes.has('text')) {
        const mergedData = {
            type: 'text',
            parsed: true,
            content: '',
            fileNames: validDocuments.map(doc => doc.fileName)
        };

        // Combine all text content with document separators
        validDocuments.forEach(doc => {
            const content = typeof doc.extractedData.content === 'string'
                ? doc.extractedData.content
                : JSON.stringify(doc.extractedData.content);

            mergedData.content += `\n\n===== DOCUMENT: ${doc.fileName} =====\n\n`;
            mergedData.content += content;
        });

        // Add structured metadata if available
        const structuredData = {
            documentCount: validDocuments.length,
            documentTypes: Array.from(docTypes),
            documentNames: validDocuments.map(doc => doc.fileName)
        };

        // Collect keywords from all documents
        const allKeywords = new Set();
        validDocuments.forEach(doc => {
            if (doc.extractedData.structuredData?.keywords) {
                doc.extractedData.structuredData.keywords.forEach(keyword => allKeywords.add(keyword));
            }
        });

        structuredData.keywords = Array.from(allKeywords);
        mergedData.structuredData = structuredData;

        return mergedData;
    }

    // Mixed document types - convert everything to text
    const mergedData = {
        type: 'text',
        parsed: true,
        content: '',
        fileNames: validDocuments.map(doc => doc.fileName)
    };

    validDocuments.forEach(doc => {
        let content;

        if (typeof doc.extractedData.content === 'string') {
            content = doc.extractedData.content;
        } else if (Array.isArray(doc.extractedData.content)) {
            // Convert tabular data to text
            const headers = doc.extractedData.headers ||
                (doc.extractedData.content[0] ? Object.keys(doc.extractedData.content[0]) : []);

            content = headers.join(',') + '\n';

            doc.extractedData.content.forEach(row => {
                const values = headers.map(header => {
                    const value = row[header];
                    // Handle values that might contain commas
                    if (typeof value === 'string' && value.includes(',')) {
                        return `"${value}"`;
                    }
                    return value;
                });
                content += values.join(',') + '\n';
            });
        } else {
            content = JSON.stringify(doc.extractedData.content);
        }

        mergedData.content += `\n\n===== DOCUMENT: ${doc.fileName} (${doc.extractedData.type}) =====\n\n`;
        mergedData.content += content;
    });

    return mergedData;
}