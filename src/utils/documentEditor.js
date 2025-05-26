// utils/documentEditor.js
import { JSDOM } from 'jsdom';

/**
 * Parse HTML document content into structured sections
 * @param {string} documentContent - The HTML document content
 * @returns {object} Parsed document structure with sections
 */
export function parseDocumentContent(documentContent) {
    if (!documentContent) {
        console.error('Empty document content passed to parseDocumentContent');
        return { sections: [] };
    }

    try {
        // Create a DOM from the HTML content
        const dom = new JSDOM(documentContent);
        const document = dom.window.document;

        // Find all table elements
        const tables = document.querySelectorAll('table');

        // Initialize document structure
        const parsedDocument = {
            title: document.querySelector('h1, h2')?.textContent || 'Process Document',
            sections: []
        };

        // Process each table in the document
        tables.forEach((table, tableIndex) => {
            // Look for section titles - usually in th elements or preceding h3/h4 elements
            let sectionTitle = 'Section ' + (tableIndex + 1);

            // Check if table has a caption
            const caption = table.querySelector('caption');
            if (caption) {
                sectionTitle = caption.textContent.trim();
            } else {
                // Check if the table has a preceding header
                let previousElement = table.previousElementSibling;
                while (previousElement && !['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].includes(previousElement.tagName)) {
                    previousElement = previousElement.previousElementSibling;
                }

                if (previousElement) {
                    sectionTitle = previousElement.textContent.trim();
                } else {
                    // Try to get section title from the first row if it spans all columns
                    const firstRow = table.querySelector('tr');
                    if (firstRow) {
                        const firstCell = firstRow.querySelector('th, td');
                        if (firstCell && firstCell.colSpan > 1) {
                            sectionTitle = firstCell.textContent.trim();
                        }
                    }
                }
            }

            // Extract rows data
            const rows = [];
            const tableRows = table.querySelectorAll('tr');

            tableRows.forEach((row, rowIndex) => {
                // Skip the first row if it's a header or spans multiple columns (likely a section title)
                if (rowIndex === 0) {
                    const firstCell = row.querySelector('th, td');
                    if (firstCell && firstCell.colSpan > 1) {
                        return;
                    }
                }

                const cells = row.querySelectorAll('th, td');
                if (cells.length === 0) return;

                // Process cells
                const rowData = {
                    cells: Array.from(cells).map(cell => ({
                        content: cell.innerHTML,
                        textContent: cell.textContent.trim(),
                        isHeader: cell.tagName.toLowerCase() === 'th',
                        colSpan: cell.colSpan || 1,
                        rowSpan: cell.rowSpan || 1
                    })),
                    rowIndex
                };

                rows.push(rowData);
            });

            // Add section to parsed document
            if (rows.length > 0) {
                parsedDocument.sections.push({
                    title: sectionTitle,
                    tableIndex,
                    rows
                });
            }
        });

        // Look for non-table content (paragraphs, lists, etc.)
        const paragraphs = document.querySelectorAll('p');
        const lists = document.querySelectorAll('ul, ol');

        if (paragraphs.length > 0 || lists.length > 0) {
            const textualContent = [];

            paragraphs.forEach(p => {
                if (p.textContent.trim()) {
                    textualContent.push({
                        type: 'paragraph',
                        content: p.innerHTML,
                        textContent: p.textContent.trim()
                    });
                }
            });

            lists.forEach(list => {
                if (list.textContent.trim()) {
                    const items = Array.from(list.querySelectorAll('li')).map(li => ({
                        content: li.innerHTML,
                        textContent: li.textContent.trim()
                    }));

                    textualContent.push({
                        type: list.tagName.toLowerCase(),
                        items,
                        content: list.innerHTML
                    });
                }
            });

            if (textualContent.length > 0) {
                parsedDocument.textualContent = textualContent;
            }
        }

        return parsedDocument;
    } catch (error) {
        console.error('Error parsing document content:', error);
        return { sections: [], error: error.message };
    }
}

/**
 * Update a specific cell in the document
 * @param {string} documentContent - The HTML document content
 * @param {object} updateInfo - Information about the cell to update
 * @param {number} updateInfo.sectionIndex - The section index
 * @param {number} updateInfo.rowIndex - The row index within the section
 * @param {number} updateInfo.cellIndex - The cell index within the row
 * @param {string} updateInfo.newContent - The new cell content
 * @returns {string} The updated document content
 */
export function updateDocumentCell(documentContent, updateInfo) {
    const { sectionIndex, rowIndex, cellIndex, newContent } = updateInfo;

    try {
        // Parse the document
        const parsedDocument = parseDocumentContent(documentContent);

        // Validate indices
        if (sectionIndex < 0 || sectionIndex >= parsedDocument.sections.length) {
            throw new Error(`Invalid section index: ${sectionIndex}`);
        }

        const section = parsedDocument.sections[sectionIndex];

        if (rowIndex < 0 || rowIndex >= section.rows.length) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        const row = section.rows[rowIndex];

        if (cellIndex < 0 || cellIndex >= row.cells.length) {
            throw new Error(`Invalid cell index: ${cellIndex}`);
        }

        // Create a DOM from the HTML content
        const dom = new JSDOM(documentContent);
        const document = dom.window.document;

        // Find tables
        const tables = document.querySelectorAll('table');
        if (!tables[section.tableIndex]) {
            throw new Error(`Table with index ${section.tableIndex} not found`);
        }

        // Find the target row
        const targetTable = tables[section.tableIndex];
        const targetRow = targetTable.querySelectorAll('tr')[row.rowIndex];
        if (!targetRow) {
            throw new Error(`Row with index ${row.rowIndex} not found in table ${section.tableIndex}`);
        }

        // Find the target cell
        const targetCells = targetRow.querySelectorAll('th, td');
        if (!targetCells[cellIndex]) {
            throw new Error(`Cell with index ${cellIndex} not found in row ${row.rowIndex}`);
        }

        // Update the cell content
        targetCells[cellIndex].innerHTML = newContent;

        // Return the updated document content
        return dom.serialize();
    } catch (error) {
        console.error('Error updating document cell:', error);
        throw error;
    }
}

/**
 * Update a paragraph or list item in the document
 * @param {string} documentContent - The HTML document content
 * @param {object} updateInfo - Information about the text to update
 * @param {string} updateInfo.type - 'paragraph' or 'listItem'
 * @param {number} updateInfo.index - The index of the paragraph or list
 * @param {number} updateInfo.itemIndex - The index of the list item (for lists only)
 * @param {string} updateInfo.newContent - The new content
 * @returns {string} The updated document content
 */
export function updateDocumentText(documentContent, updateInfo) {
    const { type, index, itemIndex, newContent } = updateInfo;

    try {
        // Create a DOM from the HTML content
        const dom = new JSDOM(documentContent);
        const document = dom.window.document;

        if (type === 'paragraph') {
            // Find paragraphs
            const paragraphs = document.querySelectorAll('p');

            if (index < 0 || index >= paragraphs.length) {
                throw new Error(`Invalid paragraph index: ${index}`);
            }

            // Update the paragraph content
            paragraphs[index].innerHTML = newContent;
        } else if (type === 'listItem') {
            // Find lists
            const lists = document.querySelectorAll('ul, ol');

            if (index < 0 || index >= lists.length) {
                throw new Error(`Invalid list index: ${index}`);
            }

            // Find list items in the specified list
            const listItems = lists[index].querySelectorAll('li');

            if (itemIndex < 0 || itemIndex >= listItems.length) {
                throw new Error(`Invalid list item index: ${itemIndex}`);
            }

            // Update the list item content
            listItems[itemIndex].innerHTML = newContent;
        } else {
            throw new Error(`Unsupported update type: ${type}`);
        }

        // Return the updated document content
        return dom.serialize();
    } catch (error) {
        console.error('Error updating document text:', error);
        throw error;
    }
}

/**
 * Add a new row to a table in the document
 * @param {string} documentContent - The HTML document content
 * @param {object} addInfo - Information about the row to add
 * @param {number} addInfo.sectionIndex - The section index
 * @param {number} addInfo.position - The position to add the row (0 = top, -1 = bottom, or a specific index)
 * @param {Array<string>} addInfo.cellContents - The contents for each cell in the new row
 * @returns {string} The updated document content
 */
export function addDocumentRow(documentContent, addInfo) {
    const { sectionIndex, position, cellContents } = addInfo;

    try {
        // Parse the document
        const parsedDocument = parseDocumentContent(documentContent);

        // Validate section index
        if (sectionIndex < 0 || sectionIndex >= parsedDocument.sections.length) {
            throw new Error(`Invalid section index: ${sectionIndex}`);
        }

        const section = parsedDocument.sections[sectionIndex];

        // Create a DOM from the HTML content
        const dom = new JSDOM(documentContent);
        const document = dom.window.document;

        // Find tables
        const tables = document.querySelectorAll('table');
        if (!tables[section.tableIndex]) {
            throw new Error(`Table with index ${section.tableIndex} not found`);
        }

        // Find the target table
        const targetTable = tables[section.tableIndex];

        // Create a new row
        const newRow = document.createElement('tr');

        // Add cells to the new row
        cellContents.forEach(cellContent => {
            const cell = document.createElement('td');
            cell.innerHTML = cellContent;
            newRow.appendChild(cell);
        });

        // Determine position to insert the row
        const rows = targetTable.querySelectorAll('tr');

        if (position === -1 || position >= rows.length) {
            // Add to the bottom
            targetTable.appendChild(newRow);
        } else if (position === 0) {
            // Add to the top
            targetTable.insertBefore(newRow, rows[0]);
        } else {
            // Add at the specified position
            targetTable.insertBefore(newRow, rows[position]);
        }

        // Return the updated document content
        return dom.serialize();
    } catch (error) {
        console.error('Error adding document row:', error);
        throw error;
    }
}

/**
 * Remove a row from a table in the document
 * @param {string} documentContent - The HTML document content
 * @param {object} removeInfo - Information about the row to remove
 * @param {number} removeInfo.sectionIndex - The section index
 * @param {number} removeInfo.rowIndex - The row index within the section
 * @returns {string} The updated document content
 */
export function removeDocumentRow(documentContent, removeInfo) {
    const { sectionIndex, rowIndex } = removeInfo;

    try {
        // Parse the document
        const parsedDocument = parseDocumentContent(documentContent);

        // Validate indices
        if (sectionIndex < 0 || sectionIndex >= parsedDocument.sections.length) {
            throw new Error(`Invalid section index: ${sectionIndex}`);
        }

        const section = parsedDocument.sections[sectionIndex];

        if (rowIndex < 0 || rowIndex >= section.rows.length) {
            throw new Error(`Invalid row index: ${rowIndex}`);
        }

        // Create a DOM from the HTML content
        const dom = new JSDOM(documentContent);
        const document = dom.window.document;

        // Find tables
        const tables = document.querySelectorAll('table');
        if (!tables[section.tableIndex]) {
            throw new Error(`Table with index ${section.tableIndex} not found`);
        }

        // Find the target table and row
        const targetTable = tables[section.tableIndex];
        const targetRow = targetTable.querySelectorAll('tr')[section.rows[rowIndex].rowIndex];

        if (!targetRow) {
            throw new Error(`Row with index ${section.rows[rowIndex].rowIndex} not found in table ${section.tableIndex}`);
        }

        // Remove the row
        targetRow.parentNode.removeChild(targetRow);

        // Return the updated document content
        return dom.serialize();
    } catch (error) {
        console.error('Error removing document row:', error);
        throw error;
    }
}

export default {
    parseDocumentContent,
    updateDocumentCell,
    updateDocumentText,
    addDocumentRow,
    removeDocumentRow
};