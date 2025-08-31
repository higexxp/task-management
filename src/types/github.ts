// Import dependency types
import type { IssueDependency } from '../services/dependency.js';

// GitHub API types
export interface GitHubUser {
  id: number;
  login: string;
  name?: string;
  avatar_url: string;
  html_url: string;
}

export interface GitHubLabel {
  id: number;
  name: string;
  color: string;
  description?: string | undefined;
}

export interface GitHubIssue {
  id: number;
  number: number;
  title: string;
  body: string | null;
  state: 'open' | 'closed';
  assignees: GitHubUser[];
  labels: GitHubLabel[];
  user: GitHubUser;
  created_at: string;
  updated_at: string;
  html_url: string;
  repository_url: string;
}

// Phase 1: Label-based metadata
export interface LabelBasedMetadata {
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'frontend' | 'backend' | 'design' | 'testing' | 'docs';
  estimatedSize: 'xs' | 'small' | 'medium' | 'large' | 'xl';
  status: 'todo' | 'in-progress' | 'review' | 'done';
  timeSpent?: 'none' | '0-2h' | '2-4h' | '4-8h' | '8h+';
}

// Extended issue with metadata
export interface ExtendedIssue extends GitHubIssue {
  metadata: LabelBasedMetadata;
  parsedDependencies: IssueDependency[];
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  has_next: boolean;
  has_prev: boolean;
}