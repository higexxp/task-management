import React, { useState } from 'react';
import {
    Box,
    Typography,
    Grid,
    Card,
    CardContent,
    TextField,
    Button,
    Alert,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton,
    Tooltip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    LinearProgress,
    Tab,
    Tabs,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Schedule as TimeIcon,
    TrendingUp as TrendingUpIcon,
    Assessment as ReportIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Timer as TimerIcon,
    Group as TeamIcon,
    ShowChart as BurndownIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { timeTrackingApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import LineChart from '../components/charts/LineChart';
import BarChart from '../components/charts/BarChart';
import PieChart from '../components/charts/PieChart';

interface TabPanelProps {
    children?: React.ReactNode;
    index: number;
    value: number;
}

function TabPanel(props: TabPanelProps) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`time-tracking-tabpanel-${index}`}
            aria-labelledby={`time-tracking-tab-${index}`}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

function TimeTrackingPage() {
    const [repository, setRepository] = useState('');
    const [period, setPeriod] = useState('30d');
    const [tabValue, setTabValue] = useState(0);
    const [addTimeDialogOpen, setAddTimeDialogOpen] = useState(false);
    const [estimateDialogOpen, setEstimateDialogOpen] = useState(false);
    const [selectedIssue, setSelectedIssue] = useState<number | null>(null);
    const [timeEntry, setTimeEntry] = useState({
        timeSpent: '',
        description: '',
        category: 'development',
    });
    const [estimate, setEstimate] = useState('');

    const [owner, repo] = repository.split('/');
    const isValidRepo = owner && repo;

    const queryClient = useQueryClient();

    // Parse duration string to minutes
    const parseDuration = (durationStr: string): number => {
        const hourMatch = durationStr.match(/(\\d+(?:\\.\\d+)?)h/);
        const minuteMatch = durationStr.match(/(\\d+)m/);

        let totalMinutes = 0;

        if (hourMatch) {
            totalMinutes += parseFloat(hourMatch[1]) * 60;
        }

        if (minuteMatch) {
            totalMinutes += parseInt(minuteMatch[1]);
        }

        // If no h or m suffix, assume minutes
        if (!hourMatch && !minuteMatch && /^\\d+$/.test(durationStr)) {
            totalMinutes = parseInt(durationStr);
        }

        return Math.round(totalMinutes);
    };

    // Fetch time tracking data
    const { data: reportData, isLoading: reportLoading, error: reportError, refetch: refetchReport } = useQuery({
        queryKey: ['time-tracking', 'report', owner, repo, period],
        queryFn: () => timeTrackingApi.getTimeReport(owner, repo, { period }),
        enabled: isValidRepo,
    });

    const { data: teamStatsData, isLoading: teamStatsLoading, refetch: refetchTeamStats } = useQuery({
        queryKey: ['time-tracking', 'team-stats', owner, repo, period],
        queryFn: () => timeTrackingApi.getTimeStats(owner, repo, { period }),
        enabled: isValidRepo,
    });

    const { data: burndownData, isLoading: burndownLoading, refetch: refetchBurndown } = useQuery({
        queryKey: ['time-tracking', 'burndown', owner, repo],
        queryFn: () => {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 30);
            return timeTrackingApi.getTimeReport(owner, repo, {
                startDate: startDate.toISOString().split('T')[0],
                endDate: endDate.toISOString().split('T')[0]
            });
        },
        enabled: isValidRepo,
    });

    // Add time entry mutation
    const addTimeEntryMutation = useMutation({
        mutationFn: (data: { issueNumber: number; timeSpent: string; description: string; category: string }) => {
            // Parse time spent to minutes
            const duration = parseDuration(data.timeSpent);
            return timeTrackingApi.addManualEntry(owner, repo, data.issueNumber, {
                userId: 'current-user',
                duration,
                description: data.description,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
            setAddTimeDialogOpen(false);
            setTimeEntry({ timeSpent: '', description: '', category: 'development' });
            setSelectedIssue(null);
        },
    });

    // Update estimate mutation (disabled for now as API doesn't exist)
    const updateEstimateMutation = useMutation({
        mutationFn: (data: { issueNumber: number; estimate: string }) => {
            // This API doesn't exist yet, so we'll just return a resolved promise
            return Promise.resolve({ data: { success: true } });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['time-tracking'] });
            setEstimateDialogOpen(false);
            setEstimate('');
            setSelectedIssue(null);
        },
    });

    const handleRefresh = () => {
        refetchReport();
        refetchTeamStats();
        refetchBurndown();
    };

    const handleAddTimeEntry = () => {
        if (selectedIssue && timeEntry.timeSpent && timeEntry.description) {
            addTimeEntryMutation.mutate({
                issueNumber: selectedIssue,
                timeSpent: timeEntry.timeSpent,
                description: timeEntry.description,
                category: timeEntry.category,
            });
        }
    };

    const handleUpdateEstimate = () => {
        if (selectedIssue && estimate) {
            updateEstimateMutation.mutate({
                issueNumber: selectedIssue,
                estimate,
            });
        }
    };

    const isLoading = reportLoading || teamStatsLoading || burndownLoading;
    const report = reportData?.data?.data;
    const teamStats = teamStatsData?.data?.data;
    const burndown = burndownData?.data?.data || [];

    // Extract summary data from the new API structure
    const summary = report?.summary || {
        totalMinutes: 0,
        totalHours: 0,
        entriesCount: 0,
        averageSessionMinutes: 0,
        longestSessionMinutes: 0,
        shortestSessionMinutes: 0,
        activeDays: 0,
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'success';
            case 'over-budget': return 'error';
            case 'on-track': return 'primary';
            default: return 'default';
        }
    };

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <div>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Time Tracking
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Track time spent on issues and monitor project progress
                    </Typography>
                </div>
                <Box display="flex" gap={1}>
                    <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => setAddTimeDialogOpen(true)}
                        disabled={!isValidRepo}
                    >
                        Add Time
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefresh}
                        disabled={!isValidRepo || isLoading}
                    >
                        Refresh
                    </Button>
                </Box>
            </Box>

            {/* Controls */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Repository (owner/repo)"
                                value={repository}
                                onChange={(e) => setRepository(e.target.value)}
                                placeholder="e.g., facebook/react"
                                helperText="Enter a repository to view time tracking data"
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
            {reportError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load time tracking data. Please check the repository name and try again.
                </Alert>
            )}

            {/* Loading State */}
            {isLoading && isValidRepo && (
                <LoadingSpinner message="Loading time tracking data..." />
            )}

            {/* No Repository Selected */}
            {!isValidRepo && (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <TimeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Select a Repository
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Enter a repository name (owner/repo) above to view time tracking data and reports.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Main Content */}
            {report && !isLoading && (
                <>
                    {/* Overview Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Total Time Spent
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {Math.round(summary.totalMinutes / 60)}h
                                            </Typography>
                                            <Typography variant="body2" color="primary.main">
                                                {summary.totalMinutes % 60}m additional
                                            </Typography>
                                        </div>
                                        <TimerIcon sx={{ fontSize: 40, color: 'primary.main' }} />
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
                                                Total Estimated
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                0h
                                            </Typography>
                                            <Typography variant="body2" color="info.main">
                                                No estimates available
                                            </Typography>
                                        </div>
                                        <ReportIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                                                {summary.entriesCount}
                                            </Typography>
                                            <Typography variant="body2" color="success.main">
                                                Time entries
                                            </Typography>
                                        </div>
                                        <TrendingUpIcon sx={{ fontSize: 40, color: 'success.main' }} />
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
                                                Efficiency
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {summary.activeDays}
                                            </Typography>
                                            <Typography variant="body2" color="warning.main">
                                                Active days
                                            </Typography>
                                        </div>
                                        <BurndownIcon sx={{ fontSize: 40, color: 'warning.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Tabs */}
                    <Card>
                        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)}>
                                <Tab label="Issues" />
                                <Tab label="Team Stats" />
                                <Tab label="Burndown" />
                            </Tabs>
                        </Box>

                        {/* Issues Tab */}
                        <TabPanel value={tabValue} index={0}>
                            <TableContainer>
                                <Table>
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Issue</TableCell>
                                            <TableCell>Time Spent</TableCell>
                                            <TableCell>Estimated</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Date</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {report?.entries?.slice(0, 10).map((entry, index) => (
                                            <TableRow key={entry.id}>
                                                <TableCell>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="bold">
                                                            #{entry.issueNumber}
                                                        </Typography>
                                                        <Typography variant="caption" color="text.secondary">
                                                            {entry.description || 'No description'}
                                                        </Typography>
                                                    </Box>
                                                </TableCell>
                                                <TableCell>
                                                    {Math.floor(entry.duration / 60)}h {entry.duration % 60}m
                                                </TableCell>
                                                <TableCell>
                                                    Not set
                                                </TableCell>
                                                <TableCell>
                                                    <Chip
                                                        label={entry.isActive ? 'Active' : 'Completed'}
                                                        color={entry.isActive ? 'primary' : 'success'}
                                                        size="small"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Typography variant="body2" color="text.secondary">
                                                        {new Date(entry.startTime).toLocaleDateString()}
                                                    </Typography>
                                                </TableCell>
                                                <TableCell>
                                                    <Box display="flex" gap={1}>
                                                        <Tooltip title="Add Time">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    setSelectedIssue(entry.issueNumber);
                                                                    setAddTimeDialogOpen(true);
                                                                }}
                                                            >
                                                                <AddIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                        <Tooltip title="Edit Estimate">
                                                            <IconButton
                                                                size="small"
                                                                onClick={() => {
                                                                    setSelectedIssue(entry.issueNumber);
                                                                    setEstimateDialogOpen(true);
                                                                }}
                                                            >
                                                                <EditIcon />
                                                            </IconButton>
                                                        </Tooltip>
                                                    </Box>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        </TabPanel>

                        {/* Team Stats Tab */}
                        <TabPanel value={tabValue} index={1}>
                            <Typography variant="h6" color="text.secondary" textAlign="center" py={4}>
                                Team statistics are not available yet.
                            </Typography>
                            {false && teamStats && (
                                <Grid container spacing={3}>
                                    <Grid item xs={12} md={6}>
                                        <BarChart
                                            title="Time Spent by Team Member"
                                            data={Object.entries(teamStats.memberStats).reduce((acc, [member, stats]) => {
                                                acc[member] = Math.round(stats.totalTimeSpent / 60);
                                                return acc;
                                            }, {} as Record<string, number>)}
                                            height={300}
                                        />
                                    </Grid>
                                    <Grid item xs={12} md={6}>
                                        <BarChart
                                            title="Efficiency by Team Member"
                                            data={Object.entries(teamStats.memberStats).reduce((acc, [member, stats]) => {
                                                acc[member] = Math.round(stats.efficiency * 100);
                                                return acc;
                                            }, {} as Record<string, number>)}
                                            height={300}
                                        />
                                    </Grid>
                                    <Grid item xs={12}>
                                        <Card>
                                            <CardContent>
                                                <Typography variant="h6" gutterBottom>
                                                    Team Summary
                                                </Typography>
                                                <Grid container spacing={2}>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Total Members
                                                        </Typography>
                                                        <Typography variant="h6">
                                                            {teamStats.summary.totalMembers}
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Total Time Spent
                                                        </Typography>
                                                        <Typography variant="h6">
                                                            {Math.round(teamStats.summary.totalTimeSpent / 60)}h
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Total Estimated
                                                        </Typography>
                                                        <Typography variant="h6">
                                                            {Math.round(teamStats.summary.totalEstimated / 60)}h
                                                        </Typography>
                                                    </Grid>
                                                    <Grid item xs={12} sm={6} md={3}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Average Efficiency
                                                        </Typography>
                                                        <Typography variant="h6">
                                                            {Math.round(teamStats.summary.averageEfficiency * 100)}%
                                                        </Typography>
                                                    </Grid>
                                                </Grid>
                                            </CardContent>
                                        </Card>
                                    </Grid>
                                </Grid>
                            )}
                        </TabPanel>

                        {/* Burndown Tab */}
                        <TabPanel value={tabValue} index={2}>
                            <Typography variant="h6" color="text.secondary" textAlign="center" py={4}>
                                Burndown chart is not available yet.
                            </Typography>
                            {false && burndown.length > 0 && (
                                <LineChart
                                    title="Burndown Chart"
                                    data={burndown.map(item => ({
                                        date: item.date,
                                        created: Math.round(item.remainingWork / 60), // Remaining work in hours
                                        closed: Math.round(item.idealRemaining / 60), // Ideal remaining in hours
                                        open: Math.round(item.actualWork / 60), // Actual work in hours
                                    }))}
                                    height={400}
                                />
                            )}
                        </TabPanel>
                    </Card>
                </>
            )}

            {/* Add Time Entry Dialog */}
            <Dialog open={addTimeDialogOpen} onClose={() => setAddTimeDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Time Entry</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Issue Number"
                            type="number"
                            value={selectedIssue || ''}
                            onChange={(e) => setSelectedIssue(parseInt(e.target.value) || null)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Time Spent"
                            value={timeEntry.timeSpent}
                            onChange={(e) => setTimeEntry({ ...timeEntry, timeSpent: e.target.value })}
                            placeholder="e.g., 2h, 30m, 1h30m"
                            helperText="Use formats like 2h, 30m, or 1h30m"
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Description"
                            value={timeEntry.description}
                            onChange={(e) => setTimeEntry({ ...timeEntry, description: e.target.value })}
                            multiline
                            rows={3}
                            sx={{ mb: 2 }}
                        />
                        <FormControl fullWidth>
                            <InputLabel>Category</InputLabel>
                            <Select
                                value={timeEntry.category}
                                label="Category"
                                onChange={(e) => setTimeEntry({ ...timeEntry, category: e.target.value })}
                            >
                                <MenuItem value="development">Development</MenuItem>
                                <MenuItem value="testing">Testing</MenuItem>
                                <MenuItem value="review">Review</MenuItem>
                                <MenuItem value="documentation">Documentation</MenuItem>
                                <MenuItem value="meeting">Meeting</MenuItem>
                                <MenuItem value="other">Other</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddTimeDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleAddTimeEntry}
                        variant="contained"
                        disabled={!selectedIssue || !timeEntry.timeSpent || !timeEntry.description || addTimeEntryMutation.isLoading}
                    >
                        Add Time Entry
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Update Estimate Dialog */}
            <Dialog open={estimateDialogOpen} onClose={() => setEstimateDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Update Time Estimate</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Issue Number"
                            type="number"
                            value={selectedIssue || ''}
                            onChange={(e) => setSelectedIssue(parseInt(e.target.value) || null)}
                            sx={{ mb: 2 }}
                        />
                        <TextField
                            fullWidth
                            label="Estimate"
                            value={estimate}
                            onChange={(e) => setEstimate(e.target.value)}
                            placeholder="e.g., 8h, 2h30m, 480m"
                            helperText="Use formats like 8h, 2h30m, or 480m"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEstimateDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleUpdateEstimate}
                        variant="contained"
                        disabled={!selectedIssue || !estimate || updateEstimateMutation.isLoading}
                    >
                        Update Estimate
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default TimeTrackingPage;