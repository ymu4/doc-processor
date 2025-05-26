// utils/documentGenerator.js

const { JSDOM } = require('jsdom');
import { callLLM } from './llmClient';
import { extractMetricsFromDocument } from './metricsProcessor';





export async function generateFormattedDocument(extractedData) {
    try {
        console.log('Creating prompt for document generation...');

        const prompt = createPromptForDocumentGeneration(extractedData);

        // Get API provider preference from session storage (client-side) or environment variable (server-side)
        let provider = 'auto';

        // Check if we're on client or server
        const isClient = typeof window !== 'undefined';

        if (isClient) {
            provider = window.sessionStorage.getItem('api_provider') || 'auto';
        } else {
            provider = process.env.API_PROVIDER_TEMP || 'auto';
        }

        console.log(`Using provider: ${provider} for document generation`);

        // Use our unified LLM client respecting the provider preference
        const response = await callLLM({
            provider: provider, // Use the configured provider instead of always 'auto'
            temperature: 0.2,
            systemPrompt: "You are a document formatting assistant that creates well-structured process documents based on input data from one or more files. Create documents in a professional HTML format with clear sections. Ensure ALL sections are properly filled with relevant content extracted from the input data. Never leave sections empty or with placeholder text when actual content is available. For each step in the process, include an estimated time for completion. THE OUTPUT SHOULD BE PROPERLY RENDERED HTML, NOT JUST HTML TAGS AS TEXT.",
            userPrompt: prompt
        });

        // Extract the generated content from the response
        const generatedContent = response.content;
        console.log(`Document generation with ${response.provider} successful, content length:`, generatedContent.length);

        // Process the content to ensure proper HTML formatting
        const processedContent = processGeneratedContent(generatedContent);

        return {
            content: processedContent,
            format: 'html',
            provider: response.provider
        };
    } catch (error) {
        console.error('Error in generateFormattedDocument:', error);
        throw error;
    }
}

/**
 * Process generated content to ensure it's properly formatted HTML
 */
function processGeneratedContent(content) {
    // Check if the content is already wrapped in valid HTML structure
    if (!content.includes('<!DOCTYPE html>') && !content.toLowerCase().includes('<html')) {
        // If it's just a table or HTML fragment, wrap it in a basic HTML structure
        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { padding: 10px; text-align: left; vertical-align: top; border: 1px solid #ddd; }
        th { background-color: #f2f2f2; font-weight: bold; }
        h2, h3 { color: #444; margin-top: 20px; }
        .document-title { text-align: center; margin-bottom: 30px; }
        .document-source { color: #777; font-style: italic; margin-bottom: 10px; }
        .file-section { border-top: 2px solid #e0e0e0; margin-top: 40px; padding-top: 20px; }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
    }

    return content;
}
function createPromptForDocumentGeneration(extractedData) {
    // First, analyze the document content to extract potential sections
    const analyzedContent = analyzeDocumentContent(extractedData);

    // If this is a multi-document analysis, add special handling
    const isMultiDocument = Array.isArray(extractedData.fileNames) && extractedData.fileNames.length > 1;

    // Create an appropriate prompt based on the data type and content
    let prompt = `# Process Document Generation Prompt

## Input Data Analysis Results
${analyzedContent}

## Instructions for the AI
${isMultiDocument ? 'You are processing multiple files together. Generate a unified process document that integrates information from all files.' : 'Generate a professional process document based on the input data and analysis results above.'}`;

    // Incorporate user feedback if available
    if (extractedData.userFeedback) {
        prompt += `\n\n## User Feedback
The user has provided the following feedback about how the document should be created/improved:

${extractedData.userFeedback}

Please incorporate this feedback when generating the document. The user's suggestions should be prioritized.`;
    }

    prompt += `\n\nCreate a document with the following structure and formatting:

1. Extract the process name and relevant details from the input data

2. Create a document titled "${isMultiDocument ? 'Integrated Process Document' : '[Process Name] Process Document'}" at the top of the document

3. ${isMultiDocument ? 'Include a section that lists all source files being analyzed' : ''}

4. Format the document as a properly rendered HTML table with the following structure:

## Document Structure
### ${isMultiDocument ? 'Integrated Process Document' : '[Process Name] Process Document'}

${isMultiDocument ? `
This document integrates process information from ${extractedData.fileNames.length} files:
${extractedData.fileNames.map(name => `- ${name}`).join('\n')}
` : ''}

Create an HTML table using this structure:
- Use proper HTML table, tr, td, and th tags
- The table should have 3 columns: Section, Details, and a third column for additional information
- Section titles should be in bold and span all three columns
- Include all the sections listed below

Sections to include:
1. Process Title
   - Name of Process
   - Process ID
   - Date
   - Updated by
   ${isMultiDocument ? '- Source Documents' : ''}

2. Process Overview
   - Description
   - Objective
   - Scope

3. Process Workflow
   - Step-by-Step Workflow with Time Estimates (IMPORTANT: List each individual step with full details)
   - Process Flow Diagram
   - Required Attachments
   - Required Forms

4. Roles and Responsibilities
   - Process Owner(s)
   - Participants (Role 1, Role 2, etc.)

5. Approval Steps
   - Approval Points (Step 1, Step 2, etc.)

6. Inputs and Outputs
   - Inputs
   - Outputs

7. Dependencies and Interactions
   - Related Processes

8. Current Challenges and Pain Points

9. Improvement Opportunities

10. Process Metrics
    - Total Steps
    - Total Est. Time

## Important Instructions
1. Carefully analyze the input data and the pre-analyzed content sections to identify:
   - The process name, ID, and relevant metadata
   - The process description, objectives, and scope
   - All sequential steps in the process workflow
   - The roles and responsibilities of different participants
   - Approval steps and requirements
   - Inputs, outputs, and dependencies
   - Any challenges, improvement opportunities
   - For each step, estimate a realistic time for completion

2. ${isMultiDocument ? 'When integrating multiple documents:' : 'For each section:'}
   ${isMultiDocument ? '- Combine relevant information from all source files' : '- Extract ALL relevant information from the input data'}
   ${isMultiDocument ? '- Resolve any conflicts or contradictions between documents' : '- NEVER leave sections empty - use the pre-analyzed content or reasonable inferences'}
   ${isMultiDocument ? '- Note the source document when information comes from a specific file' : '- Use clear, concise language appropriate for a formal process document'}
   ${isMultiDocument ? '- Create a coherent, unified process that encompasses all the input data' : '- Include ALL details present in the source material'}
   - If specific information for a section isn't directly stated, use contextual clues from the document

3. For the Process Workflow section:
   - CRITICAL: Break down the process into DETAILED individual steps - AVOID GENERAL STEPS
   - Each step must be specific, actionable, and contain concrete details about:
     * Exact actions to be performed
     * Who is responsible for each action
     * Required inputs and resulting outputs
     * Tools or systems used
     * Any decisions that need to be made
     * Thresholds or conditions for proceeding
     * Potential exceptions or edge cases
   - Include ALL steps in the correct sequential order
   - Number steps clearly (Step 1, Step 2, etc.)
   - For each step, provide comprehensive details in the third column
   - Include SPECIFIC TIME ESTIMATES for each step (e.g., '30 min', '2 hours', '1 day')
   - Include decision points, alternative paths, and exceptions where relevant
   - Ensure the workflow is complete from initiation to completion
   - If a step involves a sub-process, break that down into its own set of detailed steps
   - Include any notifications, handoffs, or status changes that occur during the process
   - For automated steps, detail what triggers them and what systems are involved
   - For manual steps, specify exactly what the person must do and any tools they use
   - Include verification points where quality checks are performed

4. For the Process Metrics section:
   - Count the total number of steps in the process
   - Calculate the total estimated time for the entire process (sum of all step times)

## Formatting Requirements
- Ensure the HTML is properly formatted for rendering in a browser
- Use HTML table attributes for proper alignment and formatting
- Bold all section titles
- Use bullet points within cells where appropriate
- Maintain consistent capitalization and formatting
- Use proper spacing for readability
- Make sure the HTML is valid and properly nested
${isMultiDocument ? '- Include a clear indication of source document when information comes from a specific file' : ''}
${isMultiDocument ? '- Add subtle visual separation between information from different documents' : ''}

THE RESULTING DOCUMENT MUST BE RENDERED HTML, NOT JUST HTML TAGS AS TEXT. ENSURE THE OUTPUT WILL DISPLAY PROPERLY IN A BROWSER.

## Input Data
${isMultiDocument ? `This analysis combines ${extractedData.fileNames.length} documents: ${extractedData.fileNames.join(', ')}` : ''}`;

    if (extractedData.type === 'csv' || extractedData.type === 'excel') {
        // For tabular data, we'll include the headers and a sample of the data
        prompt += `Headers: ${extractedData.headers.join(', ')}\n\n`;
        prompt += "Sample data:\n";

        const sampleSize = Math.min(5, extractedData.content.length);
        for (let i = 0; i < sampleSize; i++) {
            const row = extractedData.content[i];
            prompt += JSON.stringify(row) + "\n";
        }
    }
    else if (extractedData.type === 'pdf') {
        const contentPreview = typeof extractedData.content === 'string'
            ? extractedData.content // Include the full content for PDFs
            : "Binary content that couldn't be extracted";

        prompt += "PDF Content:\n\n" + contentPreview;

        // Add PDF metadata if available
        if (extractedData.info) {
            prompt += "\n\nPDF Metadata:";
            for (const key in extractedData.info) {
                prompt += `\n- ${key}: ${extractedData.info[key]}`;
            }
        }

        if (extractedData.pageCount) {
            prompt += `\n\nDocument has ${extractedData.pageCount} pages.`;
        }
    } else {
        // For text data, include the content
        const contentPreview = typeof extractedData.content === 'string'
            ? extractedData.content
            : JSON.stringify(extractedData.content);

        prompt += contentPreview;
    }

    return prompt;
}
/**
 * Helper function to analyze document content and extract sections
 */
function analyzeDocumentContent(extractedData) {
    let analysis = "### Pre-analyzed Content Sections:\n\n";

    // Check if this is multi-document data
    const isMultiDocument = Array.isArray(extractedData.fileNames) && extractedData.fileNames.length > 1;

    if (isMultiDocument) {
        analysis += `Analysis of ${extractedData.fileNames.length} documents:\n`;
        extractedData.fileNames.forEach(fileName => {
            analysis += `- ${fileName}\n`;
        });
        analysis += "\n";
    }

    // If we have raw text content
    if (typeof extractedData.content === 'string') {
        const content = extractedData.content;

        // Look for section titles and their content
        const sectionPatterns = [
            { name: "Process Title", pattern: /(process|title|subject|workflow|procedure)[\s:]+([^\n]+)(?=\n|$)/i },
            { name: "Process ID", pattern: /(process id|policy number|id|reference|document number)[\s:]+([^\n]+)(?=\n|$)/i },
            { name: "Date", pattern: /(date|effective date|created on|last modified)[\s:]+([^\n]+)(?=\n|$)/i },
            { name: "Updated by", pattern: /(updated by|author|responsible|created by|owner)[\s:]+([^\n]+)(?=\n|$)/i },
            { name: "Description", pattern: /(description|overview|summary|about)[\s:]+(.*?)(?=\n\n|\n[A-Z]|$)/is },
            { name: "Objective", pattern: /(objective|goal|purpose|aim|intent)[\s:]+(.*?)(?=\n\n|\n[A-Z]|$)/is },
            { name: "Scope", pattern: /(scope|applies to|coverage|boundary)[\s:]+(.*?)(?=\n\n|\n[A-Z]|$)/is },
            { name: "Workflow Steps", pattern: /(workflow|steps|procedure|process steps|activities|tasks)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Roles", pattern: /(roles|responsibilities|participants|owner|stakeholders|actors)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Approval", pattern: /(approval|sign-off|points|validation|verification)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Inputs", pattern: /(inputs|requirements|prerequisites|materials|resources)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Outputs", pattern: /(outputs|deliverables|results|products|outcomes)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Dependencies", pattern: /(dependencies|related|interactions|connections|relationships)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Challenges", pattern: /(challenges|pain points|issues|problems|difficulties)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Improvements", pattern: /(improvements|opportunities|enhancement|optimization|recommendations)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
            { name: "Time Estimates", pattern: /(time|duration|estimate|takes|timeline|schedule)[\s:]+(.*?)(?=\n\n\w|\n[A-Z]|$)/is },
        ];

        // Try to extract each section
        for (const section of sectionPatterns) {
            const match = content.match(section.pattern);
            if (match && match[2]) {
                analysis += `#### ${section.name}:\n${match[2].trim()}\n\n`;
            }
        }

        // Look for numbered sections which are common in process documents
        const numberedSectionMatches = content.match(/\n\d+\.?\s+([^\n]+)[\n\s]+(.*?)(?=\n\d+\.?\s+|\n\n\d+|\n\n[A-Z]|$)/gs);
        if (numberedSectionMatches && numberedSectionMatches.length > 0) {
            analysis += "#### Numbered Sections Found:\n";
            for (const section of numberedSectionMatches) {
                analysis += section.trim() + "\n\n";
            }
        }

        // Look for bullet points
        const bulletPointMatches = content.match(/\n[•\-*]\s+([^\n]+)/g);
        if (bulletPointMatches && bulletPointMatches.length > 0) {
            analysis += "#### Bullet Points Found:\n";
            for (const bullet of bulletPointMatches) {
                analysis += bullet.trim() + "\n";
            }
            analysis += "\n";
        }

        // Look for table-like structures
        if (content.includes('|') || content.includes('+---')) {
            analysis += "#### Table Structure Detected:\nInput contains table formatting. Will preserve table structure.\n\n";
        }

        // Look for headers and sections by capitalization patterns
        const headerMatches = content.match(/\n([A-Z][A-Z\s]{2,}[A-Z])[:\n]/g);
        if (headerMatches && headerMatches.length > 0) {
            analysis += "#### All-caps Headers Found:\n";
            for (const header of headerMatches) {
                analysis += header.trim() + "\n";
            }
            analysis += "\n";
        }

        // Look for time/duration mentions
        const timeMatches = content.match(/(\d+)\s*(minute|hour|day|week|min|hr|sec|second)s?/gi);
        if (timeMatches && timeMatches.length > 0) {
            analysis += "#### Time References Found:\n";
            for (const timeRef of timeMatches) {
                analysis += timeRef.trim() + "\n";
            }
            analysis += "\n";
        }
    } else if (Array.isArray(extractedData.content)) {
        // For tabular data from CSV/Excel, analyze column patterns
        analysis += "#### Table Data Analysis:\n";
        analysis += `${extractedData.content.length} rows of data found with columns: ${extractedData.headers?.join(', ') || 'unknown'}\n\n`;

        // Try to identify key columns that might contain process information
        const keyColumns = extractedData.headers?.filter(header =>
            /process|title|step|role|input|output|approval|description|time|duration|estimate/i.test(header)
        );

        if (keyColumns && keyColumns.length > 0) {
            analysis += `#### Key Information Columns:\n${keyColumns.join(', ')}\n\n`;

            // Sample some values from key columns
            analysis += "#### Sample Values from Key Columns:\n";
            for (const column of keyColumns) {
                const values = extractedData.content
                    .slice(0, 3)
                    .map(row => row[column])
                    .filter(Boolean);

                if (values.length > 0) {
                    analysis += `${column}: ${values.join(', ')}\n`;
                }
            }
            analysis += "\n";
        }

        // Look for time/duration columns
        const timeColumns = extractedData.headers?.filter(header =>
            /time|duration|estimate|minutes|hours|timeline/i.test(header)
        );

        if (timeColumns && timeColumns.length > 0) {
            analysis += "#### Time Estimate Information Found in Columns:\n";
            for (const column of timeColumns) {
                const values = extractedData.content
                    .slice(0, 5)
                    .map(row => `${row[column]}`)
                    .filter(Boolean);

                if (values.length > 0) {
                    analysis += `${column}: ${values.join(', ')}\n`;
                }
            }
            analysis += "\n";
        }
    }

    return analysis;
}

export async function extractProcessMetrics(documentContent) {
    try {
        return extractMetricsFromDocument(documentContent);
    } catch (error) {
        console.error('Error extracting process metrics:', error);
        return {
            totalSteps: 0,
            totalTime: "Unknown",
            totalTimeMinutes: 0,
            stepTimes: [],
            source: 'document-error'
        };
    }
}



// optimized process documen

/**
 * Generate an optimized process document based on optimization results
 * @param {Object} optimizationResults - The results from the optimization process
 * @param {Object} originalDocument - The original formatted document
 * @returns {Promise<Object>} - The optimized document
 */

export async function generateOptimizedDocument(optimizationResults, originalDocument) {
    try {
        console.log('Creating prompt for optimized document generation...');
        const prompt = createPromptForOptimizedDocumentGeneration(optimizationResults, originalDocument);

        // Get API provider preference
        let provider = 'auto';
        const isClient = typeof window !== 'undefined';

        if (isClient) {
            provider = window.sessionStorage.getItem('api_provider') || 'auto';
        } else {
            provider = process.env.API_PROVIDER_TEMP || 'auto';
        }

        console.log(`Using provider: ${provider} for optimized document generation`);

        const response = await callLLM({
            provider: provider,
            temperature: 0.2,
            systemPrompt: "You are a document formatting assistant that creates well-structured process documents based on optimization results. Create documents in a professional HTML format with clear sections. Ensure ALL sections are properly filled with relevant content extracted from the input data. Never leave sections empty or with placeholder text. For each step in the process, include an estimated time for completion. THE OUTPUT SHOULD BE PROPERLY RENDERED HTML, NOT JUST HTML TAGS AS TEXT.",
            userPrompt: prompt
        });

        // Extract the generated content from the response
        const generatedContent = response.content;
        console.log(`Optimized document generation with ${response.provider} successful, content length:`, generatedContent.length);

        // Process the content to ensure proper HTML formatting
        const processedContent = processGeneratedContent(generatedContent);

        return {
            content: processedContent,
            format: 'html',
            provider: response.provider
        };
    } catch (error) {
        console.error('Error in generateOptimizedDocument:', error);
        throw error;
    }
}

/**
 * Create a prompt for optimized document generation
 * @param {Object} optimizationResults - The results from the optimization process
 * @param {Object} originalDocument - The original formatted document
 * @returns {string} - The prompt
 */
function createPromptForOptimizedDocumentGeneration(optimizationResults, originalDocument) {
    // Extract key information from optimization results
    const {
        summary,
        suggestions = [],
        metrics = {},
        workflowDiagram,
        timeSavings = {},
        originalMetrics = {}
    } = optimizationResults;

    // Create fallback values for any missing properties
    const safeOriginalMetrics = {
        totalSteps: originalMetrics.totalSteps || 0,
        totalTime: originalMetrics.totalTime || "Unknown",
        // Add any other properties you might need
    };

    const safeMetrics = {
        totalSteps: metrics.totalSteps || 0,
        totalTime: metrics.totalTime || "Unknown",
        // Add any other properties you might need
    };

    const safeTimeSavings = {
        formatted: timeSavings.formatted || "Unknown",
        percentageFormatted: timeSavings.percentageFormatted || "0%",
        // Add any other properties you might need
    };

    let prompt = `# Optimized Process Document Generation

## Optimization Results
### Summary
${summary || "The process has been optimized to reduce bureaucracy and improve efficiency."}

### Time Savings
- Original Process Time: ${safeOriginalMetrics.totalTime}
- Optimized Process Time: ${safeMetrics.totalTime}
- Time Saved: ${safeTimeSavings.formatted} (${safeTimeSavings.percentageFormatted})

### Step Reduction
- Original Process Steps: ${safeOriginalMetrics.totalSteps}
- Optimized Process Steps: ${safeMetrics.totalSteps}
- Steps Reduced: ${Math.max(0, safeOriginalMetrics.totalSteps - safeMetrics.totalSteps)}

### Key Suggestions
${suggestions.length > 0 ?
            suggestions.map(s => `- ${s.title || 'Optimization'}: ${s.description || 'Improve process efficiency'}`).join('\n') :
            '- Process Optimization: Streamline the workflow and reduce unnecessary steps'}

## Original Document Content
${originalDocument?.content || "No original document content available"}

## Optimized Process Flow
\`\`\`
${workflowDiagram?.diagram || "No workflow diagram available"}
\`\`\`

## Instructions
Create an optimized version of the original process document that incorporates all the optimization suggestions and reflects the new optimized workflow. The document should:

1. Keep the same overall structure and format as the original document
2. Clearly mark this as the "OPTIMIZED PROCESS DOCUMENT" in the title
3. Include a brief summary of optimizations at the beginning
4. Update all process steps to match the optimized workflow
5. Update all time estimates to reflect the optimized process
6. Include a comparison section that highlights what changed from the original process
7. Maintain all essential information from the original document

## Required Output Format
Generate a properly formatted HTML document that:
- Has the same professional appearance as the original
- Uses the same table structure but with updated content
- Includes all time estimates for each step
- Clearly indicates this is the optimized version
- Does not lose any critical information from the original

THE OUTPUT SHOULD BE PROPERLY RENDERED HTML, NOT JUST HTML TAGS AS TEXT.`;

    return prompt;
}
