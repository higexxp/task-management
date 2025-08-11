// Test setup file
import { config } from '../config/env.js';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Mock Redis for tests
jest.mock('../services/redis', () => ({
  redisService: {
    connect: jest.fn(),
    disconnect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    setSession: jest.fn(),
    getSession: jest.fn(),
    deleteSession: jest.fn(),
    setOAuthState: jest.fn(),
    getOAuthState: jest.fn(),
    deleteOAuthState: jest.fn(),
    getCacheKey: jest.fn((type: string, ...identifiers: (string | number)[]) => 
      `github:${type}:${identifiers.join(':')}`
    ),
  },
}));