// components/DocumentDisplay.jsx
import React, { useState, useEffect } from "react";
import DocumentViewerWithEditor from "./DocumentViewerWithEditor";
import UserFeedbackInput from "./UserFeedbackInput";

const DocumentDisplay = ({
  document: docData,
  title,
  onRegenerateDocument,
  documentData,
  isRegenerating,
  regenerationError,
  onUpdateDocument,
}) => {
  // State management
  const [format, setFormat] = useState("html");
  const [documentContent, setDocumentContent] = useState("");
  const [internalIsRegenerating, setInternalIsRegenerating] = useState(false);
  const [internalError, setInternalError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(Date.now());

  // Use external state if provided, otherwise use internal state
  const effectiveIsRegenerating =
    isRegenerating !== undefined ? isRegenerating : internalIsRegenerating;

  const effectiveError =
    regenerationError !== undefined ? regenerationError : internalError;

  // Update local content when document data changes
  useEffect(() => {
    if (docData?.content) {
      console.log("Document content updated:", {
        contentPreview: docData.content.substring(0, 50) + "...",
        timestamp: new Date().toISOString(),
        contentLength: docData.content.length,
      });
      setDocumentContent(docData.content);
      setLastUpdated(Date.now());
    } else {
      console.warn("Document data is null or undefined", { docData });
    }
  }, [docData]);

  // Handle document download
  const handleDownload = () => {
    if (!documentContent) {
      console.warn("No document content to download");
      return;
    }

    // Determine MIME type and extension based on format
    let mimeType = "text/html";
    let extension = "html";

    if (format === "markdown") {
      mimeType = "text/markdown";
      extension = "md";
    }

    // Create a downloadable blob
    const blob = new Blob([documentContent], { type: mimeType });
    const url = URL.createObjectURL(blob);

    // Create a temporary link and trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title || "document"}.${extension}`;
    document.body.appendChild(a);
    a.click();

    // Clean up
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  // Handle direct document updates from the editor
  const handleDocumentUpdate = (updatedContent) => {
    console.log("Document updated via editor:", {
      contentLengthBefore: documentContent?.length || 0,
      contentLengthAfter: updatedContent?.length || 0,
    });

    // Update local state
    setDocumentContent(updatedContent);
    setLastUpdated(Date.now());

    // If external handler is provided, call it
    if (onUpdateDocument) {
      onUpdateDocument({
        content: updatedContent,
        format: format,
      });
    }
  };

  // Handle document regeneration with user feedback
  const handleRegenerateDocument = async (feedback) => {
    console.log("Attempting to regenerate document:", {
      hasDocumentData: !!documentData,
      hasDocData: !!docData,
      feedback: feedback ? "provided" : "not provided",
    });

    // Use docData as a fallback if documentData is not provided
    const dataForRegeneration =
      documentData || (docData ? { content: docData.content } : null);

    if (!dataForRegeneration) {
      console.error("Cannot regenerate: all document data is missing");
      if (regenerationError === undefined) {
        setInternalError("Cannot regenerate: missing document data");
      }
      return;
    }

    if (effectiveIsRegenerating) {
      console.log("Already regenerating, ignoring duplicate request");
      return;
    }

    // Only set internal state if external state is not provided
    if (isRegenerating === undefined) {
      setInternalIsRegenerating(true);
    }
    if (regenerationError === undefined) {
      setInternalError(null);
    }

    try {
      console.log("Calling onRegenerateDocument with feedback", {
        feedbackLength: feedback?.length || 0,
      });

      await onRegenerateDocument(feedback);
      console.log("Document regeneration completed successfully");
    } catch (err) {
      console.error("Document regeneration error:", err);
      if (regenerationError === undefined) {
        setInternalError(`Failed to regenerate document: ${err.message}`);
      }
    } finally {
      if (isRegenerating === undefined) {
        setInternalIsRegenerating(false);
      }
    }
  };

  // Simple regenerate without feedback
  const handleRegenerateClick = () => {
    console.log("Regenerate button clicked");
    handleRegenerateDocument();
  };

  return (
    <div className="document-display bg-white rounded-lg shadow-md p-6">
      {/* Header with title and controls */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">
            {title || "Generated Document"}
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Last updated: {new Date(lastUpdated).toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center space-x-3 ">
          {/* Format selector */}
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className="p-2 border border-blue-900 rounded-md text-sm bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-600"
          >
            <option value="html">HTML</option>
            <option value="markdown">Markdown</option>
          </select>

          {/* Download button */}
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

          {/* Regenerate button - only shown if onRegenerateDocument is provided */}
          {onRegenerateDocument && (
            <button
              onClick={handleRegenerateClick}
              disabled={effectiveIsRegenerating}
              className={`text-sm px-3 py-2 rounded-md font-medium transition-colors duration-200 flex items-center ${
                effectiveIsRegenerating
                  ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              }`}
            >
              {effectiveIsRegenerating ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Regenerating...
                </>
              ) : (
                "Regenerate Document"
              )}
            </button>
          )}
        </div>
      </div>

      {/* Error display */}
      {effectiveError && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{effectiveError}</p>
        </div>
      )}

      {/* Document content with loading overlay */}
      <div className="relative border rounded-md overflow-hidden">
        {effectiveIsRegenerating && (
          <div className="absolute inset-0 bg-white bg-opacity-70 flex items-center justify-center z-10">
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
              <p className="mt-3 text-blue-600 font-medium">
                Regenerating document...
              </p>
            </div>
          </div>
        )}

        <div className="p-4 bg-gray-50 min-h-[300px]">
          {/* Document viewer with editor capability */}
          <DocumentViewerWithEditor
            documentContent={documentContent}
            format={format}
            onUpdate={handleDocumentUpdate}
          />
        </div>
      </div>

      {/* Feedback input for document regeneration */}
      {onRegenerateDocument && (
        <div className="mt-6">
          <UserFeedbackInput
            onSubmit={handleRegenerateDocument}
            type="document"
            isLoading={effectiveIsRegenerating}
            title="Your Document Feedback"
          />
        </div>
      )}
    </div>
  );
};

// Make sure to use the default export
export default DocumentDisplay;
