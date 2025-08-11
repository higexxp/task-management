import React from 'react';
import {
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { IssueMetadata } from '../utils/metadata';

interface MetadataEditorProps {
  metadata: IssueMetadata;
  onChange: (metadata: IssueMetadata) => void;
}

const PRIORITY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const CATEGORY_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'bug', label: 'Bug' },
  { value: 'feature', label: 'Feature' },
  { value: 'enhancement', label: 'Enhancement' },
  { value: 'documentation', label: 'Documentation' },
  { value: 'question', label: 'Question' },
];

const SIZE_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'None' },
  { value: 'todo', label: 'To Do' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'done', label: 'Done' },
];

function MetadataEditor({ metadata, onChange }: MetadataEditorProps) {
  const handleChange = (field: keyof IssueMetadata, value: any) => {
    onChange({
      ...metadata,
      [field]: value || undefined,
    });
  };

  return (
    <Box display="flex" flexDirection="column" gap={3}>
      {/* Priority */}
      <FormControl fullWidth size="small">
        <InputLabel>Priority</InputLabel>
        <Select
          value={metadata.priority || ''}
          label="Priority"
          onChange={(e) => handleChange('priority', e.target.value)}
        >
          {PRIORITY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Category */}
      <FormControl fullWidth size="small">
        <InputLabel>Category</InputLabel>
        <Select
          value={metadata.category || ''}
          label="Category"
          onChange={(e) => handleChange('category', e.target.value)}
        >
          {CATEGORY_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Size */}
      <FormControl fullWidth size="small">
        <InputLabel>Size</InputLabel>
        <Select
          value={metadata.size || ''}
          label="Size"
          onChange={(e) => handleChange('size', e.target.value)}
        >
          {SIZE_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Status */}
      <FormControl fullWidth size="small">
        <InputLabel>Status</InputLabel>
        <Select
          value={metadata.status || ''}
          label="Status"
          onChange={(e) => handleChange('status', e.target.value)}
        >
          {STATUS_OPTIONS.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {/* Time Spent */}
      <TextField
        label="Time Spent (hours)"
        type="number"
        size="small"
        value={metadata.timeSpent || ''}
        onChange={(e) => {
          const value = parseFloat(e.target.value);
          handleChange('timeSpent', isNaN(value) ? undefined : value);
        }}
        inputProps={{
          min: 0,
          step: 0.5,
        }}
        helperText="Enter time spent in hours (e.g., 2.5)"
      />

      <Typography variant="caption" color="text.secondary">
        Changes will be saved as GitHub labels when you click Save.
      </Typography>
    </Box>
  );
}

export default MetadataEditor;