import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  OpenInNew as OpenIcon,
  Warning as WarningIcon,
  CheckCircle as CheckIcon,
  Schedule as PendingIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { dependenciesApi } from '../services/api';

interface DependencyViewerProps {
  issueBody: string;
  repository: string;
}

interface Dependency {
  type: 'blocks' | 'blocked_by' | 'related_to';
  repository: string;
  issueNumber: number;
  title?: string;
  state?: 'open' | 'closed';
  url?: string;
}

function DependencyViewer({ issueBody, repository }: DependencyViewerProps) {
  // Parse dependencies from issue body
  const { data: dependenciesData, isLoading } = useQuery({
    queryKey: ['dependencies', 'parse', issueBody],
    queryFn: () => dependenciesApi.parseDependencies(issueBody, repository),
    enabled: !!issueBody,
  });

  // Validate dependencies for cycles
  const { data: validationData } = useQuery({
    queryKey: ['dependencies', 'validate', dependenciesData?.data?.dependencies],
    queryFn: () => dependenciesApi.validateDependencies(dependenciesData?.data?.dependencies || []),
    enabled: !!dependenciesData?.data?.dependencies?.length,
  });

  if (!issueBody || isLoading) {
    return null;
  }

  const dependencies: Dependency[] = dependenciesData?.data?.dependencies || [];
  const hasCircularDependencies = validationData?.data?.hasCircularDependencies;
  const circularPaths = validationData?.data?.circularPaths || [];

  if (dependencies.length === 0) {
    return null;
  }

  const getDependencyIcon = (dependency: Dependency) => {
    if (dependency.state === 'closed') {
      return <CheckIcon color="success" fontSize="small" />;
    } else if (dependency.state === 'open') {
      return <PendingIcon color="warning" fontSize="small" />;
    }
    return <PendingIcon color="disabled" fontSize="small" />;
  };

  const getDependencyTypeLabel = (type: string) => {
    switch (type) {
      case 'blocks':
        return 'Blocks';
      case 'blocked_by':
        return 'Blocked by';
      case 'related_to':
        return 'Related to';
      default:
        return type;
    }
  };

  const getDependencyTypeColor = (type: string) => {
    switch (type) {
      case 'blocks':
        return 'error';
      case 'blocked_by':
        return 'warning';
      case 'related_to':
        return 'info';
      default:
        return 'default';
    }
  };

  const handleOpenDependency = (dependency: Dependency) => {
    if (dependency.url) {
      window.open(dependency.url, '_blank');
    } else {
      // Construct GitHub URL
      const url = `https://github.com/${dependency.repository}/issues/${dependency.issueNumber}`;
      window.open(url, '_blank');
    }
  };

  const groupedDependencies = dependencies.reduce((acc, dep) => {
    if (!acc[dep.type]) {
      acc[dep.type] = [];
    }
    acc[dep.type].push(dep);
    return acc;
  }, {} as Record<string, Dependency[]>);

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          Dependencies
        </Typography>
        <Divider sx={{ mb: 2 }} />

        {/* Circular Dependency Warning */}
        {hasCircularDependencies && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<WarningIcon />}>
            <Typography variant="body2" fontWeight="bold">
              Circular Dependencies Detected
            </Typography>
            {circularPaths.map((path: string[], index: number) => (
              <Typography key={index} variant="caption" display="block">
                {path.join(' → ')}
              </Typography>
            ))}
          </Alert>
        )}

        {/* Dependencies by Type */}
        {Object.entries(groupedDependencies).map(([type, deps]) => (
          <Box key={type} mb={3}>
            <Box display="flex" alignItems="center" gap={1} mb={1}>
              <Chip
                label={getDependencyTypeLabel(type)}
                size="small"
                color={getDependencyTypeColor(type) as any}
                variant="outlined"
              />
              <Typography variant="body2" color="text.secondary">
                ({deps.length})
              </Typography>
            </Box>

            <List dense>
              {deps.map((dependency, index) => (
                <ListItem
                  key={`${dependency.repository}-${dependency.issueNumber}-${index}`}
                  sx={{
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    mb: 1,
                  }}
                  secondaryAction={
                    <Tooltip title="Open in GitHub">
                      <IconButton
                        edge="end"
                        size="small"
                        onClick={() => handleOpenDependency(dependency)}
                      >
                        <OpenIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <Box display="flex" alignItems="center" gap={1} mr={1}>
                    {getDependencyIcon(dependency)}
                  </Box>
                  <ListItemText
                    primary={
                      <Box display="flex" alignItems="center" gap={1}>
                        <Typography variant="body2" fontWeight="bold">
                          {dependency.repository}#{dependency.issueNumber}
                        </Typography>
                        {dependency.state && (
                          <Chip
                            label={dependency.state}
                            size="small"
                            color={dependency.state === 'open' ? 'success' : 'default'}
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                    secondary={dependency.title || 'Loading title...'}
                  />
                </ListItem>
              ))}
            </List>
          </Box>
        ))}

        <Typography variant="caption" color="text.secondary">
          Dependencies are parsed from the issue description. Use keywords like "blocks", "blocked by", or "related to" followed by issue references.
        </Typography>
      </CardContent>
    </Card>
  );
}

export default DependencyViewer;