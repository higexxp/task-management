import { GitHubService } from '../github';

// Mock Octokit
jest.mock('@octokit/rest');
jest.mock('@octokit/auth-oauth-app');

describe('GitHubService', () => {
  let githubService: GitHubService;

  beforeEach(() => {
    githubService = new GitHubService('mock-token');
  });

  describe('constructor', () => {
    it('should create instance with access token', () => {
      expect(githubService).toBeInstanceOf(GitHubService);
    });

    it('should create instance without access token', () => {
      const service = new GitHubService();
      expect(service).toBeInstanceOf(GitHubService);
    });
  });

  // More tests will be added as we implement the methods
});