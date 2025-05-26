// components/FileUploader.jsx
import { useState } from "react";
import { addApiKeysToRequest } from "../middleware/apiKeyMiddleware";

export default function FileUploader({ onFileUpload, onError }) {
  const [isDragging, setIsDragging] = useState(false);
  const [files, setFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);

  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
    }
  };

  const handleFiles = (newFiles) => {
    setUploadError(null);

    // Check if adding new files would exceed the limit
    if (files.length + newFiles.length > MAX_FILES) {
      setUploadError(
        `You can upload a maximum of ${MAX_FILES} files at once. You've selected ${
          files.length + newFiles.length
        } files.`
      );
      return;
    }

    // Validate each file
    const validatedFiles = [];
    const errors = [];

    // Accepted file types
    const acceptedTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "text/plain",
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    for (const file of newFiles) {
      // Size check
      if (file.size > MAX_FILE_SIZE) {
        errors.push(`File "${file.name}" exceeds the 15MB size limit.`);
        continue;
      }

      // Type check
      if (!acceptedTypes.includes(file.type)) {
        errors.push(
          `File "${file.name}" is not a supported format. Please upload PDF, DOC, DOCX, TXT, CSV, or XLSX files.`
        );
        continue;
      }

      // Check for duplicate file names
      if (files.some((existingFile) => existingFile.name === file.name)) {
        errors.push(`File "${file.name}" is already in the upload list.`);
        continue;
      }

      validatedFiles.push(file);
    }

    // Display the first error if any
    if (errors.length > 0) {
      setUploadError(errors[0]);
      // Continue with valid files if there are any
    }

    // Add valid files to the list
    if (validatedFiles.length > 0) {
      setFiles((prevFiles) => [...prevFiles, ...validatedFiles]);
    }
  };

  const removeFile = (index) => {
    setFiles((prevFiles) => prevFiles.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(10); // Start progress at 10%

    // Create form data
    const formData = new FormData();

    // Add all files to the form data
    files.forEach((file, index) => {
      formData.append(`document${index}`, file);
    });

    try {
      console.log(`Uploading ${files.length} files`);

      // Call the API to process the documents
      const fetchOptions = addApiKeysToRequest({
        method: "POST",
        body: formData,
      });
      const response = await fetch("/api/process-documents", fetchOptions);

      setUploadProgress(60); // Processing started

      // Handle non-successful responses
      if (!response.ok) {
        let errorMessage = "Upload failed";

        try {
          const errorData = await response.json();
          errorMessage =
            errorData.error || errorData.message || "Upload failed";
          console.error("Server error details:", errorData);
        } catch (jsonError) {
          // If the response is not JSON, use status text
          errorMessage = `Upload failed: ${response.status} ${response.statusText}`;
          console.error(
            "Response was not JSON:",
            await response.text().catch(() => "Could not read response text")
          );
        }

        throw new Error(errorMessage);
      }

      setUploadProgress(90); // Processing almost complete

      // Parse the successful response
      try {
        const data = await response.json();
        console.log("Files processed successfully");
        setUploadProgress(100); // Processing complete
        onFileUpload(data);

        // Clear the files after successful upload
        setFiles([]);
      } catch (parseError) {
        console.error("Error parsing response:", parseError);
        throw new Error("Invalid response format from server");
      }
    } catch (error) {
      console.error("Error uploading files:", error);
      setUploadError(error.message);
      setUploadProgress(0);
      if (onError) onError(error.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${
          isDragging ? "border-blue-500 bg-blue-50" : "border-gray-300"
        }`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById("fileInput").click()}
      >
        <input
          id="fileInput"
          type="file"
          className="hidden"
          onChange={handleFileInput}
          accept=".pdf,.doc,.docx,.txt,.csv,.xlsx"
          multiple
        />
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          />
        </svg>
        <p className="mt-2 text-sm text-gray-600">
          Drag and drop files here, or click to select
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Supports PDF, DOC, DOCX, TXT, CSV, XLSX (Max 15MB per file)
        </p>
        <p className="mt-1 text-xs font-medium text-blue-600">
          Upload up to {MAX_FILES} files for combined analysis
        </p>
      </div>

      {files.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            Selected Files ({files.length}/{MAX_FILES})
          </h3>

          <ul className="space-y-2 max-h-60 overflow-y-auto border rounded-md divide-y p-2">
            {files.map((file, index) => (
              <li
                key={index}
                className="flex justify-between items-center py-2 px-1"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFile(index);
                  }}
                  className="ml-2 text-red-500 hover:text-red-700"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>

          {isUploading && uploadProgress > 0 && (
            <div className="w-full bg-gray-200 rounded-full h-2.5 mt-4">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${uploadProgress}%` }}
              ></div>
              <p className="text-xs text-gray-500 mt-1 text-center">
                {uploadProgress < 100
                  ? `Processing files (${uploadProgress}%)`
                  : "Processing complete"}
              </p>
            </div>
          )}

          <button
            onClick={uploadFiles}
            disabled={isUploading || files.length === 0}
            className={`mt-4 w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
              isUploading || files.length === 0
                ? "bg-blue-300 cursor-not-allowed"
                : "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            }`}
          >
            {isUploading
              ? ""
              : `Analyze ${files.length} File${files.length !== 1 ? "s" : ""}`}
          </button>
        </div>
      )}

      {uploadError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{uploadError}</p>
        </div>
      )}
    </div>
  );
}
