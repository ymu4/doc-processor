// components/Layout.jsx
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useAuth } from "../contexts/AuthContext";

export default function Layout({ children }) {
  const { currentUser, logout, userUnit, apiProvider } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      router.push("/login");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  // Get the display name for the current API provider
  const getProviderDisplayName = () => {
    switch (apiProvider) {
      case "claude":
        return "Claude (Anthropic)";
      case "openai":
        return "OpenAI";
      case "both":
        return "Claude & OpenAI";
      default:
        return "Not configured";
    }
  };

  // Get status indicator color based on provider
  const getStatusIndicatorColor = () => {
    if (!apiProvider) return "bg-red-500";
    return "bg-green-500";
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Navbar */}
      <nav className="bg-blue-700 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Link href="/">
                  <span className="text-white font-bold text-xl cursor-pointer">
                    Process Optimizer
                  </span>
                </Link>
              </div>
              <div className="hidden md:block">
                <div className="ml-10 flex items-baseline space-x-4">
                  <Link href="/">
                    <span
                      className={`px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                        router.pathname === "/"
                          ? "bg-blue-800 text-white"
                          : "text-white hover:bg-blue-600"
                      } cursor-pointer`}
                    >
                      Home
                    </span>
                  </Link>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <div className="ml-4 flex items-center md:ml-6">
                {currentUser && (
                  <>
                    <div className="text-gray-200 px-3 py-2 text-sm">
                      <span className="font-medium text-white">
                        {currentUser.email}
                      </span>
                      {userUnit && (
                        <span className="ml-1 text-gray-300">| {userUnit}</span>
                      )}
                    </div>

                    <div className="border-l border-blue-500 h-6 mx-2"></div>

                    <div className="text-gray-200 px-3 py-2 text-sm flex items-center">
                      <span>API: </span>
                      <span className="ml-1 font-medium text-white flex items-center">
                        {getProviderDisplayName()}
                        <span
                          className={`ml-2 w-2 h-2 rounded-full ${getStatusIndicatorColor()}`}
                        ></span>
                      </span>
                    </div>

                    <div className="border-l border-blue-500 h-6 mx-2"></div>

                    <button
                      onClick={handleLogout}
                      className="px-4 py-2 rounded-md text-sm font-medium text-white hover:bg-blue-600 transition-colors duration-200"
                    >
                      Logout
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="-mr-2 flex md:hidden">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="bg-blue-600 inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-blue-500 focus:outline-none transition-colors duration-200"
                aria-expanded={isMenuOpen ? "true" : "false"}
              >
                <span className="sr-only">Open main menu</span>
                <svg
                  className="h-6 w-6"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
              <Link href="/">
                <span
                  className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                    router.pathname === "/"
                      ? "bg-blue-800 text-white"
                      : "text-white hover:bg-blue-600"
                  } cursor-pointer`}
                >
                  Home
                </span>
              </Link>
            </div>
            {currentUser && (
              <div className="pt-4 pb-3 border-t border-blue-500">
                <div className="px-2 space-y-1">
                  <div className="block px-3 py-2 text-base font-medium text-white">
                    {currentUser.email}
                    {userUnit && (
                      <div className="text-sm text-gray-300 mt-1">
                        {userUnit}
                      </div>
                    )}
                  </div>

                  <div className="block px-3 py-2 text-base font-medium text-white">
                    <div className="flex items-center">
                      <span>API Provider: </span>
                      <span className="ml-2 flex items-center">
                        {getProviderDisplayName()}
                        <span
                          className={`ml-2 w-2 h-2 rounded-full ${getStatusIndicatorColor()}`}
                        ></span>
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={handleLogout}
                    className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-white hover:bg-blue-600 transition-colors duration-200"
                  >
                    Logout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </nav>

      {/* Main content */}
      <main className="flex-grow py-6">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            Process Optimizer © {new Date().getFullYear()}
          </p>
        </div>
      </footer>
    </div>
  );
}
