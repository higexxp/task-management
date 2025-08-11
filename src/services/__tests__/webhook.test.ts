import { WebhookService, GitHubWebhookEvent } from '../webhook';

// Mock dependencies
jest.mock('../redis', () => ({
  redisService: {
    del: jest.fn().mockResolvedValue(true),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue(true),
    incr: jest.fn().mockResolvedValue(1),
    getCacheKey: jest.fn().mockImplementation((...args) => args.join(':')),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('../dependency', () => ({
  DependencyService: jest.fn().mockImplementation(() => ({
    parseDependenciesFromBody: jest.fn().mockReturnValue([]),
  })),
}));

jest.mock('../metadata', () => ({
  MetadataService: jest.fn().mockImplementation(() => ({
    extractMetadataFromLabels: jest.fn().mockReturnValue({}),
  })),
}));

describe('WebhookService', () => {
  let webhookService: WebhookService;

  beforeEach(() => {
    jest.clearAllMocks();
    webhookService = new WebhookService();
  });

  describe('verifySignature', () => {
    beforeEach(() => {
      process.env.GITHUB_WEBHOOK_SECRET = 'test-secret';
    });

    it('should return false for missing signature', () => {
      const result = webhookService.verifySignature('{"test": "data"}', '');
      expect(result).toBe(false);
    });

    it('should return false for invalid signature format', () => {
      const result = webhookService.verifySignature('{"test": "data"}', 'invalid');
      expect(result).toBe(false);
    });
  });

  describe('processWebhookEvent', () => {
    const mockEvent: GitHubWebhookEvent = {
      action: 'opened',
      repository: {
        full_name: 'test/repo',
        name: 'repo',
        owner: { login: 'test' },
      },
      sender: { login: 'test-user' },
    };

    it('should process ping events', async () => {
      await webhookService.processWebhookEvent(mockEvent, 'ping');
      // Should not throw
    });

    it('should process issue events', async () => {
      const issueEvent = {
        ...mockEvent,
        issue: {
          number: 1,
          title: 'Test Issue',
          body: 'Test body',
          labels: [],
        },
      };

      await webhookService.processWebhookEvent(issueEvent, 'issues');
      // Should not throw
    });

    it('should handle unknown event types gracefully', async () => {
      await webhookService.processWebhookEvent(mockEvent, 'unknown');
      // Should not throw
    });
  });

  describe('getWebhookStats', () => {
    it('should return default stats when cache is empty', async () => {
      const stats = await webhookService.getWebhookStats();

      expect(stats).toEqual({
        totalEvents: 0,
        eventsByType: {},
        recentEvents: [],
      });
    });
  });

  describe('testWebhook', () => {
    it('should process test webhook events', async () => {
      await webhookService.testWebhook('issues', {
        action: 'opened',
        issue: { number: 1, title: 'Test' },
      });
      // Should not throw
    });
  });
});