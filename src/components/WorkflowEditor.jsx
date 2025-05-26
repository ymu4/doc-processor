// components/WorkflowEditor.jsx - Enhanced with Add Connection feature and fixed time estimate updates
import React, { useState, useEffect } from "react";
import {
  parseMermaidDiagram,
  updateNodeTimeEstimate,
  updateNodeLabel,
  updateConnectionLabel,
  addNode,
  removeNode,
  removeConnection,
  addConnection,
  getWorkflowNodes,
} from "../utils/workflowEditor";

/**
 * Component that allows users to edit a Mermaid workflow diagram
 */
const WorkflowEditor = ({
  diagramCode,
  onUpdate,
  showMermaidCode = false,
  readOnly = false,
}) => {
  const [nodes, setNodes] = useState([]);
  const [connections, setConnections] = useState([]);
  const [editingNode, setEditingNode] = useState(null);
  const [editingConnection, setEditingConnection] = useState(null);
  const [newNodeForm, setNewNodeForm] = useState(false);
  const [newConnectionForm, setNewConnectionForm] = useState(false);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState({
    nodes: true,
    connections: true,
  });
  // Add the missing state variable for new node ID
  const [newNodeId, setNewNodeId] = useState("");

  // Initialize with the current diagram
  useEffect(() => {
    try {
      if (!diagramCode) {
        setNodes([]);
        setConnections([]);
        return;
      }

      // console.log(
      //   "Parsing diagram code:",
      //   diagramCode.substring(0, 100) + "..."
      // );
      const parsedWorkflow = parseMermaidDiagram(diagramCode);

      // console.log("Parsed workflow:", {
      //   nodeCount: Object.keys(parsedWorkflow.nodes).length,
      //   connectionCount: parsedWorkflow.connections.length,
      // });

      const nodeArray = Object.values(parsedWorkflow.nodes);
      setNodes(nodeArray);
      setConnections(parsedWorkflow.connections);
      setError("");

      // Debug node information
      // console.log(
      //   "All node IDs:",
      //   nodeArray.map((node) => node.id)
      // );

      // Count implicit vs explicit nodes
      const implicitNodes = nodeArray.filter((node) => node.isImplicit).length;
      const explicitNodes = nodeArray.length - implicitNodes;
      // console.log(
      //   `Found ${explicitNodes} explicit nodes and ${implicitNodes} implicit nodes referenced in connections`
      // );
    } catch (err) {
      console.error("Error parsing diagram:", err);
      setError(`Failed to parse diagram: ${err.message}`);
    }
  }, [diagramCode]);

  // Handler for updating a node's time estimate
  const handleTimeEstimateUpdate = (nodeId, newTimeEstimate) => {
    try {
      // Ensure we have the fresh parsed node data
      const { nodes } = parseMermaidDiagram(diagramCode);
      const node = nodes[nodeId];

      if (!node) {
        throw new Error(`Node with ID "${nodeId}" not found`);
      }

      // console.log(
      //   "Updating time estimate for node:",
      //   nodeId,
      //   "to:",
      //   newTimeEstimate
      // );
      // console.log("Current node data:", node);

      const updatedDiagram = updateNodeTimeEstimate(
        diagramCode,
        nodeId,
        newTimeEstimate
      );

      // Log the updated diagram for debugging
      // console.log(
      //   "Updated diagram code:",
      //   updatedDiagram.substring(0, 100) + "..."
      // );

      onUpdate(updatedDiagram);
      setEditingNode(null);
    } catch (err) {
      // console.error("Error updating time estimate:", err);
      setError(`Failed to update time estimate: ${err.message}`);
    }
  };

  // Handler for updating a node's label
  const handleLabelUpdate = (nodeId, newLabel) => {
    try {
      const updatedDiagram = updateNodeLabel(diagramCode, nodeId, newLabel);
      onUpdate(updatedDiagram);
      setEditingNode(null);
    } catch (err) {
      console.error("Error updating label:", err);
      setError(`Failed to update label: ${err.message}`);
    }
  };

  // Handler for updating a connection's label
  const handleConnectionUpdate = (fromNodeId, toNodeId, newLabel) => {
    try {
      const updatedDiagram = updateConnectionLabel(
        diagramCode,
        fromNodeId,
        toNodeId,
        newLabel
      );
      onUpdate(updatedDiagram);
      setEditingConnection(null);
    } catch (err) {
      console.error("Error updating connection:", err);
      setError(`Failed to update connection: ${err.message}`);
    }
  };

  // Handler for removing a connection
  const handleRemoveConnection = (fromNodeId, toNodeId) => {
    if (window.confirm(`Are you sure you want to remove this connection?`)) {
      try {
        const updatedDiagram = removeConnection(
          diagramCode,
          fromNodeId,
          toNodeId
        );
        onUpdate(updatedDiagram);
      } catch (err) {
        console.error("Error removing connection:", err);
        setError(`Failed to remove connection: ${err.message}`);
      }
    }
  };

  // Helper function to format node labels for display
  function formatNodeLabel(node) {
    if (!node) return "";

    // If the node has a label that's the same as its ID (single letter node)
    if (node.label === node.id && node.id.length === 1) {
      // Check if we have subgraph context
      if (node.subgraphs && node.subgraphs.length > 0) {
        return `Node in ${node.subgraphs[0]}`;
      }
      return `Node ${node.id}`;
    }

    // If it's marked as implicit, show the node ID and try to get context
    if (node.isImplicit) {
      if (node.subgraphs && node.subgraphs.length > 0) {
        return `Node ${node.id} in ${node.subgraphs[0]}`;
      }
      return `Node ${node.id} (implicit)`;
    }

    // Return the full label (fixed: return the complete label, not trimmed)
    return node.label || node.fullLabel || node.id;
  }

  // Helper function to get node time estimate for display - FIXED
  function formatNodeTimeEstimate(node) {
    if (!node) return "";

    // First check if the node has a direct timeEstimate property
    if (node.timeEstimate) {
      return node.timeEstimate;
    }

    // Then check if the fullLabel contains time info in parentheses
    if (node.fullLabel) {
      const timeMatch = node.fullLabel.match(/\(([^)]+)\)$/);
      if (timeMatch) {
        return timeMatch[1];
      }
    }

    return "";
  }

  // Handler for adding a new connection
  const handleAddConnection = (fromNodeId, toNodeId, connectionLabel = "") => {
    try {
      const updatedDiagram = addConnection(
        diagramCode,
        fromNodeId,
        toNodeId,
        connectionLabel
      );
      onUpdate(updatedDiagram);
      setNewConnectionForm(false);
    } catch (err) {
      console.error("Error adding connection:", err);
      setError(`Failed to add connection: ${err.message}`);
    }
  };

  // Handler for adding a new node
  const handleAddNode = (nodeDetails) => {
    try {
      const updatedDiagram = addNode(diagramCode, nodeDetails);
      onUpdate(updatedDiagram);
      setNewNodeForm(false);
    } catch (err) {
      console.error("Error adding node:", err);
      setError(`Failed to add node: ${err.message}`);
    }
  };

  // Handler for removing a node
  const handleRemoveNode = (nodeId) => {
    if (window.confirm(`Are you sure you want to remove node "${nodeId}"?`)) {
      try {
        const updatedDiagram = removeNode(diagramCode, nodeId);
        onUpdate(updatedDiagram);
      } catch (err) {
        console.error("Error removing node:", err);
        setError(`Failed to remove node: ${err.message}`);
      }
    }
  };

  // Set up a new row form
  const setupNewRow = (cellCount) => {
    setNewNodeForm(true);
    // Generate a unique ID for the new node
    const existingIds = nodes.map((node) => node.id);
    let newId = "";

    // Try to find the next available letter
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let letter of alphabet) {
      if (!existingIds.includes(letter)) {
        newId = letter;
        break;
      }
    }

    // If all letters are taken, start using double letters or numbers
    if (!newId) {
      for (let i = 1; i <= 100; i++) {
        const testId = `N${i}`;
        if (!existingIds.includes(testId)) {
          newId = testId;
          break;
        }
      }
    }

    setNewNodeId(newId);
  };

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section],
    });
  };

  // Handler for converting an implicit node to an explicit one
  const handleDefineImplicitNode = (node) => {
    try {
      // Adding a node with the same ID but with an explicit label will convert it from implicit to explicit
      const nodeDetails = {
        id: node.id,
        label: node.label || node.id,
        type: node.type || "process",
        timeEstimate: node.timeEstimate || "",
      };

      const updatedDiagram = addNode(diagramCode, nodeDetails);
      onUpdate(updatedDiagram);
    } catch (err) {
      console.error("Error defining implicit node:", err);
      setError(`Failed to define implicit node: ${err.message}`);
    }
  };

  if (readOnly) {
    return (
      <div className="mermaid-display-only">
        {showMermaidCode && <pre className="mermaid-code">{diagramCode}</pre>}
      </div>
    );
  }

  return (
    <div className="document-editor workflow-editor">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <div className="editor-instructions">
        <p>
          Click on any cell to edit its content. Use "Add Node" to add new steps
          or "Add Connection" to connect nodes.
        </p>
      </div>

      {showMermaidCode && (
        <div className="mermaid-code-section">
          <h3>Mermaid Diagram Code</h3>
          <pre className="mermaid-code">{diagramCode}</pre>
        </div>
      )}

      {/* Workflow Steps Section */}
      <div className="document-section">
        <div className="section-header" onClick={() => toggleSection("nodes")}>
          <h3 className="section-title">
            {expandedSections.nodes ? "▼" : "▶"} Workflow Steps
          </h3>
        </div>

        {expandedSections.nodes && (
          <div className="section-content">
            <table className="editor-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Label</th>
                  <th>Type</th>
                  <th>Time Estimate</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {nodes.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="text-center">
                      No steps found in this workflow
                    </td>
                  </tr>
                ) : (
                  nodes.map((node) => (
                    <tr
                      key={`node-${node.id}`}
                      className={`node-row ${
                        node.isImplicit ? "node-implicit" : ""
                      }`}
                    >
                      <td>{node.id}</td>
                      <td
                        className={`editor-cell ${
                          node.isHeader ? "header-cell" : ""
                        }`}
                        onClick={() =>
                          setEditingNode({
                            id: node.id,
                            content: node.label,
                          })
                        }
                      >
                        {editingNode && editingNode.id === node.id ? (
                          <textarea
                            value={editingNode.content}
                            onChange={(e) =>
                              setEditingNode({
                                ...editingNode,
                                content: e.target.value,
                              })
                            }
                            onBlur={() =>
                              handleLabelUpdate(node.id, editingNode.content)
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleLabelUpdate(node.id, editingNode.content);
                              }
                              if (e.key === "Escape") setEditingNode(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <div className="node-label-display">
                            <span>{formatNodeLabel(node)}</span>
                            {node.isImplicit && (
                              <button
                                className="define-node-button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDefineImplicitNode(node);
                                }}
                                title="Define this implicit node"
                              >
                                Define
                              </button>
                            )}
                            {node.subgraphs && node.subgraphs.length > 0 && (
                              <div className="node-subgraph">
                                <small>In: {node.subgraphs.join(", ")}</small>
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td>{node.type}</td>
                      <td>
                        {node.type === "process" &&
                          (editingNode &&
                          editingNode.id === `${node.id}-time` ? (
                            <input
                              type="text"
                              value={editingNode.content}
                              onChange={(e) =>
                                setEditingNode({
                                  ...editingNode,
                                  content: e.target.value,
                                })
                              }
                              onBlur={() => {
                                // console.log(
                                //   "Saving time estimate for",
                                //   node.id,
                                //   ":",
                                //   editingNode.content
                                // );
                                handleTimeEstimateUpdate(
                                  node.id,
                                  editingNode.content
                                );
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  // console.log(
                                  //   "Enter pressed, saving time estimate for",
                                  //   node.id
                                  // );
                                  handleTimeEstimateUpdate(
                                    node.id,
                                    editingNode.content
                                  );
                                }
                                if (e.key === "Escape") setEditingNode(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span
                              onClick={() => {
                                // console.log(
                                //   "Setting up time edit for node:",
                                //   node.id
                                // );
                                // console.log(
                                //   "Current time estimate:",
                                //   formatNodeTimeEstimate(node)
                                // );
                                setEditingNode({
                                  id: `${node.id}-time`,
                                  content: formatNodeTimeEstimate(node) || "",
                                });
                              }}
                              className={
                                !formatNodeTimeEstimate(node)
                                  ? "no-time-estimate"
                                  : ""
                              }
                            >
                              {formatNodeTimeEstimate(node) ||
                                "Add time estimate"}
                            </span>
                          ))}
                      </td>
                      <td>
                        <button
                          className="remove-row-button"
                          onClick={() => handleRemoveNode(node.id)}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Add Node Form */}
            {newNodeForm ? (
              <div className="add-row-form">
                <h4>Add New Step</h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    handleAddNode({
                      id: formData.get("id"),
                      label: formData.get("label"),
                      type: formData.get("type"),
                      timeEstimate: formData.get("timeEstimate"),
                      connectFrom: formData.get("connectFrom") || null,
                      connectTo: formData.get("connectTo") || null,
                      connectionLabel: formData.get("connectionLabel") || null,
                    });
                  }}
                >
                  <div className="form-group">
                    <label htmlFor="new-node-id">ID:</label>
                    <input
                      type="text"
                      id="new-node-id"
                      name="id"
                      value={newNodeId}
                      onChange={(e) => setNewNodeId(e.target.value)}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-label">Label:</label>
                    <input
                      type="text"
                      name="label"
                      placeholder="Step description"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-type">Type:</label>
                    <select name="type">
                      <option value="process">Process (rectangle)</option>
                      <option value="decision">Decision (diamond)</option>
                      <option value="startEnd">Start/End (stadium)</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-time">Time Estimate:</label>
                    <input
                      type="text"
                      name="timeEstimate"
                      placeholder="e.g., 2 days"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-connect-from">
                      Connect from node:
                    </label>
                    <select name="connectFrom">
                      <option value="">None</option>
                      {nodes.map((node) => (
                        <option key={`from-${node.id}`} value={node.id}>
                          {node.id} - {formatNodeLabel(node)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-connect-to">
                      Connect to node:
                    </label>
                    <select name="connectTo">
                      <option value="">None</option>
                      {nodes.map((node) => (
                        <option key={`to-${node.id}`} value={node.id}>
                          {node.id} - {formatNodeLabel(node)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="new-node-connection-label">
                      Connection Label:
                    </label>
                    <input
                      type="text"
                      name="connectionLabel"
                      placeholder="e.g., Yes/No/Approved"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="add-button">
                      Add Step
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setNewNodeForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="add-row-button-container">
                <button
                  className="add-row-button"
                  onClick={() => setupNewRow(3)}
                >
                  Add Node
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Connections Section */}
      <div className="document-section">
        <div
          className="section-header"
          onClick={() => toggleSection("connections")}
        >
          <h3 className="section-title">
            {expandedSections.connections ? "▼" : "▶"} Connections
          </h3>
        </div>

        {expandedSections.connections && (
          <div className="section-content">
            <table className="editor-table">
              <thead>
                <tr>
                  <th>From</th>
                  <th>To</th>
                  <th>Label</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {connections.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center">
                      No connections found in this workflow
                    </td>
                  </tr>
                ) : (
                  connections.map((conn, index) => (
                    <tr key={`conn-${conn.from}-${conn.to}-${index}`}>
                      <td>{conn.from}</td>
                      <td>{conn.to}</td>
                      <td>
                        {editingConnection &&
                        editingConnection.id ===
                          `${conn.from}-${conn.to}-${index}` ? (
                          <input
                            type="text"
                            value={editingConnection.content}
                            onChange={(e) =>
                              setEditingConnection({
                                ...editingConnection,
                                content: e.target.value,
                              })
                            }
                            onBlur={() =>
                              handleConnectionUpdate(
                                conn.from,
                                conn.to,
                                editingConnection.content
                              )
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleConnectionUpdate(
                                  conn.from,
                                  conn.to,
                                  editingConnection.content
                                );
                              }
                              if (e.key === "Escape")
                                setEditingConnection(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span
                            onClick={() =>
                              setEditingConnection({
                                id: `${conn.from}-${conn.to}-${index}`,
                                content: conn.label || "",
                              })
                            }
                          >
                            {conn.label || "Add label"}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          className="remove-connection-button"
                          onClick={() =>
                            handleRemoveConnection(conn.from, conn.to)
                          }
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {/* Add Connection Form */}
            {newConnectionForm ? (
              <div className="add-connection-form">
                <h4>Add New Connection</h4>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.target);
                    handleAddConnection(
                      formData.get("fromNode"),
                      formData.get("toNode"),
                      formData.get("connectionLabel")
                    );
                  }}
                >
                  <div className="form-group">
                    <label htmlFor="from-node">From Node:</label>
                    <select name="fromNode" required>
                      <option value="">Select source node</option>
                      {nodes.map((node) => (
                        <option key={`from-conn-${node.id}`} value={node.id}>
                          {node.id} - {formatNodeLabel(node)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="to-node">To Node:</label>
                    <select name="toNode" required>
                      <option value="">Select target node</option>
                      {nodes.map((node) => (
                        <option key={`to-conn-${node.id}`} value={node.id}>
                          {node.id} - {formatNodeLabel(node)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label htmlFor="connection-label">
                      Connection Label (optional):
                    </label>
                    <input
                      type="text"
                      name="connectionLabel"
                      placeholder="e.g., Yes/No/Approved"
                    />
                  </div>
                  <div className="form-actions">
                    <button type="submit" className="add-button">
                      Add Connection
                    </button>
                    <button
                      type="button"
                      className="cancel-button"
                      onClick={() => setNewConnectionForm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="add-connection-button-container">
                <button
                  className="add-connection-button"
                  onClick={() => setNewConnectionForm(true)}
                >
                  Add Connection
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowEditor;
