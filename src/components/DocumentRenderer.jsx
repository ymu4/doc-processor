import React from "react";
import ReactMarkdown from "react-markdown";

/**
 * Component to render document content in either HTML or Markdown format
 */
const DocumentRenderer = ({ documentContent, format = "html" }) => {
  // If format is markdown, render using ReactMarkdown component
  if (format === "markdown") {
    return (
      <div className="markdown-renderer prose prose-blue max-w-none text-gray-500">
        <ReactMarkdown>{documentContent || ""}</ReactMarkdown>
      </div>
    );
  }

  return (
    <div
      className="html-renderer prose prose-blue max-w-none text-gray-900"
      dangerouslySetInnerHTML={{ __html: documentContent || "" }}
    />
  );
};

export default DocumentRenderer;
