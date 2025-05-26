// pages/api/regenerate-workflow.js - Enhanced version
import { callLLM } from '@/utils/llmClient';
import { extractMetricsFromWorkflow } from '@/utils/metricsProcessor';
import { validateAndFixMermaidSyntax } from '@/utils/workflowGenerator';
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

        const { documentData, userFeedback, originalMetrics, originalDiagram } = req.body;

        if (!documentData) {
            return res.status(400).json({ error: 'Missing document data' });
        }

        if (!originalDiagram) {
            return res.status(400).json({ error: 'Missing original diagram data needed for regeneration' });
        }

        console.log('Regenerating workflow diagram with user feedback while preserving structure...');

        // Create a custom workflow prompt with emphasis on preserving structure and applying user feedback
        const prompt = createCustomWorkflowPrompt(documentData, userFeedback, originalMetrics, originalDiagram);

        // Call the LLM to generate the workflow with a lower temperature for more precision
        const response = await callLLM({
            provider: preferredProvider !== 'both' ? preferredProvider : 'auto',
            temperature: 0.2,
            systemPrompt: "You are a workflow diagram specialist that enhances existing Mermaid.js flowcharts based on user feedback. Your primary job is to MAINTAIN THE COMPLEXITY of the original diagram while carefully incorporating specific feedback. You preserve all subgraphs, connections, decision points, and node IDs from the original diagram.",
            userPrompt: prompt
        });

        console.log('Workflow regenerated successfully');

        // Extract the diagram code
        let diagramCode = response.content;

        // Try to extract just the code block if it's wrapped in markdown backticks
        const mermaidMatch = diagramCode.match(/```mermaid\s*([\s\S]*?)\s*```/);
        if (mermaidMatch && mermaidMatch[1]) {
            diagramCode = mermaidMatch[1].trim();
        }

        // Apply validation and fixes for Mermaid syntax
        diagramCode = validateAndFixMermaidSyntax(diagramCode);

        // Second validation step - if the regenerated diagram is too different from original
        // (missing nodes, subgraphs, etc.), fall back to making targeted changes to original
        const validatedDiagram = ensureDiagramIntegrity(diagramCode, originalDiagram, userFeedback);

        // Extract process metrics from the diagram code
        console.log('Extracting metrics from regenerated workflow...');
        const workflowMetrics = extractMetricsFromWorkflow(validatedDiagram);

        console.log('Extracted workflow metrics:', JSON.stringify({
            totalSteps: workflowMetrics.totalSteps,
            totalTime: workflowMetrics.totalTime,
            stepTimesCount: workflowMetrics.stepTimes?.length || 0
        }));

        // Create the workflow diagram object
        const workflowDiagram = {
            diagram: validatedDiagram,
            type: 'mermaid',
            metrics: workflowMetrics,
            provider: response.provider
        };

        // Return both the diagram and the workflow metrics
        return res.status(200).json({
            workflowDiagram,
            workflowMetrics
        });
    } catch (error) {
        console.error('Error regenerating workflow:', error);
        return res.status(500).json({
            error: 'Failed to regenerate workflow',
            message: error.message || 'An unexpected error occurred'
        });
    }
}

/**
 * Ensures the regenerated diagram maintains the structural integrity of the original
 * If there are issues, it makes targeted changes to the original instead
 */
function ensureDiagramIntegrity(regeneratedDiagram, originalDiagram, userFeedback) {
    // Simple integrity check: regenerated diagram shouldn't be significantly smaller
    const regeneratedSize = regeneratedDiagram.length;
    const originalSize = originalDiagram.length;

    // If the regenerated diagram is less than 70% of the original size, 
    // it might have lost complexity - do a targeted modification instead
    if (regeneratedSize < originalSize * 0.7) {
        console.warn(`Regenerated diagram (${regeneratedSize} chars) is significantly smaller than original (${originalSize} chars). Applying targeted modifications to original instead.`);
        return applyTargetedChanges(originalDiagram, userFeedback);
    }

    // Count subgraphs in both diagrams
    const originalSubgraphCount = (originalDiagram.match(/subgraph/g) || []).length;
    const regeneratedSubgraphCount = (regeneratedDiagram.match(/subgraph/g) || []).length;

    if (regeneratedSubgraphCount < originalSubgraphCount) {
        console.warn(`Regenerated diagram has fewer subgraphs (${regeneratedSubgraphCount}) than original (${originalSubgraphCount}). Applying targeted modifications to original instead.`);
        return applyTargetedChanges(originalDiagram, userFeedback);
    }

    // Extract node IDs from both diagrams
    const getNodeIds = (diagram) => {
        const nodeMatches = diagram.match(/[A-Za-z0-9_]+\s*(\[|\{|\(\[)/g) || [];
        return nodeMatches.map(match => match.replace(/\s*(\[|\{|\(\[).*$/, ''));
    };

    const originalNodes = getNodeIds(originalDiagram);
    const regeneratedNodes = getNodeIds(regeneratedDiagram);

    // Check if any node IDs are missing in the regenerated diagram
    const missingNodes = originalNodes.filter(node => !regeneratedNodes.includes(node));

    if (missingNodes.length > 0) {
        console.warn(`Regenerated diagram is missing ${missingNodes.length} nodes from original. Applying targeted modifications to original instead.`);
        return applyTargetedChanges(originalDiagram, userFeedback);
    }

    // If all checks pass, return the regenerated diagram
    return regeneratedDiagram;
}

/**
 * Apply targeted changes to the original diagram based on user feedback
 * instead of completely regenerating it
 */
function applyTargetedChanges(originalDiagram, userFeedback) {
    // This is a simplified implementation that looks for time estimate changes
    let modifiedDiagram = originalDiagram;

    // Extract potential time changes from feedback
    const timeChangeRegex = /(\w+)\s+should\s+take\s+([0-9]+\s+\w+)/gi;
    const timeMatches = [...userFeedback.matchAll(timeChangeRegex)];

    timeMatches.forEach(match => {
        const stepName = match[1];
        const newTime = match[2];

        // Try to find nodes by name or ID
        const nodePatterns = [
            new RegExp(`([A-Za-z0-9_]+)\\s*\\[\\s*"${stepName}[^"]*\\s*\\(([^)]+)\\)"\\s*\\]`, 'i'),  // Matches a node with this name and a time
            new RegExp(`([A-Za-z0-9_]+)\\s*\\[\\s*"[^"]*${stepName}[^"]*\\s*\\(([^)]+)\\)"\\s*\\]`, 'i'), // Matches a node containing this name
            new RegExp(`(${stepName})\\s*\\[\\s*"([^"]+)\\s*\\(([^)]+)\\)"\\s*\\]`, 'i')  // Matches node ID
        ];

        for (const pattern of nodePatterns) {
            modifiedDiagram = modifiedDiagram.replace(pattern, (match, nodeId, label, oldTime) => {
                console.log(`Changing time for step ${nodeId} from (${oldTime}) to (${newTime})`);
                return match.replace(`(${oldTime})`, `(${newTime})`);
            });
        }
    });

    return modifiedDiagram;
}
/**
 * Create a custom workflow prompt that emphasizes user feedback and preservation of detailed metrics
 */
function createCustomWorkflowPrompt(documentData, userFeedback, originalMetrics, originalDiagram = null) {
    let prompt = `# WORKFLOW REGENERATION TASK: ENHANCE EXISTING DIAGRAM WITH USER FEEDBACK
Your task is to MAINTAIN THE COMPLEXITY AND STRUCTURE of the original workflow diagram while incorporating the user's feedback.

## ⛔️ YOU ABSOLUTELY MUST NEVER DO THESE THINGS:
1. NEVER simplify the workflow - maintain the SAME LEVEL OF DETAIL as the original diagram
2. NEVER remove existing decision points or branches
3. NEVER use 'endNode' to close a subgraph. ALWAYS use 'end'
4. NEVER create disconnected nodes that float in the diagram
5. NEVER use 'end' as a node name. Use 'endProcess', 'finish', or 'complete'
6. NEVER use smart quotes (""). ALWAYS use standard quotes (")
7. NEVER remove time estimates from steps - EVERY step must have a time estimate in parentheses

## ✅ YOU MUST ALWAYS DO THESE THINGS:
1. PRESERVE THE OVERALL STRUCTURE and complexity of the original workflow
2. MAINTAIN ALL SUBGRAPHS from the original diagram
3. MAINTAIN ALL DECISION BRANCHES from the original diagram
4. Close EVERY subgraph with 'end' on its own line
5. Connect ALL nodes to the diagram flow
6. Use 'endProcess' for the final node in your workflow
7. Use standard quotation marks (") for ALL strings
8. Include time estimates for EVERY step
9. ONLY MODIFY ASPECTS SPECIFICALLY MENTIONED in the user feedback

## DETAILED TIME ESTIMATES FORMAT
- For steps less than 1 day: Use hours and minutes, e.g., (2 hours 30 minutes) or (45 minutes)
- For steps more than 1 day: Use days, hours, and minutes, e.g., (2 days 4 hours) or (1 day 30 minutes)
- EVERY step node MUST include a time estimate in the node label
- Format: node["Step description (time estimate)"]`;

    // Include original diagram if available
    if (originalDiagram) {
        prompt += `
## ORIGINAL DIAGRAM TO MODIFY
This is the ORIGINAL diagram structure you MUST preserve while incorporating feedback:

\`\`\`mermaid
${originalDiagram}
\`\`\`

DO NOT SIMPLIFY THIS DIAGRAM. Maintain its complexity and enhance it with the user feedback.
`;
    }

    // Include original metrics if available
    if (originalMetrics) {
        prompt += `
## Original Process Metrics
Total Steps: ${originalMetrics.totalSteps || 'Unknown'}
Total Time: ${originalMetrics.totalTime || 'Unknown'}
`;

        if (originalMetrics.stepTimes && originalMetrics.stepTimes.length > 0) {
            prompt += `\nDetailed Step Times:\n`;
            originalMetrics.stepTimes.forEach((step, index) => {
                prompt += `- Step ${step.step || index + 1}: ${step.stepName || 'Unknown'} (${step.time || 'Unknown time'})\n`;
            });
        }
    }

    prompt += `
## Document Content
${typeof documentData.content === 'string' ? documentData.content.substring(0, 3000) : JSON.stringify(documentData).substring(0, 3000)}
`;

    if (userFeedback) {
        prompt += `## USER FEEDBACK - VERY IMPORTANT
The user has provided specific feedback about how they want the workflow to be changed:
${userFeedback}

You MUST follow this feedback closely in your updated workflow diagram. This is the most important part of your task.
ONLY change aspects of the diagram that are specifically mentioned in the feedback.
For all other aspects, maintain the structure, complexity, and details of the original diagram.
`;
    }

    prompt += `## Mermaid Syntax Requirements
1. Start with 'graph TD' on its own line
2. Use proper node syntax:
   - Regular steps: node["Step Label with time (X hours Y minutes)"]
   - Decision points: node{"Question?"}
   - Start/End: start([Start]) or endProcess([End])
3. Use arrows correctly: --> (NEVER ->)
4. Label arrows: A -->|"Yes"| B
5. NEVER use 'endNode' to close subgraphs
6. ALWAYS use 'end' to close subgraphs
7. NEVER use 'end' as a node name

## IMPORTANT REMINDER ABOUT COMPLEXITY
- Your output MUST maintain the same level of complexity as the original diagram
- DO NOT SIMPLIFY the workflow - keep all the detail, all the subgraphs, and all the decision points
- Only modify the specific aspects mentioned in the user feedback

## PROVIDE ONLY THE DIAGRAM
Just give me the Mermaid code. Do not explain it.
`;

    return prompt;
}