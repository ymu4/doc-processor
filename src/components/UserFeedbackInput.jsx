// components/UserFeedbackInput.jsx
import { useState } from "react";

export default function UserFeedbackInput({
  onSubmit,
  type = "optimization",
  isLoading = false,
  title = "Your Feedback",
}) {
  const [feedback, setFeedback] = useState("");
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (feedback.trim()) {
      onSubmit(feedback);
    }
  };

  // Determine placeholder text based on type
  const getPlaceholderText = () => {
    switch (type) {
      case "optimization":
        return 'Provide your feedback on how this process should be optimized. For example: "The approval step should be eliminated", "Steps 3 and 4 should be combined", "The review cycle takes too long", etc.';
      case "document":
        return 'Provide feedback on how the document should be improved. For example: "Add more detail to Step 2", "The time estimates are too high", "The roles should be better defined", etc.';
      case "workflow":
        return 'Provide feedback on how the workflow diagram should be improved. For example: "Add a decision point after Step 3", "The approval process should be shown as a parallel process", etc.';
      default:
        return "Enter your feedback here...";
    }
  };

  return (
    <div className="user-feedback-input mt-6 w-full">
      {!showForm ? (
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm flex items-center"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
            />
          </svg>
          Provide Feedback to Regenerate
        </button>
      ) : (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
            <button
              onClick={() => setShowForm(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
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
          </div>

          <form onSubmit={handleSubmit}>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder={getPlaceholderText()}
              className="w-full px-3 py-2 border text-gray-500 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={4}
              required
            />

            <div className="flex justify-end mt-3 space-x-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border rounded text-gray-600 hover:bg-gray-100"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center"
                disabled={isLoading || !feedback.trim()}
              >
                {isLoading ? (
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
                    Processing...
                  </>
                ) : (
                  "Submit Feedback"
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
