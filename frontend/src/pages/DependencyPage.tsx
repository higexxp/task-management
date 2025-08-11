import React, { useState, useMemo } from 'react';
import {
    Box,
    Typography,
    Card,
    CardContent,
    TextField,
    Button,
    Alert,
    Grid,
    Chip,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Switch,
    FormControlLabel,
    Divider,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    IconButton,
    Tooltip,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    AccountTree as DependencyIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
    Delete as DeleteIcon,
    Visibility as ViewIcon,
    VisibilityOff as HideIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi, dependenciesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import DependencyGraph from '../components/DependencyGraph';

interface Issue {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    priority?: 'high' | 'medium' | 'low';
    category?: string;
    size?: 'small' | 'medium' | 'large';
    assignee?: {
        login: string;
        avatar_url: string;
    };
}

interface Dependency {
    from: number;
    to: number;
    type: 'blocks' | 'depends_on' | 'related';
}

function DependencyPage() {
    const [repository, setRepository] = useState('');
    const [showClosedIssues, setShowClosedIssues] = useState(false);
    const [filterType, setFilterType] = useState<string>('all');
    const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null);

    const [owner, repo] = repository.split('/');
    const isValidRepo = owner && repo;

    const queryClient = useQueryClient();

    // Fetch issues
    const { data: issuesData, isLoading: issuesLoading, error: issuesError, refetch: refetchIssues } = useQuery({
        queryKey: ['issues', owner, repo],
        queryFn: () => issuesApi.getIssues(owner, repo),
        enabled: isValidRepo,
    });

    // Fetch dependencies
    const { data: dependenciesData, isLoading: dependenciesLoading, refetch: refetchDependencies } = useQuery({
        queryKey: ['dependencies', owner, repo],
        queryFn: () => dependenciesApi.getDependencies(owner, repo),
        enabled: isValidRepo,
    });

    // Add dependency mutation
    const addDependencyMutation = useMutation({
        mutationFn: ({ from, to, type }: { from: number; to: number; type: string }) =>
            dependenciesApi.addDependency(owner, repo, from, to, type),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dependencies', owner, repo] });
        },
    });

    // Remove dependency mutation
    const removeDependencyMutation = useMutation({
        mutationFn: ({ from, to }: { from: number; to: number }) =>
            dependenciesApi.removeDependency(owner, repo, from, to),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['dependencies', owner, repo] });
        },
    });

    const handleRefresh = () => {
        refetchIssues();
        refetchDependencies();
    };

    const handleDependencyAdd = (from: number, to: number, type: string) => {
        addDependencyMutation.mutate({ from, to, type });
    };

    const handleDependencyRemove = (from: number, to: number) => {
        removeDependencyMutation.mutate({ from, to });
    };

    const handleNodeClick = (issue: Issue) => {
        setSelectedIssue(issue);
    };

    const isLoading = issuesLoading || dependenciesLoading;
    const issues: Issue[] = issuesData?.data?.data || [];
    const dependencies: Dependency[] = dependenciesData?.data?.data || [];

    // Filter issues based on settings
    const filteredIssues = useMemo(() => {
        let filtered = issues;

        if (!showClosedIssues) {
            filtered = filtered.filter(issue => issue.state === 'open');
        }

        return filtered;
    }, [issues, showClosedIssues]);

    // Filter dependencies based on type
    const filteredDependencies = useMemo(() => {
        if (filterType === 'all') {
            return dependencies;
        }
        return dependencies.filter(dep => dep.type === filterType);
    }, [dependencies, filterType]);

    // Calculate dependency statistics
    const dependencyStats = useMemo(() => {
        const stats = {
            total: dependencies.length,
            blocks: dependencies.filter(d => d.type === 'blocks').length,
            dependsOn: dependencies.filter(d => d.type === 'depends_on').length,
            related: dependencies.filter(d => d.type === 'related').length,
            issuesWithDependencies: new Set([
                ...dependencies.map(d => d.from),
                ...dependencies.map(d => d.to),
            ]).size,
        };
        return stats;
    }, [dependencies]);

    // Find issues with most dependencies
    const issuesByDependencyCount = useMemo(() => {
        const counts: Record<number, { incoming: number; outgoing: number; issue: Issue }> = {};

        dependencies.forEach(dep => {
            if (!counts[dep.from]) {
                counts[dep.from] = { incoming: 0, outgoing: 0, issue: issues.find(i => i.number === dep.from)! };
            }
            if (!counts[dep.to]) {
                counts[dep.to] = { incoming: 0, outgoing: 0, issue: issues.find(i => i.number === dep.to)! };
            }

            counts[dep.from].outgoing++;
            counts[dep.to].incoming++;
        });

        return Object.entries(counts)
            .map(([issueNumber, data]) => ({
                issueNumber: parseInt(issueNumber),
                ...data,
                total: data.incoming + data.outgoing,
            }))
            .sort((a, b) => b.total - a.total)
            .slice(0, 5);
    }, [dependencies, issues]);

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <div>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Dependency Visualization
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Visualize and manage issue dependencies
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

            {/* Controls */}
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
                                helperText="Enter a repository to view dependencies"
                            />
                        </Grid>
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Filter Type</InputLabel>
                                <Select
                                    value={filterType}
                                    label="Filter Type"
                                    onChange={(e) => setFilterType(e.target.value)}
                                    disabled={!isValidRepo}
                                >
                                    <MenuItem value="all">All Types</MenuItem>
                                    <MenuItem value="blocks">Blocks</MenuItem>
                                    <MenuItem value="depends_on">Depends On</MenuItem>
                                    <MenuItem value="related">Related</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={showClosedIssues}
                                        onChange={(e) => setShowClosedIssues(e.target.checked)}
                                        disabled={!isValidRepo}
                                    />
                                }
                                label="Show Closed Issues"
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
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
            {issuesError && (
                <Alert severity="error" sx={{ mb: 3 }}>
                    Failed to load dependency data. Please check the repository name and try again.
                </Alert>
            )}

            {/* Loading State */}
            {isLoading && isValidRepo && (
                <LoadingSpinner message="Loading dependency data..." />
            )}

            {/* No Repository Selected */}
            {!isValidRepo && (
                <Card>
                    <CardContent>
                        <Box textAlign="center" py={4}>
                            <DependencyIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                Select a Repository
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Enter a repository name (owner/repo) above to visualize issue dependencies.
                            </Typography>
                        </Box>
                    </CardContent>
                </Card>
            )}

            {/* Main Content */}
            {isValidRepo && !isLoading && (
                <Grid container spacing={3}>
                    {/* Statistics Panel */}
                    <Grid item xs={12} md={4}>
                        <Card sx={{ mb: 3 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Dependency Statistics
                                </Typography>
                                <Divider sx={{ mb: 2 }} />

                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Total Dependencies:</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {dependencyStats.total}
                                    </Typography>
                                </Box>

                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Blocks:</Typography>
                                    <Typography variant="body2" color="error.main">
                                        {dependencyStats.blocks}
                                    </Typography>
                                </Box>

                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Depends On:</Typography>
                                    <Typography variant="body2" color="primary.main">
                                        {dependencyStats.dependsOn}
                                    </Typography>
                                </Box>

                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Related:</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        {dependencyStats.related}
                                    </Typography>
                                </Box>

                                <Box display="flex" justifyContent="space-between">
                                    <Typography variant="body2">Issues with Dependencies:</Typography>
                                    <Typography variant="body2" fontWeight="bold">
                                        {dependencyStats.issuesWithDependencies}
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>

                        {/* Most Connected Issues */}
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Most Connected Issues
                                </Typography>
                                <Divider sx={{ mb: 2 }} />

                                <List dense>
                                    {issuesByDependencyCount.map((item) => (
                                        <ListItem key={item.issueNumber} sx={{ px: 0 }}>
                                            <ListItemIcon>
                                                <DependencyIcon fontSize="small" />
                                            </ListItemIcon>
                                            <ListItemText
                                                primary={`#${item.issueNumber} - ${item.issue?.title || 'Unknown'}`}
                                                secondary={`${item.incoming} incoming, ${item.outgoing} outgoing`}
                                                primaryTypographyProps={{ variant: 'body2' }}
                                                secondaryTypographyProps={{ variant: 'caption' }}
                                            />
                                            <Typography variant="caption" color="primary">
                                                {item.total}
                                            </Typography>
                                        </ListItem>
                                    ))}
                                    {issuesByDependencyCount.length === 0 && (
                                        <ListItem>
                                            <ListItemText
                                                primary="No dependencies found"
                                                secondary="Add dependencies to see statistics"
                                            />
                                        </ListItem>
                                    )}
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>

                    {/* Dependency Graph */}
                    <Grid item xs={12} md={8}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Dependency Graph
                                </Typography>
                                <Divider sx={{ mb: 2 }} />

                                {filteredIssues.length > 0 ? (
                                    <DependencyGraph
                                        issues={filteredIssues}
                                        dependencies={filteredDependencies}
                                        onDependencyAdd={handleDependencyAdd}
                                        onDependencyRemove={handleDependencyRemove}
                                        onNodeClick={handleNodeClick}
                                    />
                                ) : (
                                    <Box textAlign="center" py={4}>
                                        <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                                        <Typography variant="body1" color="text.secondary">
                                            No issues found for this repository
                                        </Typography>
                                    </Box>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* Selected Issue Details */}
            {selectedIssue && (
                <Card sx={{ mt: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Selected Issue Details
                        </Typography>
                        <Divider sx={{ mb: 2 }} />

                        <Grid container spacing={2}>
                            <Grid item xs={12} md={6}>
                                <Typography variant="body2" color="text.secondary">
                                    Issue Number:
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    #{selectedIssue.number}
                                </Typography>

                                <Typography variant="body2" color="text.secondary">
                                    Title:
                                </Typography>
                                <Typography variant="body1" gutterBottom>
                                    {selectedIssue.title}
                                </Typography>

                                <Typography variant="body2" color="text.secondary">
                                    State:
                                </Typography>
                                <Chip
                                    label={selectedIssue.state}
                                    color={selectedIssue.state === 'open' ? 'primary' : 'success'}
                                    size="small"
                                    sx={{ mb: 2 }}
                                />
                            </Grid>

                            <Grid item xs={12} md={6}>
                                {selectedIssue.priority && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            Priority:
                                        </Typography>
                                        <Chip
                                            label={selectedIssue.priority}
                                            color={
                                                selectedIssue.priority === 'high' ? 'error' :
                                                    selectedIssue.priority === 'medium' ? 'warning' : 'success'
                                            }
                                            size="small"
                                            sx={{ mb: 1 }}
                                        />
                                    </>
                                )}

                                {selectedIssue.category && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            Category:
                                        </Typography>
                                        <Chip
                                            label={selectedIssue.category}
                                            variant="outlined"
                                            size="small"
                                            sx={{ mb: 1 }}
                                        />
                                    </>
                                )}

                                {selectedIssue.assignee && (
                                    <>
                                        <Typography variant="body2" color="text.secondary">
                                            Assignee:
                                        </Typography>
                                        <Box display="flex" alignItems="center" gap={1}>
                                            <img
                                                src={selectedIssue.assignee.avatar_url}
                                                alt={selectedIssue.assignee.login}
                                                style={{ width: 24, height: 24, borderRadius: '50%' }}
                                            />
                                            <Typography variant="body2">
                                                {selectedIssue.assignee.login}
                                            </Typography>
                                        </Box>
                                    </>
                                )}
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}
        </Box>
    );
}

export default DependencyPage;