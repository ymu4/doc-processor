// components/OptimizedDocumentDisplay.jsx
import { useState, useEffect } from "react";
import DocumentRenderer from "./DocumentRenderer";

export default function OptimizedDocumentDisplay({
  originalDocument,
  optimizedDocument,
  onRegenerateOptimized,
}) {
  const [format, setFormat] = useState("html");
  const [viewMode, setViewMode] = useState("optimized"); // 'optimized', 'original'
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  useEffect(() => {
    // Update the last updated timestamp when documents change
    if (optimizedDocument || originalDocument) {
      setLastUpdated(Date.now());
    }
  }, [optimizedDocument, originalDocument]);

  const handleDownload = () => {
    const currentDocument =
      viewMode === "optimized"
        ? optimizedDocument?.content
        : originalDocument?.content;

    if (!currentDocument) {
      console.warn("No document content to download");
      return;
    }

    // Create a blob object with the appropriate MIME type
    let mimeType = "text/html";
    let extension = "html";

    if (format === "markdown") {
      mimeType = "text/markdown";
      extension = "md";
    }

    const blob = new Blob([currentDocument], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `${viewMode}-document.${extension}`;
    window.document.body.appendChild(a);
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
    window.document.body.removeChild(a);
  };

  const handleRegenerate = async () => {
    if (isRegenerating || !onRegenerateOptimized) return;

    setIsRegenerating(true);
    setError(null);

    try {
      // Call the parent component's regeneration handler
      await onRegenerateOptimized();
    } catch (err) {
      console.error("Error regenerating optimized document:", err);
      setError(`Failed to regenerate optimized document: ${err.message}`);
    } finally {
      setIsRegenerating(false);
    }
  };

  if (!optimizedDocument && !originalDocument) {
    return (
      <div className="p-6 text-gray-500 bg-gray-50 rounded-md border border-gray-200 text-center">
        No document data available
      </div>
    );
  }

  return (
    <div className="optimized-document bg-white rounded-lg shadow-md p-6">
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
            Optimized Document
          </button>

          <button
            onClick={() => setViewMode("original")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
              viewMode === "original"
                ? "bg-blue-600 text-white"
                : "bg-gray-200 text-gray-800 hover:bg-gray-300"
            }`}
          >
            Original Document
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleDownload}
            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
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
            Download
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Document title and timestamp */}
      <div className="mb-3">
        <h3 className="text-lg font-semibold text-gray-800">
          {viewMode === "optimized"
            ? "Optimized Process Document"
            : "Original Process Document"}
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          Last updated: {new Date(lastUpdated).toLocaleTimeString()}
        </p>
      </div>

      {/* Show a loading overlay only in the document content area during regeneration */}
      <div className="relative border rounded-md overflow-hidden">
        {isRegenerating && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-blue-600 font-medium">
                Regenerating optimized document...
              </p>
            </div>
          </div>
        )}
        <div className="p-4 bg-gray-50 min-h-[300px]">
          <DocumentRenderer
            documentContent={
              viewMode === "optimized"
                ? optimizedDocument?.content
                : originalDocument?.content
            }
            format={format}
          />
        </div>
      </div>

      {/* Comparison hints */}
      {viewMode === "optimized" && (
        <div className="mt-4 bg-blue-50 rounded-md p-4 border border-blue-100">
          <div className="flex items-start gap-3 text-sm text-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-blue-500 flex-shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <p>
                This is the optimized version of your process document. Toggle
                between tabs to compare with the original.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
