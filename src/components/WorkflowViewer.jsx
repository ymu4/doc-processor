// components/WorkflowViewer.jsx
import React, { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import WorkflowEditor from "./WorkflowEditor";

// Initialize mermaid
mermaid.initialize({
  startOnLoad: true,
  theme: "default",
  logLevel: "fatal",
  securityLevel: "loose",
  flowchart: {
    useMaxWidth: true,
    htmlLabels: true,
    curve: "basis",
  },
  fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
});

/**
 * Safely extract and validate diagram code
 */
const validateDiagramCode = (diagramCode) => {
  if (!diagramCode) {
    console.warn("WorkflowViewer received empty diagram code");
    return 'graph TD\nA["No diagram available"]-->B["Please generate a workflow"]';
  }

  // If it's a string, return it directly
  if (typeof diagramCode === "string") {
    return diagramCode;
  }

  // If it's an object (e.g., the entire workflow data was passed), try to extract the diagram
  if (typeof diagramCode === "object") {
    console.warn(
      "WorkflowViewer received an object instead of a string. Attempting to extract diagram property."
    );
    return (
      diagramCode.diagram ||
      'graph TD\nA["Invalid diagram data"]-->B["Please check console for errors"]'
    );
  }

  // Fallback for any other case
  return 'graph TD\nA["Invalid diagram data"]-->B["Unknown data type"]';
};

/**
 * Component that displays a Mermaid workflow with editing capabilities
 */
const WorkflowViewer = ({
  diagramCode,
  onDiagramUpdate,
  editable = true,
  showRawCode = false,
}) => {
  const [renderedDiagram, setRenderedDiagram] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [renderError, setRenderError] = useState("");
  const [currentDiagramCode, setCurrentDiagramCode] = useState("");
  const diagramRef = useRef(null);

  useEffect(() => {
    // console.log("WorkflowViewer received props:", {
    //   diagramCodeType: typeof diagramCode,
    //   diagramCodeLength: diagramCode
    //     ? typeof diagramCode === "string"
    //       ? diagramCode.length
    //       : JSON.stringify(diagramCode).length
    //     : 0,
    //   isObjectWithDiagram:
    //     diagramCode &&
    //     typeof diagramCode === "object" &&
    //     "diagram" in diagramCode,
    // });
  }, [diagramCode]);

  // Render the diagram whenever the code changes
  useEffect(() => {
    const renderDiagram = async () => {
      // Validate and normalize the diagram code
      const validatedCode = validateDiagramCode(diagramCode);

      try {
        setRenderError("");
        const { svg } = await mermaid.render("mermaid-diagram", validatedCode);
        setRenderedDiagram(svg);
        setCurrentDiagramCode(validatedCode);
      } catch (error) {
        console.error("Error rendering diagram:", error);
        setRenderError(`Error rendering diagram: ${error.message}`);

        // If rendering fails, set a basic fallback diagram
        try {
          const fallbackCode =
            'graph TD\nA["Error rendering diagram"]-->B["Please check console for details"]';
          const { svg } = await mermaid.render(
            "mermaid-diagram-fallback",
            fallbackCode
          );
          setRenderedDiagram(svg);
          setCurrentDiagramCode(validatedCode); // Still keep the original code for editing
        } catch (fallbackError) {
          console.error("Even fallback diagram failed:", fallbackError);
        }
      }
    };

    renderDiagram();
  }, [diagramCode]);

  // Handle diagram updates from the editor
  const handleDiagramUpdate = (updatedDiagram) => {
    setCurrentDiagramCode(updatedDiagram);
    onDiagramUpdate(updatedDiagram);
  };

  // Handle SVG download
  const handleDownloadSVG = () => {
    // Check if we have a rendered diagram
    if (!renderedDiagram) {
      console.error("Cannot download: no SVG diagram rendered");
      return;
    }

    try {
      // Create a blob from the SVG content
      const svgBlob = new Blob([renderedDiagram], { type: "image/svg+xml" });

      // Create a URL for the blob
      const svgUrl = URL.createObjectURL(svgBlob);

      // Create a temporary link element
      const downloadLink = document.createElement("a");

      // Generate a filename with current date/time for uniqueness
      const dateStr = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .substring(0, 19);
      const fileName = `workflow-diagram-${dateStr}.svg`;

      // Set link attributes
      downloadLink.href = svgUrl;
      downloadLink.download = fileName;

      // Append to document, trigger click, and remove
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      // Clean up: revoke the object URL to free memory
      setTimeout(() => {
        URL.revokeObjectURL(svgUrl);
      }, 100);

      //  console.log(`SVG download initiated: ${fileName}`);
    } catch (error) {
      console.error("Error downloading SVG:", error);
      setRenderError(`Failed to download SVG: ${error.message}`);
    }
  };

  return (
    <div className="workflow-viewer">
      {renderError && <div className="render-error">{renderError}</div>}

      <div className="workflow-diagram">
        <div className="flex justify-between items-center mb-2 text-gray-800">
          <h3>Workflow Diagram</h3>
          <div className="diagram-actions flex gap-2">
            {renderedDiagram && (
              <button
                onClick={handleDownloadSVG}
                className="download-svg-button bg-blue-600 hover:bg-blue-800 text-white px-3 py-1 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 mr-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                Download SVG
              </button>
            )}
            {editable && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="toggle-editor-button bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 text-sm font-medium rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                {isEditing ? "Hide Editor" : "Edit Workflow"}
              </button>
            )}
          </div>
        </div>
        <div
          ref={diagramRef}
          className="mermaid-container border border-gray-200 rounded-md p-4 bg-white"
          dangerouslySetInnerHTML={{ __html: renderedDiagram }}
        />
      </div>

      {editable && isEditing && (
        <div className="workflow-editor-container mt-4">
          <h3>Edit Workflow</h3>
          <WorkflowEditor
            diagramCode={currentDiagramCode}
            onUpdate={handleDiagramUpdate}
            showMermaidCode={showRawCode}
          />
        </div>
      )}

      {showRawCode && !isEditing && (
        <div className="raw-mermaid-code mt-4">
          <h3>Mermaid Diagram Code</h3>
          <pre className="bg-gray-50 p-3 rounded-md border border-gray-200 overflow-auto text-gray-800">
            {currentDiagramCode}
          </pre>
        </div>
      )}
    </div>
  );
};

export default WorkflowViewer;
