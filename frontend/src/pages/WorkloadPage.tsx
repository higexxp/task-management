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
    Slider,
    Switch,
    FormControlLabel,
    LinearProgress,
    Avatar,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Work as WorkIcon,
    Warning as WarningIcon,
    TrendingUp as TrendingUpIcon,
    Settings as SettingsIcon,
    Person as PersonIcon,
    Assignment as AssignmentIcon,
    Schedule as ScheduleIcon,
    Balance as BalanceIcon,
    Lightbulb as SuggestionIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workloadApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import BarChart from '../components/charts/BarChart';
import LineChart from '../components/charts/LineChart';

interface WorkloadMetrics {
    assignee: string;
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    estimatedHours: number;
    actualHours: number;
    overloadRisk: 'low' | 'medium' | 'high';
    efficiency: number;
    priorityBreakdown: Record<string, number>;
    sizeBreakdown: Record<string, number>;
}

interface TeamWorkload {
    totalMembers: number;
    totalIssues: number;
    totalEstimatedHours: number;
    averageIssuesPerMember: number;
    averageHoursPerMember: number;
    workloadBalance: number;
    overloadedMembers: string[];
    underloadedMembers: string[];
    memberMetrics: WorkloadMetrics[];
}

function WorkloadPage() {
    const [repository, setRepository] = useState('');
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settings, setSettings] = useState({
        maxIssuesPerMember: 10,
        maxHoursPerMember: 40,
        sizeToHoursMapping: {
            small: 2,
            medium: 8,
            large: 20,
        },
        overloadThreshold: 150,
        underloadThreshold: 50,
    });

    const [owner, repo] = repository.split('/');
    const isValidRepo = owner && repo;

    const queryClient = useQueryClient();

    // Fetch workload data
    const { data: workloadData, isLoading: workloadLoading, error: workloadError, refetch: refetchWorkload } = useQuery({
        queryKey: ['workload', owner, repo, settings],
        queryFn: () => workloadApi.getWorkload(owner, repo, settings),
        enabled: isValidRepo,
    });

    // Fetch workload trends
    const { data: trendsData, isLoading: trendsLoading, refetch: refetchTrends } = useQuery({
        queryKey: ['workload', 'trends', owner, repo, settings],
        queryFn: () => workloadApi.getWorkloadTrends(owner, repo, '30d', settings),
        enabled: isValidRepo,
    });

    // Fetch settings
    const { data: settingsData } = useQuery({
        queryKey: ['workload', 'settings', owner, repo],
        queryFn: () => workloadApi.getSettings(owner, repo),
        enabled: isValidRepo,
        onSuccess: (data) => {
            if (data?.data?.data) {
                setSettings(data.data.data);
            }
        },
    });

    // Update settings mutation
    const updateSettingsMutation = useMutation({
        mutationFn: (newSettings: any) => workloadApi.updateSettings(owner, repo, newSettings),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['workload', owner, repo] });
            setSettingsOpen(false);
        },
    });

    // Generate suggestions mutation
    const generateSuggestionsMutation = useMutation({
        mutationFn: () => workloadApi.generateRebalancingSuggestions(owner, repo, settings),
    });

    const handleRefresh = () => {
        refetchWorkload();
        refetchTrends();
    };

    const handleSettingsUpdate = () => {
        updateSettingsMutation.mutate(settings);
    };

    const handleGenerateSuggestions = () => {
        generateSuggestionsMutation.mutate();
    };

    const isLoading = workloadLoading || trendsLoading;
    const teamWorkload: TeamWorkload | undefined = workloadData?.data?.data?.teamWorkload;
    const rebalancingSuggestions = workloadData?.data?.data?.rebalancingSuggestions;
    const trends = trendsData?.data?.data?.trends || [];

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'high': return 'error';
            case 'medium': return 'warning';
            case 'low': return 'success';
            default: return 'default';
        }
    };

    const getEfficiencyColor = (efficiency: number) => {
        if (efficiency > 1.2) return 'error';
        if (efficiency > 0.8) return 'success';
        return 'warning';
    };

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <div>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Workload Management
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Monitor and balance team workload distribution
                    </Typography>
                </div>
                <Box display="flex" gap={1}>
                    <Button
                        variant="outlined"
                        startIcon={<SettingsIcon />}
                        onClick={() => setSettingsOpen(true)}
                        disabled={!isValidRepo}
                    >
                        Settings
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
                                helperText="Enter a repository to view workload metrics"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
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
            {workloadError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load workload data. Please check the repository name and try again.
                </Alert>
            )}

            {/* Loading State */}
            {isLoading && isValidRepo && (
                <LoadingSpinner message="Loading workload data..." />
            )}

            {/* No Repository Selected */}
            {!isValidRepo && (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <WorkIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Select a Repository
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Enter a repository name (owner/repo) above to view workload metrics and team balance.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Main Content */}
            {teamWorkload && !isLoading && (
                <>
                    {/* Overview Cards */}
                    <Grid container spacing={3} sx={{ mb: 3 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Card>
                                <CardContent>
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <div>
                                            <Typography color="text.secondary" gutterBottom>
                                                Team Members
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {teamWorkload.totalMembers}
                                            </Typography>
                                            <Typography variant="body2" color="primary.main">
                                                Active contributors
                                            </Typography>
                                        </div>
                                        <PersonIcon sx={{ fontSize: 40, color: 'primary.main' }} />
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
                                                Total Issues
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {teamWorkload.totalIssues}
                                            </Typography>
                                            <Typography variant="body2" color="info.main">
                                                {teamWorkload.averageIssuesPerMember.toFixed(1)} avg per member
                                            </Typography>
                                        </div>
                                        <AssignmentIcon sx={{ fontSize: 40, color: 'info.main' }} />
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
                                                Estimated Hours
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {teamWorkload.totalEstimatedHours}h
                                            </Typography>
                                            <Typography variant="body2" color="warning.main">
                                                {teamWorkload.averageHoursPerMember.toFixed(1)}h avg per member
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
                                                Workload Balance
                                            </Typography>
                                            <Typography variant="h4" component="div">
                                                {Math.round(teamWorkload.workloadBalance * 100)}%
                                            </Typography>
                                            <Typography variant="body2" color="success.main">
                                                Distribution quality
                                            </Typography>
                                        </div>
                                        <BalanceIcon sx={{ fontSize: 40, color: 'success.main' }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>

                    {/* Alerts */}
                    {teamWorkload.overloadedMembers.length > 0 && (
                        <Alert severity="warning" sx={{ mb: 3 }}>
                            <Box display="flex" alignItems="center" gap={1}>
                                <WarningIcon />
                                <Typography variant="body2">
                                    Overloaded members detected: {teamWorkload.overloadedMembers.join(', ')}
                                </Typography>
                                <Button
                                    size="small"
                                    startIcon={<SuggestionIcon />}
                                    onClick={handleGenerateSuggestions}
                                    disabled={generateSuggestionsMutation.isLoading}
                                >
                                    Get Suggestions
                                </Button>
                            </Box>
                        </Alert>
                    )}

                    <Grid container spacing={3}>
                        {/* Team Members List */}
                        <Grid item xs={12} md={8}>
                            <Card>
                                <CardContent>
                                    <Typography variant="h6" gutterBottom>
                                        Team Member Workload
                                    </Typography>
                                    <Divider sx={{ mb: 2 }} />

                                    <List>
                                        {teamWorkload.memberMetrics.map((member) => (
                                            <ListItem key={member.assignee} sx={{ px: 0 }}>
                                                <ListItemIcon>
                                                    <Avatar sx={{ width: 32, height: 32 }}>
                                                        {member.assignee.charAt(0).toUpperCase()}
                                                    </Avatar>
                                                </ListItemIcon>
                                                <ListItemText
                                                    primary={
                                                        <Box display="flex" alignItems="center" gap={1}>
                                                            <Typography variant="body1" fontWeight="bold">
                                                                {member.assignee}
                                                            </Typography>
                                                            <Chip
                                                                label={member.overloadRisk}
                                                                color={getRiskColor(member.overloadRisk) as any}
                                                                size="small"
                                                            />
                                                        </Box>
                                                    }
                                                    secondary={
                                                        <Box>
                                                            <Typography variant="body2" color="text.secondary">
                                                                {member.totalIssues} issues ({member.openIssues} open) • {member.estimatedHours}h estimated
                                                            </Typography>
                                                            <Box display="flex" alignItems="center" gap={1} mt={1}>
                                                                <Typography variant="caption">Efficiency:</Typography>
                                                                <Chip
                                                                    label={`${Math.round(member.efficiency * 100)}%`}
                                                                    color={getEfficiencyColor(member.efficiency) as any}
                                                                    size="small"
                                                                    variant="outlined"
                                                                />
                                                            </Box>
                                                            <LinearProgress
                                                                variant="determinate"
                                                                value={Math.min((member.totalIssues / settings.maxIssuesPerMember) * 100, 100)}
                                                                sx={{ mt: 1, height: 6, borderRadius: 3 }}
                                                                color={member.overloadRisk === 'high' ? 'error' : member.overloadRisk === 'medium' ? 'warning' : 'primary'}
                                                            />
                                                        </Box>
                                                    }
                                                />
                                            </ListItem>
                                        ))}
                                    </List>
                                </CardContent>
                            </Card>
                        </Grid>

                        {/* Workload Distribution Chart */}
                        <Grid item xs={12} md={4}>
                            <BarChart
                                title="Issues by Member"
                                data={teamWorkload.memberMetrics.reduce((acc, member) => {
                                    acc[member.assignee] = member.totalIssues;
                                    return acc;
                                }, {} as Record<string, number>)}
                                height={400}
                                horizontal
                            />
                        </Grid>

                        {/* Workload Trends */}
                        {trends.length > 0 && (
                            <Grid item xs={12}>
                                <LineChart
                                    title="Workload Balance Trends"
                                    data={trends.map(trend => ({
                                        date: trend.date,
                                        created: trend.workloadBalance * 100,
                                        closed: trend.overloadedCount,
                                        open: trend.totalMembers,
                                    }))}
                                    height={300}
                                />
                            </Grid>
                        )}

                        {/* Rebalancing Suggestions */}
                        {rebalancingSuggestions && rebalancingSuggestions.suggestions.length > 0 && (
                            <Grid item xs={12}>
                                <Card>
                                    <CardContent>
                                        <Typography variant="h6" gutterBottom>
                                            Rebalancing Suggestions
                                        </Typography>
                                        <Divider sx={{ mb: 2 }} />

                                        <List>
                                            {rebalancingSuggestions.suggestions.map((suggestion, index) => (
                                                <ListItem key={index}>
                                                    <ListItemIcon>
                                                        <SuggestionIcon color="primary" />
                                                    </ListItemIcon>
                                                    <ListItemText
                                                        primary={
                                                            suggestion.type === 'reassign'
                                                                ? `Reassign ${suggestion.issueCount} issues from ${suggestion.from} to ${suggestion.to}`
                                                                : `${suggestion.type} workload for ${suggestion.from || suggestion.to}`
                                                        }
                                                        secondary={suggestion.reason}
                                                    />
                                                </ListItem>
                                            ))}
                                        </List>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </>
            )}

            {/* Settings Dialog */}
            <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="md" fullWidth>
                <DialogTitle>Workload Settings</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <Grid container spacing={3}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Max Issues per Member
                                </Typography>
                                <Slider
                                    value={settings.maxIssuesPerMember}
                                    onChange={(_, value) => setSettings({ ...settings, maxIssuesPerMember: value as number })}
                                    min={1}
                                    max={20}
                                    marks
                                    valueLabelDisplay="auto"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Max Hours per Member
                                </Typography>
                                <Slider
                                    value={settings.maxHoursPerMember}
                                    onChange={(_, value) => setSettings({ ...settings, maxHoursPerMember: value as number })}
                                    min={10}
                                    max={80}
                                    step={5}
                                    marks
                                    valueLabelDisplay="auto"
                                />
                            </Grid>

                            <Grid item xs={12}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Size to Hours Mapping
                                </Typography>
                                <Grid container spacing={2}>
                                    <Grid item xs={4}>
                                        <TextField
                                            fullWidth
                                            label="Small"
                                            type="number"
                                            value={settings.sizeToHoursMapping.small}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                sizeToHoursMapping: {
                                                    ...settings.sizeToHoursMapping,
                                                    small: parseInt(e.target.value) || 1,
                                                },
                                            })}
                                        />
                                    </Grid>
                                    <Grid item xs={4}>
                                        <TextField
                                            fullWidth
                                            label="Medium"
                                            type="number"
                                            value={settings.sizeToHoursMapping.medium}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                sizeToHoursMapping: {
                                                    ...settings.sizeToHoursMapping,
                                                    medium: parseInt(e.target.value) || 1,
                                                },
                                            })}
                                        />
                                    </Grid>
                                    <Grid item xs={4}>
                                        <TextField
                                            fullWidth
                                            label="Large"
                                            type="number"
                                            value={settings.sizeToHoursMapping.large}
                                            onChange={(e) => setSettings({
                                                ...settings,
                                                sizeToHoursMapping: {
                                                    ...settings.sizeToHoursMapping,
                                                    large: parseInt(e.target.value) || 1,
                                                },
                                            })}
                                        />
                                    </Grid>
                                </Grid>
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Overload Threshold (%)
                                </Typography>
                                <Slider
                                    value={settings.overloadThreshold}
                                    onChange={(_, value) => setSettings({ ...settings, overloadThreshold: value as number })}
                                    min={110}
                                    max={200}
                                    step={10}
                                    marks
                                    valueLabelDisplay="auto"
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                <Typography variant="subtitle2" gutterBottom>
                                    Underload Threshold (%)
                                </Typography>
                                <Slider
                                    value={settings.underloadThreshold}
                                    onChange={(_, value) => setSettings({ ...settings, underloadThreshold: value as number })}
                                    min={10}
                                    max={90}
                                    step={10}
                                    marks
                                    valueLabelDisplay="auto"
                                />
                            </Grid>
                        </Grid>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSettingsOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSettingsUpdate}
                        variant="contained"
                        disabled={updateSettingsMutation.isLoading}
                    >
                        Save Settings
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default WorkloadPage;