import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import IssueDetailPage from '../IssueDetailPage';

// Mock the API
jest.mock('../../services/api', () => ({
  issuesApi: {
    getIssue: jest.fn(),
    updateIssueMetadata: jest.fn(),
  },
  dependenciesApi: {
    parseDependencies: jest.fn(),
    validateDependencies: jest.fn(),
  },
}));

// Mock react-router-dom
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({
    owner: 'test-owner',
    repo: 'test-repo',
    number: '123',
  }),
  useNavigate: () => jest.fn(),
}));

const theme = createTheme();
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const renderWithProviders = (component: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider theme={theme}>
          {component}
        </ThemeProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

describe('IssueDetailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders loading state initially', () => {
    renderWithProviders(<IssueDetailPage />);
    expect(screen.getByText('Loading issue details...')).toBeInTheDocument();
  });

  it('renders back button', () => {
    renderWithProviders(<IssueDetailPage />);
    expect(screen.getByText('Back to Issues')).toBeInTheDocument();
  });
});