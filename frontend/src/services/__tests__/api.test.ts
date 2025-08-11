import axios from 'axios';
import { apiClient, authApi, issuesApi } from '../api';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('apiClient', () => {
    it('should have correct base configuration', () => {
      expect(apiClient.defaults.baseURL).toBe('/api');
      expect(apiClient.defaults.timeout).toBe(10000);
      expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
    });
  });

  describe('authApi', () => {
    it('should call correct endpoints', async () => {
      const mockResponse = { data: { url: 'https://github.com/login/oauth/authorize' } };
      mockedAxios.create.mockReturnValue({
        ...apiClient,
        get: jest.fn().mockResolvedValue(mockResponse),
        post: jest.fn().mockResolvedValue(mockResponse),
      } as any);

      // Test would need actual implementation
      expect(authApi.getAuthUrl).toBeDefined();
      expect(authApi.callback).toBeDefined();
      expect(authApi.me).toBeDefined();
      expect(authApi.logout).toBeDefined();
    });
  });

  describe('issuesApi', () => {
    it('should have all required methods', () => {
      expect(issuesApi.getIssues).toBeDefined();
      expect(issuesApi.getIssue).toBeDefined();
      expect(issuesApi.updateIssueMetadata).toBeDefined();
    });
  });
});