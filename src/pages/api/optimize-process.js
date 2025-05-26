// pages/api/optimize-process.js
import { callLLM } from '@/utils/llmClient';
import {
    parseTimeToMinutes,
    formatMinutesToTime,
    parseOptimizationResult,

} from '@/utils/metricsProcessor';
import { generateOptimizedDocument } from '@/utils/documentGenerator';
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

        const { originalMetrics, workflowDiagram, originalDocument, userFeedback } = req.body;

        if (!originalMetrics || !workflowDiagram) {
            return res.status(400).json({ error: 'Missing required data' });
        }

        // Create optimization prompt, incorporating user feedback if provided
        let prompt = createEnhancedOptimizationPrompt(originalMetrics, workflowDiagram, userFeedback);

        console.log('Calling LLM for process optimization...');

        // Call the LLM with auto-fallback or specified provider
        const llmResponse = await callLLM({
            provider: preferredProvider !== 'both' ? preferredProvider : 'auto',
            temperature: 0.3,
            systemPrompt: "You are a process optimization assistant that helps reduce bureaucracy and streamline business workflows. You suggest specific, actionable improvements to reduce the number of steps and total time required for processes. You are especially skilled at creating valid Mermaid.js flowcharts with perfect syntax.",
            userPrompt: prompt
        });

        const optimizationResult = llmResponse.content;
        const usedProvider = llmResponse.provider;

        console.log(`Optimization generation successful using ${usedProvider}`);

        // Parse the optimization result and ensure it has proper structure
        const optimizedProcess = parseOptimizationResult(optimizationResult, originalMetrics);

        // Apply enhanced Mermaid syntax validation and fixing
        if (optimizedProcess.workflowDiagram?.diagram) {
            console.log('ORIGINAL DIAGRAM:\n' + optimizedProcess.workflowDiagram.diagram)
            console.log('\n')
            optimizedProcess.workflowDiagram.diagram = validateAndFixMermaidSyntax(optimizedProcess.workflowDiagram.diagram);
            console.log('after validateAndFixMermaidSyntax \n' + optimizedProcess.workflowDiagram.diagram)
            console.log('\n')

            // Double-check for any remaining critical syntax issues
            optimizedProcess.workflowDiagram.diagram = ensureEndNodeConsistency(optimizedProcess.workflowDiagram.diagram);
            console.log('after ensureEndNodeConsistency:\n' + optimizedProcess.workflowDiagram.diagram)

        }

        // Add the provider information
        optimizedProcess.provider = usedProvider;

        // Generate an optimized document if original document is provided
        if (originalDocument) {
            try {
                const optimizedDocument = await generateOptimizedDocument(optimizedProcess, originalDocument);
                optimizedProcess.optimizedDocument = optimizedDocument;
            } catch (docError) {
                console.error('Error generating optimized document:', docError);
                // Continue without optimized document
            }
        }

        return res.status(200).json(optimizedProcess);
    } catch (error) {
        console.error('Error in optimize-process:', error);
        return res.status(500).json({
            error: 'Failed to optimize process',
            message: error.message
        });
    }
}

/**
 * Enhanced optimization prompt with explicit Mermaid syntax guidance
 */
function createEnhancedOptimizationPrompt(originalMetrics, workflowDiagram, userFeedback) {
    let prompt = `# CRITICAL MERMAID SYNTAX REQUIREMENTS (READ CAREFULLY)

## ❌ THESE SYNTAX ERRORS WILL BREAK YOUR DIAGRAM:
1. ❌ NEVER use 'endNode' to close a subgraph - MUST use 'end'
2. ❌ NEVER create floating nodes not connected to other nodes
3. ❌ NEVER use 'end' as a node name
4. ❌ NEVER use fancy quotes ("") - ONLY use straight quotes (")
5. ❌ NEVER use multiple node definitions on a single line
6. ❌ NEVER attempt to use HTML in node labels
7. ❌ NEVER leave a subgraph unclosed
8. ❌ NEVER use -> arrows (MUST use --> arrows)

## ✓ CORRECT WAY TO CLOSE SUBGRAPHS:
\`\`\`
subgraph "Title"
    node1["Step 1"]
    node2["Step 2"]
end
\`\`\`

## ❌ WRONG WAY TO CLOSE SUBGRAPHS (WILL FAIL):
\`\`\`
subgraph "Title"
    node1["Step 1"]
    node2["Step 2"]
endNode
\`\`\`

## ✓ CORRECT NODE DEFINITIONS:
\`\`\`
start([Start])
process["Process step (10 min)"]
decision{"Decision point?"}
finish([End])
\`\`\`

## ✓ CORRECT ARROW SYNTAX:
\`\`\`
nodeA --> nodeB
nodeC -->|"Yes"| nodeD
nodeE -->|"No"| nodeF
\`\`\`

## ✓ CORRECT COMPLETE SAMPLE:
\`\`\`
graph TD
    start([Start]) --> step1["First step (5 min)"]
    step1 --> decision{"Is this a decision?"}
    decision -->|"Yes"| step2["Do step 2 (10 min)"]
    decision -->|"No"| step3["Do step 3 (15 min)"]
    
    subgraph "Process Group"
        step2 --> step4["Complete task (5 min)"]
        step3 --> step4
    end
    
    step4 --> endProcess([End])
\`\`\`

## Process Optimization Request

### Current Process Metrics
Total Steps: ${originalMetrics.totalSteps}
Total Process Time: ${originalMetrics.totalTime}
Decision Points: ${originalMetrics.decisionPoints || 'N/A'}
Approval Stages: ${originalMetrics.approvalStages || 'N/A'}
Departments Involved: ${originalMetrics.departmentsInvolved || 'N/A'}
`;

    if (originalMetrics.stepTimes && originalMetrics.stepTimes.length > 0) {
        prompt += '\n### Current Step Times\n';
        originalMetrics.stepTimes.forEach(step => {
            prompt += `- ${step.description}: ${step.time}\n`;
        });
    }

    prompt += `\n### Current Workflow Diagram
\`\`\`mermaid
${workflowDiagram.diagram}
\`\`\`

## Optimization Task
Please optimize this process to reduce steps, time, and complexity while maintaining necessary controls and quality. Create a new, optimized Mermaid workflow diagram following the syntax rules above PRECISELY.
`;

    if (userFeedback) {
        prompt += `\n## User Feedback for Optimization
The user has provided the following feedback about how the process should be optimized:

${userFeedback}

Please take this feedback into account when optimizing the process. The user's suggestions should be prioritized where feasible.
`;
    }

    prompt += `
## FINAL SYNTAX CHECK BEFORE SUBMITTING
Before submitting your answer, check your diagram for:
1. All subgraphs end with 'end' (NOT 'endNode')
2. Every node is connected to the flow
3. No HTML tags in node labels
4. No smart/fancy quotes anywhere (only ")
5. Proper time format in parentheses for each step

## Required Output Format
Please provide your optimized process in this format:

### Process Optimization Summary
[Provide 3-5 bullet points on your key optimization recommendations]

### Expected Improvements
- Reduced steps: [X to Y]
- Reduced time: [X to Y] 
- Other improvements: [Brief description]

### Optimized Workflow Diagram
\`\`\`mermaid
[Insert your optimized Mermaid diagram here with FLAWLESS syntax]
\`\`\`

YOUR DIAGRAM MUST BE 100% SYNTACTICALLY CORRECT WITH SIMPLE NODE NAMES, PROPER SUBGRAPH CLOSURES, AND STANDARD QUOTES.
`;

    return prompt;
}

/**
 * Additional function to ensure end node consistency
 */
function ensureEndNodeConsistency(diagramCode) {
    // Final pass to ensure subgraphs close with 'end' not 'endNode'
    const lines = diagramCode.split('\n');
    const fixedLines = [];
    let subgraphLevel = 0;

    // Track node definitions for later reference
    const definedNodes = new Set();

    // First scan for node definitions
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        const nodeMatch = line.match(/^([A-Za-z0-9_]+)(?:\[|\(|\{)/);
        if (nodeMatch && !line.startsWith('subgraph')) {
            definedNodes.add(nodeMatch[1]);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const trimmedLine = lines[i].trim();

        // Track subgraph nesting level
        if (trimmedLine.startsWith('subgraph')) {
            subgraphLevel++;
            fixedLines.push(lines[i]);
        }
        // Handle subgraph end
        else if (trimmedLine === 'end' || trimmedLine === 'endNode') {
            if (subgraphLevel > 0) {
                // Always use 'end' to close subgraphs
                fixedLines.push(lines[i].replace(/endNode/, 'end'));
                subgraphLevel--;
            } else {
                // Not a subgraph closure, keep as is
                fixedLines.push(lines[i]);
            }
        }
        // Process workflow nodes named 'end'
        else if (trimmedLine.match(/\bend\b(?!\s*$)/)) {
            // Replace 'end' node name with 'endProcess'
            fixedLines.push(lines[i].replace(/\bend\b(?!\s*$)/, 'endProcess'));
        }
        // Handle nodes inside subgraphs
        else if (subgraphLevel > 0) {
            // Check if this is a node definition or reference
            const nodeMatch = trimmedLine.match(/^([A-Za-z0-9_]+)(?:\[|\(|\{)/);

            if (nodeMatch && definedNodes.has(nodeMatch[1])) {
                // This node is already defined elsewhere, just use its identifier
                fixedLines.push(nodeMatch[1]);
            } else {
                fixedLines.push(lines[i]);
            }
        }
        else {
            fixedLines.push(lines[i]);
        }
    }

    // In case we detected unclosed subgraphs, add closing 'end' statements
    for (let i = 0; i < subgraphLevel; i++) {
        fixedLines.push('end');
    }

    return fixedLines.join('\n');
}