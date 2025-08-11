import { GitHubLabel, LabelBasedMetadata } from '../types/github.js';
import { logger } from '../utils/logger.js';

// Label format definitions
export const LABEL_PREFIXES = {
  PRIORITY: 'priority',
  CATEGORY: 'category', 
  SIZE: 'size',
  STATUS: 'status',
  TIME_SPENT: 'time-spent',
} as const;

export const LABEL_VALUES = {
  PRIORITY: ['low', 'medium', 'high', 'critical'] as const,
  CATEGORY: ['frontend', 'backend', 'design', 'testing', 'docs'] as const,
  SIZE: ['xs', 'small', 'medium', 'large', 'xl'] as const,
  STATUS: ['todo', 'in-progress', 'review', 'done'] as const,
  TIME_SPENT: ['none', '0-2h', '2-4h', '4-8h', '8h+'] as const,
} as const;

// Label colors for consistent styling
export const LABEL_COLORS = {
  PRIORITY: {
    low: '0E8A16',      // Green
    medium: 'FBCA04',   // Yellow
    high: 'D93F0B',     // Orange
    critical: 'B60205', // Red
  },
  CATEGORY: {
    frontend: '1D76DB',  // Blue
    backend: '0052CC',   // Dark Blue
    design: 'E99695',    // Pink
    testing: '5319E7',   // Purple
    docs: '006B75',      // Teal
  },
  SIZE: {
    xs: 'C2E0C6',       // Light Green
    small: '7057FF',    // Light Purple
    medium: 'FBCA04',   // Yellow
    large: 'D93F0B',    // Orange
    xl: 'B60205',       // Red
  },
  STATUS: {
    todo: 'D4C5F9',     // Light Purple
    'in-progress': 'FBCA04', // Yellow
    review: 'FEF2C0',   // Light Yellow
    done: '0E8A16',     // Green
  },
  TIME_SPENT: {
    none: 'F9F9F9',     // Light Gray
    '0-2h': 'C2E0C6',   // Light Green
    '2-4h': 'FBCA04',   // Yellow
    '4-8h': 'D93F0B',   // Orange
    '8h+': 'B60205',    // Red
  },
} as const;

export class MetadataService {
  /**
   * Extract metadata from GitHub labels (supports both string[] and GitHubLabel[])
   */
  extractMetadataFromLabels(labels: (GitHubLabel | string)[]): LabelBasedMetadata {
    const metadata: LabelBasedMetadata = {
      priority: 'medium',
      category: 'backend',
      estimatedSize: 'medium',
      status: 'todo',
    };

    for (const label of labels) {
      // Handle both string labels and GitHubLabel objects
      const labelName = (typeof label === 'string' ? label : label.name || '').toLowerCase();
      
      // Parse priority labels
      if (labelName.startsWith(`${LABEL_PREFIXES.PRIORITY}:`)) {
        const value = labelName.split(':')[1] as LabelBasedMetadata['priority'];
        if (LABEL_VALUES.PRIORITY.includes(value)) {
          metadata.priority = value;
        }
      }
      
      // Parse category labels
      else if (labelName.startsWith(`${LABEL_PREFIXES.CATEGORY}:`)) {
        const value = labelName.split(':')[1] as LabelBasedMetadata['category'];
        if (LABEL_VALUES.CATEGORY.includes(value)) {
          metadata.category = value;
        }
      }
      
      // Parse size labels
      else if (labelName.startsWith(`${LABEL_PREFIXES.SIZE}:`)) {
        const value = labelName.split(':')[1] as LabelBasedMetadata['estimatedSize'];
        if (LABEL_VALUES.SIZE.includes(value)) {
          metadata.estimatedSize = value;
        }
      }
      
      // Parse status labels
      else if (labelName.startsWith(`${LABEL_PREFIXES.STATUS}:`)) {
        const value = labelName.split(':')[1] as LabelBasedMetadata['status'];
        if (LABEL_VALUES.STATUS.includes(value)) {
          metadata.status = value;
        }
      }
      
      // Parse time spent labels
      else if (labelName.startsWith(`${LABEL_PREFIXES.TIME_SPENT}:`)) {
        const value = labelName.split(':')[1] as NonNullable<LabelBasedMetadata['timeSpent']>;
        if (LABEL_VALUES.TIME_SPENT.includes(value)) {
          metadata.timeSpent = value;
        }
      }
    }

    return metadata;
  }

  /**
   * Convert metadata to GitHub label names
   */
  convertMetadataToLabels(metadata: Partial<LabelBasedMetadata>): string[] {
    const labels: string[] = [];

    if (metadata.priority) {
      labels.push(`${LABEL_PREFIXES.PRIORITY}:${metadata.priority}`);
    }

    if (metadata.category) {
      labels.push(`${LABEL_PREFIXES.CATEGORY}:${metadata.category}`);
    }

    if (metadata.estimatedSize) {
      labels.push(`${LABEL_PREFIXES.SIZE}:${metadata.estimatedSize}`);
    }

    if (metadata.status) {
      labels.push(`${LABEL_PREFIXES.STATUS}:${metadata.status}`);
    }

    if (metadata.timeSpent) {
      labels.push(`${LABEL_PREFIXES.TIME_SPENT}:${metadata.timeSpent}`);
    }

    return labels;
  }

  /**
   * Validate metadata values
   */
  validateMetadata(metadata: Partial<LabelBasedMetadata>): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (metadata.priority && !LABEL_VALUES.PRIORITY.includes(metadata.priority)) {
      errors.push(`Invalid priority: ${metadata.priority}. Must be one of: ${LABEL_VALUES.PRIORITY.join(', ')}`);
    }

    if (metadata.category && !LABEL_VALUES.CATEGORY.includes(metadata.category)) {
      errors.push(`Invalid category: ${metadata.category}. Must be one of: ${LABEL_VALUES.CATEGORY.join(', ')}`);
    }

    if (metadata.estimatedSize && !LABEL_VALUES.SIZE.includes(metadata.estimatedSize)) {
      errors.push(`Invalid size: ${metadata.estimatedSize}. Must be one of: ${LABEL_VALUES.SIZE.join(', ')}`);
    }

    if (metadata.status && !LABEL_VALUES.STATUS.includes(metadata.status)) {
      errors.push(`Invalid status: ${metadata.status}. Must be one of: ${LABEL_VALUES.STATUS.join(', ')}`);
    }

    if (metadata.timeSpent && !LABEL_VALUES.TIME_SPENT.includes(metadata.timeSpent)) {
      errors.push(`Invalid timeSpent: ${metadata.timeSpent}. Must be one of: ${LABEL_VALUES.TIME_SPENT.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get label definition for creating repository labels
   */
  getLabelDefinition(prefix: keyof typeof LABEL_PREFIXES, value: string): {
    name: string;
    color: string;
    description: string;
  } | null {
    const labelName = `${LABEL_PREFIXES[prefix]}:${value}`;
    
    let color = 'CCCCCC'; // Default gray
    let description = '';

    switch (prefix) {
      case 'PRIORITY':
        if (value in LABEL_COLORS.PRIORITY) {
          color = LABEL_COLORS.PRIORITY[value as keyof typeof LABEL_COLORS.PRIORITY];
          description = `Priority: ${value}`;
        }
        break;
      case 'CATEGORY':
        if (value in LABEL_COLORS.CATEGORY) {
          color = LABEL_COLORS.CATEGORY[value as keyof typeof LABEL_COLORS.CATEGORY];
          description = `Category: ${value}`;
        }
        break;
      case 'SIZE':
        if (value in LABEL_COLORS.SIZE) {
          color = LABEL_COLORS.SIZE[value as keyof typeof LABEL_COLORS.SIZE];
          description = `Estimated size: ${value}`;
        }
        break;
      case 'STATUS':
        if (value in LABEL_COLORS.STATUS) {
          color = LABEL_COLORS.STATUS[value as keyof typeof LABEL_COLORS.STATUS];
          description = `Status: ${value}`;
        }
        break;
      case 'TIME_SPENT':
        if (value in LABEL_COLORS.TIME_SPENT) {
          color = LABEL_COLORS.TIME_SPENT[value as keyof typeof LABEL_COLORS.TIME_SPENT];
          description = `Time spent: ${value}`;
        }
        break;
      default:
        return null;
    }

    return {
      name: labelName,
      color,
      description,
    };
  }

  /**
   * Get all required labels for a repository
   */
  getAllRequiredLabels(): Array<{ name: string; color: string; description: string }> {
    const labels: Array<{ name: string; color: string; description: string }> = [];

    // Add all priority labels
    for (const value of LABEL_VALUES.PRIORITY) {
      const label = this.getLabelDefinition('PRIORITY', value);
      if (label) labels.push(label);
    }

    // Add all category labels
    for (const value of LABEL_VALUES.CATEGORY) {
      const label = this.getLabelDefinition('CATEGORY', value);
      if (label) labels.push(label);
    }

    // Add all size labels
    for (const value of LABEL_VALUES.SIZE) {
      const label = this.getLabelDefinition('SIZE', value);
      if (label) labels.push(label);
    }

    // Add all status labels
    for (const value of LABEL_VALUES.STATUS) {
      const label = this.getLabelDefinition('STATUS', value);
      if (label) labels.push(label);
    }

    // Add all time spent labels
    for (const value of LABEL_VALUES.TIME_SPENT) {
      const label = this.getLabelDefinition('TIME_SPENT', value);
      if (label) labels.push(label);
    }

    return labels;
  }

  /**
   * Filter out metadata labels from a list of labels
   */
  filterMetadataLabels(labels: GitHubLabel[]): GitHubLabel[] {
    return labels.filter(label => {
      const labelName = (typeof label === 'string' ? label : label.name || '').toLowerCase();
      return Object.values(LABEL_PREFIXES).some(prefix => 
        labelName.startsWith(`${prefix}:`)
      );
    });
  }

  /**
   * Filter out non-metadata labels from a list of labels
   */
  filterNonMetadataLabels(labels: GitHubLabel[]): GitHubLabel[] {
    return labels.filter(label => {
      const labelName = (typeof label === 'string' ? label : label.name || '').toLowerCase();
      return !Object.values(LABEL_PREFIXES).some(prefix => 
        labelName.startsWith(`${prefix}:`)
      );
    });
  }

  /**
   * Merge existing labels with metadata labels
   */
  mergeLabelsWithMetadata(
    existingLabels: GitHubLabel[],
    metadata: Partial<LabelBasedMetadata>
  ): string[] {
    // Keep non-metadata labels
    const nonMetadataLabels = this.filterNonMetadataLabels(existingLabels)
      .map(label => typeof label === 'string' ? label : label.name || '');
    
    // Add metadata labels
    const metadataLabels = this.convertMetadataToLabels(metadata);
    
    return [...nonMetadataLabels, ...metadataLabels];
  }
}