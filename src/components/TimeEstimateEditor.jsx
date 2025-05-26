// components/TimeEstimateViewer.jsx
import { useState, useEffect } from "react";

export default function TimeEstimateViewer({ metrics }) {
  const [stepTimes, setStepTimes] = useState([]);
  const [totalTime, setTotalTime] = useState("");

  // Initialize state from props
  useEffect(() => {
    if (metrics && metrics.stepTimes) {
      setStepTimes([...metrics.stepTimes]);
      setTotalTime(metrics.totalTime);
    }
  }, [metrics]);

  if (!metrics || !metrics.stepTimes) {
    return <div className="text-gray-500">No process metrics available</div>;
  }

  return (
    <div className="time-estimate-viewer mt-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">
          Step Time Estimates
        </h3>
      </div>

      <div className="overflow-x-auto bg-white rounded-lg border">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Step
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Description
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Time Estimate
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {stepTimes.map((step, index) => (
              <tr key={`step-${index}`}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {step.step || `Step ${index + 1}`}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {step.stepName}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {step.time || "Unknown"}
                </td>
              </tr>
            ))}

            {/* Total time row */}
            <tr className="bg-gray-50 font-semibold">
              <td
                className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                colSpan="2"
              >
                Total Estimated Time
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {totalTime || "Unknown"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
