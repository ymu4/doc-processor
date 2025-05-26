// components/DocumentViewerWithEditor.jsx
import React, { useState, useEffect } from "react";
import DocumentRenderer from "./DocumentRenderer";
import DocumentEditor from "./DocumentEditor";

/**
 * Component that combines document viewing and editing capabilities
 */
const DocumentViewerWithEditor = ({ documentContent, format, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [currentContent, setCurrentContent] = useState(documentContent);

  // Update content when the parent component passes new content
  useEffect(() => {
    setCurrentContent(documentContent);
  }, [documentContent]);

  // Handle document updates from the editor
  const handleDocumentUpdate = (updatedContent) => {
    setCurrentContent(updatedContent);
    onUpdate(updatedContent);
  };

  return (
    <div className="document-viewer-editor">
      <div className="viewer-editor-controls">
        <button
          onClick={() => setIsEditing(!isEditing)}
          className="toggle-editor-button"
        >
          {isEditing ? "View Document" : "Edit Document"}
        </button>
      </div>

      {isEditing ? (
        <DocumentEditor
          documentContent={currentContent}
          onUpdate={handleDocumentUpdate}
        />
      ) : (
        <DocumentRenderer documentContent={currentContent} format={format} />
      )}
    </div>
  );
};

// Make sure to export the component as a default export
export default DocumentViewerWithEditor;
