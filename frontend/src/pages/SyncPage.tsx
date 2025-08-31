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
    LinearProgress,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    FormControlLabel,
    Switch,
    Tooltip,
    List,
    ListItem,
    ListItemText,
    ListItemIcon,
    Divider,
} from '@mui/material';
import {
    Refresh as RefreshIcon,
    Sync as SyncIcon,
    Clear as ClearIcon,
    Settings as SettingsIcon,
    CloudSync as CloudSyncIcon,
    Storage as StorageIcon,
    Speed as SpeedIcon,
    NetworkCheck as NetworkIcon,
    Warning as WarningIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    Info as InfoIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { syncApi } from '../services/api';
import { useWebSocket } from '../hooks/useWebSocket';
import LoadingSpinner from '../components/LoadingSpinner';

interface SyncStatus {
    repository: string;
    lastSync: string;
    status: 'idle' | 'syncing' | 'error';
    progress: {
        current: number;
        total: number;
        phase: string;
    };
    error?: string;
    stats: {
        issuesProcessed: number;
        labelsProcessed: number;
        cacheHits: number;
        cacheMisses: number;
    };
}

function SyncPage() {
    const [repository, setRepository] = useState('');
    const [syncDialogOpen, setSyncDialogOpen] = useState(false);
    const [selectedRepo, setSelectedRepo] = useState('');
    const [syncOptions, setSyncOptions] = useState({
        force: false,
        skipCache: false,
        batchSize: 50,
    });
    const [testMessage, setTestMessage] = useState('');
    const [testTarget, setTestTarget] = useState<'all' | 'repository' | 'user'>('all');

    const queryClient = useQueryClient();

    // WebSocket connection
    const webSocket = useWebSocket({
        userId: 'current-user', // In real app, get from auth context
        repositories: repository ? [repository] : [],
        onSyncStatus: (data) => {
            console.log('Sync status update:', data);
            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ['sync'] });
        },
        onIssueUpdate: (data) => {
            console.log('Issue update:', data);
        },
        onCacheUpdate: (data) => {
            console.log('Cache update:', data);
            queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
        },
        onTestMessage: (data) => {
            console.log('Test message received:', data);
        },
    });

    // Fetch sync statuses
    const { data: syncStatusesData, isLoading: syncStatusesLoading, refetch: refetchSyncStatuses } = useQuery({
        queryKey: ['sync', 'statuses'],
        queryFn: () => syncApi.getAllSyncStatuses(),
        refetchInterval: 5000, // Refetch every 5 seconds
    });

    // Fetch cache stats
    const { data: cacheStatsData, isLoading: cacheStatsLoading, refetch: refetchCacheStats } = useQuery({
        queryKey: ['cache-stats'],
        queryFn: () => syncApi.getCacheStats(),
        refetchInterval: 10000, // Refetch every 10 seconds
    });

    // Fetch WebSocket stats
    const { data: webSocketStatsData, isLoading: webSocketStatsLoading, refetch: refetchWebSocketStats } = useQuery({
        queryKey: ['websocket-stats'],
        queryFn: () => syncApi.getWebSocketStats(),
        refetchInterval: 10000, // Refetch every 10 seconds
    });

    // Fetch health status
    const { data: healthData, isLoading: healthLoading, refetch: refetchHealth } = useQuery({
        queryKey: ['health'],
        queryFn: () => syncApi.getHealthStatus(),
        refetchInterval: 30000, // Refetch every 30 seconds
    });

    // Sync repository mutation
    const syncRepositoryMutation = useMutation({
        mutationFn: (data: { owner: string; repo: string; options?: any }) =>
            syncApi.syncRepository(data.owner, data.repo, data.options),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sync'] });
            setSyncDialogOpen(false);
        },
    });

    // Force sync mutation
    const forceSyncMutation = useMutation({
        mutationFn: (data: { owner: string; repo: string }) =>
            syncApi.forceSyncRepository(data.owner, data.repo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['sync'] });
        },
    });

    // Clear cache mutation
    const clearCacheMutation = useMutation({
        mutationFn: (data: { owner: string; repo: string }) =>
            syncApi.clearRepositoryCache(data.owner, data.repo),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['cache-stats'] });
            queryClient.invalidateQueries({ queryKey: ['sync'] });
        },
    });

    // Send test message mutation
    const sendTestMessageMutation = useMutation({
        mutationFn: (data: { repository?: string; userId?: string; message: string }) =>
            syncApi.sendTestMessage(data),
    });

    const syncStatuses: Record<string, SyncStatus> = syncStatusesData?.data?.data || {};
    const cacheStats = cacheStatsData?.data?.data;
    const webSocketStats = webSocketStatsData?.data?.data;
    const health = healthData?.data?.data;

    const handleSync = () => {
        if (!selectedRepo) return;

        const [owner, repo] = selectedRepo.split('/');
        if (!owner || !repo) return;

        syncRepositoryMutation.mutate({ owner, repo, options: syncOptions });
    };

    const handleForceSync = (repository: string) => {
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) return;

        forceSyncMutation.mutate({ owner, repo });
    };

    const handleClearCache = (repository: string) => {
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) return;

        clearCacheMutation.mutate({ owner, repo });
    };

    const handleSendTestMessage = () => {
        if (!testMessage) return;

        const data: any = { message: testMessage };

        if (testTarget === 'repository' && repository) {
            data.repository = repository;
        } else if (testTarget === 'user') {
            data.userId = 'current-user';
        }

        sendTestMessageMutation.mutate(data);
        setTestMessage('');
    };

    const handleRefreshAll = () => {
        refetchSyncStatuses();
        refetchCacheStats();
        refetchWebSocketStats();
        refetchHealth();
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'idle': return 'success';
            case 'syncing': return 'primary';
            case 'error': return 'error';
            default: return 'default';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'idle': return <CheckCircleIcon />;
            case 'syncing': return <SyncIcon />;
            case 'error': return <ErrorIcon />;
            default: return <InfoIcon />;
        }
    };

    const isLoading = syncStatusesLoading || cacheStatsLoading || webSocketStatsLoading || healthLoading;

    return (
        <Box>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <div>
                    <Typography variant="h4" component="h1" gutterBottom>
                        Sync & Cache Management
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Monitor and manage real-time synchronization and caching
                    </Typography>
                </div>
                <Box display="flex" gap={1}>
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleRefreshAll}
                        disabled={isLoading}
                    >
                        Refresh All
                    </Button>
                    <Button
                        variant="contained"
                        startIcon={<SyncIcon />}
                        onClick={() => setSyncDialogOpen(true)}
                    >
                        Sync Repository
                    </Button>
                </Box>
            </Box>

            {/* WebSocket Connection Status */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                        <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                            <NetworkIcon />
                            WebSocket Connection
                        </Typography>
                        <Chip
                            label={webSocket.isConnected ? 'Connected' : webSocket.isConnecting ? 'Connecting' : 'Disconnected'}
                            color={webSocket.isConnected ? 'success' : webSocket.isConnecting ? 'warning' : 'error'}
                            variant="outlined"
                        />
                    </Box>

                    {webSocket.error && (
                        <Alert severity="error" sx={{ mb: 2 }}>
                            {webSocket.error}
                        </Alert>
                    )}

                    <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="body2" color="text.secondary">Socket ID</Typography>
                            <Typography variant="body1">{webSocket.connectionStatus.socketId || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="body2" color="text.secondary">User ID</Typography>
                            <Typography variant="body1">{webSocket.connectionStatus.userId || 'N/A'}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Typography variant="body2" color="text.secondary">Subscribed Repos</Typography>
                            <Typography variant="body1">{webSocket.connectionStatus.subscribedRepositories.length}</Typography>
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <Box display="flex" gap={1}>
                                <Button size="small" onClick={webSocket.connect} disabled={webSocket.isConnected}>
                                    Connect
                                </Button>
                                <Button size="small" onClick={webSocket.disconnect} disabled={!webSocket.isConnected}>
                                    Disconnect
                                </Button>
                                <Button size="small" onClick={webSocket.ping} disabled={!webSocket.isConnected}>
                                    Ping
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* System Health */}
            {health && (
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                            <SpeedIcon />
                            System Health
                        </Typography>

                        <Grid container spacing={3}>
                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary">Redis</Typography>
                                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                                        <Chip
                                            label={health.services.redis.status}
                                            color={health.services.redis.status === 'connected' ? 'success' : 'warning'}
                                            size="small"
                                        />
                                        <Typography variant="body2">
                                            {health.services.redis.mode} ({health.services.redis.hitRate})
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary">Cache</Typography>
                                    <Box mt={1}>
                                        <Typography variant="body2">
                                            {health.services.cache.totalKeys} keys, {health.services.cache.memoryUsage}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {health.services.cache.repositories} repositories
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>

                            <Grid item xs={12} md={4}>
                                <Box>
                                    <Typography variant="subtitle2" color="text.secondary">WebSocket</Typography>
                                    <Box mt={1}>
                                        <Typography variant="body2">
                                            {health.services.websocket.connectedClients} clients
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary">
                                            {health.services.websocket.activeRepositories} active repos
                                        </Typography>
                                    </Box>
                                </Box>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* Repository Input */}
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
                                helperText="Enter a repository to monitor and sync"
                            />
                        </Grid>
                        <Grid item xs={12} md={6}>
                            <Box display="flex" gap={1}>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        if (repository) {
                                            webSocket.subscribeToRepository(repository);
                                        }
                                    }}
                                    disabled={!repository || !webSocket.isConnected}
                                >
                                    Subscribe
                                </Button>
                                <Button
                                    variant="outlined"
                                    onClick={() => {
                                        if (repository) {
                                            webSocket.unsubscribeFromRepository(repository);
                                        }
                                    }}
                                    disabled={!repository || !webSocket.isConnected}
                                >
                                    Unsubscribe
                                </Button>
                            </Box>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Sync Statuses */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        Repository Sync Status
                    </Typography>

                    {Object.keys(syncStatuses).length === 0 ? (
                        <Typography color="text.secondary" textAlign="center" py={4}>
                            No repositories are currently being synced.
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table>
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Repository</TableCell>
                                        <TableCell>Status</TableCell>
                                        <TableCell>Progress</TableCell>
                                        <TableCell>Last Sync</TableCell>
                                        <TableCell>Stats</TableCell>
                                        <TableCell>Actions</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {Object.entries(syncStatuses).map(([repo, status]) => (
                                        <TableRow key={repo}>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="bold">
                                                    {repo}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={getStatusIcon(status.status)}
                                                    label={status.status}
                                                    color={getStatusColor(status.status) as any}
                                                    size="small"
                                                />
                                                {status.error && (
                                                    <Typography variant="caption" color="error" display="block">
                                                        {status.error}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {status.status === 'syncing' ? (
                                                    <Box>
                                                        <LinearProgress
                                                            variant="determinate"
                                                            value={status.progress.total > 0 ? (status.progress.current / status.progress.total) * 100 : 0}
                                                            sx={{ mb: 1 }}
                                                        />
                                                        <Typography variant="caption">
                                                            {status.progress.phase} ({status.progress.current}/{status.progress.total})
                                                        </Typography>
                                                    </Box>
                                                ) : (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {status.status === 'idle' ? 'Complete' : 'N/A'}
                                                    </Typography>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {new Date(status.lastSync).toLocaleString()}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="caption" display="block">
                                                    Issues: {status.stats.issuesProcessed}
                                                </Typography>
                                                <Typography variant="caption" display="block">
                                                    Labels: {status.stats.labelsProcessed}
                                                </Typography>
                                                <Typography variant="caption" display="block">
                                                    Cache: {status.stats.cacheHits}H/{status.stats.cacheMisses}M
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Box display="flex" gap={1}>
                                                    <Tooltip title="Force Sync">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleForceSync(repo)}
                                                            disabled={status.status === 'syncing' || forceSyncMutation.isLoading}
                                                        >
                                                            <SyncIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="Clear Cache">
                                                        <IconButton
                                                            size="small"
                                                            onClick={() => handleClearCache(repo)}
                                                            disabled={clearCacheMutation.isLoading}
                                                        >
                                                            <ClearIcon />
                                                        </IconButton>
                                                    </Tooltip>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </CardContent>
            </Card>

            {/* Cache Statistics */}
            {cacheStats && (
                <Grid container spacing={3} sx={{ mb: 3 }}>
                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                                    <StorageIcon />
                                    Cache Statistics
                                </Typography>

                                <List>
                                    <ListItem>
                                        <ListItemText
                                            primary="Total Keys"
                                            secondary={cacheStats.cache.totalKeys}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Memory Usage"
                                            secondary={cacheStats.cache.memoryUsage}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Hit Rate"
                                            secondary={`${(cacheStats.cache.hitRate * 100).toFixed(1)}%`}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Active Repositories"
                                            secondary={cacheStats.cache.repositories.length}
                                        />
                                    </ListItem>
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>

                    <Grid item xs={12} md={6}>
                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom display="flex" alignItems="center" gap={1}>
                                    <CloudSyncIcon />
                                    Redis Statistics
                                </Typography>

                                <List>
                                    <ListItem>
                                        <ListItemText
                                            primary="Mode"
                                            secondary={cacheStats.redis.mode}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="API Calls"
                                            secondary={cacheStats.redis.apiCalls}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Cache Hits"
                                            secondary={cacheStats.redis.cacheHits}
                                        />
                                    </ListItem>
                                    <ListItem>
                                        <ListItemText
                                            primary="Hit Rate"
                                            secondary={cacheStats.redis.hitRate}
                                        />
                                    </ListItem>
                                </List>
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            )}

            {/* WebSocket Test */}
            <Card sx={{ mb: 3 }}>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        WebSocket Test
                    </Typography>

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={6}>
                            <TextField
                                fullWidth
                                label="Test Message"
                                value={testMessage}
                                onChange={(e) => setTestMessage(e.target.value)}
                                placeholder="Enter a test message"
                            />
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <TextField
                                select
                                fullWidth
                                label="Target"
                                value={testTarget}
                                onChange={(e) => setTestTarget(e.target.value as any)}
                                SelectProps={{ native: true }}
                            >
                                <option value="all">All Clients</option>
                                <option value="repository">Repository</option>
                                <option value="user">Current User</option>
                            </TextField>
                        </Grid>
                        <Grid item xs={12} md={3}>
                            <Button
                                fullWidth
                                variant="contained"
                                onClick={handleSendTestMessage}
                                disabled={!testMessage || sendTestMessageMutation.isLoading}
                            >
                                Send Test Message
                            </Button>
                        </Grid>
                    </Grid>
                </CardContent>
            </Card>

            {/* Sync Dialog */}
            <Dialog open={syncDialogOpen} onClose={() => setSyncDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Sync Repository</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2 }}>
                        <TextField
                            fullWidth
                            label="Repository (owner/repo)"
                            value={selectedRepo}
                            onChange={(e) => setSelectedRepo(e.target.value)}
                            placeholder="e.g., facebook/react"
                            sx={{ mb: 3 }}
                        />

                        <Typography variant="subtitle2" gutterBottom>
                            Sync Options
                        </Typography>

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={syncOptions.force}
                                    onChange={(e) => setSyncOptions(prev => ({ ...prev, force: e.target.checked }))}
                                />
                            }
                            label="Force sync (ignore cache)"
                        />

                        <FormControlLabel
                            control={
                                <Switch
                                    checked={syncOptions.skipCache}
                                    onChange={(e) => setSyncOptions(prev => ({ ...prev, skipCache: e.target.checked }))}
                                />
                            }
                            label="Skip cache completely"
                        />

                        <TextField
                            fullWidth
                            type="number"
                            label="Batch Size"
                            value={syncOptions.batchSize}
                            onChange={(e) => setSyncOptions(prev => ({ ...prev, batchSize: parseInt(e.target.value) || 50 }))}
                            helperText="Number of items to process in each batch"
                            sx={{ mt: 2 }}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setSyncDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleSync}
                        variant="contained"
                        disabled={!selectedRepo || syncRepositoryMutation.isLoading}
                    >
                        Start Sync
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default SyncPage;