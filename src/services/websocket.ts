import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { logger } from '../utils/logger.js';

export interface WebSocketMessage {
    type: string;
    data: any;
    timestamp: string;
    userId?: string;
    repository?: string;
}

export interface ConnectedClient {
    id: string;
    socket: Socket;
    userId: string | null;
    repositories: Set<string>;
    connectedAt: Date;
    lastActivity: Date;
}

export class WebSocketService {
    private io: SocketIOServer;
    private clients: Map<string, ConnectedClient> = new Map();

    constructor(httpServer: HttpServer) {
        this.io = new SocketIOServer(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3001',
                methods: ['GET', 'POST'],
                credentials: true,
            },
            transports: ['websocket', 'polling'],
        });

        this.setupEventHandlers();
        logger.info('WebSocket service initialized');
    }

    private setupEventHandlers(): void {
        this.io.on('connection', (socket: Socket) => {
            logger.info('Client connected', { socketId: socket.id });

            // Initialize client
            const client: ConnectedClient = {
                id: socket.id,
                socket,
                userId: null,
                repositories: new Set(),
                connectedAt: new Date(),
                lastActivity: new Date(),
            };

            this.clients.set(socket.id, client);

            // Handle authentication
            socket.on('authenticate', (data: { userId: string; repositories?: string[] }) => {
                client.userId = data.userId;
                client.lastActivity = new Date();

                if (data.repositories) {
                    data.repositories.forEach(repo => client.repositories.add(repo));
                }

                socket.emit('authenticated', {
                    success: true,
                    userId: data.userId,
                    repositories: Array.from(client.repositories),
                });

                logger.info('Client authenticated', {
                    socketId: socket.id,
                    userId: data.userId,
                    repositories: data.repositories,
                });
            });

            // Handle repository subscription
            socket.on('subscribe', (data: { repository: string }) => {
                client.repositories.add(data.repository);
                client.lastActivity = new Date();

                socket.join(`repo:${data.repository}`);
                socket.emit('subscribed', { repository: data.repository });

                logger.debug('Client subscribed to repository', {
                    socketId: socket.id,
                    repository: data.repository,
                });
            });

            // Handle repository unsubscription
            socket.on('unsubscribe', (data: { repository: string }) => {
                client.repositories.delete(data.repository);
                client.lastActivity = new Date();

                socket.leave(`repo:${data.repository}`);
                socket.emit('unsubscribed', { repository: data.repository });

                logger.debug('Client unsubscribed from repository', {
                    socketId: socket.id,
                    repository: data.repository,
                });
            });

            // Handle ping
            socket.on('ping', () => {
                client.lastActivity = new Date();
                socket.emit('pong', { timestamp: new Date() });
            });

            // Handle disconnect
            socket.on('disconnect', (reason) => {
                logger.info('Client disconnected', {
                    socketId: socket.id,
                    userId: client.userId,
                    reason,
                });

                this.clients.delete(socket.id);
            });
        });
    }

    /**
     * Broadcast message to all connected clients
     */
    public broadcast(message: WebSocketMessage): void {
        this.io.emit('message', message);
        logger.debug('Broadcasted message to all clients', { type: message.type });
    }

    /**
     * Send message to a specific user
     */
    public sendToUser(userId: string, message: WebSocketMessage): void {
        const userClients = Array.from(this.clients.values()).filter(
            client => client.userId === userId
        );

        userClients.forEach(client => {
            client.socket.emit('message', message);
        });

        logger.debug('Sent message to user', { userId, type: message.type, clientCount: userClients.length });
    }

    /**
     * Broadcast message to all clients subscribed to a repository
     */
    public broadcastToRepository(repository: string, message: WebSocketMessage): void {
        this.io.to(`repo:${repository}`).emit('message', message);
        logger.debug('Broadcasted message to repository', { repository, type: message.type });
    }

    /**
     * Notify about issue updates
     */
    public notifyIssueUpdate(repository: string, data: any): void {
        const message: WebSocketMessage = {
            type: 'issue_updated',
            data,
            timestamp: new Date().toISOString(),
            repository,
        };

        this.broadcastToRepository(repository, message);
    }

    /**
     * Notify about label updates
     */
    public notifyLabelUpdate(repository: string, data: any): void {
        const message: WebSocketMessage = {
            type: 'label_updated',
            data,
            timestamp: new Date().toISOString(),
            repository,
        };

        this.broadcastToRepository(repository, message);
    }

    /**
     * Notify about sync status changes
     */
    public notifySyncStatus(repository: string, status: string, data: any): void {
        const message: WebSocketMessage = {
            type: 'sync_status',
            data: {
                repository,
                status,
                ...data,
            },
            timestamp: new Date().toISOString(),
            repository,
        };

        this.broadcastToRepository(repository, message);
    }

    /**
     * Notify about cache updates
     */
    public notifyCacheUpdate(repository: string, cacheKey: string, operation: string): void {
        const message: WebSocketMessage = {
            type: 'cache_updated',
            data: {
                repository,
                cacheKey,
                operation,
            },
            timestamp: new Date().toISOString(),
            repository,
        };

        this.broadcastToRepository(repository, message);
    }

    /**
     * Get connected clients
     */
    public getConnectedClients(): ConnectedClient[] {
        return Array.from(this.clients.values());
    }

    /**
     * Get WebSocket statistics
     */
    public getStats(): {
        connectedClients: number;
        activeRepositories: number;
        authenticatedClients: number;
    } {
        const clients = Array.from(this.clients.values());
        const repositories = new Set<string>();

        clients.forEach(client => {
            client.repositories.forEach(repo => repositories.add(repo));
        });

        return {
            connectedClients: clients.length,
            activeRepositories: repositories.size,
            authenticatedClients: clients.filter(client => client.userId).length,
        };
    }
}

// Singleton instance
let webSocketService: WebSocketService | null = null;

export const initializeWebSocket = (httpServer: HttpServer): WebSocketService => {
    if (!webSocketService) {
        webSocketService = new WebSocketService(httpServer);
    }
    return webSocketService;
};

export const getWebSocketService = (): WebSocketService => {
    if (!webSocketService) {
        throw new Error('WebSocket service not initialized. Call initializeWebSocket first.');
    }
    return webSocketService;
};