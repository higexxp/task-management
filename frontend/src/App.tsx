import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import IssuesPage from './pages/IssuesPage';
import IssueDetailPage from './pages/IssueDetailPage';
import AnalyticsPage from './pages/AnalyticsPage';
import DependencyPage from './pages/DependencyPage';
import WorkloadPage from './pages/WorkloadPage';
import TimeTrackingPage from './pages/TimeTrackingPage';
import SyncPage from './pages/SyncPage';
import { useAuth } from './contexts/AuthContext';
import LoadingSpinner from './components/LoadingSpinner';

function App() {
    console.log('App component rendering...');

    const { user, loading, isAuthenticated } = useAuth();

    console.log('Auth state:', { user, loading, isAuthenticated });

    if (loading) {
        console.log('Showing loading spinner');
        return <LoadingSpinner />;
    }

    if (!user && !isAuthenticated) {
        console.log('User not authenticated, showing login');
        return (
            <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
            </Routes>
        );
    }

    console.log('User authenticated, showing main app');
    return (
        <Layout>
            <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/issues" element={<IssuesPage />} />
                <Route path="/issues/:owner/:repo/:number" element={<IssueDetailPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/dependencies" element={<DependencyPage />} />
                <Route path="/workload" element={<WorkloadPage />} />
                <Route path="/time-tracking" element={<TimeTrackingPage />} />
                <Route path="/sync" element={<SyncPage />} />
                <Route path="/login" element={<Navigate to="/dashboard" replace />} />
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
        </Layout>
    );
}

export default App;