import { apiClient as api } from './api';

export interface User {
    id: number;
    login: string;
    name: string;
    avatar_url: string;
}

export interface AuthResponse {
    success: boolean;
    data?: {
        user: User;
        token: string;
        expiresIn: string;
    };
    error?: string;
    details?: string;
}

class AuthService {
    private token: string | null = null;
    private user: User | null = null;

    constructor() {
        // Load token and user from localStorage on initialization
        this.loadFromStorage();
    }

    private loadFromStorage() {
        try {
            const token = localStorage.getItem('auth_token');
            const userStr = localStorage.getItem('auth_user');

            if (token && userStr) {
                this.token = token;
                this.user = JSON.parse(userStr);

                // Set default authorization header
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
            }
        } catch (error) {
            console.error('Failed to load auth from storage:', error);
            this.clearStorage();
        }
    }

    private saveToStorage(token: string, user: User) {
        try {
            localStorage.setItem('auth_token', token);
            localStorage.setItem('auth_user', JSON.stringify(user));

            // Set default authorization header
            api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } catch (error) {
            console.error('Failed to save auth to storage:', error);
        }
    }

    private clearStorage() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        delete api.defaults.headers.common['Authorization'];
        this.token = null;
        this.user = null;
    }

    /**
     * Initiate GitHub OAuth flow
     */
    public initiateGitHubAuth(): void {
        // Redirect to backend OAuth endpoint
        window.location.href = '/api/auth/github';
    }

    /**
     * Handle OAuth callback (called when user returns from GitHub)
     */
    public handleOAuthCallback(): { success: boolean; error?: string } {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const token = urlParams.get('token');
            const userStr = urlParams.get('user');
            const error = urlParams.get('error');
            const message = urlParams.get('message');

            if (error) {
                console.error('OAuth error:', error, message);
                return { success: false, error: message || error };
            }

            if (token && userStr) {
                const user = JSON.parse(decodeURIComponent(userStr));
                this.token = token;
                this.user = user;
                this.saveToStorage(token, user);

                // Clean up URL
                window.history.replaceState({}, document.title, window.location.pathname);

                return { success: true };
            }

            return { success: false, error: 'No authentication data received' };
        } catch (error) {
            console.error('Failed to handle OAuth callback:', error);
            return { success: false, error: 'Failed to process authentication' };
        }
    }

    /**
     * Get current user info from server
     */
    public async getCurrentUser(): Promise<User | null> {
        try {
            if (!this.token) {
                return null;
            }

            const response = await api.get<AuthResponse>('/auth/me');

            if (response.data.success && response.data.data) {
                this.user = response.data.data.user;
                this.saveToStorage(this.token, this.user);
                return this.user;
            }

            return null;
        } catch (error) {
            console.error('Failed to get current user:', error);
            this.clearStorage();
            return null;
        }
    }

    /**
     * Logout user
     */
    public async logout(): Promise<void> {
        try {
            if (this.token) {
                await api.post('/auth/logout');
            }
        } catch (error) {
            console.error('Logout request failed:', error);
        } finally {
            this.clearStorage();
        }
    }

    /**
     * Demo authentication (development only)
     */
    public async demoAuth(username = 'demo-user', token?: string | null): Promise<AuthResponse> {
        try {
            const requestData: { username: string; token?: string } = { username };
            if (token) {
                requestData.token = token;
            }

            const response = await api.post<AuthResponse>('/auth/demo', requestData);

            if (response.data.success && response.data.data) {
                this.token = response.data.data.token;
                this.user = response.data.data.user;
                this.saveToStorage(this.token, this.user);
            }

            return response.data;
        } catch (error: any) {
            console.error('Demo auth failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Demo authentication failed',
                details: error.response?.data?.details,
            };
        }
    }

    /**
     * Check if user is authenticated
     */
    public isAuthenticated(): boolean {
        return !!(this.token && this.user);
    }

    /**
     * Get current user (cached)
     */
    public getUser(): User | null {
        return this.user;
    }

    /**
     * Get current token
     */
    public getToken(): string | null {
        return this.token;
    }
}

export const authService = new AuthService();