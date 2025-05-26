// components/ProcessedFiles.jsx
import { useState } from 'react';

export default function ProcessedFiles({ processedFiles }) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  if (!processedFiles || processedFiles.length === 0) {
    return null;
  }
  
  const fileCount = processedFiles.length;
  const successfulFiles = processedFiles.filter(file => file.parsed).length;
  
  return (
    <div className="bg-white p-6 rounded-lg shadow-md mb-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Processed Files</h3>
        
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-blue-600 hover:text-blue-800 text-sm flex items-center focus:outline-none"
        >
          <span className="mr-1">{isExpanded ? 'Hide' : 'Show'} details</span>
          <svg className={`w-4 h-4 transform ${isExpanded ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      <div className="flex items-center mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center bg-blue-100 text-blue-800 font-semibold mr-3">
          {fileCount}
        </div>
        <div>
          <p className="font-medium text-gray-900">
            {fileCount} file{fileCount !== 1 ? 's' : ''} processed
          </p>
          <p className="text-sm text-gray-600">
            {successfulFiles} successfully parsed
          </p>
        </div>
      </div>
      
      {isExpanded && (
        <div className="mt-4 border rounded-md overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {processedFiles.map((file, index) => (
                <tr key={index}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {file.fileName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {file.type || 'Unknown'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {file.parsed ? (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                        Successful
                      </span>
                    ) : (
                      <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 text-red-800">
                        Failed
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 flex">
        <div className="bg-blue-50 px-4 py-2 rounded-md text-sm text-blue-700 w-full">
          <p className="font-medium">Multi-file analysis</p>
          <p className="text-xs mt-1">
            The outputs represent a combined analysis of all successfully processed files.
          </p>
        </div>
      </div>
    </div>
  );
}