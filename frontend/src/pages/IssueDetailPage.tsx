import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Chip,
  Avatar,
  Divider,
  Grid,
  Alert,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  OpenInNew as OpenIcon,
  Save as SaveIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import MetadataChip from '../components/MetadataChip';
import MetadataEditor from '../components/MetadataEditor';
import DependencyViewer from '../components/DependencyViewer';
import {
  EnhancedIssue,
  extractMetadataFromLabels,
  IssueMetadata,
} from '../utils/metadata';
import TimeTracker from '../components/TimeTracker';

function IssueDetailPage() {
  const { owner, repo, number } = useParams<{
    owner: string;
    repo: string;
    number: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editingMetadata, setEditingMetadata] = useState<IssueMetadata>({});

  // Fetch issue details
  const { data: issueData, isLoading, error } = useQuery({
    queryKey: ['issue', owner, repo, number],
    queryFn: () => issuesApi.getIssue(owner!, repo!, parseInt(number!)),
    enabled: !!(owner && repo && number),
  });

  // Update metadata mutation
  const updateMetadataMutation = useMutation({
    mutationFn: (metadata: IssueMetadata) =>
      issuesApi.updateIssueMetadata(owner!, repo!, parseInt(number!), metadata),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['issue', owner, repo, number] });
      queryClient.invalidateQueries({ queryKey: ['issues'] });
      setIsEditing(false);
    },
  });

  const handleBack = () => {
    navigate('/issues');
  };

  const handleEdit = () => {
    if (enhancedIssue) {
      setEditingMetadata(enhancedIssue.metadata);
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    try {
      await updateMetadataMutation.mutateAsync(editingMetadata);
    } catch (error) {
      console.error('Failed to update metadata:', error);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditingMetadata({});
  };

  const handleOpenInGitHub = () => {
    if (enhancedIssue && owner && repo) {
      const url = `https://github.com/${owner}/${repo}/issues/${enhancedIssue.number}`;
      window.open(url, '_blank');
    }
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading issue details..." />;
  }

  if (error || !issueData) {
    return (
      <Box>
        <Button
          startIcon={<BackIcon />}
          onClick={handleBack}
          sx={{ mb: 2 }}
        >
          Back to Issues
        </Button>
        <Alert severity="error">
          Failed to load issue details. Please check the issue number and try again.
        </Alert>
      </Box>
    );
  }

  const rawIssue = issueData.data;
  const enhancedIssue: EnhancedIssue = {
    ...rawIssue,
    metadata: extractMetadataFromLabels(rawIssue.labels || []),
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Button
          startIcon={<BackIcon />}
          onClick={handleBack}
          variant="outlined"
        >
          Back to Issues
        </Button>
        <Box display="flex" gap={1}>
          <Tooltip title="Open in GitHub">
            <IconButton onClick={handleOpenInGitHub}>
              <OpenIcon />
            </IconButton>
          </Tooltip>
          {!isEditing ? (
            <Button
              startIcon={<EditIcon />}
              onClick={handleEdit}
              variant="outlined"
            >
              Edit Metadata
            </Button>
          ) : (
            <Box display="flex" gap={1}>
              <Button
                startIcon={<SaveIcon />}
                onClick={handleSave}
                variant="contained"
                disabled={updateMetadataMutation.isPending}
              >
                Save
              </Button>
              <Button
                startIcon={<CancelIcon />}
                onClick={handleCancel}
                variant="outlined"
              >
                Cancel
              </Button>
            </Box>
          )}
        </Box>
      </Box>

      {/* Update Error */}
      {updateMetadataMutation.error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to update metadata. Please try again.
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          {/* Issue Header */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Typography variant="h4" component="h1">
                  #{enhancedIssue.number}
                </Typography>
                <Chip
                  label={enhancedIssue.state}
                  color={enhancedIssue.state === 'open' ? 'success' : 'default'}
                  variant="outlined"
                />
              </Box>

              <Typography variant="h5" component="h2" gutterBottom>
                {enhancedIssue.title}
              </Typography>

              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <Avatar
                  src={enhancedIssue.user.avatar_url}
                  alt={enhancedIssue.user.login}
                  sx={{ width: 24, height: 24 }}
                />
                <Typography variant="body2" color="text.secondary">
                  Opened by <strong>{enhancedIssue.user.login}</strong> on{' '}
                  {formatDate(enhancedIssue.created_at)}
                </Typography>
              </Box>

              {enhancedIssue.assignee && (
                <Box display="flex" alignItems="center" gap={2} mb={2}>
                  <Avatar
                    src={enhancedIssue.assignee.avatar_url}
                    alt={enhancedIssue.assignee.login}
                    sx={{ width: 24, height: 24 }}
                  />
                  <Typography variant="body2" color="text.secondary">
                    Assigned to <strong>{enhancedIssue.assignee.login}</strong>
                  </Typography>
                </Box>
              )}

              <Typography variant="body2" color="text.secondary">
                Last updated: {formatDate(enhancedIssue.updated_at)}
              </Typography>
            </CardContent>
          </Card>

          {/* Issue Body */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Description
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {enhancedIssue.body ? (
                <Typography
                  variant="body1"
                  component="div"
                  sx={{
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                  }}
                >
                  {enhancedIssue.body}
                </Typography>
              ) : (
                <Typography variant="body2" color="text.secondary" fontStyle="italic">
                  No description provided.
                </Typography>
              )}
            </CardContent>
          </Card>

          {/* Dependencies */}
          <DependencyViewer
            issueBody={enhancedIssue.body || ''}
            repository={`${owner}/${repo}`}
          />
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Metadata */}
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Metadata
              </Typography>
              <Divider sx={{ mb: 2 }} />

              {isEditing ? (
                <MetadataEditor
                  metadata={editingMetadata}
                  onChange={setEditingMetadata}
                />
              ) : (
                <Box display="flex" flexDirection="column" gap={2}>
                  {enhancedIssue.metadata.priority && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Priority
                      </Typography>
                      <MetadataChip
                        type="priority"
                        value={enhancedIssue.metadata.priority}
                        size="medium"
                      />
                    </Box>
                  )}

                  {enhancedIssue.metadata.category && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Category
                      </Typography>
                      <MetadataChip
                        type="category"
                        value={enhancedIssue.metadata.category}
                        size="medium"
                      />
                    </Box>
                  )}

                  {enhancedIssue.metadata.size && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Size
                      </Typography>
                      <MetadataChip
                        type="size"
                        value={enhancedIssue.metadata.size}
                        size="medium"
                      />
                    </Box>
                  )}

                  {enhancedIssue.metadata.status && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Status
                      </Typography>
                      <MetadataChip
                        type="status"
                        value={enhancedIssue.metadata.status}
                        size="medium"
                      />
                    </Box>
                  )}

                  {enhancedIssue.metadata.timeSpent && (
                    <Box>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        Time Spent
                      </Typography>
                      <Chip
                        label={`${enhancedIssue.metadata.timeSpent}h`}
                        variant="outlined"
                        color="info"
                      />
                    </Box>
                  )}

                  {!enhancedIssue.metadata.priority &&
                    !enhancedIssue.metadata.category &&
                    !enhancedIssue.metadata.size &&
                    !enhancedIssue.metadata.status &&
                    !enhancedIssue.metadata.timeSpent && (
                      <Typography variant="body2" color="text.secondary" fontStyle="italic">
                        No metadata available. Click "Edit Metadata" to add some.
                      </Typography>
                    )}
                </Box>
              )}
            </CardContent>
          </Card>

          {/* GitHub Labels */}
          {enhancedIssue.labels && enhancedIssue.labels.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Labels
                </Typography>
                <Divider sx={{ mb: 2 }} />
                <Box display="flex" flexWrap="wrap" gap={1}>
                  {enhancedIssue.labels.map((label) => (
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
              </CardContent>
            </Card>
          )}

          {/* Time Tracking */}
          <Box sx={{ mt: 3 }}>
            <TimeTracker
              owner={owner!}
              repo={repo!}
              issueNumber={enhancedIssue.number}
              userId="current-user" // In real app, get from auth context
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}

export default IssueDetailPage;