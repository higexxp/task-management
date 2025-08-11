import React from 'react';
import { Chip, Tooltip } from '@mui/material';
import {
  PriorityHigh as HighPriorityIcon,
  Remove as MediumPriorityIcon,
  KeyboardArrowDown as LowPriorityIcon,
  BugReport as BugIcon,
  Star as FeatureIcon,
  Build as EnhancementIcon,
  Description as DocumentationIcon,
  Help as QuestionIcon,
  Circle as SmallIcon,
  RadioButtonUnchecked as MediumIcon,
  Adjust as LargeIcon,
  Schedule as TodoIcon,
  PlayArrow as InProgressIcon,
  RateReview as ReviewIcon,
  CheckCircle as DoneIcon,
} from '@mui/icons-material';
import {
  getPriorityColor,
  getCategoryColor,
  getSizeColor,
  getStatusColor,
} from '../utils/metadata';

interface MetadataChipProps {
  type: 'priority' | 'category' | 'size' | 'status';
  value: string;
  size?: 'small' | 'medium';
  variant?: 'filled' | 'outlined';
}

function MetadataChip({ type, value, size = 'small', variant = 'filled' }: MetadataChipProps) {
  const getIcon = () => {
    switch (type) {
      case 'priority':
        switch (value) {
          case 'high':
            return <HighPriorityIcon />;
          case 'medium':
            return <MediumPriorityIcon />;
          case 'low':
            return <LowPriorityIcon />;
          default:
            return null;
        }

      case 'category':
        switch (value) {
          case 'bug':
            return <BugIcon />;
          case 'feature':
            return <FeatureIcon />;
          case 'enhancement':
            return <EnhancementIcon />;
          case 'documentation':
            return <DocumentationIcon />;
          case 'question':
            return <QuestionIcon />;
          default:
            return null;
        }

      case 'size':
        switch (value) {
          case 'small':
            return <SmallIcon />;
          case 'medium':
            return <MediumIcon />;
          case 'large':
            return <LargeIcon />;
          default:
            return null;
        }

      case 'status':
        switch (value) {
          case 'todo':
            return <TodoIcon />;
          case 'in-progress':
            return <InProgressIcon />;
          case 'review':
            return <ReviewIcon />;
          case 'done':
            return <DoneIcon />;
          default:
            return null;
        }

      default:
        return null;
    }
  };

  const getColor = () => {
    switch (type) {
      case 'priority':
        return getPriorityColor(value);
      case 'category':
        return getCategoryColor(value);
      case 'size':
        return getSizeColor(value);
      case 'status':
        return getStatusColor(value);
      default:
        return '#757575';
    }
  };

  const getLabel = () => {
    return value.charAt(0).toUpperCase() + value.slice(1).replace('-', ' ');
  };

  const getTooltip = () => {
    return `${type.charAt(0).toUpperCase() + type.slice(1)}: ${getLabel()}`;
  };

  const color = getColor();
  const icon = getIcon();

  return (
    <Tooltip title={getTooltip()}>
      <Chip
        icon={icon}
        label={getLabel()}
        size={size}
        variant={variant}
        sx={{
          backgroundColor: variant === 'filled' ? color : 'transparent',
          color: variant === 'filled' ? 'white' : color,
          borderColor: color,
          '& .MuiChip-icon': {
            color: variant === 'filled' ? 'white' : color,
          },
        }}
      />
    </Tooltip>
  );
}

export default MetadataChip;