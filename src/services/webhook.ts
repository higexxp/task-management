import crypto from 'crypto';
import { logger } from '../utils/logger.js';
import { redisService } from './redis.js';

export interface WebhookStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  lastProcessed: Date | null;
  errors: number;
  recentEvents: Array<{
    eventType: string;
    action: string;
    repository: string;
    timestamp: string;
  }>;
}

export class WebhookService {
  private stats: WebhookStats = {
    totalEvents: 0,
    eventsByType: {},
    lastProcessed: null,
    errors: 0,
    recentEvents: [],
  };

  /**
   * Verify GitHub webhook signature
   */
  public verifySignature(payload: string, signature: string): boolean {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;

    if (!secret) {
      logger.warn('GitHub webhook secret not configured');
      return false;
    }

    if (!signature) {
      return false;
    }

    const expectedSignature = `sha256=${crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Process webhook event
   */
  public async processWebhookEvent(payload: any, eventType: string): Promise<void> {
    try {
      this.stats.totalEvents++;
      this.stats.eventsByType[eventType] = (this.stats.eventsByType[eventType] || 0) + 1;
      this.stats.lastProcessed = new Date();

      // Add to recent events (keep only last 10)
      this.stats.recentEvents.unshift({
        eventType,
        action: payload.action || 'unknown',
        repository: payload.repository?.full_name || 'unknown',
        timestamp: new Date().toISOString(),
      });

      // Keep only the 10 most recent events
      if (this.stats.recentEvents.length > 10) {
        this.stats.recentEvents = this.stats.recentEvents.slice(0, 10);
      }

      logger.info('Processing webhook event', {
        eventType,
        action: payload.action,
        repository: payload.repository?.full_name,
      });

      // Process different event types
      switch (eventType) {
        case 'issues':
          await this.processIssueEvent(payload);
          break;
        case 'label':
          await this.processLabelEvent(payload);
          break;
        case 'push':
          await this.processPushEvent(payload);
          break;
        default:
          logger.debug('Unhandled webhook event type', { eventType });
      }

      // Cache the event for potential replay
      await this.cacheWebhookEvent(eventType, payload);

    } catch (error) {
      this.stats.errors++;
      logger.error('Error processing webhook event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process issue events
   */
  private async processIssueEvent(payload: any): Promise<void> {
    const { action, issue, repository } = payload;

    if (!issue || !repository) {
      return;
    }

    const cacheKey = `issue:${repository.full_name}:${issue.number}`;

    switch (action) {
      case 'opened':
      case 'edited':
      case 'closed':
      case 'reopened':
        // Cache the updated issue data
        await redisService.set(cacheKey, {
          ...issue,
          updated_at: new Date().toISOString(),
          webhook_action: action,
        }, 3600); // Cache for 1 hour
        break;
      case 'labeled':
      case 'unlabeled':
        // Update issue labels in cache
        const cachedIssue = await redisService.get(cacheKey);
        if (cachedIssue) {
          await redisService.set(cacheKey, {
            ...cachedIssue,
            labels: issue.labels,
            updated_at: new Date().toISOString(),
            webhook_action: action,
          }, 3600);
        }
        break;
    }

    logger.debug('Processed issue event', {
      action,
      repository: repository.full_name,
      issueNumber: issue.number,
    });
  }

  /**
   * Process label events
   */
  private async processLabelEvent(payload: any): Promise<void> {
    const { action, label, repository } = payload;

    if (!label || !repository) {
      return;
    }

    const cacheKey = `labels:${repository.full_name}`;

    // Invalidate labels cache to force refresh
    await redisService.del(cacheKey);

    logger.debug('Processed label event', {
      action,
      repository: repository.full_name,
      labelName: label.name,
    });
  }

  /**
   * Process push events
   */
  private async processPushEvent(payload: any): Promise<void> {
    const { repository, commits } = payload;

    if (!repository || !commits) {
      return;
    }

    // For now, just log push events
    // In the future, we might want to trigger syncs or other actions
    logger.debug('Processed push event', {
      repository: repository.full_name,
      commitCount: commits.length,
      ref: payload.ref,
    });
  }

  /**
   * Cache webhook event for potential replay
   */
  private async cacheWebhookEvent(eventType: string, payload: any): Promise<void> {
    try {
      const cacheKey = `webhook:${eventType}:${Date.now()}`;
      await redisService.set(cacheKey, {
        eventType,
        payload,
        timestamp: new Date().toISOString(),
      }, 86400); // Cache for 24 hours
    } catch (error) {
      logger.warn('Failed to cache webhook event', {
        eventType,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get webhook statistics
   */
  public async getWebhookStats(): Promise<WebhookStats> {
    return { ...this.stats };
  }

  /**
   * Test webhook processing (development only)
   */
  public async testWebhook(eventType: string, mockData: any): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Test webhooks not available in production');
    }

    const testPayload = {
      action: 'test',
      repository: {
        full_name: 'test/repo',
      },
      ...mockData,
    };

    await this.processWebhookEvent(testPayload, eventType);
  }
}