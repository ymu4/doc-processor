// pages/index.js
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import FileUploader from '../components/FileUploader';
import DocumentDisplay from '../components/DocumentDisplay';
import WorkflowPage from '../components/WorkflowPage';
import ProcessMetrics from '../components/ProcessMetrics';
import ProcessOptimizer from '../components/ProcessOptimizer';
import ProcessedFiles from '../components/ProcessedFiles';
import ImplementationPlan from '../components/ImplementationPlan';
import { extractMetricsFromWorkflow, mergeMetrics, extractMetricsFromDocument } from '../utils/metricsProcessor';
import { recordDocumentUpload } from '../utils/analyticsService';
import { useAuth } from '../contexts/AuthContext';
import { useRouter } from 'next/router';
import { addApiKeysToRequest } from '../middleware/apiKeyMiddleware';

export default function Home() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(null);
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [isDocumentRegenerating, setIsDocumentRegenerating] = useState(false);
  const [documentError, setDocumentError] = useState(null);

  const { currentUser } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!currentUser) {
      //console.log("User not authenticated");
      // Optionally redirect to login
      // router.push('/login');
    }
  }, [currentUser, router]);

  // Initial document processing - keeps the global loading state
  const handleProcessingResults = (data) => {
    setResults(data);
    setIsProcessing(false);
    setError(null);
    setOptimizationResults(null);
    // Record analytics for document upload
    recordDocumentUpload(data);
  };

  // Global error handler
  const handleError = (errorMessage) => {
    setError(errorMessage);
    setIsProcessing(false);
  };

  const handleDocumentRegeneration = async (feedback) => {
    //console.log("Document regeneration started with feedback:", feedback);

    if (!results) {
      //console.error("No results available for document regeneration");
      return;
    }

    if (isDocumentRegenerating) {
      //console.log("Already regenerating document, skipping duplicate request");
      return;
    }

    // Get document data from whatever source is available
    const extractedData = results.extractedData ||
      (results.formattedDocument ?
        {
          content: results.formattedDocument.content,
          type: 'text',
          parsed: true
        } : null);

    // Check if we have any data to work with
    if (!extractedData) {
      //console.error("No document data available for regeneration");
      setDocumentError("Cannot regenerate document: Missing document data");
      return;
    }

    // Set only document regeneration state to true
    setIsDocumentRegenerating(true);
    setDocumentError(null);

    try {
      // Log the request being made
      //   //console.log("Sending regenerate document request with data:", {
      //   extractedData,
      //     userFeedback: feedback
      // });

      // Add API keys to the request
      const fetchOptions = addApiKeysToRequest({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          extractedData,
          userFeedback: feedback
        }),
      });

      //console.log("Fetch options prepared, sending request...");
      const response = await fetch("/api/regenerate-document", fetchOptions);

      // Check for HTTP errors
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Server error: ${response.status}`);
      }

      //console.log("Document regeneration response received");
      const data = await response.json();
      //console.log("Parsed response data:", data);

      // Update only the document-related parts of the results
      const updatedResults = {
        ...results,
        formattedDocument: data.formattedDocument
      };

      // Always update the metrics from the API response
      if (data.documentMetrics) {
        //console.log("Received updated document metrics:", data.documentMetrics);

        // Merge the new document metrics with existing workflow metrics
        const updatedMetrics = mergeMetrics(
          results.workflowDiagram.metrics,
          data.documentMetrics
        );

        //console.log("Merged updated metrics:", updatedMetrics);
        updatedResults.processMetrics = updatedMetrics;
      } else {
        //console.warn("No document metrics received from API, extracting manually");

        // If API didn't return metrics, extract them manually from the new document
        try {
          const extractedMetrics = await extractMetricsFromDocument(data.formattedDocument.content);
          //console.log("Manually extracted metrics:", extractedMetrics);

          // Merge the extracted metrics with existing workflow metrics
          const updatedMetrics = mergeMetrics(
            results.workflowDiagram.metrics,
            extractedMetrics
          );

          //console.log("Merged manually extracted metrics:", updatedMetrics);
          updatedResults.processMetrics = updatedMetrics;
        } catch (metricsError) {
          //console.error("Failed to extract metrics manually:", metricsError);
        }
      }

      // Update state with new results
      //console.log("Updating results with regenerated document and metrics");
      setResults(updatedResults);
      setOptimizationResults(null); // Reset optimization results
      //console.log('Document regenerated successfully');
    } catch (err) {
      //console.error("Document regeneration error:", err);
      setDocumentError(err.message || "An error occurred during document regeneration");
    } finally {
      setIsDocumentRegenerating(false);
    }
  };

  const handleDocumentUpdate = (updatedDocument) => {
    if (!results) return;

    //console.log("Document has been updated directly via editor");

    // Create updated results with the new document
    const updatedResults = {
      ...results,
      formattedDocument: {
        ...results.formattedDocument,
        content: updatedDocument.content
      }
    };

    // If we have a document, recalculate metrics if needed
    if (updatedDocument.content) {
      try {
        //console.log("Extracting fresh metrics from updated document");
        extractMetricsFromDocument(updatedDocument.content)
          .then(documentMetrics => {
            // If we also have workflow metrics, merge them
            let updatedMetrics = documentMetrics;
            if (results.workflowDiagram?.metrics) {
              updatedMetrics = mergeMetrics(
                results.workflowDiagram.metrics,
                documentMetrics
              );
            }

            //console.log("Final merged metrics after document update:", updatedMetrics);
            updatedResults.processMetrics = updatedMetrics;

            // Update state with the new results
            setResults(updatedResults);
          })
          .catch(error => {
            //console.error("Error extracting metrics from updated document:", error);
            // Still update the document even if metrics extraction fails
            setResults(updatedResults);
          });
      } catch (error) {
        //console.error("Error extracting metrics from updated document:", error);
        // Still update the document even if metrics extraction fails
        setResults(updatedResults);
      }
    } else {
      // Update state with the new results even without metrics
      setResults(updatedResults);
    }

    // Reset optimization results since the document changed
    setOptimizationResults(null);
  };
  const handleOptimizationResults = (data) => {
    // Store the optimization results
    setOptimizationResults(data);

    // Log optimization details for debugging
    // //console.log('Optimization complete with time savings:',
    // data.timeSavings?.formatted || 'Unknown',
    //   `(${data.timeSavings?.percentageFormatted || '0%'})`
    // );
  };

  // Handle workflow updates from regeneration
  const handleWorkflowUpdate = async (newWorkflowDiagram) => {
    if (!results) return;

    //console.log("Workflow has been updated, recalculating metrics");

    const updatedResults = {
      ...results,
      workflowDiagram: newWorkflowDiagram
    };

    // Extract fresh metrics from the workflow diagram
    if (newWorkflowDiagram.diagram) {
      try {
        const workflowMetrics = extractMetricsFromWorkflow(newWorkflowDiagram.diagram);

        // Merge with document metrics if available
        let documentMetrics = null;
        if (results.formattedDocument?.content) {
          try {
            documentMetrics = await extractMetricsFromDocument(results.formattedDocument.content);
          } catch (docMetricsError) {
            //console.error("Error extracting document metrics:", docMetricsError);
          }
        }

        // Merge metrics, prioritizing workflow metrics
        const updatedMetrics = documentMetrics
          ? mergeMetrics(workflowMetrics, documentMetrics)
          : workflowMetrics;

        updatedResults.processMetrics = updatedMetrics;
      } catch (error) {
        //console.error("Error extracting metrics from updated workflow:", error);
      }
    }

    // Update state with the new results
    setResults(updatedResults);
    setOptimizationResults(null);
  };

  // Handle metrics updates from the time editor
  const handleMetricsUpdate = (updatedMetrics) => {
    if (!results) return;

    // Create updated results with the updated metrics
    const updatedResults = {
      ...results,
      processMetrics: updatedMetrics
    };

    // Update state with the new results
    setResults(updatedResults);

    // Reset optimization results since the metrics changed
    setOptimizationResults(null);
  };

  // Reset the app state to allow new file uploads
  const handleReset = () => {
    setResults(null);
    setOptimizationResults(null);
    setError(null);
    setIsProcessing(false);
    setDocumentError(null);
  };

  return (
    <Layout>
      <Head>
        <title>Process Analysis & Optimization</title>
        <meta name="description" content="Process documents, generate workflows, and optimize for zero bureaucracy" />
      </Head>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Process Analysis & Optimization</h1>
          <p className="text-gray-600 max-w-3xl mx-auto">
            Analyze and optimize your business processes for maximum efficiency and minimal bureaucracy
          </p>
        </div>

        {!results ? (
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg shadow-md mb-8">
              <h2 className="text-xl font-semibold mb-4 text-gray-800">Upload Process Documents</h2>
              <p className="text-gray-600 mb-6">
                Upload up to 5 business process documents (PDF, Word, Excel, CSV) to analyze the workflow,
                generate metrics, and receive AI-powered optimization suggestions to reduce bureaucracy
                and streamline operations.
              </p>

              <FileUploader
                onFileUpload={handleProcessingResults}
                onError={handleError}
              />
            </div>
          </div>
        ) : (
          <div className="max-w-5xl mx-auto">
            <div className="flex justify-end mb-6">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors duration-200 flex items-center"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                </svg>
                Upload New Document
              </button>
            </div>
          </div>
        )}

        {/* Only show this global loading indicator during initial processing */}
        {isProcessing && (
          <div className="mt-8 flex flex-col items-center justify-center bg-white p-8 rounded-lg shadow-md">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-gray-700 font-medium">Processing documents and analyzing workflow...</p>
          </div>
        )}

        {/* Global error display */}
        {error && !isProcessing && (
          <div className="mt-8 p-6 bg-red-50 border border-red-200 rounded-lg shadow-md max-w-4xl mx-auto">
            <h3 className="text-lg font-medium text-red-800 mb-3">Processing Error</h3>
            <p className="mb-6 text-sm text-red-600">{error}</p>

            <div>
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {results && !isProcessing && (
          <div className="mt-8 space-y-8 max-w-5xl mx-auto">
            {/* Processed Files Section */}
            {results.processedFiles && (
              <ProcessedFiles processedFiles={results.processedFiles} />
            )}

            {/* Process Metrics Section */}
            {results.processMetrics && (
              <ProcessMetrics
                metrics={results.processMetrics}
                optimizedMetrics={optimizationResults?.metrics}
                onMetricsUpdate={handleMetricsUpdate}
              />
            )}

            {/* Tabbed Document & Workflow Section */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="border-b border-gray-200">
                <h2 className="px-6 py-4 text-xl font-semibold text-gray-800">
                  {results.documentCount > 1 ? 'Integrated Process Details' : 'Process Details'}
                </h2>
              </div>

              <div className="p-6">
                {/* Process Document Section - Pass isRegenerating state */}
                <div className="mb-10">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">
                    {results.documentCount > 1
                      ? `Integrated Process Document (${results.documentCount} files)`
                      : 'Process Document'}
                  </h3>

                  {/* Pass document regeneration state and error */}
                  <DocumentDisplay
                    document={results.formattedDocument}
                    title="Process Document"
                    onRegenerateDocument={handleDocumentRegeneration}
                    documentData={
                      results.extractedData ||
                      (results.formattedDocument ?
                        {
                          content: results.formattedDocument.content,
                          type: 'text',
                          parsed: true
                        } : null)
                    }
                    isRegenerating={isDocumentRegenerating}
                    regenerationError={documentError}
                    onUpdateDocument={handleDocumentUpdate}
                  />
                </div>

                {/* Workflow Diagram Section */}
                <div className="mb-10">
                  <h3 className="text-lg font-semibold mb-4 text-gray-800">
                    {results.documentCount > 1
                      ? 'Integrated Process Workflow'
                      : 'Process Workflow'}
                  </h3>
                  <WorkflowPage
                    workflowDiagram={results.workflowDiagram}
                    documentData={results.extractedData || results.formattedDocument}
                    onWorkflowUpdate={handleWorkflowUpdate}
                  />
                </div>

                {/* Process Optimizer Section */}
                {results.processMetrics && results.workflowDiagram && (
                  <div className="mb-10">
                    <ProcessOptimizer
                      originalMetrics={results.processMetrics}
                      workflowDiagram={results.workflowDiagram}
                      originalDocument={results.formattedDocument}
                      onOptimizationComplete={handleOptimizationResults}
                    />
                  </div>
                )}

                {/* Implementation Plan Section */}
                {optimizationResults && (
                  <div className="mt-10">
                    <h3 className="text-lg font-semibold mb-4 text-gray-800">
                      Implementation Strategy
                    </h3>
                    <ImplementationPlan
                      optimizedDocument={optimizationResults.optimizedDocument}
                      originalDocument={results.formattedDocument}
                      optimizationResults={optimizationResults}
                      onError={(error) => setError(error)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}