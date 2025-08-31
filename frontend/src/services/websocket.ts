import { io, Socket } from 'socket.io-client';
import { logger } from '../utils/logger';

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
    userId?: string;
    repository?: string;
}

export interface WebSocketEventHandlers {
    onIssueUpdate?: (data: any) => void;
    onLabelUpdate?: (data: any) => void;
    onSyncStatus?: (data: any) => void;
    onCacheUpdate?: (data: any) => void;
    onTestMessage?: (data: any) => void;
    onConnect?: () => void;
    onDisconnect?: (reason: string) => void;
    onError?: (error: any) => void;
}

export class WebSocketService {
    private socket: Socket | null = null;
    private isConnected = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;
    private reconnectDelay = 1000;
    private userId: string | null = null;
    private subscribedRepositories: Set<string> = new Set();
    private eventHandlers: WebSocketEventHandlers = {};
    private pingInterval: NodeJS.Timeout | null = null;

    constructor(private serverUrl: string = process.env.REACT_APP_API_URL || 'http://localhost:3000') {
        // Remove /api suffix if present
        this.serverUrl = this.serverUrl.replace('/api', '');
    }

    /**
     * Connect to WebSocket server
     */
    public connect(userId: string, repositories: string[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.isConnected && this.socket) {
                resolve();
                return;
            }

            this.userId = userId;
            this.subscribedRepositories = new Set(repositories);

            this.socket = io(this.serverUrl, {
                transports: ['websocket', 'polling'],
                timeout: 10000,
                forceNew: true,
            });

            // Connection event handlers
            this.socket.on('connect', () => {
                logger.info('WebSocket connected', { socketId: this.socket?.id });
                this.isConnected = true;
                this.reconnectAttempts = 0;

                // Authenticate with server
                this.authenticate(userId, repositories);

                // Start ping interval
                this.startPingInterval();

                if (this.eventHandlers.onConnect) {
                    this.eventHandlers.onConnect();
                }

                resolve();
            });

            this.socket.on('disconnect', (reason) => {
                logger.info('WebSocket disconnected', { reason });
                this.isConnected = false;

                // Stop ping interval
                this.stopPingInterval();

                if (this.eventHandlers.onDisconnect) {
                    this.eventHandlers.onDisconnect(reason);
                }

                // Attempt to reconnect
                this.handleReconnect();
            });

            this.socket.on('connect_error', (error) => {
                logger.error('WebSocket connection error', { error: error.message });

                if (this.eventHandlers.onError) {
                    this.eventHandlers.onError(error);
                }

                if (this.reconnectAttempts === 0) {
                    reject(error);
                }
            });

            // Authentication response
            this.socket.on('authenticated', (data) => {
                logger.info('WebSocket authenticated', data);
            });

            this.socket.on('subscribed', (data) => {
                logger.info('Subscribed to repository', data);
            });

            this.socket.on('unsubscribed', (data) => {
                logger.info('Unsubscribed from repository', data);
            });

            // Message handler
            this.socket.on('message', (message: WebSocketMessage) => {
                this.handleMessage(message);
            });

            // Ping/pong for connection health
            this.socket.on('pong', (data) => {
                logger.debug('Received pong', data);
            });

            // Error handler
            this.socket.on('error', (error) => {
                logger.error('WebSocket error', { error });

                if (this.eventHandlers.onError) {
                    this.eventHandlers.onError(error);
                }
            });
        });
    }

    /**
     * Disconnect from WebSocket server
     */
    public disconnect(): void {
        if (this.socket) {
            this.stopPingInterval();
            this.socket.disconnect();
            this.socket = null;
        }

        this.isConnected = false;
        this.userId = null;
        this.subscribedRepositories.clear();
    }

    /**
     * Set event handlers
     */
    public setEventHandlers(handlers: WebSocketEventHandlers): void {
        this.eventHandlers = { ...this.eventHandlers, ...handlers };
    }

    /**
     * Subscribe to repository updates
     */
    public subscribeToRepository(repository: string): void {
        if (!this.socket || !this.isConnected) {
            logger.warn('Cannot subscribe: WebSocket not connected');
            return;
        }

        if (this.subscribedRepositories.has(repository)) {
            logger.debug('Already subscribed to repository', { repository });
            return;
        }

        this.socket.emit('subscribe', { repository });
        this.subscribedRepositories.add(repository);

        logger.info('Subscribing to repository', { repository });
    }

    /**
     * Unsubscribe from repository updates
     */
    public unsubscribeFromRepository(repository: string): void {
        if (!this.socket || !this.isConnected) {
            logger.warn('Cannot unsubscribe: WebSocket not connected');
            return;
        }

        if (!this.subscribedRepositories.has(repository)) {
            logger.debug('Not subscribed to repository', { repository });
            return;
        }

        this.socket.emit('unsubscribe', { repository });
        this.subscribedRepositories.delete(repository);

        logger.info('Unsubscribing from repository', { repository });
    }

    /**
     * Get connection status
     */
    public getConnectionStatus(): {
        isConnected: boolean;
        userId: string | null;
        subscribedRepositories: string[];
        socketId: string | null;
    } {
        return {
            isConnected: this.isConnected,
            userId: this.userId,
            subscribedRepositories: Array.from(this.subscribedRepositories),
            socketId: this.socket?.id || null,
        };
    }

    /**
     * Send ping to server
     */
    public ping(): void {
        if (this.socket && this.isConnected) {
            this.socket.emit('ping');
        }
    }

    /**
     * Authenticate with server
     */
    private authenticate(userId: string, repositories: string[]): void {
        if (!this.socket) {
            return;
        }

        this.socket.emit('authenticate', {
            userId,
            repositories,
        });
    }

    /**
     * Handle incoming messages
     */
    private handleMessage(message: WebSocketMessage): void {
        logger.debug('Received WebSocket message', {
            type: message.type,
            repository: message.repository,
        });

        switch (message.type) {
            case 'issue_updated':
                if (this.eventHandlers.onIssueUpdate) {
                    this.eventHandlers.onIssueUpdate(message.data);
                }
                break;

            case 'label_updated':
                if (this.eventHandlers.onLabelUpdate) {
                    this.eventHandlers.onLabelUpdate(message.data);
                }
                break;

            case 'sync_status':
                if (this.eventHandlers.onSyncStatus) {
                    this.eventHandlers.onSyncStatus(message.data);
                }
                break;

            case 'cache_updated':
                if (this.eventHandlers.onCacheUpdate) {
                    this.eventHandlers.onCacheUpdate(message.data);
                }
                break;

            case 'test_message':
                if (this.eventHandlers.onTestMessage) {
                    this.eventHandlers.onTestMessage(message.data);
                }
                break;

            default:
                logger.debug('Unhandled message type', { type: message.type });
        }
    }

    /**
     * Handle reconnection logic
     */
    private handleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            logger.error('Max reconnection attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

        logger.info('Attempting to reconnect', {
            attempt: this.reconnectAttempts,
            maxAttempts: this.maxReconnectAttempts,
            delay,
        });

        setTimeout(() => {
            if (this.userId) {
                this.connect(this.userId, Array.from(this.subscribedRepositories))
                    .catch(error => {
                        logger.error('Reconnection failed', { error: error.message });
                    });
            }
        }, delay);
    }

    /**
     * Start ping interval to keep connection alive
     */
    private startPingInterval(): void {
        this.stopPingInterval();

        this.pingInterval = setInterval(() => {
            this.ping();
        }, 30000); // Ping every 30 seconds
    }

    /**
     * Stop ping interval
     */
    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const getWebSocketService = (): WebSocketService => {
    if (!webSocketService) {
        webSocketService = new WebSocketService();
    }
    return webSocketService;
};

export const initializeWebSocketService = (userId: string, repositories: string[] = []): Promise<WebSocketService> => {
    const service = getWebSocketService();
    return service.connect(userId, repositories).then(() => service);
};