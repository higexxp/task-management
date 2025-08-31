import axios from 'axios';

// Create axios instance
export const apiClient = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    // Add timestamp to prevent caching
    config.params = {
      ...config.params,
      _t: Date.now(),
    };
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear auth data and redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      delete apiClient.defaults.headers.common['Authorization'];
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// API service functions
export const authApi = {
  getAuthUrl: () => apiClient.get('/auth/github'),
  callback: (code: string) => apiClient.post('/auth/callback', { code }),
  me: () => apiClient.get('/auth/me'),
  logout: () => apiClient.post('/auth/logout'),
};

export const issuesApi = {
  getIssues: (params?: {
    owner?: string;
    repo?: string;
    state?: 'open' | 'closed' | 'all';
    page?: number;
    per_page?: number;
  }) => {
    if (!params?.owner || !params?.repo) {
      return Promise.reject(new Error('Owner and repo are required'));
    }
    const { owner, repo, ...queryParams } = params;
    return apiClient.get(`/issues/${owner}/${repo}`, { params: queryParams });
  },

  getIssue: (owner: string, repo: string, issueNumber: number) =>
    apiClient.get(`/issues/${owner}/${repo}/${issueNumber}`),

  updateIssueMetadata: (
    owner: string,
    repo: string,
    issueNumber: number,
    metadata: {
      priority?: string;
      category?: string;
      size?: string;
      status?: string;
      timeSpent?: number;
    }
  ) => apiClient.put(`/issues/${owner}/${repo}/${issueNumber}/metadata`, metadata),
};

export const metadataApi = {
  getOptions: () => apiClient.get('/metadata/options'),
  getRequiredLabels: () => apiClient.get('/metadata/labels'),
  extractFromLabels: (labels: any[]) =>
    apiClient.post('/metadata/extract', { labels }),
  convertToLabels: (metadata: any) =>
    apiClient.post('/metadata/convert', { metadata }),
};

export const dependenciesApi = {
  parseDependencies: (body: string, repository?: string) =>
    apiClient.post('/dependencies/parse', { body, repository }),

  validateDependencies: (dependencies: any[]) =>
    apiClient.post('/dependencies/validate', { dependencies }),

  buildGraph: (dependencies: any[]) =>
    apiClient.post('/dependencies/graph', { dependencies }),

  getDependencies: (owner: string, repo: string) =>
    apiClient.get(`/dependencies/${owner}/${repo}`),

  addDependency: (owner: string, repo: string, from: number, to: number, type: string) =>
    apiClient.post(`/dependencies/${owner}/${repo}`, { from, to, type }),

  removeDependency: (owner: string, repo: string, from: number, to: number) =>
    apiClient.delete(`/dependencies/${owner}/${repo}/${from}/${to}`),

  getGraph: (owner: string, repo: string) =>
    apiClient.get(`/dependencies/${owner}/${repo}/graph`),
};

export const analyticsApi = {
  getOverview: (owner: string, repo: string, period: string = '30d') =>
    apiClient.get(`/analytics/${owner}/${repo}/overview`, { params: { period } }),
  getTimeSeries: (owner: string, repo: string, period: string = '30d', granularity: string = 'day') =>
    apiClient.get(`/analytics/${owner}/${repo}/timeseries`, { params: { period, granularity } }),
  getTeamMetrics: (owner: string, repo: string, period: string = '30d') =>
    apiClient.get(`/analytics/${owner}/${repo}/team`, { params: { period } }),
};

export const workloadApi = {
  getWorkload: (owner: string, repo: string, settings?: any) =>
    apiClient.get(`/workload/${owner}/${repo}`, { params: { settings: settings ? JSON.stringify(settings) : undefined } }),
  getMemberWorkload: (owner: string, repo: string, assignee: string, settings?: any) =>
    apiClient.get(`/workload/${owner}/${repo}/member/${assignee}`, { params: { settings: settings ? JSON.stringify(settings) : undefined } }),
  getWorkloadTrends: (owner: string, repo: string, period: string = '30d', settings?: any) =>
    apiClient.get(`/workload/${owner}/${repo}/trends`, { params: { period, settings: settings ? JSON.stringify(settings) : undefined } }),
  getSettings: (owner: string, repo: string) =>
    apiClient.get(`/workload/${owner}/${repo}/settings`),
  updateSettings: (owner: string, repo: string, settings: any) =>
    apiClient.post(`/workload/${owner}/${repo}/settings`, settings),
  generateRebalancingSuggestions: (owner: string, repo: string, settings?: any) =>
    apiClient.post(`/workload/${owner}/${repo}/rebalance`, { settings }),
};

export const syncApi = {
  // Sync operations
  getSyncStatus: (owner: string, repo: string) =>
    apiClient.get(`/sync/${owner}/${repo}/status`),
  getAllSyncStatuses: () =>
    apiClient.get('/sync/status'),
  syncRepository: (owner: string, repo: string, options?: {
    force?: boolean;
    skipCache?: boolean;
    batchSize?: number;
  }) =>
    apiClient.post(`/sync/${owner}/${repo}/sync`, options || {}),
  forceSyncRepository: (owner: string, repo: string) =>
    apiClient.post(`/sync/${owner}/${repo}/force-sync`),
  clearRepositoryCache: (owner: string, repo: string) =>
    apiClient.delete(`/sync/${owner}/${repo}/cache`),

  // Statistics and monitoring
  getCacheStats: () =>
    apiClient.get('/sync/cache/stats'),
  getWebSocketStats: () =>
    apiClient.get('/sync/websocket/stats'),
  getHealthStatus: () =>
    apiClient.get('/sync/health'),

  // Testing
  sendTestMessage: (data: {
    repository?: string;
    userId?: string;
    message: string;
  }) =>
    apiClient.post('/sync/websocket/test', data),
};

export const timeTrackingApi = {
  // Session management
  startSession: (owner: string, repo: string, issueNumber: number, userId: string, description?: string) =>
    apiClient.post(`/time/${owner}/${repo}/${issueNumber}/start`, { userId, description }),
  stopSession: (owner: string, repo: string, issueNumber: number, userId: string, description?: string) =>
    apiClient.post(`/time/${owner}/${repo}/${issueNumber}/stop`, { userId, description }),
  pauseSession: (owner: string, repo: string, issueNumber: number, userId: string) =>
    apiClient.post(`/time/${owner}/${repo}/${issueNumber}/pause`, { userId }),
  resumeSession: (owner: string, repo: string, issueNumber: number, userId: string) =>
    apiClient.post(`/time/${owner}/${repo}/${issueNumber}/resume`, { userId }),

  // Session queries
  getActiveSession: (userId: string) =>
    apiClient.get(`/time/sessions/active/${userId}`),
  getUserSessions: (userId: string) =>
    apiClient.get(`/time/sessions/user/${userId}`),

  // Manual time entries
  addManualEntry: (owner: string, repo: string, issueNumber: number, data: {
    userId: string;
    duration: number;
    description?: string;
    startTime?: string;
    tags?: string[];
  }) =>
    apiClient.post(`/time/${owner}/${repo}/${issueNumber}/manual`, data),

  // Time entry management
  updateTimeEntry: (entryId: string, updates: any) =>
    apiClient.put(`/time/entries/${entryId}`, updates),
  deleteTimeEntry: (entryId: string) =>
    apiClient.delete(`/time/entries/${entryId}`),

  // Time entry queries
  getTimeEntries: (owner: string, repo: string, params?: {
    userId?: string;
    issueNumber?: number;
    startDate?: string;
    endDate?: string;
    tags?: string;
  }) =>
    apiClient.get(`/time/${owner}/${repo}/entries`, { params }),
  getIssueTimeEntries: (owner: string, repo: string, issueNumber: number, params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
  }) =>
    apiClient.get(`/time/${owner}/${repo}/${issueNumber}/entries`, { params }),

  // Reports and statistics
  getTimeReport: (owner: string, repo: string, params?: {
    startDate?: string;
    endDate?: string;
    userId?: string;
    period?: string;
  }) =>
    apiClient.get(`/time/${owner}/${repo}/report`, { params }),
  getTimeStats: (owner: string, repo: string, params?: {
    userId?: string;
    period?: string;
  }) =>
    apiClient.get(`/time/${owner}/${repo}/stats`, { params }),
};

export const webhooksApi = {
  getStats: () => apiClient.get('/webhooks/stats'),
  getHealth: () => apiClient.get('/webhooks/health'),
};