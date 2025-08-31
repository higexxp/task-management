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
import { authService } from '../services/auth';

function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.log('LoginPage mounted');

    try {
      // Handle OAuth callback
      const result = authService.handleOAuthCallback();
      console.log('OAuth callback result:', result);

      if (result.success) {
        console.log('OAuth success, redirecting...');
        // Redirect to main app
        window.location.href = '/';
      } else if (result.error) {
        console.log('OAuth error:', result.error);
        setError(result.error);
      }
    } catch (err) {
      console.error('Error in OAuth callback handling:', err);
      setError('Failed to process authentication callback');
    }
  }, []);

  const handleGitHubLogin = async () => {
    try {
      console.log('Initiating GitHub login...');
      setLoading(true);
      setError(null);

      // Initiate GitHub OAuth flow
      authService.initiateGitHubAuth();
    } catch (err) {
      console.error('Failed to initiate GitHub auth:', err);
      setError('Failed to initiate GitHub authentication. Please try again.');
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    try {
      console.log('Initiating demo login...');
      setLoading(true);
      setError(null);

      // Ask user if they want to use a Personal Access Token
      const useRealGitHub = window.confirm(
        'Do you want to connect to real GitHub?\n\n' +
        'Click "OK" to enter your Personal Access Token for real GitHub connection.\n' +
        'Click "Cancel" for mock demo login.'
      );

      let token = null;
      if (useRealGitHub) {
        token = window.prompt(
          'Enter your GitHub Personal Access Token:\n\n' +
          'You can create one at: https://github.com/settings/tokens\n' +
          'Required scopes: repo, read:user, user:email'
        );

        if (!token) {
          setLoading(false);
          return;
        }
      }

      const result = await authService.demoAuth('demo-user', token);

      if (result.success) {
        console.log('Demo login successful, redirecting...');
        window.location.href = '/';
      } else {
        setError(result.error || 'Demo login failed');
      }
    } catch (err) {
      console.error('Failed to demo login:', err);
      setError('Demo login failed. Please try again.');
    } finally {
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
              Failed to initiate GitHub authentication. Please try again.
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
            {loading ? 'Connecting...' : 'SIGN IN WITH GITHUB'}
          </Button>

          {/* Development Demo Login */}
          {process.env.NODE_ENV === 'development' && (
            <Button
              fullWidth
              variant="outlined"
              size="large"
              onClick={handleDemoLogin}
              disabled={loading}
              sx={{ mt: 2 }}
            >
              Demo Login (Development)
            </Button>
          )}

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