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
} from '@mui/material';
import {
  BugReport as IssuesIcon,
  TrendingUp as TrendingIcon,
  Schedule as ScheduleIcon,
  Group as TeamIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Refresh as RefreshIcon,
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
  const { data: webhookStats, isLoading } = useQuery({
    queryKey: ['webhook-stats'],
    queryFn: () => webhooksApi.getStats(),
  });

  if (isLoading) {
    return <LoadingSpinner message="Loading dashboard..." />;
  }

  const stats = webhookStats?.data?.data || {
    totalEvents: 0,
    eventsByType: {},
    recentEvents: [],
  };

  const dashboardCards = [
    {
      title: 'Total Issues',
      value: '24',
      icon: <IssuesIcon />,
      color: '#1976d2',
      change: '+12%',
    },
    {
      title: 'In Progress',
      value: '8',
      icon: <TrendingIcon />,
      color: '#ed6c02',
      change: '+5%',
    },
    {
      title: 'Completed',
      value: '16',
      icon: <ScheduleIcon />,
      color: '#2e7d32',
      change: '+8%',
    },
    {
      title: 'Team Members',
      value: '5',
      icon: <TeamIcon />,
      color: '#9c27b0',
      change: '0%',
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
                Total Events: {stats.totalEvents}
              </Typography>
            </Box>
            <Box display="flex" flexWrap="wrap" gap={1}>
              {Object.entries(stats.eventsByType).map(([type, count]) => (
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
              {stats.recentEvents.length > 0 ? (
                stats.recentEvents.slice(0, 5).map((event: any, index: number) => (
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