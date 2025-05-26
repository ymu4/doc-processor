// utils/documentParser.js
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';

export async function parseDocument(fileContent, mimeType, fileName) {
    console.log('Parsing document with mime type:', mimeType, 'and filename:', fileName);

    try {
        // Determine file type from mime type or file extension if needed
        if (mimeType && mimeType.includes('pdf')) {
            return await parsePdfContent(fileContent, fileName);
        } else if (
            mimeType && (
                mimeType.includes('msword') ||
                mimeType.includes('officedocument.wordprocessingml.document')
            )
        ) {
            return await parseDocxContent(fileContent);
        } else if (mimeType && mimeType.includes('csv')) {
            return parseCsvContent(fileContent);
        } else if (mimeType && (
            mimeType.includes('excel') ||
            mimeType.includes('spreadsheetml.sheet')
        )) {
            return parseExcelContent(fileContent, fileName);
        } else {
            // Treat as text by default (txt, etc.)
            const textContent = await parseTextContent(fileContent);
            return textContent;
        }
    } catch (error) {
        console.error('Error parsing document:', error);
        return {
            content: `Failed to parse document: ${error.message}`,
            type: 'error',
            parsed: false,
            error: error.message
        };
    }
}

async function parsePdfContent(buffer, fileName) {
    console.log('Parsing as PDF content');
    try {
        // Enhanced PDF parsing options with structure preservation
        const options = {
            // Page range to extract from (null means all pages)
            pagerender: renderPage,  // Custom page renderer to capture more structure
            // Ensure the text is properly normalized but preserves structure
            normalizeWhitespace: false,
            disableCombineTextItems: false
        };

        // Store the raw PDF data for potential diagram analysis
        let rawPdfData = null;

        // Use pdf-parse to extract text from the PDF
        const data = await pdfParse(buffer, options);
        console.log('PDF text extraction successful, content length:', data.text.length);

        // Keep the raw data
        rawPdfData = data;

        // Process PDF content to preserve structure better
        const processedText = processPdfText(data.text);

        // Check if this PDF might contain diagrams or flowcharts
        const mightContainDiagrams = checkForDiagramIndicators(processedText, fileName);

        // Structured data to help the analysis
        const structuredData = {
            title: extractDocumentTitle(data, fileName),
            sections: extractSections(processedText),
            keywords: extractKeywords(processedText),
            diagramDetected: mightContainDiagrams
        };

        return {
            content: processedText,
            structuredData: structuredData,
            type: 'pdf',
            parsed: true,
            pageCount: data.numpages,
            info: data.info,
            rawMetadata: rawPdfData ? {
                metadata: rawPdfData.metadata,
                info: rawPdfData.info
            } : null,
            containsDiagrams: mightContainDiagrams
        };
    } catch (error) {
        console.error('Error parsing PDF:', error);
        // Try fallback method if primary fails
        try {
            console.log('Attempting fallback PDF parsing method');
            // Simplified fallback method
            const data = await pdfParse(buffer);
            return {
                content: data.text,
                type: 'pdf',
                parsed: true,
                pageCount: data.numpages,
                info: data.info,
                note: 'Used fallback parsing method - structure may be impacted'
            };
        } catch (fallbackError) {
            console.error('Fallback PDF parsing also failed:', fallbackError);
            return {
                content: "Failed to parse PDF content after multiple attempts: " + error.message,
                type: 'pdf',
                parsed: false,
                error: error.message
            };
        }
    }
}

// Custom page renderer function to extract more detailed information
function renderPage(pageData) {
    // The default implementation just returns the text
    let render_options = {
        normalizeWhitespace: false,
        disableCombineTextItems: false
    };

    // Extract page text
    return pageData.getTextContent(render_options)
        .then(function (textContent) {
            let lastY, text = '';

            // Process each text item with position information
            for (let item of textContent.items) {
                if (lastY == item.transform[5] || !lastY) {
                    text += item.str;
                } else {
                    text += '\n' + item.str;
                }
                lastY = item.transform[5];
            }

            return text;
        });
}

// Helper function to process PDF text and preserve formatting
function processPdfText(text) {
    if (!text) return "";

    // Replace multiple spaces with a single space, but preserve paragraph breaks
    const normalizedText = text
        .replace(/\r\n/g, '\n')        // Normalize line endings
        .replace(/\n{3,}/g, '\n\n')    // Normalize multiple line breaks
        .replace(/\s{2,}/g, ' ')       // Replace multiple spaces with single space
        .trim();                       // Remove leading/trailing whitespace

    // Try to detect and preserve section headers
    // Look for patterns like "1. Section Title" or "Section Title:" or "SECTION TITLE"
    const withPreservedHeaders = normalizedText.replace(
        /(\n|^)(\d+\.|\*|[A-Z][A-Z\s]+:|[A-Z][A-Z\s]+)(\s+)([A-Z])/g,
        '$1\n$2$3$4'
    );

    // Try to preserve table-like structures
    // Look for lines with multiple separators like | or tabs
    const withPreservedTables = withPreservedHeaders.replace(
        /(\n|^)([^\n]*\|[^\n]*\|[^\n]*)/g,
        '$1\n$2\n'
    );

    return withPreservedTables;
}

// Check if the PDF might contain diagrams or flowcharts based on textual clues
function checkForDiagramIndicators(text, fileName) {
    // Check filename for indications this might be a diagram
    const diagramFilePatterns = /(flow|chart|diagram|process|workflow|graph)/i;

    if (fileName && diagramFilePatterns.test(fileName)) {
        return true;
    }

    // Keywords that suggest diagrams
    const diagramKeywords = [
        'flowchart', 'flow chart', 'diagram', 'process flow', 'workflow',
        'decision point', 'start', 'end', 'decision', 'process',
        'approval', 'review', 'submit', 'yes/no', 'approved', 'rejected',
        'arrow', 'node', 'step', 'flow', 'sequence'
    ];

    // Check for diagram keywords
    const keywordCount = diagramKeywords.reduce((count, keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'i');
        return count + (regex.test(text) ? 1 : 0);
    }, 0);

    // If at least 3 diagram-related keywords are found, it might contain a diagram
    if (keywordCount >= 3) {
        return true;
    }

    // Check for diagram-like structures in text (arrows, boxes)
    const arrowPatterns = /(-+>|→|⟶|\s+>\s+|--+|=>)/;
    const boxPatterns = /(\[.*?\]|\(.*?\)|{.*?})/;

    if (arrowPatterns.test(text) && boxPatterns.test(text)) {
        return true;
    }

    return false;
}

// Extract potential document title
function extractDocumentTitle(data, fileName) {
    // Try to extract from PDF metadata
    if (data.info && data.info.Title) {
        return data.info.Title;
    }

    // Try to find title in the first page text
    const firstPageText = data.text.split('\n').slice(0, 10).join(' ');
    const titleMatch = firstPageText.match(/^([^\n.]+)/);

    if (titleMatch && titleMatch[1].length > 10) {
        return titleMatch[1].trim();
    }

    // Fall back to filename without extension
    if (fileName) {
        return fileName.replace(/\.[^/.]+$/, "").replace(/_/g, ' ');
    }

    return 'Untitled Document';
}

// Extract sections from the document
function extractSections(text) {
    const sections = [];
    const lines = text.split('\n');
    let currentSection = { title: 'Introduction', content: '' };

    for (const line of lines) {
        // Look for section headers (numbered, all caps, or ending with colon)
        const sectionHeaderMatch = line.match(/^(\d+\.|\*|[A-Z][A-Z\s]+:|[A-Z][A-Z\s]+)(\s+)([A-Za-z].*)/);

        if (sectionHeaderMatch) {
            // Save previous section
            if (currentSection.content.trim()) {
                sections.push(currentSection);
            }

            // Start new section
            currentSection = {
                title: sectionHeaderMatch[0].trim(),
                content: ''
            };
        } else {
            // Add to current section
            currentSection.content += line + '\n';
        }
    }

    // Add the last section
    if (currentSection.content.trim()) {
        sections.push(currentSection);
    }

    return sections;
}

// Extract potential keywords from the document
function extractKeywords(text) {
    // Common keywords related to workflows and processes
    const processKeywords = [
        'process', 'workflow', 'procedure', 'approval', 'review',
        'submit', 'application', 'request', 'form', 'document',
        'policy', 'step', 'check', 'verify', 'confirm', 'validate',
        'authorize', 'reject', 'approve', 'deny', 'grant', 'travel',
        'conference', 'faculty', 'instructor', 'department', 'dean',
        'chair', 'signatory', 'authority', 'budget', 'financial',
        'report', 'submission', 'criteria', 'eligibility', 'funding'
    ];

    // Count occurrences of each keyword
    const keywordCounts = {};

    for (const keyword of processKeywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = text.match(regex);

        if (matches) {
            keywordCounts[keyword] = matches.length;
        }
    }

    // Return the top keywords (those that appear at least twice)
    return Object.entries(keywordCounts)
        .filter(([_, count]) => count >= 2)
        .sort((a, b) => b[1] - a[1])
        .map(([keyword]) => keyword);
}

// The rest of your parsing functions remain the same
async function parseDocxContent(buffer) {
    console.log('Parsing as DOCX content');
    try {
        // Use mammoth to extract text from DOCX
        const result = await mammoth.extractRawText({ buffer });
        console.log('DOCX text extraction successful, content length:', result.value.length);

        return {
            content: result.value,
            type: 'docx',
            parsed: true,
            messages: result.messages
        };
    } catch (error) {
        console.error('Error parsing DOCX:', error);
        return {
            content: "Failed to parse DOCX content: " + error.message,
            type: 'docx',
            parsed: false,
            error: error.message
        };
    }
}

function parseCsvContent(content) {
    console.log('Parsing as CSV content');
    try {
        // Detect different line endings
        const lineEnding = content.includes('\r\n') ? '\r\n' : '\n';
        const lines = content.split(lineEnding);

        if (lines.length === 0) {
            return { content, type: 'csv', parsed: false };
        }

        // Try to detect the delimiter (comma, tab, semicolon)
        const firstLine = lines[0];
        let delimiter = ',';

        if (firstLine.includes('\t') && firstLine.split('\t').length > 1) {
            delimiter = '\t';
        } else if (firstLine.includes(';') && firstLine.split(';').length > 1) {
            delimiter = ';';
        }

        // Extract headers and clean them
        const headers = firstLine.split(delimiter).map(h => h.trim().replace(/^["'](.*)["']$/, '$1'));
        const data = [];

        // Process each row
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].trim() === '') continue;

            // Handle quoted values with commas inside
            let row = {};
            let vals = parseCSVLine(lines[i], delimiter);

            // Map values to headers
            for (let j = 0; j < headers.length; j++) {
                row[headers[j]] = vals[j] !== undefined ? vals[j] : '';
            }

            data.push(row);
        }

        return {
            content: data,
            headers,
            type: 'csv',
            parsed: true
        };
    } catch (error) {
        console.error('Error parsing CSV:', error);
        return {
            content,
            type: 'text',
            parsed: false,
            error: error.message
        };
    }
}

// Helper function to parse CSV lines with quoted values
function parseCSVLine(line, delimiter) {
    const result = [];
    let insideQuotes = false;
    let currentStr = '';

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"' && (i === 0 || line[i - 1] !== '\\')) {
            insideQuotes = !insideQuotes;
        } else if (char === delimiter && !insideQuotes) {
            result.push(currentStr.trim().replace(/^["'](.*)["']$/, '$1'));
            currentStr = '';
        } else {
            currentStr += char;
        }
    }

    // Add the last field
    if (currentStr) {
        result.push(currentStr.trim().replace(/^["'](.*)["']$/, '$1'));
    }

    return result;
}

async function parseExcelContent(buffer, fileName) {
    console.log('Parsing as Excel content');
    try {
        // Import XLSX dynamically to ensure browser compatibility
        const XLSX = (await import('xlsx')).default;

        // Parse the workbook
        const workbook = XLSX.read(buffer, {
            type: 'buffer',
            cellDates: true,
            cellStyles: true
        });

        // Get first sheet name
        const firstSheetName = workbook.SheetNames[0];

        // Convert to JSON
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (jsonData.length === 0) {
            return {
                content: "Excel file appears to be empty",
                type: 'excel',
                parsed: false
            };
        }

        const headers = jsonData[0].map(h => h.toString().trim());
        const data = [];

        // Convert rows to objects with headers as keys
        for (let i = 1; i < jsonData.length; i++) {
            if (!jsonData[i] || jsonData[i].length === 0) continue;

            const row = {};
            for (let j = 0; j < headers.length; j++) {
                const value = jsonData[i][j];
                row[headers[j]] = value !== undefined ? value : '';
            }
            data.push(row);
        }

        return {
            content: data,
            headers,
            type: 'excel',
            parsed: true,
            sheetNames: workbook.SheetNames
        };
    } catch (error) {
        console.error('Error parsing Excel:', error);
        return {
            content: `Failed to parse Excel file: ${error.message}`,
            type: 'excel',
            parsed: false,
            error: error.message
        };
    }
}

async function parseTextContent(content) {
    console.log('Parsing as plain text content');

    // Try to detect if content is binary and convert accordingly
    let textContent;
    if (content instanceof ArrayBuffer || content instanceof Uint8Array) {
        try {
            // Convert binary content to text using TextDecoder
            const decoder = new TextDecoder('utf-8');
            textContent = decoder.decode(content);
        } catch (error) {
            console.error('Error decoding binary content:', error);
            textContent = "Unable to decode binary content";
        }
    } else if (typeof content === 'string') {
        textContent = content;
    } else {
        textContent = JSON.stringify(content);
    }

    // Normalize line endings and cleanup text
    const normalizedText = textContent
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n{3,}/g, '\n\n');

    return {
        // Include more content to ensure all sections are captured
        content: normalizedText,
        type: 'text',
        parsed: true
    };
}