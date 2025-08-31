import React, { useState, useMemo } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Chip,
  TextField,
  Alert,
  Collapse,
  IconButton,
  Tooltip,
  Button,
} from '@mui/material';
import {
  BugReport as IssuesIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Group as TeamIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { webhooksApi, issuesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import PriorityChart from '../components/charts/PriorityChart';
import CategoryChart from '../components/charts/CategoryChart';
import ProgressChart from '../components/charts/ProgressChart';
import DashboardFilters from '../components/DashboardFilters';
import {
  EnhancedIssue,
  extractMetadataFromLabels,
  filterIssues,
} from '../utils/metadata';

function DashboardPage() {
  const [ownerRepo, setOwnerRepo] = useState('');

  const { data: webhookStats, isLoading: webhookLoading } = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: () => webhooksApi.getStats(),
  });

  const { data: issuesData, isLoading: issuesLoading, error: issuesError } = useQuery({
    queryKey: ['dashboard-issues', { ownerRepo }],
    queryFn: () => {
      const [owner, repo] = ownerRepo.split('/');
      return issuesApi.getIssues({
        owner: owner || undefined,
        repo: repo || undefined,
        state: 'all',
      });
    },
    enabled: !!ownerRepo,
  });

  // Calculate real statistics from GitHub issues
  const issueStats = useMemo(() => {
    const issues = issuesData?.data?.data?.issues || [];
    const openIssues = issues.filter((issue: any) => issue.state === 'open');
    const closedIssues = issues.filter((issue: any) => issue.state === 'closed');
    
    // Calculate in-progress issues (issues with "in progress" or similar labels/status)
    const inProgressIssues = openIssues.filter((issue: any) => {
      const metadata = extractMetadataFromLabels(issue.labels || []);
      return metadata.status === 'in-progress' || 
             metadata.status === 'doing' ||
             issue.labels?.some((label: any) => 
               label.name?.toLowerCase().includes('in progress') ||
               label.name?.toLowerCase().includes('in-progress') ||
               label.name?.toLowerCase().includes('doing')
             );
    });

    // Get unique assignees/team members
    const uniqueAssignees = new Set();
    issues.forEach((issue: any) => {
      issue.assignees?.forEach((assignee: any) => {
        uniqueAssignees.add(assignee.login);
      });
      if (issue.user) {
        uniqueAssignees.add(issue.user.login);
      }
    });

    return {
      total: issues.length,
      open: openIssues.length,
      closed: closedIssues.length,
      inProgress: inProgressIssues.length,
      teamMembers: uniqueAssignees.size,
    };
  }, [issuesData]);

  const isLoading = webhookLoading || issuesLoading;

  if (isLoading && !ownerRepo) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const webhookStatistics = webhookStats?.data?.data || {
    totalEvents: 0,
    eventsByType: {},
    recentEvents: [],
  };

  // Ensure recentEvents is always an array
  if (!Array.isArray(webhookStatistics.recentEvents)) {
    webhookStatistics.recentEvents = [];
  }

  const dashboardCards = [
    {
      title: 'Total Issues',
      value: issueStats.total.toString(),
      icon: <IssuesIcon />,
      color: '#1976d2',
      change: ownerRepo ? `${issueStats.open} open` : 'Select repository',
    },
    {
      title: 'In Progress',
      value: issueStats.inProgress.toString(),
      icon: <TrendingIcon />,
      color: '#ed6c02',
      change: ownerRepo ? `${Math.round((issueStats.inProgress / Math.max(issueStats.open, 1)) * 100)}% of open` : 'Select repository',
    },
    {
      title: 'Completed',
      value: issueStats.closed.toString(),
      icon: <ScheduleIcon />,
      color: '#2e7d32',
      change: ownerRepo ? `${Math.round((issueStats.closed / Math.max(issueStats.total, 1)) * 100)}% completion` : 'Select repository',
    },
    {
      title: 'Team Members',
      value: issueStats.teamMembers.toString(),
      icon: <TeamIcon />,
      color: '#9c27b0',
      change: ownerRepo ? 'Contributors' : 'Select repository',
    },
  ];

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>
        Dashboard
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        Overview of your GitHub issues and project progress
      </Typography>

      {/* Repository Selection */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={8}>
              <TextField
                fullWidth
                label="Repository (owner/repo)"
                value={ownerRepo}
                onChange={(e) => setOwnerRepo(e.target.value)}
                placeholder="e.g., higexxp/task-management"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                helperText="Enter a repository to load real GitHub statistics"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              {ownerRepo && (
                <Box display="flex" alignItems="center" gap={1}>
                  {issuesLoading && <LoadingSpinner size={20} />}
                  {issuesError && (
                    <Alert severity="error" sx={{ minWidth: 0 }}>
                      Failed to load repository data
                    </Alert>
                  )}
                </Box>
              )}
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {/* Stats Cards */}
        {dashboardCards.map((card, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card>
              <CardContent>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography color="text.secondary" gutterBottom>
                      {card.title}
                    </Typography>
                    <Typography variant="h4" component="div">
                      {card.value}
                    </Typography>
                    <Typography variant="body2" color={card.color}>
                      {card.change} from last week
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      backgroundColor: card.color,
                      color: 'white',
                      borderRadius: 2,
                      p: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {card.icon}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}

        {/* Webhook Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Webhook Activity
            </Typography>
            <Box mb={2}>
              <Typography variant="body2" color="text.secondary">
                Total Events: {webhookStatistics.totalEvents}
              </Typography>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(webhookStatistics.eventsByType).map(([type, count]) => (
                <Chip
                  key={type}
                  label={`${type}: ${count}`}
                  variant="outlined"
                  size="small"
                />
              ))}
            </Box>
          </Paper>
        </Grid>

        {/* Recent Activity */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>
            <List dense>
              {webhookStatistics.recentEvents && webhookStatistics.recentEvents.length > 0 ? (
                webhookStatistics.recentEvents.slice(0, 5).map((event: any, index: number) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`${event.eventType} - ${event.action}`}
                      secondary={`${event.repository} • ${new Date(
                        event.timestamp
                      ).toLocaleString()}`}
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText
                    primary="No recent activity"
                    secondary="Webhook events will appear here"
                  />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • View and manage your GitHub issues
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Track issue dependencies and relationships
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Monitor project progress and team workload
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Analyze issue metadata and priorities
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default DashboardPage;