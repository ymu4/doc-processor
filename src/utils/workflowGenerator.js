// utils/workflowGenerator.js
import { callLLM } from './llmClient';
import { extractMetricsFromWorkflow } from './metricsProcessor';

function createPromptForWorkflowGeneration(extractedData, regenerationAttempt = false) {

    let prompt = regenerationAttempt
        ? "Your previous attempt at creating a workflow diagram had syntax errors or rendering issues. Please create a NEW  workflow diagram with careful attention to Mermaid.js syntax:\n\n"
        : "Based on the following data, generate a detailed workflow diagram using Mermaid.js syntax for the process described:\n\n";

    // Add general instructions for workflow generation
    prompt += "## Instructions\n";
    prompt += "Analyze the input data to identify the specific process being described, even if the input data is already a workflow or process document. Then create a detailed and more organized workflow diagram that clearly represents this process. ";
    prompt += "The diagram should visually represent the step-by-step workflow, ";
    prompt += "including all approval stages, decision points, participant roles, and TIME ESTIMATES for each step.\n\n";

    prompt += "## Process Analysis and Diagram Creation Steps\n";
    prompt += "1. First, identify the name and type of process from the input data\n";
    prompt += "2. Extract all sequential steps involved in the process\n";
    prompt += "3. Identify key decision points where the process flow may branch\n";
    prompt += "4. Determine the different roles/departments/units involved in the process\n";
    prompt += "5. For each step, identify or estimate a reasonable time duration\n";
    prompt += "6. Map out the complete workflow from initiation to completion\n";
    prompt += "7. Include appropriate labels, descriptions, and time estimates for each step\n\n";


    prompt += "## Diagram Structure Guidelines\n";
    prompt += "1. Start with a clear title showing the process name\n";
    prompt += "2. Begin the workflow with a 'Start' node and end with an 'End' node\n";
    prompt += "3. Use rectangular nodes [\"text\"] for process steps\n";
    prompt += "4. Use diamond shapes {\"text\"} for decision points with labeled branches\n";
    prompt += "5. Show the proper sequence with directional arrows using '-->' syntax (NOT '->')\n";
    prompt += "6. Group related activities by department/role when appropriate\n";
    prompt += "7. Include TIME ESTIMATES for each step (e.g., '30 min', '2 hours', '1 day')\n";
    prompt += "8. Use ([\"text\"]) syntax for start/end nodes\n";
    prompt += "9. Ensure all possible paths through the process are represented\n";


    prompt += "10. Use subgraphs to organize the workflow by phases or departments if applicable\n";
    prompt += "11. Always close subgraphs with 'end' keyword\n\n";



    // Add the data context similar to document generation
    if (extractedData.type === 'csv' || extractedData.type === 'excel') {
        prompt += `Headers: ${extractedData.headers.join(', ')}\n\n`;
        prompt += "Sample data:\n";

        const sampleSize = Math.min(5, extractedData.content.length);
        for (let i = 0; i < sampleSize; i++) {
            prompt += JSON.stringify(extractedData.content[i]) + "\n";
        }
    } else {
        const contentPreview = typeof extractedData.content === 'string'
            ? extractedData.content.substring(0, 5000)
            : JSON.stringify(extractedData.content).substring(0, 5000);

        prompt += contentPreview;
    }

    prompt += "\n\nGenerate a detailed flowchart that accurately represents the process workflow described in this data.";
    prompt += "\n\nRequirements for the workflow diagram:";
    prompt += "\n1. Use clear, descriptive labels for each step";
    prompt += "\n2. Include appropriate decision points with labeled branches (Yes/No, Approved/Rejected, etc.)";
    prompt += "\n3. Show the flow between different departments or organizational units";
    prompt += "\n4. Use appropriate Mermaid.js symbols for different types of activities:";
    prompt += "\n   - ([\"text\"]) for start/end points";
    prompt += "\n   - [\"text\"] for process steps";
    prompt += "\n   - {\"text\"} for decision points";
    prompt += "\n   - -->|\"label\"| for labeled arrows (DO NOT use -> arrows)";
    prompt += "\n5. Title the diagram with the specific process name identified from the input data";
    prompt += "\n6. For each process step, include an estimated time for completion (e.g., 'Step 1: Review Document (30 min)')";
    prompt += "\n7. If the input already has time estimates, use those; otherwise, provide reasonable estimates";
    prompt += "\n8. Ensure the diagram is complete and represents the entire process from beginning to end";

    // Improved Mermaid syntax guidelines based on issues seen
    prompt += "\n\nMERMAID.JS SYNTAX REQUIREMENTS:";
    prompt += "\n1. Start with 'graph TD' on its own line";
    prompt += "\n2. Use simple label text without HTML tags or special characters";
    prompt += "\n3. For time estimates, add them directly at the end of labels in parentheses, e.g., 'Review Document (30 min)'";
    prompt += "\n4. DO NOT use <br> tags or HTML formatting in node labels";
    prompt += "\n5. Use double quotes for all node labels to handle spaces: A[\"Process step\"]";
    prompt += "\n6. For decision nodes, use proper syntax: A{\"Decision?\"}";
    prompt += "\n7. For arrows with labels, use the proper syntax: A -->|\"Yes\"| B";
    prompt += "\n8. Avoid special characters: ^ < > ` $ ! & *";
    prompt += "\n9. Keep node IDs simple and avoid reserved words like 'end', 'style', etc.";
    prompt += "\n10. DO NOT use 'endNode' as a keyword - use 'end' to close subgraphs";
    prompt += "\n11. Format time estimates consistently as (Xh Ym) or (Z min)";
    prompt += "\n12. Always close subgraphs with 'end' on its own line";
    prompt += "\n13. Each node definition should be on its own line";
    prompt += '\n14. Use standard quotation marks " not smart quotation marks " " ';



    prompt += "\n15. For subgraphs, use the correct syntax: 'subgraph \"Title\"' and 'end'";
    prompt += "\n16. Ensure proper line breaks between node definitions";


    return prompt;
}
function autoFixMermaidSyntax(diagramCode) {
    // Fix smart quotes
    diagramCode = diagramCode.replace(/[""]/g, '"');

    // Fix endNode to end for subgraphs - look specifically for endNode closing subgraphs
    // This is the most critical fix for your current issue
    diagramCode = diagramCode.replace(/^(\s*)endNode\s*$/gm, '$1end');

    // Fix when endNode appears in flow without being at the start of a line 
    // (e.g., it's a node name in the workflow)
    diagramCode = diagramCode.replace(/\bendNode\b(?!\s*$)/g, 'endProcess');

    // Fix node names that are 'end' to prevent conflicts with subgraph end
    diagramCode = diagramCode.replace(/\bend\[/g, 'endProcess[');
    diagramCode = diagramCode.replace(/\bend{/g, 'endProcess{');
    diagramCode = diagramCode.replace(/\bend\(/g, 'endProcess(');

    return diagramCode;
}

export function validateAndFixMermaidSyntax(code) {
    if (!code) return 'graph TD\nA[No diagram available]';

    // First pass: auto fix common issues
    let fixed = code.trim();

    // Make sure graph TD is on its own line at the beginning
    if (!fixed.match(/^graph\s+(TD|LR|RL|BT)/i)) {
        fixed = 'graph TD\n' + fixed;
    }

    // Fix critical syntax issues
    fixed = fixed
        // Ensure arrow syntax is correct
        .replace(/-+>/g, '-->')
        .replace(/--[^>]/g, '-->')
        // Remove HTML tags that can cause problems
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, '')
        // Standardize quotes
        .replace(/'/g, '"')
        .replace(/[""]/g, '"') // Fix smart quotes that might appear in the diagram
        // Remove any trailing commas in brackets
        .replace(/,\s*\]/g, ']')
        // Fix missing quotes around node labels with spaces
        .replace(/\[([^"\]]+\s+[^"\]]+)\]/g, '["$1"]')
        // Fix node definition syntax
        .replace(/([A-Za-z0-9_]+)\s*\[\s*"([^"]+)"\s*\]/g, '$1["$2"]')
        // Fix duplicate node definitions
        .replace(/^(\s*[A-Za-z0-9_]+\["[^"]+"\])\s*\1/gm, '$1');

    // Fix subgraph handling - critical for your issue
    const lines = fixed.split('\n');
    const fixedLines = [];
    let subgraphDepth = 0;
    let inSubgraph = false;

    // Track which nodes are already in the main flow
    const definedNodes = new Set();
    const subgraphNodes = new Set();

    // First pass to collect all defined nodes in the main flow
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip subgraph sections for now
        if (line.startsWith('subgraph')) {
            let j = i;
            while (j < lines.length && lines[j].trim() !== 'end') {
                j++;
            }
            i = j;
            continue;
        }

        // Find node definitions in the main flow (step1, step2, etc.)
        const nodeMatch = line.match(/^([A-Za-z0-9_]+)(?:\[|\(|\{)/);
        if (nodeMatch) {
            definedNodes.add(nodeMatch[1]);
        }
    }

    // Second pass to fix subgraph issues
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Detect subgraph start
        if (line.startsWith('subgraph')) {
            subgraphDepth++;
            inSubgraph = true;
            fixedLines.push(lines[i]);
            continue;
        }

        // Detect potential subgraph end
        if (line === 'end' || line === 'endNode') {
            if (inSubgraph && subgraphDepth > 0) {
                fixedLines.push(lines[i].replace(/endNode/, 'end'));
                subgraphDepth--;
                if (subgraphDepth === 0) {
                    inSubgraph = false;
                }
            } else {
                // This is not closing a subgraph, so keep as is
                fixedLines.push(lines[i]);
            }
            continue;
        }

        // Handle nodes inside subgraphs
        if (inSubgraph) {
            // Check if this is trying to reference a node already in the main flow
            const nodeMatch = line.match(/^([A-Za-z0-9_]+)(?:\[|\(|\{)/);

            if (nodeMatch && definedNodes.has(nodeMatch[1])) {
                // This node is already defined in the main flow
                // Instead of redefining it, just add its name to reference it
                subgraphNodes.add(nodeMatch[1]);
                fixedLines.push(nodeMatch[1]);
            } else {
                fixedLines.push(lines[i]);
            }
        } else {
            fixedLines.push(lines[i]);
        }
    }

    fixed = fixedLines.join('\n');

    // Ensure the diagram has at least one node
    if (!fixed.match(/\[[^\]]+\]/)) {
        fixed += '\nA["Process Start"] --> B["Process End"]';
    }

    // Fix common issues with decision nodes
    fixed = fixed
        // Fix decision node syntax
        .replace(/([A-Za-z0-9_]+)\s*\{\s*"([^"]+)"\s*\}/g, '$1{"$2"}')
        // Ensure proper formatting for condition labels
        .replace(/-->\|([^|]*[^|"])\|/g, '-->|"$1"|');

    // Final pass to ensure no endNode is used to close subgraphs
    fixed = fixed.replace(/^(\s*)endNode\s*$/gm, '$1end');

    // Ensure end nodes in the workflow (not subgraph closures) are renamed
    fixed = fixed.replace(/\bendNode\b(?!\s*$)/g, 'endProcess');

    // Close any unclosed subgraphs
    if (subgraphDepth > 0) {
        for (let i = 0; i < subgraphDepth; i++) {
            fixed += '\nend';
        }
    }

    return fixed;
}


/**
 * Generate a workflow diagram based on extracted data
 */
export async function generateWorkflow(extractedData, options = {}) {
    const { temperature = 0.3, regenerationAttempt = false } = options;

    try {
        console.log('Creating prompt for workflow generation...');
        const prompt = createPromptForWorkflowGeneration(extractedData, regenerationAttempt);

        // Get API provider preference from session storage (client-side) or environment variable (server-side)
        let provider = 'auto';

        // Check if we're on client or server
        const isClient = typeof window !== 'undefined';

        if (isClient) {
            provider = window.sessionStorage.getItem('api_provider') || 'auto';
        } else {
            provider = process.env.API_PROVIDER_TEMP || 'auto';
        }

        console.log(`Using provider: ${provider} for workflow generation`);

        // Use the unified LLM client with the correct provider preference
        const response = await callLLM({
            provider: provider, // Use the configured provider instead of always 'auto'
            temperature: temperature,
            systemPrompt: "You are a workflow diagram assistant that creates clear Mermaid.js flowcharts based on process descriptions. Your diagrams are professional and follow standard flowchart conventions. Include time estimates for each step when the information is available or can be reasonably inferred.",
            userPrompt: prompt
        });

        const generatedContent = response.content;
        console.log(`Workflow generation successful using ${response.provider}, content length:`, generatedContent.length);

        // Extract just the Mermaid code from the response (in case it includes extra text)
        let diagramCode = generatedContent;

        // Try to extract just the code block if it's wrapped in markdown backticks
        const mermaidMatch = generatedContent.match(/```mermaid\s*([\s\S]*?)\s*```/);
        if (mermaidMatch && mermaidMatch[1]) {
            diagramCode = mermaidMatch[1].trim();
            console.log('Extracted Mermaid code from markdown block');
        }

        // Apply additional validation and fixes for Mermaid syntax
        diagramCode = validateAndFixMermaidSyntax(diagramCode);
        diagramCode = autoFixMermaidSyntax(diagramCode)

        // Extract process metrics from the diagram code
        const metrics = extractMetricsFromWorkflow(diagramCode);

        return {
            diagram: diagramCode,
            type: 'mermaid',
            metrics: metrics,
            provider: response.provider
        };
    } catch (error) {
        console.error('Error in generateWorkflow:', error);
        throw error;
    }
}
export default {
    generateWorkflow,
    validateAndFixMermaidSyntax
};