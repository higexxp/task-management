import React from 'react';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import Layout from '../Layout';
import { AuthProvider } from '../../contexts/AuthContext';

// Mock the auth context
const mockUser = {
  id: 1,
  login: 'testuser',
  name: 'Test User',
  avatar_url: 'https://github.com/testuser.png',
};

jest.mock('../../contexts/AuthContext', () => ({
  ...jest.requireActual('../../contexts/AuthContext'),
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

const theme = createTheme();

const renderWithProviders = (children: React.ReactNode) => {
  return render(
    <BrowserRouter>
      <ThemeProvider theme={theme}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Layout', () => {
  it('renders navigation items', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    expect(screen.getByText('GitHub Task Extension')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('displays user avatar and name', () => {
    renderWithProviders(
      <Layout>
        <div>Test Content</div>
      </Layout>
    );

    const avatar = screen.getByAltText('Test User');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('src', mockUser.avatar_url);
  });
});