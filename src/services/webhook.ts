import crypto from 'crypto';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { redisService } from './redis.js';
import { DependencyService } from './dependency.js';
import { MetadataService } from './metadata.js';

export interface GitHubWebhookEvent {
  action: string;
  issue?: any;
  label?: any;
  repository: {
    full_name: string;
    name: string;
    owner: {
      login: string;
    };
  };
  sender: {
    login: string;
  };
  changes?: any;
}

export class WebhookService {
  private dependencyService: DependencyService;
  private metadataService: MetadataService;

  constructor() {
    this.dependencyService = new DependencyService();
    this.metadataService = new MetadataService();
  }

  /**
   * Verify GitHub webhook signature
   */
  verifySignature(payload: string, signature: string): boolean {
    if (!signature) {
      logger.warn('No signature provided for webhook');
      return false;
    }

    const expectedSignature = crypto
      .createHmac('sha256', config.github.webhookSecret)
      .update(payload, 'utf8')
      .digest('hex');

    const providedSignature = signature.replace('sha256=', '');

    // Use timingSafeEqual to prevent timing attacks
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const providedBuffer = Buffer.from(providedSignature, 'hex');

    if (expectedBuffer.length !== providedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  }

  /**
   * Process GitHub webhook event
   */
  async processWebhookEvent(event: GitHubWebhookEvent, eventType: string): Promise<void> {
    const { repository, action } = event;
    const repoFullName = repository.full_name;

    logger.info('Processing webhook event', {
      eventType,
      action,
      repository: repoFullName,
      sender: event.sender.login,
    });

    try {
      // Record webhook statistics
      await this.recordWebhookStats(eventType, action, repoFullName);

      switch (eventType) {
        case 'issues':
          await this.handleIssueEvent(event);
          break;
        case 'issue_comment':
          await this.handleIssueCommentEvent(event);
          break;
        case 'label':
          await this.handleLabelEvent(event);
          break;
        case 'ping':
          await this.handlePingEvent(event);
          break;
        default:
          logger.debug('Unhandled webhook event type', { eventType, action });
      }
    } catch (error) {
      logger.error('Failed to process webhook event', {
        eventType,
        action,
        repository: repoFullName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Handle issue events (opened, edited, closed, etc.)
   */
  private async handleIssueEvent(event: GitHubWebhookEvent): Promise<void> {
    const { action, issue, repository, changes } = event;
    const repoFullName = repository.full_name;
    const issueNumber = issue?.number;

    if (!issue || !issueNumber) {
      logger.warn('Issue event missing issue data', { action, repository: repoFullName });
      return;
    }

    logger.info('Handling issue event', {
      action,
      repository: repoFullName,
      issueNumber,
      title: issue.title,
    });

    switch (action) {
      case 'opened':
      case 'edited':
      case 'closed':
      case 'reopened':
        await this.invalidateIssueCache(repoFullName, issueNumber);
        
        // If body was changed, reprocess dependencies
        if (changes?.body) {
          await this.reprocessIssueDependencies(repoFullName, issueNumber, issue.body);
        }

        // If labels were changed, update metadata cache
        if (changes?.labels) {
          await this.updateIssueMetadataCache(repoFullName, issueNumber, issue.labels);
        }
        break;

      case 'labeled':
      case 'unlabeled':
        await this.invalidateIssueCache(repoFullName, issueNumber);
        await this.updateIssueMetadataCache(repoFullName, issueNumber, issue.labels);
        break;

      case 'deleted':
        await this.invalidateIssueCache(repoFullName, issueNumber);
        await this.invalidateRepositoryCache(repoFullName);
        break;

      default:
        logger.debug('Unhandled issue action', { action, issueNumber });
    }

    // Always invalidate repository-level caches for any issue change
    await this.invalidateRepositoryCache(repoFullName);
  }

  /**
   * Handle issue comment events
   */
  private async handleIssueCommentEvent(event: GitHubWebhookEvent): Promise<void> {
    const { action, issue, repository } = event;
    const repoFullName = repository.full_name;
    const issueNumber = issue?.number;

    if (!issue || !issueNumber) {
      logger.warn('Issue comment event missing issue data', { action, repository: repoFullName });
      return;
    }

    logger.info('Handling issue comment event', {
      action,
      repository: repoFullName,
      issueNumber,
    });

    // Comments might contain metadata updates, so invalidate cache
    if (action === 'created' || action === 'edited' || action === 'deleted') {
      await this.invalidateIssueCache(repoFullName, issueNumber);
    }
  }

  /**
   * Handle label events (created, edited, deleted)
   */
  private async handleLabelEvent(event: GitHubWebhookEvent): Promise<void> {
    const { action, label, repository } = event;
    const repoFullName = repository.full_name;

    logger.info('Handling label event', {
      action,
      repository: repoFullName,
      labelName: label?.name,
    });

    // Label changes affect metadata parsing, so invalidate related caches
    if (action === 'created' || action === 'edited' || action === 'deleted') {
      await this.invalidateRepositoryCache(repoFullName);
      
      // If it's a metadata label, invalidate all issue caches
      if (label?.name && this.isMetadataLabel(label.name)) {
        await this.invalidateAllIssueCaches(repoFullName);
      }
    }
  }

  /**
   * Handle ping events (webhook setup verification)
   */
  private async handlePingEvent(event: GitHubWebhookEvent): Promise<void> {
    const { repository } = event;
    logger.info('Received ping event', {
      repository: repository.full_name,
      message: 'Webhook is properly configured',
    });
  }

  /**
   * Invalidate issue-specific cache entries
   */
  private async invalidateIssueCache(repoFullName: string, issueNumber: number): Promise<void> {
    const [owner, repo] = repoFullName.split('/');
    
    if (!owner || !repo) {
      logger.warn('Invalid repository full name', { repoFullName });
      return;
    }
    
    const cacheKeys = [
      redisService.getCacheKey('issue', owner, repo, issueNumber.toString()),
      // Add more specific cache keys as needed
    ];

    for (const key of cacheKeys) {
      await redisService.del(key);
      logger.debug('Invalidated cache key', { key });
    }
  }

  /**
   * Invalidate repository-level cache entries
   */
  private async invalidateRepositoryCache(repoFullName: string): Promise<void> {
    const [owner, repo] = repoFullName.split('/');
    
    if (!owner || !repo) {
      logger.warn('Invalid repository full name', { repoFullName });
      return;
    }
    
    // In a real implementation, you'd want to use a pattern-based cache invalidation
    // For now, we'll invalidate common cache keys
    const cacheKeys = [
      redisService.getCacheKey('issues', owner, repo),
      redisService.getCacheKey('stats', owner, repo),
      // Add pagination and filter variations
      redisService.getCacheKey('issues', owner, repo, 'open'),
      redisService.getCacheKey('issues', owner, repo, 'closed'),
      redisService.getCacheKey('issues', owner, repo, 'all'),
    ];

    for (const key of cacheKeys) {
      await redisService.del(key);
      logger.debug('Invalidated repository cache key', { key });
    }
  }

  /**
   * Invalidate all issue caches for a repository
   */
  private async invalidateAllIssueCaches(repoFullName: string): Promise<void> {
    // In a production system, you'd implement pattern-based cache invalidation
    // For now, we'll just invalidate repository-level caches
    await this.invalidateRepositoryCache(repoFullName);
    
    logger.info('Invalidated all issue caches for repository', { repository: repoFullName });
  }

  /**
   * Reprocess issue dependencies when body changes
   */
  private async reprocessIssueDependencies(
    repoFullName: string,
    issueNumber: number,
    newBody: string
  ): Promise<void> {
    try {
      const dependencies = this.dependencyService.parseDependenciesFromBody(newBody, repoFullName);
      
      logger.info('Reprocessed issue dependencies', {
        repository: repoFullName,
        issueNumber,
        dependencyCount: dependencies.length,
      });

      // Invalidate dependency-related caches
      const [owner, repo] = repoFullName.split('/');
      const dependencyCacheKey = redisService.getCacheKey('dependencies', 'parse', newBody.slice(0, 100));
      await redisService.del(dependencyCacheKey);

    } catch (error) {
      logger.error('Failed to reprocess issue dependencies', {
        repository: repoFullName,
        issueNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Update issue metadata cache when labels change
   */
  private async updateIssueMetadataCache(
    repoFullName: string,
    issueNumber: number,
    labels: any[]
  ): Promise<void> {
    try {
      const metadata = this.metadataService.extractMetadataFromLabels(labels);
      
      logger.info('Updated issue metadata cache', {
        repository: repoFullName,
        issueNumber,
        metadata,
      });

      // The actual cache update will happen when the issue is next requested
      // For now, we just invalidate to force refresh
      await this.invalidateIssueCache(repoFullName, issueNumber);

    } catch (error) {
      logger.error('Failed to update issue metadata cache', {
        repository: repoFullName,
        issueNumber,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Check if a label is a metadata label
   */
  private isMetadataLabel(labelName: string): boolean {
    const metadataPrefixes = ['priority:', 'category:', 'size:', 'status:', 'time-spent:'];
    return metadataPrefixes.some(prefix => labelName.toLowerCase().startsWith(prefix));
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(): Promise<{
    totalEvents: number;
    eventsByType: Record<string, number>;
    recentEvents: Array<{
      timestamp: string;
      eventType: string;
      action: string;
      repository: string;
    }>;
  }> {
    try {
      // Get total events count
      const totalEventsKey = redisService.getCacheKey('webhook', 'stats', 'total');
      const totalEvents = await redisService.get<string>(totalEventsKey);
      
      // Get events by type
      const eventTypesKey = redisService.getCacheKey('webhook', 'stats', 'types');
      const eventsByTypeStr = await redisService.get<string>(eventTypesKey);
      const eventsByType = eventsByTypeStr ? JSON.parse(eventsByTypeStr) : {};
      
      // Get recent events (last 10)
      const recentEventsKey = redisService.getCacheKey('webhook', 'stats', 'recent');
      const recentEventsStr = await redisService.get<string>(recentEventsKey);
      const recentEvents = recentEventsStr ? JSON.parse(recentEventsStr) : [];

      return {
        totalEvents: totalEvents ? parseInt(totalEvents, 10) : 0,
        eventsByType,
        recentEvents,
      };
    } catch (error) {
      logger.warn('Failed to get webhook stats from cache', { error });
      return {
        totalEvents: 0,
        eventsByType: {},
        recentEvents: [],
      };
    }
  }

  /**
   * Record webhook event statistics
   */
  private async recordWebhookStats(
    eventType: string,
    action: string,
    repository: string
  ): Promise<void> {
    try {
      // Increment total events
      const totalEventsKey = redisService.getCacheKey('webhook', 'stats', 'total');
      await redisService.incr(totalEventsKey);

      // Update events by type
      const eventTypesKey = redisService.getCacheKey('webhook', 'stats', 'types');
      const eventsByTypeStr = await redisService.get<string>(eventTypesKey);
      const eventsByType = eventsByTypeStr ? JSON.parse(eventsByTypeStr) : {};
      eventsByType[eventType] = (eventsByType[eventType] || 0) + 1;
      await redisService.set(eventTypesKey, JSON.stringify(eventsByType), 86400); // 24 hours

      // Add to recent events (keep last 10)
      const recentEventsKey = redisService.getCacheKey('webhook', 'stats', 'recent');
      const recentEventsStr = await redisService.get<string>(recentEventsKey);
      const recentEvents = recentEventsStr ? JSON.parse(recentEventsStr) : [];
      
      const newEvent = {
        timestamp: new Date().toISOString(),
        eventType,
        action,
        repository,
      };
      
      recentEvents.unshift(newEvent);
      if (recentEvents.length > 10) {
        recentEvents.pop();
      }
      
      await redisService.set(recentEventsKey, JSON.stringify(recentEvents), 86400); // 24 hours

    } catch (error) {
      logger.warn('Failed to record webhook stats', { error, eventType, action, repository });
    }
  }

  /**
   * Test webhook processing with mock data
   */
  async testWebhook(eventType: string, mockData: any): Promise<void> {
    logger.info('Testing webhook with mock data', { eventType });
    
    const mockEvent: GitHubWebhookEvent = {
      action: mockData.action || 'test',
      repository: {
        full_name: mockData.repository || 'test/repo',
        name: 'repo',
        owner: { login: 'test' },
      },
      sender: { login: 'test-user' },
      ...mockData,
    };

    await this.processWebhookEvent(mockEvent, eventType);
  }
}