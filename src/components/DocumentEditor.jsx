// components/DocumentEditor.jsx
import React, { useState, useEffect } from "react";
import {
  parseDocumentContent,
  updateDocumentCell,
  updateDocumentText,
  addDocumentRow,
  removeDocumentRow,
} from "../utils/documentEditor";

/**å
 * Component for editing HTML documents with tables and text content
 */
const DocumentEditor = ({ documentContent, onUpdate }) => {
  const [parsedDocument, setParsedDocument] = useState({ sections: [] });
  const [editingCell, setEditingCell] = useState(null);
  const [editingText, setEditingText] = useState(null);
  const [error, setError] = useState("");
  const [expandedSections, setExpandedSections] = useState({});
  const [addingRow, setAddingRow] = useState(null);
  const [newCellValues, setNewCellValues] = useState([]);

  // Parse the document when content changes
  useEffect(() => {
    try {
      if (!documentContent) {
        setParsedDocument({ sections: [] });
        return;
      }

      const parsed = parseDocumentContent(documentContent);
      setParsedDocument(parsed);

      // Initialize all sections to expanded by default
      const initialExpandedState = {};
      parsed.sections.forEach((_, index) => {
        initialExpandedState[index] = true;
      });
      setExpandedSections(initialExpandedState);

      setError("");
    } catch (err) {
      console.error("Error parsing document:", err);
      setError(`Failed to parse document: ${err.message}`);
    }
  }, [documentContent]);

  // Handle updating a cell
  const handleCellUpdate = (sectionIndex, rowIndex, cellIndex, newContent) => {
    try {
      const updatedDocument = updateDocumentCell(documentContent, {
        sectionIndex,
        rowIndex,
        cellIndex,
        newContent,
      });

      onUpdate(updatedDocument);
      setEditingCell(null);
    } catch (err) {
      console.error("Error updating cell:", err);
      setError(`Failed to update cell: ${err.message}`);
    }
  };

  // Handle updating text content
  const handleTextUpdate = (type, index, itemIndex, newContent) => {
    try {
      const updatedDocument = updateDocumentText(documentContent, {
        type,
        index,
        itemIndex,
        newContent,
      });

      onUpdate(updatedDocument);
      setEditingText(null);
    } catch (err) {
      console.error("Error updating text:", err);
      setError(`Failed to update text: ${err.message}`);
    }
  };

  // Handle adding a new row
  const handleAddRow = (sectionIndex, position) => {
    try {
      // Validate cell contents
      if (newCellValues.some((value) => !value.trim())) {
        setError("All cells must have content");
        return;
      }

      const updatedDocument = addDocumentRow(documentContent, {
        sectionIndex,
        position,
        cellContents: newCellValues,
      });

      onUpdate(updatedDocument);
      setAddingRow(null);
      setNewCellValues([]);
    } catch (err) {
      console.error("Error adding row:", err);
      setError(`Failed to add row: ${err.message}`);
    }
  };

  // Handle removing a row
  const handleRemoveRow = (sectionIndex, rowIndex) => {
    if (window.confirm("Are you sure you want to remove this row?")) {
      try {
        const updatedDocument = removeDocumentRow(documentContent, {
          sectionIndex,
          rowIndex,
        });

        onUpdate(updatedDocument);
      } catch (err) {
        console.error("Error removing row:", err);
        setError(`Failed to remove row: ${err.message}`);
      }
    }
  };

  // Toggle section expansion
  const toggleSection = (sectionIndex) => {
    setExpandedSections({
      ...expandedSections,
      [sectionIndex]: !expandedSections[sectionIndex],
    });
  };

  // Set up a new row form
  const setupNewRow = (sectionIndex, cellCount) => {
    setAddingRow(sectionIndex);
    setNewCellValues(Array(cellCount).fill(""));
  };

  // Update new cell value
  const updateNewCellValue = (index, value) => {
    const updatedValues = [...newCellValues];
    updatedValues[index] = value;
    setNewCellValues(updatedValues);
  };

  return (
    <div className="document-editor">
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}

      <h2 className="editor-title">Document Editor</h2>
      <p className="editor-instruction">
        Click on table cells or text to edit them.
      </p>

      {parsedDocument.sections.length === 0 ? (
        <div className="no-content">
          <p>No editable content found in the document.</p>
        </div>
      ) : (
        <>
          {/* Sections list */}
          {parsedDocument.sections.map((section, sectionIndex) => (
            <div key={`section-${sectionIndex}`} className="document-section">
              <div
                className="section-header"
                onClick={() => toggleSection(sectionIndex)}
              >
                <h3 className="section-title">
                  {expandedSections[sectionIndex] ? "▼" : "▶"} {section.title}
                </h3>
              </div>

              {expandedSections[sectionIndex] && (
                <div className="section-content">
                  <table className="editor-table">
                    <tbody>
                      {section.rows.map((row, rowIndex) => (
                        <tr key={`row-${sectionIndex}-${rowIndex}`}>
                          {row.cells.map((cell, cellIndex) => (
                            <td
                              key={`cell-${sectionIndex}-${rowIndex}-${cellIndex}`}
                              className={`editor-cell ${
                                cell.isHeader ? "header-cell" : ""
                              }`}
                              onClick={() =>
                                setEditingCell({
                                  sectionIndex,
                                  rowIndex,
                                  cellIndex,
                                  content: cell.content,
                                })
                              }
                            >
                              {editingCell &&
                              editingCell.sectionIndex === sectionIndex &&
                              editingCell.rowIndex === rowIndex &&
                              editingCell.cellIndex === cellIndex ? (
                                <textarea
                                  value={editingCell.content}
                                  onChange={(e) =>
                                    setEditingCell({
                                      ...editingCell,
                                      content: e.target.value,
                                    })
                                  }
                                  onBlur={() =>
                                    handleCellUpdate(
                                      sectionIndex,
                                      rowIndex,
                                      cellIndex,
                                      editingCell.content
                                    )
                                  }
                                  autoFocus
                                />
                              ) : (
                                <div
                                  dangerouslySetInnerHTML={{
                                    __html: cell.content,
                                  }}
                                />
                              )}
                            </td>
                          ))}
                          <td className="action-cell">
                            <button
                              className="remove-row-button"
                              onClick={() =>
                                handleRemoveRow(sectionIndex, rowIndex)
                              }
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Add row form */}
                  {addingRow === sectionIndex ? (
                    <div className="add-row-form">
                      <h4>Add New Row</h4>
                      {newCellValues.map((value, index) => (
                        <div
                          key={`new-cell-${index}`}
                          className="new-cell-input"
                        >
                          <label>Cell {index + 1}:</label>
                          <input
                            type="text"
                            value={value}
                            onChange={(e) =>
                              updateNewCellValue(index, e.target.value)
                            }
                          />
                        </div>
                      ))}
                      <div className="form-actions">
                        <button
                          className="add-button"
                          onClick={() => handleAddRow(sectionIndex, -1)}
                        >
                          Add Row
                        </button>
                        <button
                          className="cancel-button"
                          onClick={() => {
                            setAddingRow(null);
                            setNewCellValues([]);
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="add-row-button-container">
                      <button
                        className="add-row-button"
                        onClick={() =>
                          setupNewRow(
                            sectionIndex,
                            section.rows[0]?.cells.length || 3
                          )
                        }
                      >
                        Add Row
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default DocumentEditor;
