// utils/workflowEditor.js
import { validateAndFixMermaidSyntax } from './workflowGenerator';



/**
 * Parse a Mermaid diagram into a structured format with improved handling of complex nodes
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {object} Parsed workflow with nodes, connections, and subgraphs
 */
/**
 * Parse a Mermaid diagram into a structured format with improved handling of complex nodes
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {object} Parsed workflow with nodes, connections, and subgraphs
 */
export function parseMermaidDiagram(diagramCode) {
    // Print the full Mermaid syntax to the console
    console.group('Mermaid Diagram Syntax');
    console.log(diagramCode);
    console.groupEnd();

    // Handle undefined or null diagram code
    console.log('Parsing diagram:', diagramCode?.length || 0);
    if (!diagramCode) {
        console.error('Empty or undefined diagram code passed to parseMermaidDiagram');
        return { nodes: {}, connections: [], subgraphs: [] };
    }

    const lines = diagramCode.split('\n');
    const nodes = {};
    const connections = [];
    const subgraphs = [];

    let currentSubgraph = null;
    let inSubgraph = false;

    // First pass: collect subgraph boundaries
    let i = 0;
    while (i < lines.length) {
        const line = lines[i].trim();

        // Process subgraph starts
        if (line.startsWith('subgraph ')) {
            const titleMatch = line.match(/subgraph\s+"?([^"]+)"?/);
            const subgraphTitle = titleMatch ? titleMatch[1] : '';

            const startLine = i;
            let endLine = -1;
            let nestingLevel = 1;

            // Find corresponding end of this subgraph, accounting for nested subgraphs
            for (let j = i + 1; j < lines.length; j++) {
                const nestedLine = lines[j].trim();

                if (nestedLine.startsWith('subgraph ')) {
                    nestingLevel++;
                } else if (nestedLine === 'end') {
                    nestingLevel--;
                    if (nestingLevel === 0) {
                        endLine = j;
                        break;
                    }
                }
            }

            if (endLine > startLine) {
                // Store subgraph info for second pass
                subgraphs.push({
                    title: subgraphTitle,
                    startLine,
                    endLine,
                    nodes: []
                });

                // Skip past this subgraph's end in the first pass
                i = endLine + 1;
                continue;
            }
        }

        i++;
    }

    // Second pass: Process nodes and connections
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Skip empty lines and directives
        if (!line || line.startsWith('%%') || line.startsWith('graph ')) {
            continue;
        }

        // Skip subgraph and end lines as we've already processed them
        if (line.startsWith('subgraph ') || line === 'end') {
            continue;
        }

        // Find what subgraph this line belongs to
        const currentSubgraphs = subgraphs.filter(sg =>
            i > sg.startLine && i < sg.endLine
        );

        // Process node definitions
        // Standard process node with time: A["Label text (time)"]
        const processNodeMatch = line.match(/^([A-Za-z0-9_]+)\s*\[\s*"([^"]+)"\s*\]/);
        if (processNodeMatch) {
            const nodeId = processNodeMatch[1];
            const nodeLabel = processNodeMatch[2];

            // Check if it contains a time estimate in parentheses
            const timeMatch = nodeLabel.match(/\(([^)]+)\)$/);
            if (timeMatch) {
                const timeEstimate = timeMatch[1];
                const labelWithoutTime = nodeLabel.substring(0, nodeLabel.length - timeMatch[0].length).trim();

                nodes[nodeId] = {
                    id: nodeId,
                    type: 'process',
                    label: labelWithoutTime,
                    fullLabel: nodeLabel,
                    timeEstimate,
                    line: i,
                    subgraphs: currentSubgraphs.map(sg => sg.title)
                };
            } else {
                nodes[nodeId] = {
                    id: nodeId,
                    type: 'process',
                    label: nodeLabel,
                    fullLabel: nodeLabel,
                    timeEstimate: null,
                    line: i,
                    subgraphs: currentSubgraphs.map(sg => sg.title)
                };
            }

            // Add node to all containing subgraphs
            currentSubgraphs.forEach(sg => {
                if (!sg.nodes.includes(nodeId)) {
                    sg.nodes.push(nodeId);
                }
            });

            continue;
        }

        // Decision node: A{"Question text?"}
        const decisionNodeMatch = line.match(/^([A-Za-z0-9_]+)\s*\{\s*"([^"]+)"\s*\}/);
        if (decisionNodeMatch) {
            const nodeId = decisionNodeMatch[1];
            const nodeLabel = decisionNodeMatch[2];

            // Check if it contains a time estimate in parentheses
            const timeMatch = nodeLabel.match(/\(([^)]+)\)$/);
            if (timeMatch) {
                const timeEstimate = timeMatch[1];
                const labelWithoutTime = nodeLabel.substring(0, nodeLabel.length - timeMatch[0].length).trim();

                nodes[nodeId] = {
                    id: nodeId,
                    type: 'decision',
                    label: labelWithoutTime,
                    fullLabel: nodeLabel,
                    timeEstimate,
                    line: i,
                    subgraphs: currentSubgraphs.map(sg => sg.title)
                };
            } else {
                nodes[nodeId] = {
                    id: nodeId,
                    type: 'decision',
                    label: nodeLabel,
                    fullLabel: nodeLabel,
                    timeEstimate: null,
                    line: i,
                    subgraphs: currentSubgraphs.map(sg => sg.title)
                };
            }

            // Add node to all containing subgraphs
            currentSubgraphs.forEach(sg => {
                if (!sg.nodes.includes(nodeId)) {
                    sg.nodes.push(nodeId);
                }
            });

            continue;
        }

        // Start/End node: A(["Start/End text"])
        const startEndNodeMatch = line.match(/^([A-Za-z0-9_]+)\s*\(\[\s*"([^"]+)"\s*\]\)/);
        if (startEndNodeMatch) {
            const nodeId = startEndNodeMatch[1];
            const nodeLabel = startEndNodeMatch[2];

            nodes[nodeId] = {
                id: nodeId,
                type: 'startEnd',
                label: nodeLabel,
                fullLabel: nodeLabel,
                line: i,
                subgraphs: currentSubgraphs.map(sg => sg.title)
            };

            // Add node to all containing subgraphs
            currentSubgraphs.forEach(sg => {
                if (!sg.nodes.includes(nodeId)) {
                    sg.nodes.push(nodeId);
                }
            });

            continue;
        }

        // Process connections
        // Labeled connection: A -->|"Label"| B
        const labeledConnectionMatch = line.match(/([A-Za-z0-9_]+)\s*-->\|"([^"]+)"\|\s*([A-Za-z0-9_]+)/);
        if (labeledConnectionMatch) {
            connections.push({
                from: labeledConnectionMatch[1],
                to: labeledConnectionMatch[3],
                label: labeledConnectionMatch[2],
                line: i
            });
            continue;
        }

        // Basic connection: A --> B
        const basicConnectionMatch = line.match(/([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/);
        if (basicConnectionMatch) {
            connections.push({
                from: basicConnectionMatch[1],
                to: basicConnectionMatch[2],
                label: '',
                line: i
            });
            continue;
        }
    }

    // Third pass: Handle implicit nodes from connections
    connections.forEach(conn => {
        ['from', 'to'].forEach(endpoint => {
            const nodeId = conn[endpoint];

            if (!nodes[nodeId]) {
                // Try to extract node text from the raw Mermaid code
                // First look for process nodes: nodeId["Label"]
                const processNodePattern = new RegExp(`${nodeId}\\s*\\[\\s*"([^"]+)"\\s*\\]`);
                const processNodeMatch = diagramCode.match(processNodePattern);

                // Look for startEnd nodes: nodeId(["Label"])
                const startEndNodePattern = new RegExp(`${nodeId}\\s*\\(\\[\\s*"([^"]+)"\\s*\\]\\)`);
                const startEndNodeMatch = diagramCode.match(startEndNodePattern);

                // Look for decision nodes: nodeId{"Label"}
                const decisionNodePattern = new RegExp(`${nodeId}\\s*\\{\\s*"([^"]+)"\\s*\\}`);
                const decisionNodeMatch = diagramCode.match(decisionNodePattern);

                if (processNodeMatch) {
                    // Found a process node definition
                    const nodeLabel = processNodeMatch[1];

                    // Check if it contains a time estimate
                    const timeMatch = nodeLabel.match(/\(([^)]+)\)$/);

                    if (timeMatch) {
                        const timeEstimate = timeMatch[1];
                        const labelWithoutTime = nodeLabel.substring(0, nodeLabel.length - timeMatch[0].length).trim();

                        nodes[nodeId] = {
                            id: nodeId,
                            type: 'process',
                            label: labelWithoutTime,
                            fullLabel: nodeLabel,
                            timeEstimate,
                            isRecovered: true
                        };
                    } else {
                        nodes[nodeId] = {
                            id: nodeId,
                            type: 'process',
                            label: nodeLabel,
                            fullLabel: nodeLabel,
                            isRecovered: true
                        };
                    }
                } else if (startEndNodeMatch) {
                    // Found a startEnd node definition
                    const nodeLabel = startEndNodeMatch[1];
                    nodes[nodeId] = {
                        id: nodeId,
                        type: 'startEnd',
                        label: nodeLabel,
                        fullLabel: nodeLabel,
                        isRecovered: true
                    };
                } else if (decisionNodeMatch) {
                    // Found a decision node definition
                    const nodeLabel = decisionNodeMatch[1];
                    nodes[nodeId] = {
                        id: nodeId,
                        type: 'decision',
                        label: nodeLabel,
                        fullLabel: nodeLabel,
                        isRecovered: true
                    };
                } else {
                    // Create an implicit node
                    nodes[nodeId] = {
                        id: nodeId,
                        type: 'process',
                        label: nodeId,
                        fullLabel: nodeId,
                        isImplicit: true
                    };
                }
            }
        });
    });

    // Fourth pass: Check for node label texts in comments or surrounding context
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        // Look for node descriptions in comments
        if (line.startsWith('%%') && line.includes(':')) {
            const nodeDescMatch = line.match(/%%\s*([A-Za-z0-9_]+)\s*:\s*(.*)/);

            if (nodeDescMatch && nodes[nodeDescMatch[1]]) {
                const nodeId = nodeDescMatch[1];
                const description = nodeDescMatch[2].trim();

                // Only update if it's an implicit node with no real label
                if (nodes[nodeId].isImplicit || nodes[nodeId].label === nodeId) {
                    nodes[nodeId].label = description;
                    nodes[nodeId].fullLabel = description;
                    nodes[nodeId].isImplicit = false;
                    nodes[nodeId].fromComment = true;
                }
            }
        }
    }

    // Fifth pass: Search for end nodes in connection labels
    // This fixes issues with nodes that only appear in connection labels
    connections.forEach(conn => {
        const lineIndex = conn.line;
        if (lineIndex >= 0 && lineIndex < lines.length) {
            const line = lines[lineIndex];

            // Look for end nodes in the form: X -->|"Yes"| F(["End: Application rejected"])
            // This pattern matches a node at the end of a connection
            const endNodeInConnectionPattern = new RegExp(`${conn.to}\\s*\\(\\[\\s*"([^"]+)"\\s*\\]\\)`);
            const endNodeMatch = line.match(endNodeInConnectionPattern);

            if (endNodeMatch && conn.to) {
                const nodeId = conn.to;
                const nodeLabel = endNodeMatch[1];

                // Update or create the node
                nodes[nodeId] = {
                    id: nodeId,
                    type: 'startEnd',
                    label: nodeLabel,
                    fullLabel: nodeLabel,
                    isRecovered: true,
                    foundInConnection: true,
                    line: lineIndex
                };
            }
        }
    });

    // Perform a final full diagram scan for startEnd nodes that might have been missed
    const fullDiagramStartEndPattern = /([A-Za-z0-9_]+)\s*\(\[\s*"([^"]+)"\s*\]\)/g;
    let match;
    while ((match = fullDiagramStartEndPattern.exec(diagramCode)) !== null) {
        const nodeId = match[1];
        const nodeLabel = match[2];

        // Only add if not already present or update if it's an implicit node
        if (!nodes[nodeId] || nodes[nodeId].isImplicit) {
            nodes[nodeId] = {
                id: nodeId,
                type: 'startEnd',
                label: nodeLabel,
                fullLabel: nodeLabel,
                isRecovered: true,
                foundInFullScan: true
            };
        }
    }

    // Sixth pass: Try to infer labels from subgraph titles for single-letter nodes
    Object.keys(nodes).forEach(nodeId => {
        if (nodeId.length === 1 && nodes[nodeId].label === nodeId && nodes[nodeId].subgraphs && nodes[nodeId].subgraphs.length > 0) {
            // This is a single-letter node with no proper label, but it's in a subgraph
            // Use the subgraph title as context for the node label
            const subgraphTitle = nodes[nodeId].subgraphs[0];
            nodes[nodeId].label = `${subgraphTitle} Node ${nodeId}`;
            nodes[nodeId].fullLabel = nodes[nodeId].label;
            nodes[nodeId].inferredFromSubgraph = true;
        }
    });

    // Log results
    console.group('Parsed Mermaid Diagram Results');
    console.log('Nodes:', Object.keys(nodes).length);
    console.log('Connections:', connections.length);
    console.log('Subgraphs:', subgraphs.length);

    console.group('Parsed Nodes');
    Object.keys(nodes).forEach(nodeId => {
        const node = nodes[nodeId];
        let nodeInfo = `${nodeId} - Type: ${node.type}, Label: ${node.label.substring(0, 30)}${node.label.length > 30 ? '...' : ''}`;

        if (node.timeEstimate) {
            nodeInfo += `, Time: ${node.timeEstimate}`;
        }

        if (node.isImplicit) {
            nodeInfo += ' (Implicit node)';
        }

        if (node.isRecovered) {
            nodeInfo += ' (Recovered from context)';
        }

        if (node.foundInConnection) {
            nodeInfo += ' (Found in connection)';
        }

        if (node.foundInFullScan) {
            nodeInfo += ' (Found in full scan)';
        }

        if (node.subgraphs && node.subgraphs.length > 0) {
            nodeInfo += `, Subgraphs: ${node.subgraphs.join(', ')}`;
        }

        console.log(nodeInfo);
    });
    console.groupEnd();

    console.group('Parsed Connections');
    connections.forEach((conn, index) => {
        console.log(`${index + 1}. ${conn.from} -> ${conn.to}${conn.label ? ` [Label: ${conn.label}]` : ''}`);
    });
    console.groupEnd();

    console.group('Parsed Subgraphs');
    subgraphs.forEach((sg, index) => {
        console.log(`${index + 1}. "${sg.title}" with ${sg.nodes.length} nodes: ${sg.nodes.join(', ')}`);
    });
    console.groupEnd();

    console.groupEnd(); // End of Parsed Mermaid Diagram Results

    return { nodes, connections, subgraphs };
}

/**
 * Update the time estimate for a specific node in the diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} nodeId - The ID of the node to update
 * @param {string} newTimeEstimate - The new time estimate
 * @returns {string} The updated diagram code
 */
/**
 * Update the time estimate for a specific node in the diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} nodeId - The ID of the node to update
 * @param {string} newTimeEstimate - The new time estimate
 * @returns {string} The updated diagram code
 */
export function updateNodeTimeEstimate(diagramCode, nodeId, newTimeEstimate) {
    const { nodes } = parseMermaidDiagram(diagramCode);

    if (!nodes[nodeId]) {
        throw new Error(`Node with ID "${nodeId}" not found in diagram`);
    }

    const node = nodes[nodeId];
    const lines = diagramCode.split('\n');

    console.log(`Updating time estimate for node ${nodeId}:`, {
        currentLine: node.line !== undefined ? lines[node.line] : "Node is implicit",
        nodeLabel: node.label,
        nodeFullLabel: node.fullLabel,
        currentTimeEstimate: node.timeEstimate,
        newTimeEstimate
    });

    // If the node is implicit or doesn't have a line number, we need to define it explicitly
    if (node.line === undefined || node.isImplicit) {
        console.log(`Node ${nodeId} is implicit. Creating an explicit definition.`);

        // First, try to define the node by adding it to the diagram
        try {
            let updatedDiagram;

            // Create a node definition with the current label and new time estimate
            if (node.type === 'process') {
                // Find a good position to insert the new node definition
                // A good place is after other node definitions but before connections
                let insertPosition = 0;

                // Look for the last node definition
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    // This looks for lines that define nodes but aren't connections
                    if ((line.match(/^[A-Za-z0-9_]+\s*\[/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\{/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\(\[/)) &&
                        !line.includes('-->')) {
                        insertPosition = i;
                    }
                }

                // Create a new node definition with the time estimate
                const newNodeDefinition = `${nodeId}["${node.label || nodeId} (${newTimeEstimate})"]`;

                // Insert the new definition
                const newLines = [...lines];
                newLines.splice(insertPosition + 1, 0, newNodeDefinition);
                updatedDiagram = newLines.join('\n');
            } else if (node.type === 'startEnd') {
                // For startEnd nodes, we don't typically add time estimates, but we'll define the node
                const newNodeDefinition = `${nodeId}(["${node.label || nodeId}"])`;

                // Find insertion position as above
                let insertPosition = 0;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if ((line.match(/^[A-Za-z0-9_]+\s*\[/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\{/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\(\[/)) &&
                        !line.includes('-->')) {
                        insertPosition = i;
                    }
                }

                const newLines = [...lines];
                newLines.splice(insertPosition + 1, 0, newNodeDefinition);
                updatedDiagram = newLines.join('\n');
            } else if (node.type === 'decision') {
                // For decision nodes, define without time estimate
                const newNodeDefinition = `${nodeId}{"${node.label || nodeId}"}`;

                let insertPosition = 0;
                for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if ((line.match(/^[A-Za-z0-9_]+\s*\[/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\{/) ||
                        line.match(/^[A-Za-z0-9_]+\s*\(\[/)) &&
                        !line.includes('-->')) {
                        insertPosition = i;
                    }
                }

                const newLines = [...lines];
                newLines.splice(insertPosition + 1, 0, newNodeDefinition);
                updatedDiagram = newLines.join('\n');
            }

            // Now we have an updated diagram with the node explicitly defined
            return validateAndFixMermaidSyntax(updatedDiagram);
        } catch (err) {
            console.error("Error creating explicit node definition:", err);
            throw new Error(`Cannot update time estimate for implicit node ${nodeId}. Please define the node first.`);
        }
    }

    // Regular update for explicit nodes
    if (node.type === 'process') {
        const currentLine = lines[node.line];

        // Check for existing syntax pattern
        const nodePattern = new RegExp(`${nodeId}\\s*\\[\\s*"([^"]+)"\\s*\\]`);
        const match = currentLine.match(nodePattern);

        if (!match) {
            console.error(`Cannot find node pattern in line: ${currentLine}`);
            throw new Error(`Could not parse node syntax for node ${nodeId}`);
        }

        // If the node doesn't have a time estimate yet, add one
        if (!node.timeEstimate) {
            lines[node.line] = currentLine.replace(
                `${nodeId}["${node.label}"]`,
                `${nodeId}["${node.label} (${newTimeEstimate})"]`
            );
        } else {
            // Check if we need to handle a fullLabel with time estimate
            if (node.fullLabel && node.fullLabel.includes('(')) {
                // Replace the entire content inside the brackets
                lines[node.line] = currentLine.replace(
                    `${nodeId}["${node.fullLabel}"]`,
                    `${nodeId}["${node.label} (${newTimeEstimate})"]`
                );
            } else {
                // Try a direct replacement of just the time estimate portion
                const timeEstimatePattern = new RegExp(`(${nodeId}\\s*\\[\\s*"${node.label}\\s*)\\([^)]+\\)(\\s*"\\s*\\])`);
                if (timeEstimatePattern.test(currentLine)) {
                    lines[node.line] = currentLine.replace(
                        timeEstimatePattern,
                        `$1(${newTimeEstimate})$2`
                    );
                } else {
                    // Fall back to replacing the whole node definition
                    lines[node.line] = currentLine.replace(
                        nodePattern,
                        `${nodeId}["${node.label} (${newTimeEstimate})"]`
                    );
                }
            }
        }

        console.log("Line after update:", lines[node.line]);
    } else if (node.type === 'decision' || node.type === 'startEnd') {
        // These node types don't traditionally have time estimates in Mermaid
        // but we could add them in a similar format if needed
        console.warn(`Time estimates for ${node.type} nodes are not standard in Mermaid`);
    }

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(lines.join('\n'));
}

/**
 * Update the label text for a node in the diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} nodeId - The ID of the node to update
 * @param {string} newLabel - The new label text
 * @returns {string} The updated diagram code
 */
export function updateNodeLabel(diagramCode, nodeId, newLabel) {
    const { nodes } = parseMermaidDiagram(diagramCode);

    if (!nodes[nodeId]) {
        throw new Error(`Node with ID "${nodeId}" not found in diagram`);
    }

    const node = nodes[nodeId];
    const lines = diagramCode.split('\n');

    // Preserve time estimate if it exists
    const timeEstimate = node.timeEstimate ? ` (${node.timeEstimate})` : '';

    if (node.type === 'process') {
        lines[node.line] = lines[node.line].replace(
            `${nodeId}["${node.fullLabel}"]`,
            `${nodeId}["${newLabel}${timeEstimate}"]`
        );
    } else if (node.type === 'decision') {
        lines[node.line] = lines[node.line].replace(
            `${nodeId}{"${node.fullLabel}"}`,
            `${nodeId}{"${newLabel}"}`
        );
    } else if (node.type === 'startEnd') {
        lines[node.line] = lines[node.line].replace(
            `${nodeId}(["${node.fullLabel}"])`,
            `${nodeId}(["${newLabel}"])`
        );
    }

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(lines.join('\n'));
}

/**
 * Update connection label in the diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} fromNodeId - The source node ID
 * @param {string} toNodeId - The target node ID
 * @param {string} newLabel - The new connection label
 * @returns {string} The updated diagram code
 */
export function updateConnectionLabel(diagramCode, fromNodeId, toNodeId, newLabel) {
    const { connections } = parseMermaidDiagram(diagramCode);
    const lines = diagramCode.split('\n');

    // Find the connection
    const connection = connections.find(c => c.from === fromNodeId && c.to === toNodeId);

    if (!connection) {
        throw new Error(`Connection from "${fromNodeId}" to "${toNodeId}" not found`);
    }

    if (connection.label) {
        // Replace existing label
        lines[connection.line] = lines[connection.line].replace(
            `${fromNodeId} -->|"${connection.label}"| ${toNodeId}`,
            `${fromNodeId} -->|"${newLabel}"| ${toNodeId}`
        );
    } else {
        // Add new label
        lines[connection.line] = lines[connection.line].replace(
            `${fromNodeId} --> ${toNodeId}`,
            `${fromNodeId} -->|"${newLabel}"| ${toNodeId}`
        );
    }

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(lines.join('\n'));
}

/**
 * Add a new node to the diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {object} nodeDetails - The new node details
 * @param {string} nodeDetails.id - The new node ID
 * @param {string} nodeDetails.label - The node label
 * @param {string} nodeDetails.timeEstimate - Time estimate (optional)
 * @param {string} nodeDetails.type - Node type: 'process', 'decision', or 'startEnd'
 * @param {string} nodeDetails.connectFrom - ID of node to connect from (optional)
 * @param {string} nodeDetails.connectTo - ID of node to connect to (optional)
 * @param {string} nodeDetails.connectionLabel - Label for the connection (optional)
 * @returns {string} The updated diagram code
 */
export function addNode(diagramCode, nodeDetails) {
    const { nodes, connections } = parseMermaidDiagram(diagramCode);
    const lines = diagramCode.split('\n');

    // Generate a unique ID if not provided
    let nodeId = nodeDetails.id || `step${Object.keys(nodes).length + 1}`;

    // Prevent using reserved keywords as node IDs
    const reservedKeywords = ['end', 'graph', 'subgraph', 'style', 'class', 'classDef'];
    if (reservedKeywords.includes(nodeId.toLowerCase())) {
        nodeId = `${nodeId}Node`; // Append "Node" to avoid keyword conflicts
    }

    // Check for ID collision
    if (nodes[nodeId]) {
        throw new Error(`Node with ID "${nodeId}" already exists`);
    }

    // Create node definition
    let nodeDefinition = '';
    const timeEstimate = nodeDetails.timeEstimate ? ` (${nodeDetails.timeEstimate})` : '';

    if (nodeDetails.type === 'decision') {
        nodeDefinition = `${nodeId}{"${nodeDetails.label}"}`;
    } else if (nodeDetails.type === 'startEnd') {
        nodeDefinition = `${nodeId}(["${nodeDetails.label}"])`;
    } else {
        // Default to process node
        nodeDefinition = `${nodeId}["${nodeDetails.label}${timeEstimate}"]`;
    }

    // Find a good position to insert the new node
    // A good strategy is to insert it after the last node definition
    let insertPosition = 1; // Default to after the graph directive

    for (const nodeId in nodes) {
        const line = nodes[nodeId].line;
        if (line > insertPosition) {
            insertPosition = line;
        }
    }

    // Insert the node definition
    lines.splice(insertPosition + 1, 0, nodeDefinition);

    // Adjust line numbers for insertions that will follow
    let connectionInsertLine = insertPosition + 2;

    // Add connections if needed
    let updatedDiagram = lines.join('\n');

    if (nodeDetails.connectFrom) {
        const connection = `${nodeDetails.connectFrom} -->${nodeDetails.connectionLabel ? `|"${nodeDetails.connectionLabel}"| ` : ' '}${nodeId}`;
        lines.splice(connectionInsertLine, 0, connection);
        connectionInsertLine++;
    }

    if (nodeDetails.connectTo) {
        const connection = `${nodeId} -->${nodeDetails.connectionLabel ? `|"${nodeDetails.connectionLabel}"| ` : ' '}${nodeDetails.connectTo}`;
        lines.splice(connectionInsertLine, 0, connection);
    }

    updatedDiagram = lines.join('\n');

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(updatedDiagram);
}

/**
 * Remove a node from the diagram (and its connections)
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} nodeId - The ID of the node to remove
 * @returns {string} The updated diagram code
 */
export function removeNode(diagramCode, nodeId) {
    const { nodes, connections } = parseMermaidDiagram(diagramCode);

    if (!nodes[nodeId]) {
        throw new Error(`Node with ID "${nodeId}" not found`);
    }

    // Don't allow removing if this would create an invalid diagram
    if (Object.keys(nodes).length <= 2) {
        throw new Error("Cannot remove node: diagram must have at least 2 nodes");
    }

    const lines = diagramCode.split('\n');
    const linesToRemove = new Set();

    // Mark the node line for removal
    linesToRemove.add(nodes[nodeId].line);

    // Mark all connection lines involving this node for removal
    connections.forEach(connection => {
        if (connection.from === nodeId || connection.to === nodeId) {
            linesToRemove.add(connection.line);
        }
    });

    // Filter out the lines to remove
    const updatedLines = lines.filter((_, i) => !linesToRemove.has(i));

    // Make sure to fix any "end" related issues
    // If the nodeId is "end", rename all occurrences to "endNode"
    let updatedDiagram = updatedLines.join('\n');
    if (nodeId === "end") {
        updatedDiagram = updatedDiagram.replace(/\bend\b(?!\s*$)/g, 'endNode');
    }

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(updatedDiagram);
}

/**
 * Get all node IDs from the diagram for UI display
 * @param {string} diagramCode - The Mermaid diagram code
 * @returns {Array} List of node objects with id, label, and type
 */
export function getWorkflowNodes(diagramCode) {
    const { nodes } = parseMermaidDiagram(diagramCode);

    return Object.values(nodes).map(node => ({
        id: node.id,
        label: node.label,
        fullLabel: node.fullLabel,
        type: node.type,
        timeEstimate: node.timeEstimate
    }));
}

/**
 * Removes a connection between two nodes in a Mermaid workflow diagram
 * @param {string} diagramCode - The original Mermaid diagram code
 * @param {string} fromNodeId - The ID of the source node
 * @param {string} toNodeId - The ID of the target node
 * @returns {string} - Updated Mermaid diagram code with the connection removed
 */
export function removeConnection(diagramCode, fromNodeId, toNodeId) {
    if (!diagramCode) {
        throw new Error("No diagram code provided");
    }

    if (!fromNodeId || !toNodeId) {
        throw new Error("Both source and target node IDs must be provided");
    }

    // Split the diagram into lines for processing
    const lines = diagramCode.split('\n');
    const updatedLines = [];

    // Regular expressions to match different connection formats
    // Format: A --> B
    const basicConnectionRegex = new RegExp(`^\\s*${fromNodeId}\\s*-->\\s*${toNodeId}\\s*$`);

    // Format: A -->|"Label"| B
    const labeledConnectionRegex = new RegExp(`^\\s*${fromNodeId}\\s*-->\\|.*?\\|\\s*${toNodeId}\\s*$`);

    // Format: A -- text --> B (less common but possible)
    const textConnectionRegex = new RegExp(`^\\s*${fromNodeId}\\s*--.*?-->\\s*${toNodeId}\\s*$`);

    // Check each line and exclude the connection we want to remove
    let connectionFound = false;
    for (const line of lines) {
        if (basicConnectionRegex.test(line) ||
            labeledConnectionRegex.test(line) ||
            textConnectionRegex.test(line)) {
            connectionFound = true;
            // Skip this line (don't add it to updatedLines)
            continue;
        }
        updatedLines.push(line);
    }

    if (!connectionFound) {
        console.warn(`Connection from ${fromNodeId} to ${toNodeId} not found in diagram`);
    }

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(updatedLines.join('\n'));
}
// Function to add a connection in workflowEditor.js
// Enhanced addConnection function with better support for complex connection labels
export function addConnection(diagramCode, fromNodeId, toNodeId, connectionLabel = "") {
    if (!diagramCode) {
        throw new Error("No diagram code provided");
    }

    if (!fromNodeId || !toNodeId) {
        throw new Error("Both source and target node IDs must be provided");
    }

    // Validate that both nodes exist in the diagram
    const { nodes } = parseMermaidDiagram(diagramCode);

    if (!nodes[fromNodeId]) {
        throw new Error(`Source node "${fromNodeId}" does not exist in the diagram`);
    }

    if (!nodes[toNodeId]) {
        throw new Error(`Target node "${toNodeId}" does not exist in the diagram`);
    }

    // Split the diagram into lines
    const lines = diagramCode.split('\n');

    // Find the best place to add the connection - after the last connection or node definition
    let insertIndex = lines.length - 1;
    let foundConnections = false;

    // Look for existing connections to find a good insertion point
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();

        // Check if this line is a connection
        if (line.match(/[A-Za-z0-9_]+\s*-->/)) {
            insertIndex = i + 1;
            foundConnections = true;
            break;
        }

        // Check if this is a node definition
        if (!foundConnections &&
            (line.match(/[A-Za-z0-9_]+\s*\[/) ||
                line.match(/[A-Za-z0-9_]+\s*\{/) ||
                line.match(/[A-Za-z0-9_]+\s*\(\[/))) {
            insertIndex = i + 1;
        }
    }

    // Create the connection string with proper escaping of quotes in the label
    let connectionString;
    if (connectionLabel && connectionLabel.trim() !== "") {
        // Ensure the label is properly formatted and quoted
        const sanitizedLabel = connectionLabel.trim().replace(/"/g, '\\"');
        connectionString = `${fromNodeId} -->|"${sanitizedLabel}"| ${toNodeId}`;
    } else {
        connectionString = `${fromNodeId} --> ${toNodeId}`;
    }

    // Insert the connection
    lines.splice(insertIndex, 0, connectionString);

    // Put the diagram back together
    const updatedDiagram = lines.join('\n');

    // Validate and fix any syntax issues
    return validateAndFixMermaidSyntax(updatedDiagram);
}

export default {
    parseMermaidDiagram,
    updateNodeTimeEstimate,
    updateNodeLabel,
    updateConnectionLabel,
    addNode,
    removeNode,
    getWorkflowNodes,
    removeConnection,
    addConnection
};