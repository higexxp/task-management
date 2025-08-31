import { useEffect, useRef, useState, useCallback } from 'react';
import { getWebSocketService, WebSocketEventHandlers } from '../services/websocket';
import { logger } from '../utils/logger';

export interface UseWebSocketOptions {
    userId: string;
    repositories?: string[];
    autoConnect?: boolean;
    onIssueUpdate?: (data: any) => void;
    onLabelUpdate?: (data: any) => void;
    onSyncStatus?: (data: any) => void;
    onCacheUpdate?: (data: any) => void;
    onTestMessage?: (data: any) => void;
}

export interface WebSocketState {
    isConnected: boolean;
    isConnecting: boolean;
    error: string | null;
    connectionStatus: {
        isConnected: boolean;
        userId: string | null;
        subscribedRepositories: string[];
        socketId: string | null;
    };
}

export const useWebSocket = (options: UseWebSocketOptions) => {
    const {
        userId,
        repositories = [],
        autoConnect = true,
        onIssueUpdate,
        onLabelUpdate,
        onSyncStatus,
        onCacheUpdate,
        onTestMessage,
    } = options;

    const [state, setState] = useState<WebSocketState>({
        isConnected: false,
        isConnecting: false,
        error: null,
        connectionStatus: {
            isConnected: false,
            userId: null,
            subscribedRepositories: [],
            socketId: null,
        },
    });

    const webSocketService = useRef(getWebSocketService());
    const handlersRef = useRef<WebSocketEventHandlers>({});

    // Update handlers ref when props change
    useEffect(() => {
        handlersRef.current = {
            onIssueUpdate,
            onLabelUpdate,
            onSyncStatus,
            onCacheUpdate,
            onTestMessage,
            onConnect: () => {
                setState(prev => ({
                    ...prev,
                    isConnected: true,
                    isConnecting: false,
                    error: null,
                    connectionStatus: webSocketService.current.getConnectionStatus(),
                }));
            },
            onDisconnect: (reason: string) => {
                setState(prev => ({
                    ...prev,
                    isConnected: false,
                    isConnecting: false,
                    error: `Disconnected: ${reason}`,
                    connectionStatus: webSocketService.current.getConnectionStatus(),
                }));
            },
            onError: (error: any) => {
                setState(prev => ({
                    ...prev,
                    isConnecting: false,
                    error: error.message || 'WebSocket error',
                }));
            },
        };

        webSocketService.current.setEventHandlers(handlersRef.current);
    }, [onIssueUpdate, onLabelUpdate, onSyncStatus, onCacheUpdate, onTestMessage]);

    // Connect function
    const connect = useCallback(async () => {
        if (state.isConnected || state.isConnecting) {
            return;
        }

        setState(prev => ({ ...prev, isConnecting: true, error: null }));

        try {
            await webSocketService.current.connect(userId, repositories);
            logger.info('WebSocket connected successfully');
        } catch (error) {
            logger.error('Failed to connect WebSocket', { error });
            setState(prev => ({
                ...prev,
                isConnecting: false,
                error: error instanceof Error ? error.message : 'Connection failed',
            }));
        }
    }, [userId, repositories, state.isConnected, state.isConnecting]);

    // Disconnect function
    const disconnect = useCallback(() => {
        webSocketService.current.disconnect();
        setState(prev => ({
            ...prev,
            isConnected: false,
            isConnecting: false,
            error: null,
            connectionStatus: {
                isConnected: false,
                userId: null,
                subscribedRepositories: [],
                socketId: null,
            },
        }));
    }, []);

    // Subscribe to repository
    const subscribeToRepository = useCallback((repository: string) => {
        webSocketService.current.subscribeToRepository(repository);
        setState(prev => ({
            ...prev,
            connectionStatus: webSocketService.current.getConnectionStatus(),
        }));
    }, []);

    // Unsubscribe from repository
    const unsubscribeFromRepository = useCallback((repository: string) => {
        webSocketService.current.unsubscribeFromRepository(repository);
        setState(prev => ({
            ...prev,
            connectionStatus: webSocketService.current.getConnectionStatus(),
        }));
    }, []);

    // Ping server
    const ping = useCallback(() => {
        webSocketService.current.ping();
    }, []);

    // Auto-connect on mount
    useEffect(() => {
        if (autoConnect && userId && !state.isConnected && !state.isConnecting) {
            connect();
        }

        // Cleanup on unmount
        return () => {
            if (state.isConnected) {
                disconnect();
            }
        };
    }, [autoConnect, userId]); // Only depend on autoConnect and userId

    // Update connection status periodically
    useEffect(() => {
        const interval = setInterval(() => {
            if (state.isConnected) {
                setState(prev => ({
                    ...prev,
                    connectionStatus: webSocketService.current.getConnectionStatus(),
                }));
            }
        }, 5000); // Update every 5 seconds

        return () => clearInterval(interval);
    }, [state.isConnected]);

    return {
        ...state,
        connect,
        disconnect,
        subscribeToRepository,
        unsubscribeFromRepository,
        ping,
    };
};