// pages/admin.js (with unit filtering)
import { useState, useEffect } from 'react';
import Head from 'next/head';
import Layout from '../components/Layout';
import { useRouter } from 'next/router';
import { useAuth } from '../contexts/AuthContext';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, where, orderBy } from "firebase/firestore";

// Firebase configuration 
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

// Initialize Firebase
let app;
try {
    app = initializeApp(firebaseConfig);
} catch (error) {
    if (!/already exists/.test(error.message)) {
        console.error('Firebase initialization error', error.stack);
    }
}

const db = getFirestore(app);

// List of available units for filtering
const AVAILABLE_UNITS = [
    { id: 'all', name: 'All Units' },
    { id: 'finance', name: 'Finance Department' },
    { id: 'hr', name: 'Human Resources' },
    { id: 'operations', name: 'Operations' }
];

export default function AdminDashboard() {
    const [authChecked, setAuthChecked] = useState(false);
    const [selectedUnit, setSelectedUnit] = useState('all');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const router = useRouter();
    const { currentUser, isAdmin } = useAuth();

    // Stats state
    const [stats, setStats] = useState({
        totalUploads: 0,
        totalOptimizations: 0,
        totalTimeSaved: 0,
        totalStepsSaved: 0,
        averageTimeSaved: 0,
        totalWorkflowRegenerations: 0,
        unitBreakdown: {},
        recentActivity: []
    });

    // Check if user is authorized to access admin page
    useEffect(() => {
        async function checkAuth() {
            if (!currentUser) {
                router.push('/login');
                return;
            }

            const adminStatus = await isAdmin();
            if (!adminStatus) {
                router.push('/');
                return;
            }

            setAuthChecked(true);
            loadStats(selectedUnit);
        }

        checkAuth();
    }, [currentUser, router]);

    // Load statistics based on selected unit
    const loadStats = async (unitFilter = 'all') => {
        if (!authChecked) return;

        setLoading(true);
        setError(null);

        try {
            // Define the base query
            let analyticsQuery;

            if (unitFilter === 'all') {
                analyticsQuery = collection(db, 'analytics');
            } else {
                analyticsQuery = query(
                    collection(db, 'analytics'),
                    where('unit', '==', unitFilter)
                );
            }

            // Execute the query
            const snapshot = await getDocs(analyticsQuery);
            const allEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Process events
            const uploads = allEvents.filter(event => event.type === 'documentUpload');
            const optimizations = allEvents.filter(event => event.type === 'optimization');
            const regenerations = allEvents.filter(event => event.type === 'workflowRegeneration');

            // Calculate time saved
            let totalSavedMinutes = 0;
            let totalStepsSaved = 0;

            optimizations.forEach(opt => {
                if (opt.data && opt.data.timeSavedMinutes) {
                    totalSavedMinutes += opt.data.timeSavedMinutes;
                }

                if (opt.data && opt.data.originalSteps && opt.data.optimizedSteps) {
                    const stepsSaved = opt.data.originalSteps - opt.data.optimizedSteps;
                    if (stepsSaved > 0) {
                        totalStepsSaved += stepsSaved;
                    }
                }
            });

            // Calculate average time saved
            const avgSavedMinutes = optimizations.length > 0
                ? totalSavedMinutes / optimizations.length
                : 0;

            // Get unit breakdown
            const unitBreakdown = {};

            // Initialize all units with zero counts
            AVAILABLE_UNITS.forEach(unit => {
                if (unit.id !== 'all') {
                    unitBreakdown[unit.id] = {
                        name: unit.name,
                        uploads: 0,
                        optimizations: 0,
                        timeSaved: 0
                    };
                }
            });

            // Count by unit
            allEvents.forEach(event => {
                const eventUnit = event.unit || 'unknown';
                if (eventUnit !== 'unknown') {
                    // Create entry if this is a new unit
                    if (!unitBreakdown[eventUnit]) {
                        unitBreakdown[eventUnit] = {
                            name: eventUnit,
                            uploads: 0,
                            optimizations: 0,
                            timeSaved: 0
                        };
                    }

                    // Add to counts
                    if (event.type === 'documentUpload') {
                        unitBreakdown[eventUnit].uploads++;
                    } else if (event.type === 'optimization') {
                        unitBreakdown[eventUnit].optimizations++;
                        if (event.data && event.data.timeSavedMinutes) {
                            unitBreakdown[eventUnit].timeSaved += event.data.timeSavedMinutes;
                        }
                    }
                }
            });

            // Get recent activity, sorted by timestamp
            const recentActivity = allEvents
                .sort((a, b) => {
                    const dateA = a.timestamp?.toDate ? a.timestamp.toDate() : new Date();
                    const dateB = b.timestamp?.toDate ? b.timestamp.toDate() : new Date();
                    return dateB - dateA;
                })
                .slice(0, 10);

            // Update state with calculated stats
            setStats({
                totalUploads: uploads.length,
                totalOptimizations: optimizations.length,
                totalTimeSaved: formatTime(totalSavedMinutes),
                totalStepsSaved,
                averageTimeSaved: formatTime(avgSavedMinutes),
                totalWorkflowRegenerations: regenerations.length,
                unitBreakdown,
                recentActivity
            });

        } catch (error) {
            console.error('Error loading stats:', error);
            setError(`Error loading statistics: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Handle unit filter change
    const handleUnitChange = (e) => {
        const newUnit = e.target.value;
        setSelectedUnit(newUnit);
        loadStats(newUnit);
    };

    // Helper to format minutes into readable time
    const formatTime = (minutes) => {
        if (minutes < 60) {
            return `${Math.round(minutes)} minutes`;
        } else {
            const hours = Math.floor(minutes / 60);
            const mins = Math.round(minutes % 60);
            return `${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} minute${mins !== 1 ? 's' : ''}` : ''}`;
        }
    };

    // Format timestamp
    const formatDate = (timestamp) => {
        if (!timestamp) return 'Unknown date';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    };

    // If auth check isn't done yet, show loading
    if (!authChecked) {
        return (
            <Layout>
                <div className="min-h-screen flex items-center justify-center">
                    <div className="text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Checking authorization...</p>
                    </div>
                </div>
            </Layout>
        );
    }

    return (
        <Layout>
            <Head>
                <title>Admin Dashboard - Process Analysis & Optimization</title>
                <meta name="description" content="Admin dashboard for process optimization app" />
            </Head>

            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold text-center mb-2 text-gray-800">Admin Dashboard</h1>
                <p className="text-center text-gray-600 mb-8">Process Optimization Analytics</p>

                {/* Unit Filter */}
                <div className="max-w-4xl mx-auto mb-6">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center">
                            <label htmlFor="unit-filter" className="mr-2 text-gray-700">Filter by Unit:</label>
                            <select
                                id="unit-filter"
                                className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-800"
                                value={selectedUnit}
                                onChange={handleUnitChange}
                            >
                                {AVAILABLE_UNITS.map(unit => (
                                    <option key={unit.id} value={unit.id}>{unit.name}</option>
                                ))}
                            </select>
                        </div>

                        <button
                            onClick={() => loadStats(selectedUnit)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded"
                        >
                            Refresh Data
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="max-w-4xl mx-auto mb-6 bg-red-50 border-l-4 border-red-500 p-4">
                        <div className="flex">
                            <div className="flex-shrink-0">
                                <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <p className="text-sm text-red-800">{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                {loading ? (
                    <div className="text-center py-8">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
                        <p className="mt-2 text-gray-600">Loading analytics data...</p>
                    </div>
                ) : (
                    <>
                        {/* Stats Summary Cards */}
                        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-gray-500 text-sm uppercase tracking-wide">Total Documents Processed</h3>
                                <p className="text-3xl font-bold text-gray-800">{stats.totalUploads}</p>
                                <p className="text-sm text-gray-600 mt-1">
                                    {selectedUnit === 'all' ? 'Across all units' : `In ${AVAILABLE_UNITS.find(u => u.id === selectedUnit)?.name}`}
                                </p>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-gray-500 text-sm uppercase tracking-wide">Total Optimizations</h3>
                                <p className="text-3xl font-bold text-gray-800">{stats.totalOptimizations}</p>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-md">
                                <h3 className="text-gray-500 text-sm uppercase tracking-wide">Process Steps Saved</h3>
                                <p className="text-3xl font-bold text-green-600">{stats.totalStepsSaved}</p>
                            </div>
                        </div>

                        {/* Time Savings */}
                        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Time Savings</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-gray-500 text-sm">Total Time Saved</h4>
                                    <p className="text-2xl font-bold text-green-600">{stats.totalTimeSaved}</p>
                                </div>

                                <div>
                                    <h4 className="text-gray-500 text-sm">Average Time Saved Per Optimization</h4>
                                    <p className="text-2xl font-bold text-green-600">{stats.averageTimeSaved}</p>
                                </div>
                            </div>
                        </div>

                        {/* Unit Breakdown (visible only when looking at all units) */}
                        {selectedUnit === 'all' && (
                            <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md mb-8">
                                <h3 className="text-lg font-semibold mb-4 text-gray-800">Unit Breakdown</h3>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Unit
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Documents Processed
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Optimizations
                                                </th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Time Saved
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {Object.entries(stats.unitBreakdown).map(([unitId, unitData]) => (
                                                <tr key={unitId}>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                        {unitData.name}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {unitData.uploads}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {unitData.optimizations}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600">
                                                        {formatTime(unitData.timeSaved)}
                                                    </td>
                                                </tr>
                                            ))}

                                            {Object.keys(stats.unitBreakdown).length === 0 && (
                                                <tr>
                                                    <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                                                        No unit data available
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Recent Activity */}
                        <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg shadow-md">
                            <h3 className="text-lg font-semibold mb-4 text-gray-800">Recent Activity</h3>

                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Event
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Unit
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Date
                                            </th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                Details
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {stats.recentActivity.map((activity) => {
                                            // Get user and unit information
                                            const userData = activity.data?.user || {};
                                            const unitId = activity.unit || userData.unit || 'unknown';
                                            const unitName = AVAILABLE_UNITS.find(u => u.id === unitId)?.name || unitId;

                                            return (
                                                <tr key={activity.id}>
                                                    <td className="px-6 py-4 whitespace-nowrap">
                                                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                              ${activity.type === 'documentUpload' ? 'bg-blue-100 text-blue-800' :
                                                                activity.type === 'optimization' ? 'bg-green-100 text-green-800' :
                                                                    'bg-purple-100 text-purple-800'}`}>
                                                            {activity.type === 'documentUpload' ? 'Document Upload' :
                                                                activity.type === 'optimization' ? 'Optimization' :
                                                                    activity.type === 'workflowRegeneration' ? 'Workflow Regeneration' :
                                                                        activity.type}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {unitName}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                        {formatDate(activity.timestamp)}
                                                    </td>
                                                    <td className="px-6 py-4 text-sm text-gray-500">
                                                        {activity.type === 'optimization' && activity.data?.timeSavedMinutes && (
                                                            <span>Saved {formatTime(activity.data.timeSavedMinutes)}</span>
                                                        )}
                                                        {activity.type === 'documentUpload' && activity.data?.fileCount && (
                                                            <span>{activity.data.fileCount} file(s) uploaded</span>
                                                        )}
                                                        {activity.type === 'workflowRegeneration' && (
                                                            <span>Steps: {activity.data?.previousSteps || 0} → {activity.data?.newSteps || 0}</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {stats.recentActivity.length === 0 && (
                                            <tr>
                                                <td colSpan="4" className="px-6 py-4 text-center text-sm text-gray-500">
                                                    No recent activity found
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Layout>
    );
}