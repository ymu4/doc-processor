// components/ImplementationPlan.jsx
import { useState } from "react";
import { addApiKeysToRequest } from "../middleware/apiKeyMiddleware";

export default function ImplementationPlan({
  optimizedDocument,
  originalDocument,
  optimizationResults,
  onError,
}) {
  const [implementationPlan, setImplementationPlan] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);

  const generateImplementationPlan = async () => {
    if (!optimizedDocument || isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      //("Generating implementation plan...");

      // Prepare the request data
      const requestData = {
        optimizedDocument,
        originalDocument,
        optimizationResults,
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
      const response = await fetch(
        "/api/generate-implementation-plan",
        fetchOptions
      );

      // Handle errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || `Server error: ${response.status}`
        );
      }

      // Process the response
      const data = await response.json();
      // console.log("Implementation plan generated successfully");

      // Update state with the new implementation plan
      setImplementationPlan(data.implementationPlan);
    } catch (err) {
      console.error("Error generating implementation plan:", err);
      setError(
        err.message ||
          "An error occurred while generating the implementation plan"
      );

      // Pass error to parent component if callback provided
      if (onError) {
        onError(err.message || "Implementation plan generation failed");
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = async () => {
    // Clear the existing plan before regenerating
    setImplementationPlan(null);
    await generateImplementationPlan();
  };

  const handleDownload = () => {
    if (!implementationPlan) return;

    // Create a blob object with the appropriate MIME type
    const blob = new Blob([implementationPlan], { type: "text/html" });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const a = window.document.createElement("a");
    a.href = url;
    a.download = "implementation_plan.html";
    window.document.body.appendChild(a);
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
    window.document.body.removeChild(a);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-800 mb-6">
        Implementation Plan
      </h3>

      {!implementationPlan && !isGenerating && (
        <div className="mb-6 bg-blue-50 rounded-md p-6 border border-blue-100">
          <p className="text-gray-700 mb-4">
            Ready to put the optimized process into action? Generate a detailed
            implementation plan that includes timeline, resources, stakeholder
            management, and change strategy.
          </p>

          <button
            onClick={generateImplementationPlan}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md shadow-sm font-medium transition-colors duration-200"
          >
            Generate Implementation Plan
          </button>
        </div>
      )}

      {isGenerating && (
        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-md">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-700 font-medium">
            {implementationPlan
              ? "Regenerating implementation plan..."
              : "Generating implementation plan..."}
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

      {implementationPlan && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button
                onClick={handleRegenerate}
                disabled={isGenerating}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
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
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isGenerating ? "Regenerating..." : "Regenerate Plan"}
              </button>
            </div>

            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className="bg-green-600 hover:bg-green-700 disabled:bg-green-400 disabled:cursor-not-allowed text-white px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
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
              Download Plan
            </button>
          </div>

          <div className="border rounded-md bg-gray-50 overflow-hidden">
            <iframe
              srcDoc={implementationPlan}
              className="w-full"
              style={{ height: "500px", border: "none" }}
              title="Implementation Plan"
            />
          </div>
        </div>
      )}
    </div>
  );
}
