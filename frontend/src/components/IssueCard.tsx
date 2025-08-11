import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Person as PersonIcon,
  Schedule as TimeIcon,
} from '@mui/icons-material';
import { EnhancedIssue } from '../utils/metadata';
import MetadataChip from './MetadataChip';

interface IssueCardProps {
  issue: EnhancedIssue;
  onIssueClick?: (issue: EnhancedIssue) => void;
}

function IssueCard({ issue, onIssueClick }: IssueCardProps) {
  const handleCardClick = () => {
    if (onIssueClick) {
      onIssueClick(issue);
    }
  };

  const handleOpenInGitHub = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Construct GitHub URL - this would need repository info
    // For now, we'll just prevent the event
    console.log('Open in GitHub:', issue);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStateColor = (state: string) => {
    return state === 'open' ? 'success' : 'default';
  };

  return (
    <Card
      sx={{
        cursor: onIssueClick ? 'pointer' : 'default',
        transition: 'all 0.2s ease-in-out',
        '&:hover': {
          transform: onIssueClick ? 'translateY(-2px)' : 'none',
          boxShadow: onIssueClick ? 3 : 1,
        },
      }}
      onClick={handleCardClick}
    >
      <CardContent>
        {/* Header */}
        <Box display="flex" justifyContent="space-between" alignItems="start" mb={2}>
          <Box flex={1}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Typography variant="h6" component="h3" sx={{ fontWeight: 600 }}>
                #{issue.number}
              </Typography>
              <Chip
                label={issue.state}
                color={getStateColor(issue.state)}
                size="small"
                variant="outlined"
              />
            </Box>
            <Typography variant="h6" component="h2" gutterBottom>
              {issue.title}
            </Typography>
          </Box>
          <Tooltip title="Open in GitHub">
            <IconButton
              size="small"
              onClick={handleOpenInGitHub}
              sx={{ ml: 1 }}
            >
              <OpenIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Description */}
        {issue.body && (
          <Typography
            variant="body2"
            color="text.secondary"
            paragraph
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {issue.body}
          </Typography>
        )}

        {/* Metadata Chips */}
        <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
          {issue.metadata.priority && (
            <MetadataChip type="priority" value={issue.metadata.priority} />
          )}
          {issue.metadata.category && (
            <MetadataChip type="category" value={issue.metadata.category} />
          )}
          {issue.metadata.size && (
            <MetadataChip type="size" value={issue.metadata.size} />
          )}
          {issue.metadata.status && (
            <MetadataChip type="status" value={issue.metadata.status} />
          )}
          {issue.metadata.timeSpent && (
            <Chip
              icon={<TimeIcon />}
              label={`${issue.metadata.timeSpent}h`}
              size="small"
              variant="outlined"
              color="info"
            />
          )}
        </Box>

        {/* GitHub Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
            {issue.labels
              .filter(label => !label.name.match(/^(priority|category|size|status|time-spent):/))
              .map((label) => (
                <Chip
                  key={label.id}
                  label={label.name}
                  size="small"
                  variant="outlined"
                  sx={{
                    backgroundColor: `#${label.color}20`,
                    borderColor: `#${label.color}`,
                    color: `#${label.color}`,
                  }}
                />
              ))}
          </Box>
        )}

        {/* Footer */}
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Box display="flex" alignItems="center" gap={1}>
            <Avatar
              src={issue.user.avatar_url}
              alt={issue.user.login}
              sx={{ width: 20, height: 20 }}
            />
            <Typography variant="caption" color="text.secondary">
              {issue.user.login}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              • {formatDate(issue.created_at)}
            </Typography>
          </Box>

          {issue.assignee && (
            <Box display="flex" alignItems="center" gap={1}>
              <PersonIcon fontSize="small" color="action" />
              <Avatar
                src={issue.assignee.avatar_url}
                alt={issue.assignee.login}
                sx={{ width: 20, height: 20 }}
              />
              <Typography variant="caption" color="text.secondary">
                {issue.assignee.login}
              </Typography>
            </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

export default IssueCard;