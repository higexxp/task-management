import React, { useState, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Button,
  Alert,
  Divider,
  Collapse,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Refresh as RefreshIcon,
  FilterList as FilterIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { issuesApi } from '../services/api';
import LoadingSpinner from '../components/LoadingSpinner';
import IssueCard from '../components/IssueCard';
import IssueFilters from '../components/IssueFilters';
import IssueStats from '../components/IssueStats';
import {
  EnhancedIssue,
  extractMetadataFromLabels,
  filterIssues,
  sortIssues,
} from '../utils/metadata';

function IssuesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState<'open' | 'closed' | 'all'>('open');
  const [ownerRepo, setOwnerRepo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    priority: [] as string[],
    category: [] as string[],
    size: [] as string[],
    status: [] as string[],
    sortBy: 'priority',
    sortOrder: 'desc',
  });

  const { data: issuesData, isLoading, error, refetch } = useQuery({
    queryKey: ['issues', { state: stateFilter, ownerRepo }],
    queryFn: () => {
      const [owner, repo] = ownerRepo.split('/');
      return issuesApi.getIssues({
        owner: owner || undefined,
        repo: repo || undefined,
        state: stateFilter,
      });
    },
    enabled: !!ownerRepo,
  });

  // Transform GitHub issues to enhanced issues with metadata
  const enhancedIssues: EnhancedIssue[] = useMemo(() => {
    const rawIssues = issuesData?.data?.issues || [];
    return rawIssues.map((issue: any) => ({
      ...issue,
      metadata: extractMetadataFromLabels(issue.labels || []),
    }));
  }, [issuesData]);

  // Apply filters and sorting
  const filteredAndSortedIssues = useMemo(() => {
    let filtered = filterIssues(enhancedIssues, {
      priority: filters.priority,
      category: filters.category,
      size: filters.size,
      status: filters.status,
      state: stateFilter,
      search: searchTerm,
    });

    return sortIssues(
      filtered,
      filters.sortBy as any,
      filters.sortOrder as any
    );
  }, [enhancedIssues, filters, stateFilter, searchTerm]);

  const handleRefresh = () => {
    refetch();
  };

  const handleIssueClick = (issue: EnhancedIssue) => {
    // TODO: Navigate to issue detail page or open modal
    console.log('Issue clicked:', issue);
  };

  if (isLoading) {
    return <LoadingSpinner message="Loading issues..." />;
  }

  return (
    <Box>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <div>
          <Typography variant="h4" component="h1" gutterBottom>
            Issues
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and track your GitHub issues with enhanced metadata
          </Typography>
        </div>
        <Box display="flex" gap={1}>
          <Button
            variant="outlined"
            startIcon={showFilters ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            onClick={() => setShowFilters(!showFilters)}
          >
            Filters
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={handleRefresh}
            disabled={!ownerRepo}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      {/* Basic Search and Repository Input */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Repository (owner/repo)"
                value={ownerRepo}
                onChange={(e) => setOwnerRepo(e.target.value)}
                placeholder="e.g., facebook/react"
                InputProps={{
                  startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />,
                }}
                helperText="Enter a repository to load issues"
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                label="Search issues"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by title or content"
                disabled={!ownerRepo}
              />
            </Grid>
            <Grid item xs={12} md={2}>
              <FormControl fullWidth>
                <InputLabel>State</InputLabel>
                <Select
                  value={stateFilter}
                  label="State"
                  onChange={(e) => setStateFilter(e.target.value as any)}
                  disabled={!ownerRepo}
                >
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="closed">Closed</MenuItem>
                  <MenuItem value="all">All</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Typography variant="body2" color="text.secondary">
                {filteredAndSortedIssues.length} issue{filteredAndSortedIssues.length !== 1 ? 's' : ''}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Advanced Filters */}
      <Collapse in={showFilters}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <IssueFilters
              filters={filters}
              onFiltersChange={setFilters}
            />
          </CardContent>
        </Card>
      </Collapse>

      {/* Statistics */}
      {enhancedIssues.length > 0 && (
        <IssueStats issues={enhancedIssues} />
      )}

      {/* Error State */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          Failed to load issues. Please check your repository name and try again.
        </Alert>
      )}

      {/* Issues List */}
      {!ownerRepo ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                Enter a Repository
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter a repository name (owner/repo) above to load and manage issues.
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : filteredAndSortedIssues.length === 0 ? (
        <Card>
          <CardContent>
            <Box textAlign="center" py={4}>
              <Typography variant="h6" color="text.secondary" gutterBottom>
                No issues found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {enhancedIssues.length === 0
                  ? `No issues found in ${ownerRepo}.`
                  : 'No issues match the current filters. Try adjusting your search criteria.'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filteredAndSortedIssues.map((issue) => (
            <Grid item xs={12} key={issue.id}>
              <IssueCard
                issue={issue}
                onIssueClick={handleIssueClick}
              />
            </Grid>
          ))}
        </Grid>
      )}
    </Box>
  );
}

export default IssuesPage;