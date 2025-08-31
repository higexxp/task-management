import React, { useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Button,
    Alert,
    Chip,
    Divider,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    TrendingUp as TrendingUpIcon,
    Assessment as AssessmentIcon,
    Group as GroupIcon,
    Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PieChart from '../components/charts/PieChart';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';

function AnalyticsPage() {
    const [repository, setRepository] = useState('');
    const [period, setPeriod] = useState('30d');
    const [granularity, setGranularity] = useState('day');

    const [owner, repo] = repository.split('/');
    const isValidRepo = owner && repo;

    // Fetch analytics data
    const { data: overviewData, isLoading: overviewLoading, error: overviewError, refetch: refetchOverview } = useQuery({
        queryKey: ['analytics', 'overview', owner, repo, period],
        queryFn: () => analyticsApi.getOverview(owner, repo, period),
        enabled: isValidRepo,
    });

    const { data: timeSeriesData, isLoading: timeSeriesLoading, refetch: refetchTimeSeries } = useQuery({
        queryKey: ['analytics', 'timeseries', owner, repo, period, granularity],
        queryFn: () => analyticsApi.getTimeSeries(owner, repo, period, granularity),
        enabled: isValidRepo,
    });

    const { data: teamData, isLoading: teamLoading, refetch: refetchTeam } = useQuery({
        queryKey: ['analytics', 'team', owner, repo, period],
        queryFn: () => analyticsApi.getTeamMetrics(owner, repo, period),
        enabled: isValidRepo,
    });

    const handleRefresh = () => {
        refetchOverview();
        refetchTimeSeries();
        refetchTeam();
    };

    const isLoading = overviewLoading || timeSeriesLoading || teamLoading;
    const overview = overviewData?.data?.data;
    const timeSeries = timeSeriesData?.data?.data || [];
    const team = teamData?.data?.data;

    // Calculate KPIs
    const completionRate = overview ?
        Math.round((overview.closedIssues / overview.totalIssues) * 100) : 0;
    const avgTimeToClose = overview?.averageTimeToClose || 0;
    const totalTimeSpent = overview?.totalTimeSpent || 0;

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <div>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Analytics Dashboard
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Visualize your project progress and team performance
                    </Typography>
                </div>
                <Button
                    variant="outlined"
                    startIcon={<RefreshIcon />}
                    onClick={handleRefresh}
                    disabled={!isValidRepo || isLoading}
                >
                    Refresh
                </Button>
            </Box>

            {/* Filters */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={4}>
                            <TextField
                                fullWidth
                                label="Repository (owner/repo)"
                                value={repository}
                                onChange={(e) => setRepository(e.target.value)}
                                placeholder="e.g., facebook/react"
                                helperText="Enter a repository to view analytics"
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Period</InputLabel>
                                <Select
                                    value={period}
                                    label="Period"
                                    onChange={(e) => setPeriod(e.target.value)}
                                    disabled={!isValidRepo}
                                >
                                    <MenuItem value="7d">Last 7 days</MenuItem>
                                    <MenuItem value="30d">Last 30 days</MenuItem>
                                    <MenuItem value="90d">Last 90 days</MenuItem>
                                    <MenuItem value="365d">Last year</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Granularity</InputLabel>
                                <Select
                                    value={granularity}
                                    label="Granularity"
                                    onChange={(e) => setGranularity(e.target.value)}
                                    disabled={!isValidRepo}
                                >
                                    <MenuItem value="day">Daily</MenuItem>
                                    <MenuItem value="week">Weekly</MenuItem>
                                    <MenuItem value="month">Monthly</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={4}>
                            <Box display="flex" alignItems="center" gap={1}>
                                <Typography variant="body2" color="text.secondary">
                                    Status:
                                </Typography>
                                {isValidRepo ? (
                                    <Chip label="Connected" color="success" size="small" />
                                ) : (
                                    <Chip label="Enter Repository" color="default" size="small" />
                                )}
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Error State */}
            {overviewError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load analytics data. Please check the repository name and try again.
                </Alert>
            )}

            {/* Loading State */}
            {isLoading && isValidRepo && (
                <LoadingSpinner message="Loading analytics data..." />
            )}

            {/* No Repository Selected */}
            {!isValidRepo && (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <AssessmentIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Select a Repository
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Enter a repository name (owner/repo) above to view detailed analytics and insights.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Analytics Content */}
            {overview && !isLoading && (
                <>
                    {/* KPI Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Total Issues
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {overview.totalIssues}
                                            </Typography>
                                            <Typography variant="body2" color="success.main">
                                                {overview.openIssues} open, {overview.closedIssues} closed
                                            </Typography>
                                        </div>
                                        <TrendingUpIcon sx={{ fontSize: 40, color: 'primary.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Completion Rate
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {completionRate}%
                                            </Typography>
                                            <Typography variant="body2" color="info.main">
                                                Issues completed
                                            </Typography>
                                        </div>
                                        <AssessmentIcon sx={{ fontSize: 40, color: 'success.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Avg. Time to Close
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {avgTimeToClose}h
                                            </Typography>
                                            <Typography variant="body2" color="warning.main">
                                                Average resolution time
                                            </Typography>
                                        </div>
                                        <ScheduleIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Time Spent
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {totalTimeSpent}h
                                            </Typography>
                                            <Typography variant="body2" color="secondary.main">
                                                Total logged time
                                            </Typography>
                                        </div>
                                        <GroupIcon sx={{ fontSize: 40, color: 'secondary.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Charts */}
                    <Grid container spacing={3}>
                        {/* Time Series Chart */}
                        <Grid item xs={12}>
                            <LineChart
                                title="Issue Activity Over Time"
                                data={timeSeries}
                                height={350}
                            />
                        </Grid>

                        {/* Priority Distribution */}
                        <Grid item xs={12} md={6}>
                            <PieChart
                                title="Priority Distribution"
                                data={overview.priorityDistribution}
                                colors={['#d32f2f', '#ed6c02', '#2e7d32', '#757575']}
                            />
                        </Grid>

                        {/* Category Distribution */}
                        <Grid item xs={12} md={6}>
                            <PieChart
                                title="Category Distribution"
                                data={overview.categoryDistribution}
                                colors={['#d32f2f', '#1976d2', '#388e3c', '#7b1fa2', '#f57c00', '#757575']}
                            />
                        </Grid>

                        {/* Size Distribution */}
                        <Grid item xs={12} md={6}>
                            <BarChart
                                title="Size Distribution"
                                data={overview.sizeDistribution}
                            />
                        </Grid>

                        {/* Status Distribution */}
                        <Grid item xs={12} md={6}>
                            <BarChart
                                title="Status Distribution"
                                data={overview.statusDistribution}
                            />
                        </Grid>

                        {/* Team Performance */}
                        {team && (
                            <Grid item xs={12}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Team Performance
                                        </Typography>
                                        <Divider sx={{ mb: 2 }} />
                                        <Grid container spacing={2}>
                                            <Grid item xs={12} md={6}>
                                                <Typography variant="subtitle2" gutterBottom>
                                                    Contributors: {team.summary.totalContributors}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Most Active: {team.summary.mostActiveContributor}
                                                </Typography>
                                            </Grid>
                                            <Grid item xs={12} md={6}>
                                                <BarChart
                                                    title="Issues by Assignee"
                                                    data={team.byAssignee}
                                                    height={250}
                                                    horizontal
                                                />
                                            </Grid>
                                        </Grid>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </>
            )}
        </Box>
    );
}

export default AnalyticsPage;