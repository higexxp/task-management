import React, { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';
import { GitHub as GitHubIcon } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { authApi } from '../services/api';

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useAuth();

  useEffect(() => {
    // Handle OAuth callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');

    if (error) {
      setError('GitHub authentication was cancelled or failed.');
      return;
    }

    if (code) {
      handleCallback(code);
    }
  }, []);

  const handleCallback = async (code: string) => {
    try {
      setLoading(true);
      setError(null);
      await login(code);
      // Navigation will be handled by App component
    } catch (err) {
      console.error('Login callback failed:', err);
      setError('Failed to complete GitHub authentication. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleGitHubLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await authApi.getAuthUrl();
      window.location.href = response.data.url;
    } catch (err) {
      console.error('Failed to get GitHub auth URL:', err);
      setError('Failed to initiate GitHub authentication. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Box
      display="flex"
      alignItems="center"
      justifyContent="center"
      minHeight="100vh"
      sx={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card sx={{ maxWidth: 400, width: '100%', mx: 2 }}>
        <CardContent sx={{ p: 4 }}>
          <Box textAlign="center" mb={3}>
            <Typography variant="h4" component="h1" gutterBottom>
              GitHub Task Extension
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Sign in with your GitHub account to manage your issues and tasks
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={loading ? <CircularProgress size={20} /> : <GitHubIcon />}
            onClick={handleGitHubLogin}
            disabled={loading}
            sx={{
              py: 1.5,
              backgroundColor: '#24292e',
              '&:hover': {
                backgroundColor: '#1a1e22',
              },
            }}
          >
            {loading ? 'Connecting...' : 'Sign in with GitHub'}
          </Button>

          <Box mt={3} textAlign="center">
            <Typography variant="caption" color="text.secondary">
              By signing in, you agree to allow this application to access your
              GitHub repositories and issues.
            </Typography>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;