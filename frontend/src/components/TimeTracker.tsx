import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    TextField,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Alert,
    Tooltip,
    LinearProgress,
} from '@mui/material';
import {
    PlayArrow as PlayIcon,
    Stop as StopIcon,
    Pause as PauseIcon,
    Add as AddIcon,
    Edit as EditIcon,
    Timer as TimerIcon,
} from '@mui/icons-material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { timeTrackingApi } from '../services/api';

interface TimeSession {
    id: string;
    issueNumber: number;
    repository: string;
    userId: string;
    startTime: string;
    lastActivity: string;
    isActive: boolean;
    description?: string;
}

interface TimeTrackerProps {
    owner: string;
    repo: string;
    issueNumber: number;
    userId: string;
    onTimeUpdate?: (totalMinutes: number) => void;
}

function TimeTracker({ owner, repo, issueNumber, userId, onTimeUpdate }: TimeTrackerProps) {
    const [description, setDescription] = useState('');
    const [manualDialogOpen, setManualDialogOpen] = useState(false);
    const [manualDuration, setManualDuration] = useState('');
    const [manualDescription, setManualDescription] = useState('');
    const [currentTime, setCurrentTime] = useState(0); // in seconds

    const queryClient = useQueryClient();

    // Get active session
    const { data: activeSessionData, refetch: refetchActiveSession } = useQuery({
        queryKey: ['activeSession', userId],
        queryFn: () => timeTrackingApi.getActiveSession(userId),
        refetchInterval: 5000, // Refetch every 5 seconds
    });

    // Get time entries for this issue
    const { data: timeEntriesData, refetch: refetchTimeEntries } = useQuery({
        queryKey: ['timeEntries', owner, repo, issueNumber],
        queryFn: () => timeTrackingApi.getIssueTimeEntries(owner, repo, issueNumber),
    });

    const activeSession: TimeSession | null = activeSessionData?.data?.data;
    const timeEntries = timeEntriesData?.data?.data?.entries || [];
    const timeSummary = timeEntriesData?.data?.data?.summary;

    // Check if there's an active session for this issue
    const isActiveForThisIssue = activeSession &&
        activeSession.issueNumber === issueNumber &&
        activeSession.repository === `${owner}/${repo}` &&
        activeSession.isActive;

    // Start session mutation
    const startSessionMutation = useMutation({
        mutationFn: () => timeTrackingApi.startSession(owner, repo, issueNumber, userId, description),
        onSuccess: () => {
            refetchActiveSession();
            setDescription('');
        },
    });

    // Stop session mutation
    const stopSessionMutation = useMutation({
        mutationFn: () => timeTrackingApi.stopSession(owner, repo, issueNumber, userId, description),
        onSuccess: () => {
            refetchActiveSession();
            refetchTimeEntries();
            setCurrentTime(0);
        },
    });

    // Pause session mutation
    const pauseSessionMutation = useMutation({
        mutationFn: () => timeTrackingApi.pauseSession(owner, repo, issueNumber, userId),
        onSuccess: () => {
            refetchActiveSession();
        },
    });

    // Resume session mutation
    const resumeSessionMutation = useMutation({
        mutationFn: () => timeTrackingApi.resumeSession(owner, repo, issueNumber, userId),
        onSuccess: () => {
            refetchActiveSession();
        },
    });

    // Add manual entry mutation
    const addManualEntryMutation = useMutation({
        mutationFn: (data: { duration: number; description?: string }) =>
            timeTrackingApi.addManualEntry(owner, repo, issueNumber, {
                userId,
                duration: data.duration,
                description: data.description,
            }),
        onSuccess: () => {
            refetchTimeEntries();
            setManualDialogOpen(false);
            setManualDuration('');
            setManualDescription('');
        },
    });

    // Update current time for active session
    useEffect(() => {
        let interval: NodeJS.Timeout;

        if (isActiveForThisIssue && activeSession) {
            const startTime = new Date(activeSession.startTime).getTime();

            interval = setInterval(() => {
                const now = Date.now();
                const elapsed = Math.floor((now - startTime) / 1000);
                setCurrentTime(elapsed);
            }, 1000);
        } else {
            setCurrentTime(0);
        }

        return () => {
            if (interval) clearInterval(interval);
        };
    }, [isActiveForThisIssue, activeSession]);

    // Notify parent of time updates
    useEffect(() => {
        if (onTimeUpdate && timeSummary) {
            onTimeUpdate(timeSummary.totalMinutes);
        }
    }, [timeSummary, onTimeUpdate]);

    const handleStart = () => {
        startSessionMutation.mutate();
    };

    const handleStop = () => {
        stopSessionMutation.mutate();
    };

    const handlePause = () => {
        if (isActiveForThisIssue) {
            pauseSessionMutation.mutate();
        }
    };

    const handleResume = () => {
        if (activeSession && !activeSession.isActive) {
            resumeSessionMutation.mutate();
        }
    };

    const handleAddManual = () => {
        if (!manualDuration) return;

        // Parse duration (supports formats like "1h 30m", "90m", "1.5h")
        const duration = parseDuration(manualDuration);
        if (duration > 0) {
            addManualEntryMutation.mutate({
                duration,
                description: manualDescription,
            });
        }
    };

    const parseDuration = (durationStr: string): number => {
        const hourMatch = durationStr.match(/(\d+(?:\.\d+)?)h/);
        const minuteMatch = durationStr.match(/(\d+)m/);

        let totalMinutes = 0;

        if (hourMatch) {
            totalMinutes += parseFloat(hourMatch[1]) * 60;
        }

        if (minuteMatch) {
            totalMinutes += parseInt(minuteMatch[1]);
        }

        // If no h or m suffix, assume minutes
        if (!hourMatch && !minuteMatch && /^\d+$/.test(durationStr)) {
            totalMinutes = parseInt(durationStr);
        }

        return Math.round(totalMinutes);
    };

    const formatTime = (seconds: number): string => {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDuration = (minutes: number): string => {
        if (minutes < 60) {
            return `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${remainingMinutes}m`;
    };

    const isLoading = startSessionMutation.isLoading ||
        stopSessionMutation.isLoading ||
        pauseSessionMutation.isLoading ||
        resumeSessionMutation.isLoading;

    return (
        <Card>
            <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={2}>
                    <Typography variant="h6" display="flex" alignItems="center" gap={1}>
                        <TimerIcon />
                        Time Tracking
                    </Typography>
                    <Tooltip title="Add Manual Entry">
                        <IconButton onClick={() => setManualDialogOpen(true)} size="small">
                            <AddIcon />
                        </IconButton>
                    </Tooltip>
                </Box>

                {/* Active Session Display */}
                {isActiveForThisIssue && (
                    <Box mb={2}>
                        <Alert severity="info" sx={{ mb: 1 }}>
                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                <Typography variant="body2">
                                    Active session: {formatTime(currentTime)}
                                </Typography>
                                <Chip label="RUNNING" color="success" size="small" />
                            </Box>
                        </Alert>
                        {activeSession?.description && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {activeSession.description}
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Paused Session Display */}
                {activeSession && !activeSession.isActive &&
                    activeSession.issueNumber === issueNumber &&
                    activeSession.repository === `${owner}/${repo}` && (
                        <Box mb={2}>
                            <Alert severity="warning" sx={{ mb: 1 }}>
                                <Box display="flex" alignItems="center" justifyContent="space-between">
                                    <Typography variant="body2">
                                        Session paused
                                    </Typography>
                                    <Chip label="PAUSED" color="warning" size="small" />
                                </Box>
                            </Alert>
                        </Box>
                    )}

                {/* Controls */}
                <Box display="flex" gap={1} mb={2}>
                    {!activeSession || activeSession.issueNumber !== issueNumber ? (
                        // Start button
                        <>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PlayIcon />}
                                onClick={handleStart}
                                disabled={isLoading}
                                fullWidth
                            >
                                Start Timer
                            </Button>
                        </>
                    ) : activeSession.isActive ? (
                        // Active session controls
                        <>
                            <Button
                                variant="outlined"
                                startIcon={<PauseIcon />}
                                onClick={handlePause}
                                disabled={isLoading}
                                sx={{ flex: 1 }}
                            >
                                Pause
                            </Button>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<StopIcon />}
                                onClick={handleStop}
                                disabled={isLoading}
                                sx={{ flex: 1 }}
                            >
                                Stop
                            </Button>
                        </>
                    ) : (
                        // Paused session controls
                        <>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={<PlayIcon />}
                                onClick={handleResume}
                                disabled={isLoading}
                                sx={{ flex: 1 }}
                            >
                                Resume
                            </Button>
                            <Button
                                variant="outlined"
                                color="error"
                                startIcon={<StopIcon />}
                                onClick={handleStop}
                                disabled={isLoading}
                                sx={{ flex: 1 }}
                            >
                                Stop
                            </Button>
                        </>
                    )}
                </Box>

                {/* Description input for new sessions */}
                {!isActiveForThisIssue && (
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Optional: Describe what you're working on..."
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        sx={{ mb: 2 }}
                    />
                )}

                {/* Loading indicator */}
                {isLoading && <LinearProgress sx={{ mb: 2 }} />}

                {/* Time Summary */}
                {timeSummary && (
                    <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                            Total time logged: <strong>{formatDuration(timeSummary.totalMinutes)}</strong>
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                            {timeSummary.entriesCount} session{timeSummary.entriesCount !== 1 ? 's' : ''}
                        </Typography>
                    </Box>
                )}

                {/* Manual Entry Dialog */}
                <Dialog open={manualDialogOpen} onClose={() => setManualDialogOpen(false)} maxWidth="sm" fullWidth>
                    <DialogTitle>Add Manual Time Entry</DialogTitle>
                    <DialogContent>
                        <Box sx={{ pt: 1 }}>
                            <TextField
                                fullWidth
                                label="Duration"
                                placeholder="e.g., 1h 30m, 90m, 1.5h"
                                value={manualDuration}
                                onChange={(e) => setManualDuration(e.target.value)}
                                helperText="Formats: 1h 30m, 90m, 1.5h, or just minutes (90)"
                                sx={{ mb: 2 }}
                            />
                            <TextField
                                fullWidth
                                label="Description (optional)"
                                multiline
                                rows={3}
                                value={manualDescription}
                                onChange={(e) => setManualDescription(e.target.value)}
                                placeholder="What did you work on?"
                            />
                        </Box>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => setManualDialogOpen(false)}>Cancel</Button>
                        <Button
                            onClick={handleAddManual}
                            variant="contained"
                            disabled={!manualDuration || addManualEntryMutation.isLoading}
                        >
                            Add Entry
                        </Button>
                    </DialogActions>
                </Dialog>
            </CardContent>
        </Card>
    );
}

export default TimeTracker;