// Enhanced WorkflowPage.jsx with better regeneration handling
import React, { useState, useEffect } from "react";
import WorkflowViewer from "./WorkflowViewer";
import { validateAndFixMermaidSyntax } from "../utils/workflowGenerator";
import UserFeedbackInput from "./UserFeedbackInput";

/**
 * WorkflowPage component that displays and manages workflow diagrams
 *
 * @param {Object} props Component props
 * @param {Object} props.workflowDiagram The workflow diagram data to display
 * @param {Object} props.documentData The document data for context/regeneration if needed
 * @param {Function} props.onWorkflowUpdate Callback when workflow is updated
 */
const WorkflowPage = ({ workflowDiagram, documentData, onWorkflowUpdate }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [userFeedback, setUserFeedback] = useState("");
  const [userFeedbackHistory, setUserFeedbackHistory] = useState([]);
  const [regenerationAttempts, setRegenerationAttempts] = useState(0);

  // Log information about the workflow on component mount and updates
  useEffect(() => {
    if (workflowDiagram) {
      // console.log("Current workflow properties:", {
      //   diagramLength: workflowDiagram.diagram?.length || 0,
      //   hasMetrics: !!workflowDiagram.metrics,
      //   totalSteps: workflowDiagram.metrics?.totalSteps || "N/A",
      //   provider: workflowDiagram.provider || "unknown",
      // });
    }
  }, [workflowDiagram]);

  // Handle when the workflow is updated via the editor
  const handleDiagramUpdate = (updatedDiagram) => {
    // console.log("Workflow diagram updated via editor:", {
    //   diagramLength: updatedDiagram?.length || 0,
    // });

    if (!workflowDiagram) {
      console.warn("Cannot update workflow: no workflowDiagram available");
      return;
    }

    // Create a new object with the updated diagram
    const updatedWorkflowDiagram = {
      ...workflowDiagram,
      diagram: updatedDiagram,
    };

    // Pass the updated workflow back to the parent component
    onWorkflowUpdate(updatedWorkflowDiagram);
  };

  // Handle user feedback for regeneration
  const handleFeedbackSubmit = async (e) => {
    e.preventDefault();
    if (!userFeedback.trim()) return;

    // Save the feedback to history
    setUserFeedbackHistory([...userFeedbackHistory, userFeedback]);
    setIsRegenerating(true);
    setError(""); // Clear any previous errors

    try {
      // Validate current diagram before sending to ensure its integrity
      const validatedOriginalDiagram = validateAndFixMermaidSyntax(
        workflowDiagram?.diagram
      );

      // Track regeneration attempts
      const currentAttempt = regenerationAttempts + 1;
      setRegenerationAttempts(currentAttempt);

      // Use the regenerate-workflow API, passing the original diagram
      const response = await fetch("/api/regenerate-workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentData: documentData,
          userFeedback: userFeedback,
          originalMetrics: workflowDiagram?.metrics || null,
          originalDiagram: validatedOriginalDiagram,
          regenerationAttempt: currentAttempt,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to regenerate workflow");
      }

      const data = await response.json();

      // Clear the feedback input
      setUserFeedback("");

      // Check if returned workflow is valid and has at least 80% of the original's complexity
      if (data.workflowDiagram) {
        const regeneratedLength = data.workflowDiagram.diagram?.length || 0;
        const originalLength = workflowDiagram.diagram?.length || 1;
        const complexityRatio = regeneratedLength / originalLength;

        // console.log(
        //   `Regenerated diagram complexity: ${(complexityRatio * 100).toFixed(
        //     1
        //   )}% of original`
        // );

        if (complexityRatio < 0.8 && currentAttempt <= 2) {
          setError(
            `The regenerated workflow appears to be simplified. Attempting to preserve more structure...`
          );
          // Retry with a stronger emphasis on preserving structure
          handleRetryRegeneration(userFeedback);
        } else {
          // Use the regenerated workflow
          onWorkflowUpdate(data.workflowDiagram);
        }
      } else {
        throw new Error("No workflow diagram returned from API");
      }
    } catch (err) {
      console.error("Error regenerating workflow:", err);
      setError(`Failed to regenerate workflow: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  // Handle retry regeneration with stronger structure preservation
  const handleRetryRegeneration = async (previousFeedback) => {
    try {
      setIsRegenerating(true);

      // Call the regenerate API with modified instructions to preserve more structure
      const response = await fetch("/api/regenerate-workflow", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documentData: documentData,
          userFeedback: `MAINTAIN COMPLETE DIAGRAM STRUCTURE AND COMPLEXITY! ${previousFeedback}`,
          originalMetrics: workflowDiagram?.metrics || null,
          originalDiagram: workflowDiagram?.diagram,
          forceStructurePreservation: true, // Signal to API to be extra careful with structure
        }),
      });

      if (!response.ok) {
        throw new Error("Retry regeneration failed");
      }

      const data = await response.json();

      if (data.workflowDiagram) {
        onWorkflowUpdate(data.workflowDiagram);
        setError(""); // Clear error if successful
      }
    } catch (err) {
      console.error("Error in retry regeneration:", err);
      setError(
        `Regeneration failed to preserve workflow complexity. Try editing directly or adding more specific feedback.`
      );
    } finally {
      setIsRegenerating(false);
    }
  };

  return (
    <div className="workflow-page">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm">{error}</p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setError("")}
                  className="inline-flex rounded-md p-1.5 text-red-500 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  <span className="sr-only">Dismiss</span>
                  <svg
                    className="h-5 w-5"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {workflowDiagram ? (
        <div className="workflow-container">
          <WorkflowViewer
            diagramCode={workflowDiagram.diagram}
            onDiagramUpdate={handleDiagramUpdate}
            editable={true}
            showRawCode={false}
          />

          <div className="workflow-feedback mt-6 bg-gray-50 rounded-md p-4 border border-gray-200">
            {/* Replace the Regenerate full process button */}
            <div className="mb-6 flex justify-end">
              <UserFeedbackInput
                onSubmit={handleRetryRegeneration}
                type="workflow"
                isLoading={isRegenerating}
                title="Workflow Feedback"
              />
            </div>

            {userFeedbackHistory.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-medium text-gray-700 mb-2">
                  Previous Feedback
                </h4>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  {userFeedbackHistory.map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-4 text-sm text-gray-600">
              <p>
                Tip: You can also directly edit the workflow by clicking on the
                "Edit Workflow" button above.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center p-6 bg-gray-50 border border-gray-200 rounded-md">
          <p className="text-gray-600">
            No workflow diagram available. Please upload a document to generate
            a workflow.
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkflowPage;
