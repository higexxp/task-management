import React from 'react';
import {
    Box,
    Card,
    CardContent,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    TextField,
    Chip,
    Grid,
    Autocomplete,
    Divider,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { EnhancedIssue } from '../utils/metadata';

interface DashboardFiltersProps {
    issues: EnhancedIssue[];
    filters: {
        repository: string;
        state: 'open' | 'closed' | 'all';
        assignee: string[];
        labels: string[];
        dateRange: {
            start: Date | null;
            end: Date | null;
        };
    };
    onFiltersChange: (filters: any) => void;
}

function DashboardFilters({ issues, filters, onFiltersChange }: DashboardFiltersProps) {
    // Extract unique assignees from issues
    const assignees = React.useMemo(() => {
        const uniqueAssignees = new Set<string>();
        issues.forEach(issue => {
            if (issue.assignee) {
                uniqueAssignees.add(issue.assignee.login);
            }
        });
        return Array.from(uniqueAssignees).sort();
    }, [issues]);

    // Extract unique labels from issues
    const availableLabels = React.useMemo(() => {
        const uniqueLabels = new Set<string>();
        issues.forEach(issue => {
            issue.labels?.forEach(label => {
                // Exclude metadata labels
                if (!label.name.match(/^(priority|category|size|status|time-spent):/)) {
                    uniqueLabels.add(label.name);
                }
            });
        });
        return Array.from(uniqueLabels).sort();
    }, [issues]);

    const handleFilterChange = (key: string, value: any) => {
        onFiltersChange({
            ...filters,
            [key]: value,
        });
    };

    const handleDateRangeChange = (key: 'start' | 'end', value: Date | null) => {
        onFiltersChange({
            ...filters,
            dateRange: {
                ...filters.dateRange,
                [key]: value,
            },
        });
    };

    const clearFilters = () => {
        onFiltersChange({
            repository: filters.repository, // Keep repository
            state: 'all',
            assignee: [],
            labels: [],
            dateRange: {
                start: null,
                end: null,
            },
        });
    };

    const hasActiveFilters =
        filters.state !== 'all' ||
        filters.assignee.length > 0 ||
        filters.labels.length > 0 ||
        filters.dateRange.start ||
        filters.dateRange.end;

    return (
        <Card>
            <CardContent>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                    <Typography variant="h6">Dashboard Filters</Typography>
                    {hasActiveFilters && (
                        <Chip
                            label="Clear Filters"
                            variant="outlined"
                            size="small"
                            onClick={clearFilters}
                            clickable
                        />
                    )}
                </Box>

                <Grid container spacing={2}>
                    {/* Repository Display */}
                    <Grid item xs={12} md={3}>
                        <TextField
                            fullWidth
                            label="Repository"
                            value={filters.repository}
                            disabled
                            size="small"
                            helperText="Current repository"
                        />
                    </Grid>

                    {/* State Filter */}
                    <Grid item xs={12} md={2}>
                        <FormControl fullWidth size="small">
                            <InputLabel>State</InputLabel>
                            <Select
                                value={filters.state}
                                label="State"
                                onChange={(e) => handleFilterChange('state', e.target.value)}
                            >
                                <MenuItem value="all">All</MenuItem>
                                <MenuItem value="open">Open</MenuItem>
                                <MenuItem value="closed">Closed</MenuItem>
                            </Select>
                        </FormControl>
                    </Grid>

                    {/* Assignee Filter */}
                    <Grid item xs={12} md={3}>
                        <Autocomplete
                            multiple
                            size="small"
                            options={assignees}
                            value={filters.assignee}
                            onChange={(_, value) => handleFilterChange('assignee', value)}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        variant="outlined"
                                        label={option}
                                        size="small"
                                        {...getTagProps({ index })}
                                        key={option}
                                    />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Assignees"
                                    placeholder="Select assignees"
                                />
                            )}
                        />
                    </Grid>

                    {/* Labels Filter */}
                    <Grid item xs={12} md={4}>
                        <Autocomplete
                            multiple
                            size="small"
                            options={availableLabels}
                            value={filters.labels}
                            onChange={(_, value) => handleFilterChange('labels', value)}
                            renderTags={(value, getTagProps) =>
                                value.map((option, index) => (
                                    <Chip
                                        variant="outlined"
                                        label={option}
                                        size="small"
                                        {...getTagProps({ index })}
                                        key={option}
                                    />
                                ))
                            }
                            renderInput={(params) => (
                                <TextField
                                    {...params}
                                    label="Labels"
                                    placeholder="Select labels"
                                />
                            )}
                        />
                    </Grid>

                    {/* Date Range */}
                    <Grid item xs={12}>
                        <Divider sx={{ my: 1 }} />
                        <Typography variant="subtitle2" gutterBottom>
                            Date Range Filter
                        </Typography>
                        <LocalizationProvider dateAdapter={AdapterDateFns}>
                            <Box display="flex" gap={2} flexWrap="wrap">
                                <DatePicker
                                    label="Start Date"
                                    value={filters.dateRange.start}
                                    onChange={(value) => handleDateRangeChange('start', value)}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            sx: { minWidth: 150 },
                                        },
                                    }}
                                />
                                <DatePicker
                                    label="End Date"
                                    value={filters.dateRange.end}
                                    onChange={(value) => handleDateRangeChange('end', value)}
                                    slotProps={{
                                        textField: {
                                            size: 'small',
                                            sx: { minWidth: 150 },
                                        },
                                    }}
                                />
                            </Box>
                        </LocalizationProvider>
                    </Grid>
                </Grid>

                {/* Filter Summary */}
                {hasActiveFilters && (
                    <Box mt={2}>
                        <Typography variant="caption" color="text.secondary">
                            Active Filters:
                            {filters.state !== 'all' && ` State: ${filters.state}`}
                            {filters.assignee.length > 0 && ` | Assignees: ${filters.assignee.length}`}
                            {filters.labels.length > 0 && ` | Labels: ${filters.labels.length}`}
                            {(filters.dateRange.start || filters.dateRange.end) && ` | Date Range`}
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

export default DashboardFilters;