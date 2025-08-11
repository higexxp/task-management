import { Octokit } from '@octokit/rest';
import { createOAuthAppAuth } from '@octokit/auth-oauth-app';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { GitHubIssue, GitHubLabel, GitHubUser, ExtendedIssue, LabelBasedMetadata } from '../types/github.js';
import { MetadataService } from './metadata.js';
import { DependencyService, IssueDependency } from './dependency.js';

export class GitHubService {
  private octokit: Octokit;
  private metadataService: MetadataService;
  private dependencyService: DependencyService;

  constructor(accessToken?: string) {
    this.metadataService = new MetadataService();
    this.dependencyService = new DependencyService();
    if (accessToken) {
      // User-specific client with access token
      this.octokit = new Octokit({
        auth: accessToken,
      });
    } else {
      // App-level client with OAuth app credentials
      this.octokit = new Octokit({
        authStrategy: createOAuthAppAuth,
        auth: {
          clientId: config.github.clientId,
          clientSecret: config.github.clientSecret,
        },
      });
    }
  }

  // OAuth methods
  async exchangeCodeForToken(code: string): Promise<string> {
    try {
      const { data } = await this.octokit.rest.apps.createInstallationAccessToken({
        installation_id: 0, // This will be replaced with proper OAuth flow
      });
      
      // For now, use a simpler approach with OAuth app
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: config.github.clientId,
          client_secret: config.github.clientSecret,
          code,
        }),
      });

      const data_oauth = await response.json() as { access_token: string; error?: string };
      
      if (data_oauth.error) {
        throw new Error(`OAuth error: ${data_oauth.error}`);
      }

      return data_oauth.access_token;
    } catch (error) {
      logger.error('Failed to exchange code for token', { error });
      throw error;
    }
  }

  async getCurrentUser(): Promise<GitHubUser> {
    try {
      const { data } = await this.octokit.rest.users.getAuthenticated();
      return {
        id: data.id,
        login: data.login,
        avatar_url: data.avatar_url,
        html_url: data.html_url,
      };
    } catch (error) {
      logger.error('Failed to get current user', { error });
      throw error;
    }
  }

  // Repository and Issue methods
  async getRepositoryIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<GitHubIssue[]> {
    try {
      const { data } = await this.octokit.rest.issues.listForRepo({
        owner,
        repo,
        state: options.state || 'open',
        labels: options.labels,
        sort: options.sort || 'created',
        direction: options.direction || 'desc',
        per_page: options.per_page || 30,
        page: options.page || 1,
      });

      return data.map(issue => ({
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body ?? null,
        state: issue.state as 'open' | 'closed',
        assignees: issue.assignees?.map(assignee => ({
          id: assignee?.id || 0,
          login: assignee?.login || '',
          avatar_url: assignee?.avatar_url || '',
          html_url: assignee?.html_url || '',
        })) || [],
        labels: issue.labels?.map(label => ({
          id: typeof label === 'object' && label !== null ? label.id || 0 : 0,
          name: typeof label === 'string' ? label : label?.name || '',
          color: typeof label === 'object' && label !== null ? label.color || '' : '',
          description: typeof label === 'object' && label !== null ? (label.description ?? undefined) : undefined,
        })) || [],
        user: {
          id: issue.user?.id || 0,
          login: issue.user?.login || '',
          avatar_url: issue.user?.avatar_url || '',
          html_url: issue.user?.html_url || '',
        },
        created_at: issue.created_at,
        updated_at: issue.updated_at,
        html_url: issue.html_url,
        repository_url: issue.repository_url,
      }));
    } catch (error) {
      logger.error('Failed to get repository issues', { owner, repo, error });
      throw error;
    }
  }

  async getIssue(owner: string, repo: string, issueNumber: number): Promise<GitHubIssue> {
    try {
      const { data } = await this.octokit.rest.issues.get({
        owner,
        repo,
        issue_number: issueNumber,
      });

      return {
        id: data.id,
        number: data.number,
        title: data.title,
        body: data.body ?? null,
        state: data.state as 'open' | 'closed',
        assignees: data.assignees?.map(assignee => ({
          id: assignee?.id || 0,
          login: assignee?.login || '',
          avatar_url: assignee?.avatar_url || '',
          html_url: assignee?.html_url || '',
        })) || [],
        labels: data.labels?.map(label => ({
          id: typeof label === 'object' && label !== null ? label.id || 0 : 0,
          name: typeof label === 'string' ? label : label?.name || '',
          color: typeof label === 'object' && label !== null ? label.color || '' : '',
          description: typeof label === 'object' && label !== null ? label.description || undefined : undefined,
        })) || [],
        user: {
          id: data.user?.id || 0,
          login: data.user?.login || '',
          avatar_url: data.user?.avatar_url || '',
          html_url: data.user?.html_url || '',
        },
        created_at: data.created_at,
        updated_at: data.updated_at,
        html_url: data.html_url,
        repository_url: data.repository_url,
      };
    } catch (error) {
      logger.error('Failed to get issue', { owner, repo, issueNumber, error });
      throw error;
    }
  }

  async updateIssueLabels(
    owner: string,
    repo: string,
    issueNumber: number,
    labels: string[]
  ): Promise<GitHubLabel[]> {
    try {
      const { data } = await this.octokit.rest.issues.setLabels({
        owner,
        repo,
        issue_number: issueNumber,
        labels,
      });

      return data.map(label => ({
        id: label.id,
        name: label.name,
        color: label.color,
        description: label.description || undefined,
      }));
    } catch (error) {
      logger.error('Failed to update issue labels', { owner, repo, issueNumber, labels, error });
      throw error;
    }
  }

  async createRepositoryLabel(
    owner: string,
    repo: string,
    name: string,
    color: string,
    description?: string
  ): Promise<GitHubLabel> {
    try {
      const labelData: any = {
        owner,
        repo,
        name,
        color,
      };
      
      if (description !== undefined) {
        labelData.description = description;
      }

      const { data } = await this.octokit.rest.issues.createLabel(labelData);

      return {
        id: data.id,
        name: data.name,
        color: data.color,
        description: data.description || undefined,
      };
    } catch (error) {
      logger.error('Failed to create repository label', { owner, repo, name, color, error });
      throw error;
    }
  }

  // Metadata-specific methods
  async getExtendedIssue(owner: string, repo: string, issueNumber: number): Promise<ExtendedIssue> {
    try {
      const issue = await this.getIssue(owner, repo, issueNumber);
      const metadata = this.metadataService.extractMetadataFromLabels(issue.labels);
      const parsedDependencies = this.parseDependenciesFromBody(issue.body || '', `${owner}/${repo}`);

      return {
        ...issue,
        metadata,
        parsedDependencies,
      };
    } catch (error) {
      logger.error('Failed to get extended issue', { owner, repo, issueNumber, error });
      throw error;
    }
  }

  async getExtendedRepositoryIssues(
    owner: string,
    repo: string,
    options: {
      state?: 'open' | 'closed' | 'all';
      labels?: string;
      sort?: 'created' | 'updated' | 'comments';
      direction?: 'asc' | 'desc';
      per_page?: number;
      page?: number;
    } = {}
  ): Promise<ExtendedIssue[]> {
    try {
      const issues = await this.getRepositoryIssues(owner, repo, options);
      
      return issues.map(issue => {
        const metadata = this.metadataService.extractMetadataFromLabels(issue.labels);
        const parsedDependencies = this.parseDependenciesFromBody(issue.body || '', `${owner}/${repo}`);

        return {
          ...issue,
          metadata,
          parsedDependencies,
        };
      });
    } catch (error) {
      logger.error('Failed to get extended repository issues', { owner, repo, error });
      throw error;
    }
  }

  async updateIssueMetadata(
    owner: string,
    repo: string,
    issueNumber: number,
    metadata: Partial<LabelBasedMetadata>
  ): Promise<ExtendedIssue> {
    try {
      // Validate metadata
      const validation = this.metadataService.validateMetadata(metadata);
      if (!validation.isValid) {
        throw new Error(`Invalid metadata: ${validation.errors.join(', ')}`);
      }

      // Get current issue to preserve existing labels
      const currentIssue = await this.getIssue(owner, repo, issueNumber);
      
      // Merge existing labels with new metadata
      const newLabels = this.metadataService.mergeLabelsWithMetadata(currentIssue.labels, metadata);
      
      // Update labels
      await this.updateIssueLabels(owner, repo, issueNumber, newLabels);
      
      // Return updated extended issue
      return this.getExtendedIssue(owner, repo, issueNumber);
    } catch (error) {
      logger.error('Failed to update issue metadata', { owner, repo, issueNumber, metadata, error });
      throw error;
    }
  }

  async initializeRepositoryLabels(owner: string, repo: string): Promise<void> {
    try {
      const requiredLabels = this.metadataService.getAllRequiredLabels();
      
      // Get existing labels
      const { data: existingLabels } = await this.octokit.rest.issues.listLabelsForRepo({
        owner,
        repo,
      });

      const existingLabelNames = new Set(existingLabels.map(label => label.name));

      // Create missing labels
      for (const labelDef of requiredLabels) {
        if (!existingLabelNames.has(labelDef.name)) {
          try {
            await this.createRepositoryLabel(
              owner,
              repo,
              labelDef.name,
              labelDef.color,
              labelDef.description
            );
            logger.info('Created label', { owner, repo, label: labelDef.name });
          } catch (error) {
            // Log but don't fail if label already exists (race condition)
            if (error instanceof Error && error.message.includes('already_exists')) {
              logger.debug('Label already exists', { owner, repo, label: labelDef.name });
            } else {
              logger.warn('Failed to create label', { owner, repo, label: labelDef.name, error });
            }
          }
        }
      }

      logger.info('Repository labels initialized', { owner, repo });
    } catch (error) {
      logger.error('Failed to initialize repository labels', { owner, repo, error });
      throw error;
    }
  }

  // Helper method to parse dependencies from issue body using DependencyService
  private parseDependenciesFromBody(body: string, repository?: string) {
    return this.dependencyService.parseDependenciesFromBody(body, repository);
  }
}