// Metadata extraction and utility functions

export interface IssueMetadata {
  priority?: 'high' | 'medium' | 'low';
  category?: 'bug' | 'feature' | 'enhancement' | 'documentation' | 'question';
  size?: 'small' | 'medium' | 'large';
  status?: 'todo' | 'in-progress' | 'review' | 'done';
  timeSpent?: number; // in hours
}

export interface Label {
  id: number;
  name: string;
  color: string;
  description?: string;
}

export interface EnhancedIssue {
  id: number;
  number: number;
  title: string;
  body: string;
  state: 'open' | 'closed';
  labels: Label[];
  user: {
    login: string;
    avatar_url: string;
  };
  assignee?: {
    login: string;
    avatar_url: string;
  };
  created_at: string;
  updated_at: string;
  metadata: IssueMetadata;
}

/**
 * Extract metadata from GitHub labels
 */
export function extractMetadataFromLabels(labels: Label[]): IssueMetadata {
  const metadata: IssueMetadata = {};

  labels.forEach(label => {
    const labelName = label.name.toLowerCase();

    // Priority
    if (labelName.startsWith('priority:')) {
      const priority = labelName.replace('priority:', '').trim();
      if (['high', 'medium', 'low'].includes(priority)) {
        metadata.priority = priority as IssueMetadata['priority'];
      }
    }

    // Category
    if (labelName.startsWith('category:')) {
      const category = labelName.replace('category:', '').trim();
      if (['bug', 'feature', 'enhancement', 'documentation', 'question'].includes(category)) {
        metadata.category = category as IssueMetadata['category'];
      }
    }

    // Size
    if (labelName.startsWith('size:')) {
      const size = labelName.replace('size:', '').trim();
      if (['small', 'medium', 'large'].includes(size)) {
        metadata.size = size as IssueMetadata['size'];
      }
    }

    // Status
    if (labelName.startsWith('status:')) {
      const status = labelName.replace('status:', '').trim();
      if (['todo', 'in-progress', 'review', 'done'].includes(status)) {
        metadata.status = status as IssueMetadata['status'];
      }
    }

    // Time spent
    if (labelName.startsWith('time-spent:')) {
      const timeStr = labelName.replace('time-spent:', '').trim();
      const timeMatch = timeStr.match(/(\d+(?:\.\d+)?)h?/);
      if (timeMatch) {
        metadata.timeSpent = parseFloat(timeMatch[1]);
      }
    }
  });

  return metadata;
}

/**
 * Get priority color
 */
export function getPriorityColor(priority?: string): string {
  switch (priority) {
    case 'high':
      return '#d32f2f'; // red
    case 'medium':
      return '#ed6c02'; // orange
    case 'low':
      return '#2e7d32'; // green
    default:
      return '#757575'; // gray
  }
}

/**
 * Get category color
 */
export function getCategoryColor(category?: string): string {
  switch (category) {
    case 'bug':
      return '#d32f2f'; // red
    case 'feature':
      return '#1976d2'; // blue
    case 'enhancement':
      return '#388e3c'; // green
    case 'documentation':
      return '#7b1fa2'; // purple
    case 'question':
      return '#f57c00'; // orange
    default:
      return '#757575'; // gray
  }
}

/**
 * Get size color
 */
export function getSizeColor(size?: string): string {
  switch (size) {
    case 'small':
      return '#2e7d32'; // green
    case 'medium':
      return '#ed6c02'; // orange
    case 'large':
      return '#d32f2f'; // red
    default:
      return '#757575'; // gray
  }
}

/**
 * Get status color
 */
export function getStatusColor(status?: string): string {
  switch (status) {
    case 'todo':
      return '#757575'; // gray
    case 'in-progress':
      return '#1976d2'; // blue
    case 'review':
      return '#ed6c02'; // orange
    case 'done':
      return '#2e7d32'; // green
    default:
      return '#757575'; // gray
  }
}

/**
 * Sort issues by various criteria
 */
export function sortIssues(
  issues: EnhancedIssue[],
  sortBy: 'priority' | 'created' | 'updated' | 'number',
  sortOrder: 'asc' | 'desc' = 'desc'
): EnhancedIssue[] {
  return [...issues].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'priority':
        const priorityOrder = { high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.metadata.priority || 'low' as keyof typeof priorityOrder] || 0;
        const bPriority = priorityOrder[b.metadata.priority || 'low' as keyof typeof priorityOrder] || 0;
        comparison = aPriority - bPriority;
        break;

      case 'created':
        comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        break;

      case 'updated':
        comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
        break;

      case 'number':
        comparison = a.number - b.number;
        break;

      default:
        comparison = 0;
    }

    return sortOrder === 'desc' ? -comparison : comparison;
  });
}

/**
 * Filter issues by metadata
 */
export function filterIssues(
  issues: EnhancedIssue[],
  filters: {
    priority?: string[];
    category?: string[];
    size?: string[];
    status?: string[];
    state?: string;
    search?: string;
  }
): EnhancedIssue[] {
  return issues.filter(issue => {
    // Priority filter
    if (filters.priority && filters.priority.length > 0) {
      if (!issue.metadata.priority || !filters.priority.includes(issue.metadata.priority)) {
        return false;
      }
    }

    // Category filter
    if (filters.category && filters.category.length > 0) {
      if (!issue.metadata.category || !filters.category.includes(issue.metadata.category)) {
        return false;
      }
    }

    // Size filter
    if (filters.size && filters.size.length > 0) {
      if (!issue.metadata.size || !filters.size.includes(issue.metadata.size)) {
        return false;
      }
    }

    // Status filter
    if (filters.status && filters.status.length > 0) {
      if (!issue.metadata.status || !filters.status.includes(issue.metadata.status)) {
        return false;
      }
    }

    // State filter
    if (filters.state && filters.state !== 'all') {
      if (issue.state !== filters.state) {
        return false;
      }
    }

    // Search filter
    if (filters.search && filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      const titleMatch = issue.title.toLowerCase().includes(searchTerm);
      const bodyMatch = issue.body?.toLowerCase().includes(searchTerm);
      if (!titleMatch && !bodyMatch) {
        return false;
      }
    }

    return true;
  });
}