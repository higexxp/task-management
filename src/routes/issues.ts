import { Router, Request, Response } from 'express';
import { GitHubService } from '../services/github.js';
import { redisService } from '../services/redis.js';
import { logger } from '../utils/logger.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Get issues for a repository with metadata
router.get('/:owner/:repo', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;
    const { 
      state = 'open',
      labels,
      sort = 'created',
      direction = 'desc',
      per_page = '30',
      page = '1'
    } = req.query;

    // Validate parameters
    if (!owner || !repo) {
      res.status(400).json({
        success: false,
        error: 'Owner and repository name are required',
      });
      return;
    }

    // Check cache first
    const cacheKey = redisService.getCacheKey(
      'issues',
      owner,
      repo,
      state as string,
      labels as string || '',
      sort as string,
      direction as string,
      per_page as string,
      page as string
    );
    let issues = await redisService.get<any[]>(cacheKey);

    if (!issues) {
      // Create GitHub service (with user token if authenticated)
      const githubService = new GitHubService(req.user?.access_token);

      // Fetch issues with metadata
      issues = await githubService.getExtendedRepositoryIssues(owner, repo, {
        state: state as 'open' | 'closed' | 'all',
        labels: labels as string,
        sort: sort as 'created' | 'updated' | 'comments',
        direction: direction as 'asc' | 'desc',
        per_page: parseInt(per_page as string, 10),
        page: parseInt(page as string, 10),
      });

      // Cache for 5 minutes
      await redisService.set(cacheKey, issues, 300);
    }

    res.json({
      success: true,
      data: {
        issues,
        repository: `${owner}/${repo}`,
        pagination: {
          page: parseInt(page as string, 10),
          per_page: parseInt(per_page as string, 10),
          total: issues.length,
        },
        filters: {
          state,
          labels,
          sort,
          direction,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to get repository issues', { 
      error: errorMessage,
      stack: errorStack,
      params: req.params,
      query: req.query
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issues',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Get a specific issue with metadata and dependencies
router.get('/:owner/:repo/:issueNumber', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { owner, repo, issueNumber } = req.params;

    // Validate parameters
    if (!owner || !repo || !issueNumber) {
      res.status(400).json({
        success: false,
        error: 'Owner, repository name, and issue number are required',
      });
      return;
    }

    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum)) {
      res.status(400).json({
        success: false,
        error: 'Issue number must be a valid integer',
      });
      return;
    }

    // Check cache first
    const cacheKey = redisService.getCacheKey('issue', owner, repo, issueNumber);
    let issue = await redisService.get<any>(cacheKey);

    if (!issue) {
      // Create GitHub service (with user token if authenticated)
      const githubService = new GitHubService(req.user?.access_token);

      // Fetch issue with metadata and dependencies
      issue = await githubService.getExtendedIssue(owner, repo, issueNum);

      // Cache for 2 minutes (shorter cache for individual issues)
      await redisService.set(cacheKey, issue, 120);
    }

    res.json({
      success: true,
      data: {
        issue,
        repository: `${owner}/${repo}`,
        metadata: issue.metadata,
        dependencies: issue.parsedDependencies,
        summary: {
          hasDependencies: issue.parsedDependencies.length > 0,
          dependsOn: issue.parsedDependencies.filter((d: any) => d.type === 'depends_on').length,
          blocks: issue.parsedDependencies.filter((d: any) => d.type === 'blocks').length,
          crossRepository: issue.parsedDependencies.filter((d: any) => d.repository).length,
        },
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Handle specific GitHub API errors
    if (errorMessage.includes('Not Found')) {
      res.status(404).json({
        success: false,
        error: 'Issue not found',
        details: 'The specified issue does not exist or you do not have access to it',
      });
      return;
    }

    logger.error('Failed to get issue', { 
      error: errorMessage,
      stack: errorStack,
      params: req.params
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch issue',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Update issue metadata (requires authentication)
router.put('/:owner/:repo/:issueNumber/metadata', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { owner, repo, issueNumber } = req.params;
    const { metadata } = req.body;

    // Validate parameters
    if (!owner || !repo || !issueNumber) {
      res.status(400).json({
        success: false,
        error: 'Owner, repository name, and issue number are required',
      });
      return;
    }

    if (!metadata || typeof metadata !== 'object') {
      res.status(400).json({
        success: false,
        error: 'Metadata object is required',
      });
      return;
    }

    const issueNum = parseInt(issueNumber, 10);
    if (isNaN(issueNum)) {
      res.status(400).json({
        success: false,
        error: 'Issue number must be a valid integer',
      });
      return;
    }

    // Create GitHub service with user token
    const githubService = new GitHubService(req.user?.access_token);

    // Update issue metadata
    const updatedIssue = await githubService.updateIssueMetadata(owner, repo, issueNum, metadata);

    // Invalidate cache
    const cacheKey = redisService.getCacheKey('issue', owner, repo, issueNumber);
    await redisService.del(cacheKey);

    // Also invalidate issues list cache
    const listCachePattern = redisService.getCacheKey('issues', owner, repo);
    // Note: In a real implementation, you'd want to invalidate all related cache keys

    res.json({
      success: true,
      data: {
        issue: updatedIssue,
        repository: `${owner}/${repo}`,
        updatedMetadata: updatedIssue.metadata,
        message: 'Issue metadata updated successfully',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Handle specific GitHub API errors
    if (errorMessage.includes('Not Found')) {
      res.status(404).json({
        success: false,
        error: 'Issue not found',
        details: 'The specified issue does not exist or you do not have access to it',
      });
      return;
    }

    if (errorMessage.includes('Forbidden')) {
      res.status(403).json({
        success: false,
        error: 'Permission denied',
        details: 'You do not have permission to update this issue',
      });
      return;
    }

    logger.error('Failed to update issue metadata', { 
      error: errorMessage,
      stack: errorStack,
      params: req.params,
      body: req.body
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to update issue metadata',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Initialize repository labels (requires authentication)
router.post('/:owner/:repo/labels/init', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;

    // Validate parameters
    if (!owner || !repo) {
      res.status(400).json({
        success: false,
        error: 'Owner and repository name are required',
      });
      return;
    }

    // Create GitHub service with user token
    const githubService = new GitHubService(req.user?.access_token);

    // Initialize repository labels
    await githubService.initializeRepositoryLabels(owner, repo);

    res.json({
      success: true,
      data: {
        repository: `${owner}/${repo}`,
        message: 'Repository labels initialized successfully',
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Handle specific GitHub API errors
    if (errorMessage.includes('Not Found')) {
      res.status(404).json({
        success: false,
        error: 'Repository not found',
        details: 'The specified repository does not exist or you do not have access to it',
      });
      return;
    }

    if (errorMessage.includes('Forbidden')) {
      res.status(403).json({
        success: false,
        error: 'Permission denied',
        details: 'You do not have permission to manage labels in this repository',
      });
      return;
    }

    logger.error('Failed to initialize repository labels', { 
      error: errorMessage,
      stack: errorStack,
      params: req.params
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to initialize repository labels',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

// Get repository statistics
router.get('/:owner/:repo/stats', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { owner, repo } = req.params;

    // Validate parameters
    if (!owner || !repo) {
      res.status(400).json({
        success: false,
        error: 'Owner and repository name are required',
      });
      return;
    }

    // Check cache first
    const cacheKey = redisService.getCacheKey('stats', owner, repo);
    let stats = await redisService.get<any>(cacheKey);

    if (!stats) {
      // Create GitHub service (with user token if authenticated)
      const githubService = new GitHubService(req.user?.access_token);

      // Fetch all open issues to calculate statistics
      const issues = await githubService.getExtendedRepositoryIssues(owner, repo, {
        state: 'all',
        per_page: 100, // Limit for performance
      });

      // Calculate statistics
      const openIssues = issues.filter(issue => issue.state === 'open');
      const closedIssues = issues.filter(issue => issue.state === 'closed');

      // Priority distribution
      const priorityStats = {
        critical: openIssues.filter(issue => issue.metadata.priority === 'critical').length,
        high: openIssues.filter(issue => issue.metadata.priority === 'high').length,
        medium: openIssues.filter(issue => issue.metadata.priority === 'medium').length,
        low: openIssues.filter(issue => issue.metadata.priority === 'low').length,
      };

      // Category distribution
      const categoryStats = {
        frontend: openIssues.filter(issue => issue.metadata.category === 'frontend').length,
        backend: openIssues.filter(issue => issue.metadata.category === 'backend').length,
        design: openIssues.filter(issue => issue.metadata.category === 'design').length,
        testing: openIssues.filter(issue => issue.metadata.category === 'testing').length,
        docs: openIssues.filter(issue => issue.metadata.category === 'docs').length,
      };

      // Size distribution
      const sizeStats = {
        xs: openIssues.filter(issue => issue.metadata.estimatedSize === 'xs').length,
        small: openIssues.filter(issue => issue.metadata.estimatedSize === 'small').length,
        medium: openIssues.filter(issue => issue.metadata.estimatedSize === 'medium').length,
        large: openIssues.filter(issue => issue.metadata.estimatedSize === 'large').length,
        xl: openIssues.filter(issue => issue.metadata.estimatedSize === 'xl').length,
      };

      // Dependency statistics
      const issuesWithDependencies = openIssues.filter(issue => issue.parsedDependencies.length > 0);
      const totalDependencies = openIssues.reduce((sum, issue) => sum + issue.parsedDependencies.length, 0);

      stats = {
        repository: `${owner}/${repo}`,
        overview: {
          totalIssues: issues.length,
          openIssues: openIssues.length,
          closedIssues: closedIssues.length,
        },
        priority: priorityStats,
        category: categoryStats,
        size: sizeStats,
        dependencies: {
          issuesWithDependencies: issuesWithDependencies.length,
          totalDependencies,
          averageDependenciesPerIssue: openIssues.length > 0 
            ? (totalDependencies / openIssues.length).toFixed(2)
            : '0.00',
        },
        lastUpdated: new Date().toISOString(),
      };

      // Cache for 10 minutes
      await redisService.set(cacheKey, stats, 600);
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    logger.error('Failed to get repository statistics', { 
      error: errorMessage,
      stack: errorStack,
      params: req.params
    });
    
    res.status(500).json({
      success: false,
      error: 'Failed to fetch repository statistics',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
    });
  }
});

export default router;