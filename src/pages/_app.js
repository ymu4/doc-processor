// pages/_app.js
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { AuthProvider, useAuth } from '../contexts/AuthContext';
import '../styles/globals.css';

// Wrapper component for route protection and API key verification
function RouteGuard({ children }) {
  const { currentUser, loading, apiKeysConfigured, isAdmin } = useAuth();
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);

  // First, check admin status when user logs in
  useEffect(() => {
    async function checkAdminStatus() {
      if (currentUser) {
        //console.log(`Checking admin status for: ${currentUser.email}`);
        const adminStatus = await isAdmin();
        // console.log(`Admin status result: ${adminStatus}`);
        setIsAdminUser(adminStatus);
        setAdminChecked(true);
      } else {
        setIsAdminUser(false);
        setAdminChecked(true);
      }
    }

    if (!loading) {
      checkAdminStatus();
    }
  }, [currentUser, loading, isAdmin]);

  // Then, handle route authorization based on the admin status
  useEffect(() => {
    // Don't proceed with route checks until admin status is confirmed
    if (!adminChecked || loading) {
      return;
    }

    // Check if the route requires authentication and API keys
    async function authCheck() {
      // Public paths that don't require authentication
      const publicPaths = ['/login', '/signup'];

      // Paths that require authentication but not API keys
      const apiConfigPaths = ['/api-config'];

      // Admin path
      const adminPaths = ['/admin'];

      const path = router.pathname;
      // console.log(`Route check - Path: ${path}, User: ${currentUser?.email || 'Not logged in'}, Admin: ${isAdminUser}, API configured: ${apiKeysConfigured}`);

      // Authorization logic - ORDER MATTERS HERE!

      // 1. If not logged in and on protected route, redirect to login
      if (!publicPaths.includes(path) && !currentUser) {
        //  console.log("Not logged in, redirecting to login");
        setAuthorized(false);
        router.push('/login');
        return;
      }

      // 2. Admin status check - allow admin to access admin route, deny non-admins
      if (adminPaths.includes(path)) {
        if (!isAdminUser) {
          //  console.log("Non-admin attempting to access admin route, redirecting");
          setAuthorized(false);
          router.push('/');
          return;
        } else {
          // console.log("Admin accessing admin route, allowing");
          setAuthorized(true);
          return;
        }
      }

      // 3. If admin, allow access to all routes
      if (isAdminUser) {
        //  console.log("Admin user, authorizing access to all routes");
        setAuthorized(true);
        return;
      }

      // 4. For non-admins, check if API keys are configured
      // If not configured and not on public/api-config path, redirect to api-config
      if (
        !publicPaths.includes(path) &&
        !apiConfigPaths.includes(path) &&
        !apiKeysConfigured
      ) {
        //   console.log("API keys not configured, redirecting to api-config");
        setAuthorized(false);
        router.push('/api-config');
        return;
      }

      // 5. If none of the above conditions apply, authorize access
      // console.log("Route authorized");
      setAuthorized(true);
    }

    // Run auth check when route changes or dependencies update
    authCheck();

    // Listen for route changes and verify authentication
    const hideContent = () => setAuthorized(false);
    router.events.on('routeChangeStart', hideContent);
    router.events.on('routeChangeComplete', authCheck);

    // Cleanup event listeners
    return () => {
      router.events.off('routeChangeStart', hideContent);
      router.events.off('routeChangeComplete', authCheck);
    };
  }, [loading, currentUser, apiKeysConfigured, router, isAdminUser, adminChecked]);

  // Show loading screen while checking auth
  if (loading || !adminChecked) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      <div className="ml-3 text-sm text-gray-700">
        {!adminChecked ? 'Checking admin status...' : 'Loading...'}
      </div>
    </div>;
  }

  // Debug overlay - remove in production
  const debugInfo = currentUser ? {
    path: router.pathname,
    uid: currentUser.uid,
    email: currentUser.email,
    isAdmin: isAdminUser,
    adminChecked: adminChecked,
    apiKeysConfigured: apiKeysConfigured
  } : { status: 'Not logged in' };

  // Show children only when authorized
  return authorized ? (
    <>
      {/* Debug info overlay - remove in production */}
      {/* <div className="fixed bottom-4 right-4 bg-gray-800 text-white p-4 rounded shadow-lg z-50 max-w-md text-xs opacity-70 hover:opacity-100">
        <h3 className="font-bold mb-2">Auth Debug:</h3>
        <pre>{JSON.stringify(debugInfo, null, 2)}</pre>
      </div> */}
      {children}
    </>
  ) : (
    <div className="flex items-center justify-center min-h-screen">
      <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );
}

function MyApp({ Component, pageProps }) {
  return (
    <AuthProvider>
      <RouteGuard>
        <Component {...pageProps} />
      </RouteGuard>
    </AuthProvider>
  );
}

export default MyApp;