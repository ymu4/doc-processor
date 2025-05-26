// utils/metricsProcessor.js
/**
 * Centralized metrics processing module for standardizing all metrics operations
 */

/**
 * Standard metrics structure used throughout the application
 * @typedef {Object} ProcessMetrics
 * @property {number} totalSteps - Total number of steps in the process
 * @property {string} totalTime - Human-readable total time (e.g., "2 hours 30 minutes")
 * @property {number} totalTimeMinutes - Total time in minutes (for calculations)
 * @property {Array<StepTime>} stepTimes - Array of step time objects
 * @property {string} source - Source of the metrics ("document", "workflow", "merged", "optimized")
 * @property {number} timestamp - When the metrics were created
 */

/**
 * Standard step time structure
 * @typedef {Object} StepTime
 * @property {string} step - Step number or ID
 * @property {string} stepName - Name or description of the step
 * @property {string} time - Human-readable time estimate (e.g., "30 minutes")
 * @property {number} timeMinutes - Time in minutes (for calculations)
 */

/**
 * Parse a time string into minutes
 * Handles various formats like "1 hour 30 minutes", "2 days", "45 min"
 * @param {string} timeString - Time string to parse
 * @returns {number|null} - Time in minutes or null if parsing failed
 */


export function parseTimeToMinutes(timeString) {
    if (!timeString || typeof timeString !== 'string' || timeString === "Unknown") return null;

    let totalMinutes = 0;

    // Handle range formats with weeks (assuming 5 working days per week)
    const weekRangeMatch = timeString.match(/(\d+)\s*-\s*(\d+)\s*(week|weeks)s?/i);
    if (weekRangeMatch) {
        const min = parseInt(weekRangeMatch[1]);
        const max = parseInt(weekRangeMatch[2]);
        const avgWeeks = (min + max) / 2;
        totalMinutes = avgWeeks * 5 * 8 * 60; // 5 days/week * 8 hours/day * 60 minutes/hour
        return totalMinutes;
    }

    // Handle "X weeks" specifically
    const weeksMatch = timeString.match(/(\d+)\s*(week|weeks)s?/i);
    if (weeksMatch) {
        totalMinutes = parseInt(weeksMatch[1]) * 5 * 8 * 60;
        return totalMinutes;
    }

    // Handle range formats like "20-25 days"
    const dayRangeMatch = timeString.match(/(\d+)\s*-\s*(\d+)\s*(day|days)s?/i);
    if (dayRangeMatch) {
        const min = parseInt(dayRangeMatch[1]);
        const max = parseInt(dayRangeMatch[2]);
        const avgDays = (min + max) / 2;
        totalMinutes = avgDays * 8 * 60; // 8 hours/day * 60 minutes/hour
        return totalMinutes;
    }

    // Handle specific days
    const daysMatch = timeString.match(/(\d+)\s*(day|days)s?/i);
    if (daysMatch) {
        totalMinutes = parseInt(daysMatch[1]) * 8 * 60;
        return totalMinutes;
    }

    // Handle hours and minutes
    const hoursMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(hour|hours|hr|h)s?/i);
    if (hoursMatch) {
        totalMinutes += parseFloat(hoursMatch[1]) * 60;
    }

    const minutesMatch = timeString.match(/(\d+(?:\.\d+)?)\s*(minute|minutes|min|m)s?/i);
    if (minutesMatch) {
        totalMinutes += parseFloat(minutesMatch[1]);
    }

    return totalMinutes > 0 ? totalMinutes : null;
}

/**
 * Format minutes to a readable time string
 * @param {number} minutes - Time in minutes
 * @returns {string} - Formatted time string
 */
export function formatMinutesToTime(minutes) {
    if (minutes === null || isNaN(minutes) || minutes < 0) return "Unknown";

    if (minutes >= 60 * 24) {
        // Convert to days for larger durations (assume 8-hour days)
        const days = Math.floor(minutes / (8 * 60));
        const hours = Math.floor((minutes % (8 * 60)) / 60);
        const remainingMinutes = Math.round(minutes % 60);

        let result = `${days} day${days !== 1 ? 's' : ''}`;
        if (hours > 0) result += ` ${hours} hour${hours !== 1 ? 's' : ''}`;
        if (remainingMinutes > 0) result += ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        return result;
    } else if (minutes >= 60) {
        const hours = Math.floor(minutes / 60);
        const remainingMinutes = Math.round(minutes % 60);
        return `${hours} hour${hours !== 1 ? 's' : ''}${remainingMinutes > 0 ? ` ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}` : ''}`;
    } else {
        return `${Math.round(minutes)} minute${Math.round(minutes) !== 1 ? 's' : ''}`;
    }
}
// On the client side
// In metricsProcessor.js, update the extractMetricsFromDocument function:

export async function extractMetricsFromDocument(htmlContent) {
    try {
        // Determine if we're in a browser or Node.js environment
        const isBrowser = typeof window !== 'undefined' && window.fetch;

        if (isBrowser) {
            // Create a temporary DOM element to safely extract text without HTML tags
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;

            // Extract text content without HTML tags
            const textContent = tempDiv.textContent || tempDiv.innerText;

            // Process the text content for metrics
            let totalSteps = 0;
            let totalTime = "Not specified";
            let totalTimeMinutes = 0;
            const stepTimes = [];

            // Look for steps and times 
            const stepPattern = /Step\s+(\d+)[:\s]*([^.]+?)(?:\s*(?:Estimated time|Time estimate|Time)[:\s]*([^\n<]+?))?(?=Step\s+\d+|$)/gi;
            let match;

            while ((match = stepPattern.exec(textContent)) !== null) {
                const stepNumber = match[1];
                const stepNameText = match[2].trim();

                // Clean the step name by removing any remaining HTML-like patterns
                const stepName = stepNameText.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

                const timeEstimate = match[3] || "Unknown";
                const timeMinutes = parseTimeToMinutes(timeEstimate.trim()) || 0;

                stepTimes.push({
                    step: stepNumber,
                    stepName: stepName,
                    time: timeEstimate.trim(),
                    timeMinutes: timeMinutes
                });
            }

            totalSteps = stepTimes.length;

            // Calculate total time from step times
            if (stepTimes.length > 0) {
                totalTimeMinutes = stepTimes.reduce((sum, step) => sum + (step.timeMinutes || 0), 0);
                if (totalTimeMinutes > 0) {
                    totalTime = formatMinutesToTime(totalTimeMinutes);
                }
            }

            return {
                totalSteps,
                totalTime,
                totalTimeMinutes,
                stepTimes,
                source: 'document',
                timestamp: Date.now()
            };
        }

        // Server-side implementation
        const { JSDOM } = require('jsdom');
        const dom = new JSDOM(htmlContent);
        const doc = dom.window.document;

        // Remove all tags from step names
        const cleanText = (elem) => elem.textContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

        let totalSteps = 0;
        let totalTime = "Not specified";
        let totalTimeMinutes = 0;
        const stepTimes = [];

        // Find table rows containing steps
        const rows = doc.querySelectorAll('tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length > 0) {
                const firstCellText = cleanText(cells[0]);

                // Check for step rows
                if (firstCellText.match(/^Step\s+\d+$/i)) {
                    const stepNumber = firstCellText.match(/\d+/)[0];
                    const stepName = cells.length > 1 ? cleanText(cells[1]) : "";
                    let timeEstimate = cells.length > 2 ? cleanText(cells[2]) : "Unknown";

                    const timeMinutes = parseTimeToMinutes(timeEstimate) || 0;

                    stepTimes.push({
                        step: stepNumber,
                        stepName: stepName,
                        time: timeEstimate,
                        timeMinutes: timeMinutes
                    });
                }
            }
        });

        // Sort step times by step number
        stepTimes.sort((a, b) => parseInt(a.step) - parseInt(b.step));

        totalSteps = stepTimes.length;

        // Calculate total time
        if (stepTimes.length > 0) {
            totalTimeMinutes = stepTimes.reduce((sum, step) => sum + (step.timeMinutes || 0), 0);
            if (totalTimeMinutes > 0) {
                totalTime = formatMinutesToTime(totalTimeMinutes);
            }
        }

        return {
            totalSteps,
            totalTime,
            totalTimeMinutes,
            stepTimes,
            source: 'document',
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('Error extracting document metrics:', error);
        return createDefaultMetrics('extraction-error');
    }
}


/**
 * Extract metrics from Mermaid workflow diagram
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {ProcessMetrics} - Standardized metrics object
 */
export function extractMetricsFromWorkflow(diagramCode) {
    try {
        if (!diagramCode) return createDefaultMetrics('workflow-empty');

        // Find all rectangular nodes (process boxes)
        const processBoxes = diagramCode.match(/\[[^\]]+\]/g) || [];

        // Filter out non-process nodes like start/end/decision points
        const processSteps = processBoxes.filter(box => {
            const lowerBox = box.toLowerCase();
            return !lowerBox.includes('start') &&
                !lowerBox.includes('end') &&
                !lowerBox.includes('begin') &&
                !lowerBox.includes('finish') &&
                !lowerBox.includes('title') &&
                !lowerBox.includes('?') &&  // Decision nodes often contain question marks
                !lowerBox.includes('decision');
        });

        // Count total steps
        const totalSteps = processSteps.length;

        // Extract time information from each step
        const stepTimes = extractStepTimesFromDiagram(diagramCode);

        // Calculate total time
        let totalTimeMinutes = stepTimes.reduce((sum, step) => sum + (step.timeMinutes || 0), 0);
        const totalTime = totalTimeMinutes > 0
            ? formatMinutesToTime(totalTimeMinutes)
            : "Unknown";

        // Log what we found for debugging
        // console.log("Workflow metrics extraction:", {
        //     totalProcessBoxes: processBoxes.length,
        //     filteredProcessSteps: totalSteps,
        //     extractedStepTimes: stepTimes.length,
        //     totalTimeMinutes
        // });

        return {
            totalSteps,
            totalTime,
            totalTimeMinutes,
            stepTimes,
            source: 'workflow',
            timestamp: Date.now()
        };
    } catch (error) {
        console.error('Error extracting workflow metrics:', error);
        return createDefaultMetrics('workflow-error');
    }
}

/**
 * Extract step times from a mermaid diagram
 * @param {string} diagramCode - Mermaid diagram code
 * @returns {Array<StepTime>} - Array of step times
 */
function extractStepTimesFromDiagram(diagramCode) {
    const stepTimes = [];

    // Extract nodes with their IDs and content
    const nodeDefinitions = {};
    const nodeDefPattern = /\s*([a-zA-Z0-9_]+)\["([^"]+)"\]/g;
    let nodeMatch;

    while ((nodeMatch = nodeDefPattern.exec(diagramCode)) !== null) {
        const nodeId = nodeMatch[1];
        const nodeContent = nodeMatch[2];
        nodeDefinitions[nodeId] = nodeContent;
    }

    // Extract step information from node contents
    Object.entries(nodeDefinitions).forEach(([nodeId, content]) => {
        // Skip nodes that are clearly not steps
        if (nodeId.toLowerCase().includes('start') ||
            nodeId.toLowerCase().includes('end') ||
            content.toLowerCase().includes('start:') ||
            content.toLowerCase().includes('end:') ||
            content.includes('?')) {
            return;
        }

        // Extract step number
        let stepNumber = null;
        const stepNumberMatch = content.match(/Step\s+(\d+)|Submit\s+Step\s+(\d+)|Activity\s+(\d+)|Process\s+(\d+)/i);
        if (stepNumberMatch) {
            stepNumber = stepNumberMatch.slice(1).find(match => match !== undefined);
        }

        // If no explicit step number, try to extract from node ID
        if (!stepNumber) {
            const idNumberMatch = nodeId.match(/step(\d+)|s(\d+)|(\d+)/i);
            if (idNumberMatch) {
                stepNumber = idNumberMatch.slice(1).find(match => match !== undefined);
            }
        }

        // If still no step number, generate one
        if (!stepNumber) {
            stepNumber = (stepTimes.length + 1).toString();
        }

        // Extract time estimate
        let timeEstimate = "Unknown";

        // Match time patterns
        const parenthesisTimeMatch = content.match(/\(([^)]*(?:day|week|hour|minute|min|hr|h|d|w)[^)]*)\)/i);
        if (parenthesisTimeMatch) {
            timeEstimate = parenthesisTimeMatch[1].trim();
        } else {
            const timeMatch = content.match(/(\d+(?:-\d+)?\s*(?:day|days|week|weeks|hour|hours|minute|minutes|min|mins|hr|hrs|h|d|w)s?)/i);
            if (timeMatch) {
                timeEstimate = timeMatch[1].trim();
            }
        }

        // Clean up the step name
        let stepName = content
            .replace(/\([^)]*(?:day|week|hour|minute|min|hr|h|d|w)[^)]*\)/i, '')
            .replace(/\d+(?:-\d+)?\s*(?:day|days|week|weeks|hour|hours|minute|minutes|min|mins|hr|hrs|h|d|w)s?/i, '')
            .trim();

        // Remove trailing punctuation
        stepName = stepName.replace(/[:;,.]+$/, '').trim();

        const timeMinutes = parseTimeToMinutes(timeEstimate) || 0;

        stepTimes.push({
            step: stepNumber,
            stepName: stepName,
            time: timeEstimate,
            timeMinutes: timeMinutes
        });
    });

    // Sort steps by number
    stepTimes.sort((a, b) => {
        const aNum = parseInt(a.step, 10) || Number.MAX_SAFE_INTEGER;
        const bNum = parseInt(b.step, 10) || Number.MAX_SAFE_INTEGER;
        return aNum - bNum;
    });

    return stepTimes;
}

/**
 * Merge metrics from document and workflow sources
 * @param {ProcessMetrics} workflowMetrics - Metrics from workflow diagram
 * @param {ProcessMetrics} documentMetrics - Metrics from document
 * @returns {ProcessMetrics} - Merged metrics
 */
export function mergeMetrics(workflowMetrics, documentMetrics) {
    // Validate inputs
    const workflow = workflowMetrics || createDefaultMetrics('workflow');
    const document = documentMetrics || createDefaultMetrics('document');

    // Create a new metrics object
    const merged = {
        totalSteps: Math.max(workflow.totalSteps || 0, document.totalSteps || 0),
        stepTimes: [],
        source: 'merged',
        timestamp: Date.now()
    };

    // Use step times from the document as primary source
    const stepTimes = new Map();

    // Add document step times first (highest priority)
    if (document.stepTimes) {
        document.stepTimes.forEach(step => {
            stepTimes.set(step.step, {
                ...step,
                source: 'document'
            });
        });
    }

    // Add workflow step times (only if not already present)
    if (workflow.stepTimes) {
        workflow.stepTimes.forEach(step => {
            if (!stepTimes.has(step.step)) {
                stepTimes.set(step.step, {
                    ...step,
                    source: 'workflow'
                });
            }
        });
    }

    // Convert map to array and sort by step number
    merged.stepTimes = Array.from(stepTimes.values()).sort((a, b) => {
        const aNum = parseInt(a.step, 10) || Number.MAX_SAFE_INTEGER;
        const bNum = parseInt(b.step, 10) || Number.MAX_SAFE_INTEGER;
        return aNum - bNum;
    });

    // Calculate total time from step times
    const totalTimeMinutes = merged.stepTimes.reduce((sum, step) => sum + (step.timeMinutes || 0), 0);
    merged.totalTimeMinutes = totalTimeMinutes;
    merged.totalTime = formatMinutesToTime(totalTimeMinutes);

    return merged;
}

/**
 * Calculate time savings between original and optimized processes
 * @param {ProcessMetrics} originalMetrics - Original process metrics
 * @param {ProcessMetrics} optimizedMetrics - Optimized process metrics
 * @returns {Object} - Time savings details
 */
export function calculateTimeSavings(originalMetrics, optimizedMetrics) {
    // Get time in minutes, ensuring we have valid values
    const originalMinutes = originalMetrics?.totalTimeMinutes ||
        parseTimeToMinutes(originalMetrics?.totalTime) || 0;

    const optimizedMinutes = optimizedMetrics?.totalTimeMinutes ||
        parseTimeToMinutes(optimizedMetrics?.totalTime) || 0;

    // Calculate savings
    const savedMinutes = Math.max(0, originalMinutes - optimizedMinutes);
    const percentage = originalMinutes > 0
        ? (savedMinutes / originalMinutes) * 100
        : 0;

    return {
        minutes: savedMinutes,
        percentage: percentage,
        formatted: formatMinutesToTime(savedMinutes),
        percentageFormatted: `${Math.round(percentage)}%`
    };
}

/**
 * Parse optimization result from any LLM response
 * @param {string} result - The LLM optimization response text
 * @param {ProcessMetrics} originalMetrics - Original metrics for fallback calculations
 * @returns {Object} - Parsed optimization result
 */
function extractOptimizationViaRegex(result) {
    const parsed = {};

    // Extract summary
    const summaryMatch = result.match(/["']?summary["']?\s*:\s*["']([^"']+)["']/i) ||
        result.match(/summary[^:]*:\s*([^\n]+)/i);
    if (summaryMatch) parsed.summary = summaryMatch[1].trim();

    // Extract total steps
    const stepsMatch = result.match(/["']?total\s*steps?["']?\s*:\s*(\d+)/i) ||
        result.match(/total\s*steps?[^:]*:\s*(\d+)/i);
    if (stepsMatch) parsed.totalSteps = parseInt(stepsMatch[1]);

    // Extract total time
    const timeMatch = result.match(/["']?total\s*time["']?\s*:\s*["']([^"']+)["']/i) ||
        result.match(/total\s*time[^:]*:\s*([^\n]+)/i);
    if (timeMatch) parsed.totalTime = timeMatch[1].trim();

    // Extract suggestions with a simple pattern
    const suggestionsMatch = result.match(/["']?suggestions["']?\s*:\s*(\[[\s\S]*?\])/i);
    if (suggestionsMatch) {
        try {
            // Clean up the JSON before parsing
            const cleanedSuggestions = suggestionsMatch[1]
                .replace(/,\s*]/g, ']') // Remove trailing commas
                .replace(/([{,]\s*)["']?(\w+)["']?\s*:/g, '$1"$2":') // Ensure property names are quoted
                .replace(/:\s*["'](.*?)["']/g, ':"$1"'); // Standardize string quotes

            parsed.suggestions = JSON.parse(cleanedSuggestions);
        } catch (suggestionsError) {
            console.error('Failed to parse suggestions:', suggestionsError);
            // Create a simple fallback suggestion
            parsed.suggestions = [
                {
                    title: "Process Optimization",
                    description: "Review and optimize the workflow to reduce unnecessary steps.",
                    timeSaved: "Varies based on implementation"
                }
            ];
        }
    }

    // NEW: Better extraction of Mermaid diagram
    let diagramContent = null;

    // First look for Mermaid code blocks
    const mermaidBlockMatch = result.match(/```mermaid\s*([\s\S]*?)```/);
    if (mermaidBlockMatch && mermaidBlockMatch[1]) {
        diagramContent = mermaidBlockMatch[1].trim();
    }
    // Then look for graph TD outside of code blocks
    else {
        const graphMatch = result.match(/graph\s+TD\s*([\s\S]*?)(?=\n\s*\n|$)/);
        if (graphMatch) {
            diagramContent = 'graph TD' + graphMatch[0].substring('graph TD'.length);
        }
    }

    // If diagram found, add it to parsed result
    if (diagramContent) {
        parsed.workflowDiagram = { diagram: diagramContent };
        parsed.optimizedWorkflow = { diagram: diagramContent };
    }

    return parsed;
}

export function parseOptimizationResult(result, originalMetrics) {
    try {
        // First, check if this is just a Mermaid diagram
        if (result.trim().startsWith('graph TD') || result.includes('```mermaid')) {
            //  console.log('Detected Mermaid diagram response');

            // Extract the diagram
            let diagram = result;
            if (result.includes('```mermaid')) {
                const mermaidMatch = result.match(/```mermaid\s*([\s\S]*?)```/);
                if (mermaidMatch && mermaidMatch[1]) {
                    diagram = mermaidMatch[1].trim();
                }
            }

            // Create a minimal result object with the diagram
            const optimizedProcess = {
                summary: "Process optimized with streamlined workflow",
                metrics: {
                    totalSteps: countStepsInDiagram(diagram) || originalMetrics.totalSteps - 1,
                    totalTime: `Approximately ${Math.round((originalMetrics.totalTimeMinutes * 0.8) / 60)} hours ${Math.round((originalMetrics.totalTimeMinutes * 0.8) % 60)} minutes`,
                    totalTimeMinutes: Math.round(originalMetrics.totalTimeMinutes * 0.8),
                },
                suggestions: [
                    {
                        title: "Streamlined workflow",
                        description: "Process has been optimized with a more efficient workflow",
                        timeSaved: `Approximately ${Math.round(originalMetrics.totalTimeMinutes * 0.2)} minutes`
                    }
                ],
                workflowDiagram: {
                    diagram: diagram
                },
                optimizedWorkflow: {
                    diagram: diagram,
                    metrics: {
                        totalSteps: countStepsInDiagram(diagram) || originalMetrics.totalSteps - 1,
                        totalTimeMinutes: Math.round(originalMetrics.totalTimeMinutes * 0.8)
                    }
                }
            };

            return optimizedProcess;
        }

        // Continue with existing JSON extraction logic
        const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)```/);
        let parsedResult;

        if (jsonMatch && jsonMatch[1]) {
            // Clean up the JSON before parsing
            const cleanedJson = jsonMatch[1].trim()
                .replace(/,\s*([\]}])/g, '$1'); // Remove trailing commas

            try {
                parsedResult = JSON.parse(cleanedJson);
            } catch (jsonError) {
                console.error('Failed to parse extracted JSON block:', jsonError);
                // Continue to the next approach
            }
        }

        // If first approach failed, try parsing the whole response
        if (!parsedResult) {
            try {
                parsedResult = JSON.parse(result.trim());
            } catch (wholeJsonError) {
                console.error('Failed to parse whole response as JSON');
                // Fall back to regex extraction
                parsedResult = extractOptimizationViaRegex(result);
            }
        }

        // Standardize and validate the parsed result
        return standardizeOptimizationResult(parsedResult, originalMetrics);
    } catch (error) {
        console.error('Error parsing optimization result:', error);
        return createDefaultOptimizationResult(originalMetrics);
    }
}

// Helper function to count steps in a diagram
function countStepsInDiagram(diagram) {
    // Count nodes that appear to be steps (rectangular nodes with text)
    const stepMatches = diagram.match(/\[\s*"[^"]+"\s*\]/g);
    return stepMatches ? stepMatches.length : 0;
}

/**
 * Standardize and enhance the optimization result
 * @param {Object} result - The parsed optimization result
 * @param {ProcessMetrics} originalMetrics - Original metrics for calculations
 * @returns {Object} - Standardized optimization result
 */
function standardizeOptimizationResult(result, originalMetrics) {
    if (!result) return createDefaultOptimizationResult(originalMetrics);

    // Calculate optimized metrics
    const optimizedTotalSteps = result.totalSteps || Math.floor(originalMetrics.totalSteps * 0.7);

    const optimizedTimeMinutes = parseTimeToMinutes(result.totalTime);
    let calculatedTimeMinutes = 0;

    if (optimizedTimeMinutes) {
        calculatedTimeMinutes = optimizedTimeMinutes;
    } else if (originalMetrics.totalTimeMinutes > 0) {
        // Estimate optimized time based on step reduction
        const reductionFactor = optimizedTotalSteps / originalMetrics.totalSteps;
        calculatedTimeMinutes = Math.floor(originalMetrics.totalTimeMinutes * reductionFactor);
    }

    const optimizedTotalTime = result.totalTime ||
        (calculatedTimeMinutes > 0 ? formatMinutesToTime(calculatedTimeMinutes) : "Unknown");

    // Process step times
    let optimizedStepTimes = Array.isArray(result.stepTimes) ? result.stepTimes : [];

    // Add timeMinutes to each step
    optimizedStepTimes = optimizedStepTimes.map(step => ({
        ...step,
        timeMinutes: parseTimeToMinutes(step.time) || 0
    }));

    // Ensure we have the right number of step times
    if (optimizedStepTimes.length !== optimizedTotalSteps) {
        if (optimizedStepTimes.length > optimizedTotalSteps) {
            // Trim excess steps
            optimizedStepTimes = optimizedStepTimes.slice(0, optimizedTotalSteps);
        } else {
            // Add missing steps
            while (optimizedStepTimes.length < optimizedTotalSteps) {
                const stepNum = optimizedStepTimes.length + 1;
                optimizedStepTimes.push({
                    step: stepNum.toString(),
                    stepName: `Optimized Step ${stepNum}`,
                    time: "Not specified",
                    timeMinutes: 0
                });
            }
        }
    }

    // Calculate savings
    const timeSavings = calculateTimeSavings(
        originalMetrics,
        { totalTimeMinutes: calculatedTimeMinutes, totalTime: optimizedTotalTime }
    );

    // Enhanced summary if none provided
    let summary = result.summary;
    if (!summary) {
        summary = `By implementing these optimizations, the process could be reduced from ${originalMetrics.totalSteps} to ${optimizedTotalSteps} steps (${Math.round(timeSavings.percentage)}% reduction) and save approximately ${timeSavings.formatted} of processing time.`;
    }

    // Ensure we have suggestions
    const suggestions = Array.isArray(result.suggestions) && result.suggestions.length > 0
        ? result.suggestions
        : [
            {
                title: "Streamline Approval Process",
                description: "Consolidate multiple approval steps into a single, parallel approval workflow.",
                timeSaved: "Approximately 30% of approval time"
            },
            {
                title: "Automate Manual Data Entry",
                description: "Replace manual data entry with automated form processing.",
                timeSaved: "Up to 50% of data processing time"
            },
            {
                title: "Eliminate Redundant Reviews",
                description: "Remove duplicate review cycles and implement a single comprehensive review.",
                timeSaved: "About 25% of review cycle time"
            }
        ];

    return {
        summary,
        suggestions,
        metrics: {
            totalSteps: optimizedTotalSteps,
            totalTime: optimizedTotalTime,
            totalTimeMinutes: calculatedTimeMinutes,
            stepTimes: optimizedStepTimes,
            source: 'optimized',
            timestamp: Date.now()
        },
        workflowDiagram: {
            diagram: result.workflow || "",
            type: 'mermaid'
        },
        timeSavings: timeSavings,
        originalMetrics: {
            totalSteps: originalMetrics.totalSteps,
            totalTime: originalMetrics.totalTime,
            totalTimeMinutes: originalMetrics.totalTimeMinutes
        }
    };
}

/**
 * Create default metrics object
 * @param {string} source - Source identifier
 * @returns {ProcessMetrics} - Default metrics object
 */
export function createDefaultMetrics(source = 'unknown') {
    return {
        totalSteps: 0,
        totalTime: "Unknown",
        totalTimeMinutes: 0,
        stepTimes: [],
        source: source,
        timestamp: Date.now()
    };
}

/**
 * Create default optimization result
 * @param {ProcessMetrics} originalMetrics - Original metrics to base defaults on
 * @returns {Object} - Default optimization result
 */
function createDefaultOptimizationResult(originalMetrics) {
    const defaultSteps = Math.floor(originalMetrics.totalSteps * 0.7) || 3;
    const defaultTimeMinutes = Math.floor(originalMetrics.totalTimeMinutes * 0.7) || 0;
    const defaultTime = defaultTimeMinutes > 0
        ? formatMinutesToTime(defaultTimeMinutes)
        : "Unknown";

    return {
        summary: "Process optimization completed successfully with estimated time and step reductions.",
        metrics: {
            totalSteps: defaultSteps,
            totalTime: defaultTime,
            totalTimeMinutes: defaultTimeMinutes,
            stepTimes: Array(defaultSteps).fill(0).map((_, i) => ({
                step: (i + 1).toString(),
                stepName: `Optimized Step ${i + 1}`,
                time: "Not specified",
                timeMinutes: 0
            })),
            source: 'optimized-default',
            timestamp: Date.now()
        },
        suggestions: [
            {
                title: "Streamline Approval Process",
                description: "Consolidate multiple approval steps into a single, parallel approval workflow.",
                timeSaved: "Approximately 30% of approval time"
            },
            {
                title: "Automate Manual Steps",
                description: "Replace manual processes with automation where possible.",
                timeSaved: "Up to 40% of manual processing time"
            }
        ],
        workflowDiagram: {
            diagram: "graph TD\nA[Start] --> B[Optimized Process] --> C[End]",
            type: 'mermaid'
        },
        timeSavings: {
            minutes: originalMetrics.totalTimeMinutes * 0.3,
            percentage: 30,
            formatted: formatMinutesToTime(originalMetrics.totalTimeMinutes * 0.3),
            percentageFormatted: "30%"
        },
        originalMetrics: {
            totalSteps: originalMetrics.totalSteps,
            totalTime: originalMetrics.totalTime,
            totalTimeMinutes: originalMetrics.totalTimeMinutes
        }
    };
}




/**
 * Create an optimized prompt for the LLM with clear schema requirements
 * @param {ProcessMetrics} metrics - Original process metrics
 * @param {Object} workflow - Original workflow diagram
 * @returns {string} - Formatted prompt
 */

export default {

};