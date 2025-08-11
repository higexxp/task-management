import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  LinearProgress,
  Chip,
} from '@mui/material';
import {
  BugReport as BugIcon,
  Star as FeatureIcon,
  Build as EnhancementIcon,
  PriorityHigh as HighPriorityIcon,
  Remove as MediumPriorityIcon,
  KeyboardArrowDown as LowPriorityIcon,
} from '@mui/icons-material';
import { EnhancedIssue } from '../utils/metadata';

interface IssueStatsProps {
  issues: EnhancedIssue[];
}

function IssueStats({ issues }: IssueStatsProps) {
  // Calculate statistics
  const stats = React.useMemo(() => {
    const total = issues.length;
    const open = issues.filter(issue => issue.state === 'open').length;
    const closed = issues.filter(issue => issue.state === 'closed').length;

    // Priority distribution
    const priorityStats = {
      high: issues.filter(issue => issue.metadata.priority === 'high').length,
      medium: issues.filter(issue => issue.metadata.priority === 'medium').length,
      low: issues.filter(issue => issue.metadata.priority === 'low').length,
      unset: issues.filter(issue => !issue.metadata.priority).length,
    };

    // Category distribution
    const categoryStats = {
      bug: issues.filter(issue => issue.metadata.category === 'bug').length,
      feature: issues.filter(issue => issue.metadata.category === 'feature').length,
      enhancement: issues.filter(issue => issue.metadata.category === 'enhancement').length,
      documentation: issues.filter(issue => issue.metadata.category === 'documentation').length,
      question: issues.filter(issue => issue.metadata.category === 'question').length,
      unset: issues.filter(issue => !issue.metadata.category).length,
    };

    // Size distribution
    const sizeStats = {
      small: issues.filter(issue => issue.metadata.size === 'small').length,
      medium: issues.filter(issue => issue.metadata.size === 'medium').length,
      large: issues.filter(issue => issue.metadata.size === 'large').length,
      unset: issues.filter(issue => !issue.metadata.size).length,
    };

    // Status distribution
    const statusStats = {
      todo: issues.filter(issue => issue.metadata.status === 'todo').length,
      'in-progress': issues.filter(issue => issue.metadata.status === 'in-progress').length,
      review: issues.filter(issue => issue.metadata.status === 'review').length,
      done: issues.filter(issue => issue.metadata.status === 'done').length,
      unset: issues.filter(issue => !issue.metadata.status).length,
    };

    return {
      total,
      open,
      closed,
      priorityStats,
      categoryStats,
      sizeStats,
      statusStats,
    };
  }, [issues]);

  const StatCard = ({ title, value, total, color = '#1976d2' }: {
    title: string;
    value: number;
    total: number;
    color?: string;
  }) => {
    const percentage = total > 0 ? (value / total) * 100 : 0;
    
    return (
      <Box>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="body2" color="text.secondary">
            {title}
          </Typography>
          <Typography variant="body2" fontWeight="bold">
            {value}
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={percentage}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(0,0,0,0.1)',
            '& .MuiLinearProgress-bar': {
              backgroundColor: color,
            },
          }}
        />
        <Typography variant="caption" color="text.secondary">
          {percentage.toFixed(1)}%
        </Typography>
      </Box>
    );
  };

  if (stats.total === 0) {
    return null;
  }

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Issue Statistics
        </Typography>

        <Grid container spacing={3}>
          {/* Overview */}
          <Grid item xs={12} md={3}>
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Overview
              </Typography>
              <Box display="flex" gap={1} mb={2}>
                <Chip
                  label={`${stats.open} Open`}
                  color="success"
                  size="small"
                  variant="outlined"
                />
                <Chip
                  label={`${stats.closed} Closed`}
                  color="default"
                  size="small"
                  variant="outlined"
                />
              </Box>
              <Typography variant="h4" color="primary">
                {stats.total}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Issues
              </Typography>
            </Box>
          </Grid>

          {/* Priority Distribution */}
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Priority
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <StatCard
                title="High"
                value={stats.priorityStats.high}
                total={stats.total}
                color="#d32f2f"
              />
              <StatCard
                title="Medium"
                value={stats.priorityStats.medium}
                total={stats.total}
                color="#ed6c02"
              />
              <StatCard
                title="Low"
                value={stats.priorityStats.low}
                total={stats.total}
                color="#2e7d32"
              />
            </Box>
          </Grid>

          {/* Category Distribution */}
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Category
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <StatCard
                title="Bug"
                value={stats.categoryStats.bug}
                total={stats.total}
                color="#d32f2f"
              />
              <StatCard
                title="Feature"
                value={stats.categoryStats.feature}
                total={stats.total}
                color="#1976d2"
              />
              <StatCard
                title="Enhancement"
                value={stats.categoryStats.enhancement}
                total={stats.total}
                color="#388e3c"
              />
            </Box>
          </Grid>

          {/* Size Distribution */}
          <Grid item xs={12} md={3}>
            <Typography variant="subtitle2" gutterBottom>
              Size
            </Typography>
            <Box display="flex" flexDirection="column" gap={1}>
              <StatCard
                title="Small"
                value={stats.sizeStats.small}
                total={stats.total}
                color="#2e7d32"
              />
              <StatCard
                title="Medium"
                value={stats.sizeStats.medium}
                total={stats.total}
                color="#ed6c02"
              />
              <StatCard
                title="Large"
                value={stats.sizeStats.large}
                total={stats.total}
                color="#d32f2f"
              />
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}

export default IssueStats;