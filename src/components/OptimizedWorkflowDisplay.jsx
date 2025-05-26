// components/OptimizedWorkflowDisplay.jsx
import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

export default function OptimizedWorkflowDisplay({
  originalWorkflow,
  optimizedWorkflow,
  onRegenerateOptimized,
}) {
  const containerRef = useRef(null);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("optimized");
  const [userFeedback, setUserFeedback] = useState("");

  useEffect(() => {
    if (!containerRef.current) return;

    // Initialize Mermaid with specific configuration
    mermaid.initialize({
      startOnLoad: true,
      theme: "default",
      logLevel: "error",
      securityLevel: "loose",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: "basis",
      },
    });

    renderSelectedView();
  }, [optimizedWorkflow, viewMode]);

  // Render the currently selected view
  const renderSelectedView = () => {
    if (!containerRef.current) return;

    try {
      // Clear previous content and error
      containerRef.current.innerHTML = "";
      setError(null);

      // Create a div for the diagram
      const diagramDiv = document.createElement("div");
      diagramDiv.className = "mermaid";

      let diagramToRender = "";

      if (viewMode === "optimized" && optimizedWorkflow) {
        diagramToRender = fixMermaidSyntax(optimizedWorkflow.diagram);
      } else if (viewMode === "original" && originalWorkflow) {
        diagramToRender = fixMermaidSyntax(originalWorkflow.diagram);
      } else if (
        viewMode === "comparison" &&
        originalWorkflow &&
        optimizedWorkflow
      ) {
        // For comparison view, we need to be extra careful with syntax
        // Rather than trying to combine diagrams (which often causes issues),
        // we'll use a different approach
        diagramToRender =
          'graph TD\n  subgraph "Comparison not available"\n    note["Please view diagrams separately"]\n  end';
      }

      diagramDiv.textContent = diagramToRender;
      containerRef.current.appendChild(diagramDiv);

      // Render the diagram
      mermaid.init(undefined, ".mermaid").catch((err) => {
        console.error("Mermaid render error:", err);
        setError(
          `Failed to render diagram: ${err.message}. Try regenerating with simpler structure.`
        );
      });
    } catch (err) {
      console.error("Error setting up Mermaid diagram:", err);
      setError(`Error setting up diagram: ${err.message}`);
    }
  };
  const regenerateOptimizedWorkflow = async () => {
    if (!originalWorkflow || isRegenerating || !onRegenerateOptimized) return;

    setIsRegenerating(true);
    setError(null);

    try {
      // Call the parent component's regeneration handler with user feedback
      await onRegenerateOptimized(userFeedback);
      // FIXED: Hide the form after successful regeneration
      setShowFeedbackForm(false);
      setUserFeedback("");
    } catch (err) {
      console.error("Error regenerating optimized workflow:", err);
      setError(`Failed to regenerate optimized workflow: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Enhanced helper function to fix Mermaid code with robust error handling
  function fixMermaidSyntax(code) {
    if (!code) return 'graph TD\nA["No diagram available"]';

    // Ensure the code starts with graph TD
    let fixed = code.trim();

    // Make sure graph TD is on its own line at the beginning
    if (!fixed.match(/^graph\s+(TD|LR|RL|BT)/i)) {
      fixed = "graph TD\n" + fixed;
    }

    // Fix critical syntax issues based on our earlier improvements
    fixed = fixed
      // Fix the arrow syntax (ensure exactly two dashes)
      .replace(/-+>/g, "-->")
      // Remove HTML tags that can cause problems
      .replace(/<br\s*\/?>/gi, " ")
      // Fix quotes consistency
      .replace(/'/g, '"')
      // Fix smart quotes
      .replace(/[""]/g, '"')
      // Fix endNode to end for subgraphs
      .replace(/^(\s*)endNode\s*$/gm, "$1end");

    // Fix subgraph closures
    const lines = fixed.split("\n");
    const fixedLines = [];
    let subgraphLevel = 0;

    for (let i = 0; i < lines.length; i++) {
      const trimmedLine = lines[i].trim();

      // Track subgraph nesting level
      if (trimmedLine.startsWith("subgraph")) {
        subgraphLevel++;
        fixedLines.push(lines[i]);
      }
      // Handle subgraph end
      else if (trimmedLine === "end" || trimmedLine === "endNode") {
        if (subgraphLevel > 0) {
          // Always use 'end' to close subgraphs
          fixedLines.push(lines[i].replace(/endNode/, "end"));
          subgraphLevel--;
        } else {
          // Not a subgraph closure, keep as is
          fixedLines.push(lines[i]);
        }
      }
      // Process workflow nodes named 'end'
      else if (trimmedLine.match(/\bend\b(?!\s*$)/)) {
        // Replace 'end' node name with 'endProcess'
        fixedLines.push(lines[i].replace(/\bend\b(?!\s*$)/, "endProcess"));
      } else {
        fixedLines.push(lines[i]);
      }
    }

    // In case we detected unclosed subgraphs, add closing 'end' statements
    for (let i = 0; i < subgraphLevel; i++) {
      fixedLines.push("end");
    }

    return fixedLines.join("\n");
  }

  if (!optimizedWorkflow && !originalWorkflow) {
    return (
      <div className="p-6 text-gray-500 bg-gray-50 rounded-md border border-gray-200">
        No workflow data available
      </div>
    );
  }

  return (
    <div className="optimized-workflow mt-6 bg-white rounded-lg shadow-md p-6">
      <div className="mb-6 flex flex-wrap justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setViewMode("optimized")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              viewMode === "optimized"
                ? "bg-green-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Optimized Workflow
          </button>

          <button
            onClick={() => setViewMode("original")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              viewMode === "original"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Original Workflow
          </button>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => {
              // Export as SVG
              const svg = containerRef.current.querySelector("svg");
              if (svg) {
                const svgData = new XMLSerializer().serializeToString(svg);
                const blob = new Blob([svgData], { type: "image/svg+xml" });
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = `${viewMode}-workflow-diagram.svg`;
                document.body.appendChild(a);
                a.click();

                URL.revokeObjectURL(url);
                document.body.removeChild(a);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
          >
            <svg
              className="w-4 h-4 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            Download as SVG
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setShowFeedbackForm(true)}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Try regenerating with simplified workflow
          </button>
        </div>
      )}

      {/* Added a title based on the view mode */}
      <h3 className="text-lg font-semibold text-gray-800 mb-3">
        {viewMode === "optimized"
          ? "Optimized Process Flow"
          : viewMode === "original"
          ? "Original Process Flow"
          : "Process Comparison"}
      </h3>

      <div
        ref={containerRef}
        className="overflow-auto border rounded-md p-6 bg-white min-h-[400px]"
      ></div>
    </div>
  );
}
