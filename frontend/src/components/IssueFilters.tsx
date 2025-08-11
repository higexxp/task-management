import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  SelectChangeEvent,
  Grid,
  Typography,
} from '@mui/material';

interface IssueFiltersProps {
  filters: {
    priority: string[];
    category: string[];
    size: string[];
    status: string[];
    sortBy: string;
    sortOrder: string;
  };
  onFiltersChange: (filters: any) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_OPTIONS = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'question', label: 'Question' },
];

const SIZE_OPTIONS = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const STATUS_OPTIONS = [
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

const SORT_OPTIONS = [
  { value: 'priority', label: 'Priority' },
  { value: 'created', label: 'Created Date' },
  { value: 'updated', label: 'Updated Date' },
  { value: 'number', label: 'Issue Number' },
];

function IssueFilters({ filters, onFiltersChange }: IssueFiltersProps) {
  const handleMultiSelectChange = (
    event: SelectChangeEvent<string[]>,
    filterType: string
  ) => {
    const value = event.target.value as string[];
    onFiltersChange({
      ...filters,
      [filterType]: value,
    });
  };

  const handleSingleSelectChange = (
    event: SelectChangeEvent<string>,
    filterType: string
  ) => {
    const value = event.target.value as string;
    onFiltersChange({
      ...filters,
      [filterType]: value,
    });
  };

  const renderMultiSelectValue = (selected: string[], options: any[]) => (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
      {selected.map((value) => {
        const option = options.find(opt => opt.value === value);
        return (
          <Chip
            key={value}
            label={option?.label || value}
            size="small"
            variant="outlined"
          />
        );
      })}
    </Box>
  );

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Filters & Sorting
      </Typography>
      
      <Grid container spacing={2}>
        {/* Priority Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Priority</InputLabel>
            <Select
              multiple
              value={filters.priority}
              onChange={(e) => handleMultiSelectChange(e, 'priority')}
              input={<OutlinedInput label="Priority" />}
              renderValue={(selected) => renderMultiSelectValue(selected, PRIORITY_OPTIONS)}
            >
              {PRIORITY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Category Filter */}
        <Grid item xs={12} sm={6} md={3}>
          <FormControl fullWidth size="small">
            <InputLabel>Category</InputLabel>
            <Select
              multiple
              value={filters.category}
              onChange={(e) => handleMultiSelectChange(e, 'category')}
              input={<OutlinedInput label="Category" />}
              renderValue={(selected) => renderMultiSelectValue(selected, CATEGORY_OPTIONS)}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Size Filter */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Size</InputLabel>
            <Select
              multiple
              value={filters.size}
              onChange={(e) => handleMultiSelectChange(e, 'size')}
              input={<OutlinedInput label="Size" />}
              renderValue={(selected) => renderMultiSelectValue(selected, SIZE_OPTIONS)}
            >
              {SIZE_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Status Filter */}
        <Grid item xs={12} sm={6} md={2}>
          <FormControl fullWidth size="small">
            <InputLabel>Status</InputLabel>
            <Select
              multiple
              value={filters.status}
              onChange={(e) => handleMultiSelectChange(e, 'status')}
              input={<OutlinedInput label="Status" />}
              renderValue={(selected) => renderMultiSelectValue(selected, STATUS_OPTIONS)}
            >
              {STATUS_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Sort By */}
        <Grid item xs={12} sm={6} md={1.5}>
          <FormControl fullWidth size="small">
            <InputLabel>Sort By</InputLabel>
            <Select
              value={filters.sortBy}
              onChange={(e) => handleSingleSelectChange(e, 'sortBy')}
              label="Sort By"
            >
              {SORT_OPTIONS.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>

        {/* Sort Order */}
        <Grid item xs={12} sm={6} md={0.5}>
          <FormControl fullWidth size="small">
            <InputLabel>Order</InputLabel>
            <Select
              value={filters.sortOrder}
              onChange={(e) => handleSingleSelectChange(e, 'sortOrder')}
              label="Order"
            >
              <MenuItem value="desc">↓</MenuItem>
              <MenuItem value="asc">↑</MenuItem>
            </Select>
          </FormControl>
        </Grid>
      </Grid>
    </Box>
  );
}

export default IssueFilters;