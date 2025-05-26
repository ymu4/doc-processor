// Modified section of ProcessOptimizer.jsx to ensure consistent metrics calculation

import { useState, useEffect } from "react";
import OptimizedWorkflowDisplay from "./OptimizedWorkflowDisplay";
import OptimizedDocumentDisplay from "./OptimizedDocumentDisplay";
import { addApiKeysToRequest } from "../middleware/apiKeyMiddleware";
import UserFeedbackInput from "./UserFeedbackInput";
import {
  extractMetricsFromWorkflow,
  formatMinutesToTime,
  calculateTimeSavings,
} from "../utils/metricsProcessor";

export default function ProcessOptimizer({
  originalMetrics,
  workflowDiagram,
  originalDocument,
  onOptimizationComplete,
}) {
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("workflow");
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [userFeedback, setUserFeedback] = useState("");

  const [regenerationCount, setRegenerationCount] = useState(0);

  // Helper function to format time string with days, hours, and minutes
  const formatTimeString = (minutes) => {
    if (!minutes && minutes !== 0) {
      return "unknown";
    }

    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? "s" : ""}`;
    } else if (minutes < 8 * 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0
        ? `${hours} hour${hours !== 1 ? "s" : ""} ${remainingMinutes} minute${
            remainingMinutes !== 1 ? "s" : ""
          }`
        : `${hours} hour${hours !== 1 ? "s" : ""}`;
    } else {
      // Format in days when appropriate
      const days = Math.floor(minutes / (8 * 60));
      const remainingHours = Math.floor((minutes % (8 * 60)) / 60);
      const remainingMinutes = minutes % 60;

      let result = `${days} day${days !== 1 ? "s" : ""}`;

      if (remainingHours > 0) {
        result += ` ${remainingHours} hour${remainingHours !== 1 ? "s" : ""}`;
      }

      if (remainingMinutes > 0) {
        result += ` ${remainingMinutes} minute${
          remainingMinutes !== 1 ? "s" : ""
        }`;
      }

      return result;
    }
  };

  // Ensure metrics are always correctly synchronized with the diagram
  const syncMetricsWithDiagram = (data) => {
    if (!data || !data.optimizedWorkflow || !data.optimizedWorkflow.diagram) {
      return data;
    }

    //  console.log("Synchronizing metrics with diagram...");

    // Extract fresh metrics directly from the diagram
    const extractedMetrics = extractMetricsFromWorkflow(
      data.optimizedWorkflow.diagram
    );

    // console.log("Extracted metrics from diagram:", extractedMetrics);

    // Create a synced version of the data with consistent metrics
    const syncedData = {
      ...data,
      // Update optimizedWorkflow with extracted metrics
      optimizedWorkflow: {
        ...data.optimizedWorkflow,
        metrics: {
          ...data.optimizedWorkflow.metrics,
          totalSteps: extractedMetrics.totalSteps,
          totalTimeMinutes: extractedMetrics.totalTimeMinutes,
          stepTimes: extractedMetrics.stepTimes,
        },
      },
      // Update the main metrics object for consistency
      metrics: {
        ...data.metrics,
        totalSteps: extractedMetrics.totalSteps,
        totalTimeMinutes: extractedMetrics.totalTimeMinutes,
        totalTime: formatTimeString(extractedMetrics.totalTimeMinutes),
        stepTimes: extractedMetrics.stepTimes,
      },
    };

    // Recalculate time savings based on the extracted metrics
    if (
      originalMetrics &&
      originalMetrics.totalTimeMinutes &&
      extractedMetrics.totalTimeMinutes
    ) {
      syncedData.timeSavings = calculateTimeSavings(originalMetrics, {
        totalTimeMinutes: extractedMetrics.totalTimeMinutes,
        totalTime: formatTimeString(extractedMetrics.totalTimeMinutes),
      });

      //  console.log("Recalculated time savings:", syncedData.timeSavings);
    }

    return syncedData;
  };

  const generateOptimization = async (userFeedback = null) => {
    if (!originalMetrics || !workflowDiagram || isOptimizing) return;

    setIsOptimizing(true);
    setError(null);

    try {
      // Prepare the request data
      const requestData = {
        originalMetrics,
        workflowDiagram,
        originalDocument: originalDocument || null,
        userFeedback: userFeedback || null,
      };

      // Add API keys to the request
      const fetchOptions = addApiKeysToRequest({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Call the API endpoint
      const response = await fetch("/api/optimize-process", fetchOptions);
      //  console.log("response:", response);

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Server error: ${response.status}`
        );
      }

      // Process the response
      const data = await response.json();

      // Log the raw data for debugging
      //  console.log("Raw optimization data:", data);

      // CRITICAL FIX: Sync the metrics with the diagram to ensure consistency
      const syncedData = syncMetricsWithDiagram(data);

      // Update state with the optimization results
      setOptimizationResults(syncedData);

      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(syncedData);
      }
    } catch (err) {
      console.error("Error generating optimization:", err);
      setError(err.message || "An error occurred during optimization");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Function to regenerate full optimization
  const handleRegenerateOptimization = async (userFeedback = null) => {
    // Track regeneration attempts for debugging
    setRegenerationCount((prev) => prev + 1);

    // Log regeneration attempt
    // console.log(
    //   `Starting regeneration attempt #${regenerationCount + 1} with feedback:`,
    //   userFeedback
    // );

    // Set loading state
    setIsOptimizing(true);

    try {
      // Prepare the request data
      const requestData = {
        originalMetrics,
        workflowDiagram,
        originalDocument: originalDocument || null,
        userFeedback: userFeedback || null,
        // Include current optimization results to help guide further optimization
        currentOptimization: optimizationResults
          ? {
              metrics: optimizationResults.metrics,
              suggestions: optimizationResults.suggestions,
            }
          : null,
      };

      // Add API keys to the request
      const fetchOptions = addApiKeysToRequest({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      // Call the API endpoint
      const response = await fetch("/api/optimize-process", fetchOptions);

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Server error: ${response.status}`
        );
      }

      // Process the response
      const data = await response.json();

      // Log the raw regenerated data
      // console.log("Regenerated optimization data:", data);

      // CRITICAL FIX: Sync the metrics with the diagram to ensure consistency
      const syncedData = syncMetricsWithDiagram(data);

      // console.log("Final synced optimization results:", {
      //   metrics: syncedData.metrics,
      //   timeSavings: syncedData.timeSavings,
      // });

      // Update state with the new optimization results
      setOptimizationResults(syncedData);

      // Notify parent component
      if (onOptimizationComplete) {
        onOptimizationComplete(syncedData);
      }
    } catch (err) {
      console.error("Error regenerating optimization:", err);
      setError(err.message || "An error occurred during regeneration");
    } finally {
      setIsOptimizing(false);
    }
  };

  // Function to handle workflow-only updates with proper time calculations
  const handleUpdateWorkflowOnly = (updatedWorkflow) => {
    if (!optimizationResults) return;

    //  console.log("Updating workflow only with:", updatedWorkflow);

    // CRITICAL FIX: Create a wrapper object with the same structure as the API response
    // so we can use the same syncMetricsWithDiagram function
    const dataWrapper = {
      ...optimizationResults,
      optimizedWorkflow: updatedWorkflow,
    };

    // Sync metrics with the diagram
    const syncedData = syncMetricsWithDiagram(dataWrapper);

    // console.log("Updated results with synced metrics:", {
    //   metrics: syncedData.metrics,
    //   timeSavings: syncedData.timeSavings,
    // });

    // Update the state with the properly synced data
    setOptimizationResults(syncedData);

    // Notify parent if needed
    if (onOptimizationComplete) {
      onOptimizationComplete(syncedData);
    }
  };

  return (
    <div className="process-optimizer bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">
        Process Optimization
      </h3>

      {!optimizationResults && !isOptimizing && (
        <div className="mb-6 bg-blue-50 rounded-md p-6 border border-blue-100">
          <p className="text-gray-700 mb-4">
            Ready to streamline your process? Generate an optimized workflow
            that eliminates bureaucracy, reduces handoffs, and cuts unnecessary
            steps to improve efficiency.
          </p>

          <button
            onClick={() => generateOptimization()}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200"
          >
            Generate Optimized Process
          </button>
        </div>
      )}

      {isOptimizing && (
        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-md">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700 font-medium">
            {optimizationResults ? "Regenerating" : "Analyzing and optimizing"}{" "}
            your process...
          </p>
          <p className="text-gray-500 text-sm mt-2">
            This may take a minute or two
          </p>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            Try Again
          </button>
        </div>
      )}

      {optimizationResults && !isOptimizing && (
        <div>
          {/* Optimization Summary */}
          <div className="bg-white p-6 rounded-lg border shadow-sm mb-6">
            <h4 className="text-lg font-semibold mb-2 text-gray-950">
              Optimization Summary
            </h4>
            <p className="text-gray-700 mb-4">{optimizationResults.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                <h5 className="font-medium text-blue-800 mb-1">
                  Original Process
                </h5>
                <p className="text-2xl font-bold text-blue-600">
                  {originalMetrics.totalSteps} steps
                </p>
                <p className="text-sm text-blue-700">
                  {originalMetrics.totalTime}
                </p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                <h5 className="font-medium text-green-800 mb-1">
                  Optimized Process
                </h5>
                <p className="text-2xl font-bold text-green-600">
                  {optimizationResults.metrics.totalSteps} steps
                </p>
                <p className="text-sm text-green-700">
                  {optimizationResults.metrics.totalTime}
                </p>
              </div>

              <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                <h5 className="font-medium text-purple-800 mb-1">
                  Time Savings
                </h5>
                <p className="text-2xl font-bold text-purple-600">
                  {optimizationResults?.timeSavings?.percentageFormatted ||
                    "unknown"}
                </p>
                <p className="text-sm text-purple-700">
                  {optimizationResults?.timeSavings?.formatted || "unknown"}
                </p>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="mb-6 border-b border-gray-200">
            <div className="flex space-x-1">
              <button
                onClick={() => setActiveTab("workflow")}
                className={`py-2 px-4 font-medium text-sm rounded-t-md ${
                  activeTab === "workflow"
                    ? "bg-white border-l border-t border-r border-gray-200 border-b-white text-blue-600"
                    : "bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                Workflow
              </button>
              <button
                onClick={() => setActiveTab("document")}
                className={`py-2 px-4 font-medium text-sm rounded-t-md ${
                  activeTab === "document"
                    ? "bg-white border-l border-t border-r border-gray-200 border-b-white text-blue-600"
                    : "bg-gray-100 text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                Document
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="tab-content">
            {activeTab === "workflow" && (
              <OptimizedWorkflowDisplay
                originalWorkflow={workflowDiagram}
                optimizedWorkflow={optimizationResults.optimizedWorkflow}
                onRegenerateOptimized={handleRegenerateOptimization}
                onUpdateWorkflow={handleUpdateWorkflowOnly}
              />
            )}

            {activeTab === "document" && (
              <OptimizedDocumentDisplay
                originalDocument={originalDocument}
                optimizedDocument={optimizationResults.optimizedDocument}
                onRegenerateOptimized={handleRegenerateOptimization}
              />
            )}

            {/* Regenerate full process button */}
            <div className="mb-6 flex w-full">
              <UserFeedbackInput
                onSubmit={handleRegenerateOptimization}
                type="optimization"
                isLoading={isOptimizing}
                title="Optimization Feedback"
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
