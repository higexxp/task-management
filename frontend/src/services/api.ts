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
      // Unauthorized - redirect to login
      localStorage.removeItem('github_token');
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
  }) => apiClient.get('/issues', { params }),
  
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
};

export const webhooksApi = {
  getStats: () => apiClient.get('/webhooks/stats'),
  getHealth: () => apiClient.get('/webhooks/health'),
};