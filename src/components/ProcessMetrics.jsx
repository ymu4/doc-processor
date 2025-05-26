// components/ProcessMetrics.jsx
import { useState } from "react";
import { calculateTimeSavings } from "@/utils/metricsProcessor";
import TimeEstimateEditor from "./TimeEstimateEditor";

export default function ProcessMetrics({
  metrics,
  optimizedMetrics,
  onMetricsUpdate,
}) {
  const [showDetailedMetrics, setShowDetailedMetrics] = useState(false);

  // Handle metrics update from the time editor
  const handleMetricsUpdate = (updatedMetrics) => {
    if (onMetricsUpdate) {
      onMetricsUpdate(updatedMetrics);
    }
  };

  if (!metrics) {
    return <div className="text-gray-500">No process metrics available</div>;
  }

  // Calculate time/step savings if optimized metrics are available
  let timeSavings = null;
  let stepSavings = null;

  if (optimizedMetrics) {
    timeSavings = calculateTimeSavings(metrics, optimizedMetrics);

    const originalSteps = metrics.totalSteps || 0;
    const optimizedSteps = optimizedMetrics.totalSteps || 0;
    const stepDifference = Math.max(0, originalSteps - optimizedSteps);

    stepSavings = {
      steps: stepDifference,
      percentage:
        originalSteps > 0
          ? Math.round((stepDifference / originalSteps) * 100)
          : 0,
      percentageFormatted:
        originalSteps > 0
          ? `${Math.round((stepDifference / originalSteps) * 100)}%`
          : "0%",
    };
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">Process Metrics</h2>
      </div>

      <div className="px-6 py-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <h3 className="text-sm font-medium text-blue-800 uppercase">
              Total Steps
            </h3>
            <p className="text-3xl font-bold text-blue-600">
              {metrics.totalSteps || "Unknown"}
            </p>
            {stepSavings && (
              <div className="mt-1 text-sm text-green-600">
                <span className="font-medium">-{stepSavings.steps} steps</span>{" "}
                ({stepSavings.percentageFormatted} reduction)
              </div>
            )}
          </div>

          <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
            <h3 className="text-sm font-medium text-purple-800 uppercase">
              Total Time
            </h3>
            <p className="text-3xl font-bold text-purple-600">
              {metrics.totalTime || "Unknown"}
            </p>
            {timeSavings && (
              <div className="mt-1 text-sm text-green-600">
                <span className="font-medium">-{timeSavings.formatted}</span> (
                {timeSavings.percentageFormatted} reduction)
              </div>
            )}
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
            <h3 className="text-sm font-medium text-gray-800 uppercase">
              Data Source
            </h3>
            <p className="text-lg font-medium text-gray-700 capitalize">
              {metrics.source || "Unknown"}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {metrics.timestamp
                ? new Date(metrics.timestamp).toLocaleString()
                : "Timestamp not available"}
            </p>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={() => setShowDetailedMetrics(!showDetailedMetrics)}
            className="text-blue-600 hover:text-blue-800 text-sm flex items-center"
          >
            {showDetailedMetrics ? "Hide Details" : "Show Step Details"}
            <svg
              className={`ml-1 h-4 w-4 transform transition-transform ${
                showDetailedMetrics ? "rotate-180" : ""
              }`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>
        </div>

        {showDetailedMetrics &&
          metrics.stepTimes &&
          metrics.stepTimes.length > 0 && (
            <div className="mt-4">
              <TimeEstimateEditor
                metrics={metrics}
                onMetricsUpdate={handleMetricsUpdate}
              />
            </div>
          )}
      </div>
    </div>
  );
}
