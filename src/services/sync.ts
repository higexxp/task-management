import { GitHubService } from './github.js';
import { redisService } from './redis.js';
import { getWebSocketService } from './websocket.js';
import { logger } from '../utils/logger.js';

export interface SyncStatus {
    repository: string;
    lastSync: Date;
    status: 'idle' | 'syncing' | 'error';
    progress: {
        current: number;
        total: number;
        phase: string;
    };
    error?: string;
    stats: {
        issuesProcessed: number;
        labelsProcessed: number;
        cacheHits: number;
        cacheMisses: number;
    };
}

export interface SyncOptions {
    force?: boolean; // Force full sync even if cache is fresh
    batchSize?: number; // Number of items to process in each batch
    maxRetries?: number; // Maximum number of retries for failed operations
    skipCache?: boolean; // Skip cache and fetch directly from GitHub
}

export class SyncService {
    private syncStatuses: Map<string, SyncStatus> = new Map();
    private activeSyncs: Set<string> = new Set();
    private syncIntervals: Map<string, NodeJS.Timeout> = new Map();

    constructor() {
        this.startPeriodicSync();
    }

    /**
     * Start periodic sync for all repositories
     */
    private startPeriodicSync(): void {
        // Sync every 5 minutes
        setInterval(async () => {
            try {
                const repositories = await this.getActiveRepositories();
                for (const repo of repositories) {
                    if (!this.activeSyncs.has(repo)) {
                        this.syncRepository(repo, { force: false });
                    }
                }
            } catch (error) {
                logger.error('Error in periodic sync', { error });
            }
        }, 5 * 60 * 1000);
    }

    /**
     * Get list of active repositories from cache or recent activity
     */
    private async getActiveRepositories(): Promise<string[]> {
        try {
            const cacheKey = 'active_repositories';
            const cached = await redisService.get<string[]>(cacheKey);

            if (cached) {
                return cached;
            }

            // If no cached list, return empty array
            // In a real implementation, you might want to maintain a list of repositories
            // that have been accessed recently or are configured for monitoring
            return [];
        } catch (error) {
            logger.error('Error getting active repositories', { error });
            return [];
        }
    }

    /**
     * Sync a specific repository
     */
    public async syncRepository(repository: string, options: SyncOptions = {}): Promise<SyncStatus> {
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) {
            throw new Error('Invalid repository format. Expected "owner/repo"');
        }

        // Check if sync is already in progress
        if (this.activeSyncs.has(repository)) {
            const status = this.syncStatuses.get(repository);
            if (status) {
                return status;
            }
        }

        // Initialize sync status
        const syncStatus: SyncStatus = {
            repository,
            lastSync: new Date(),
            status: 'syncing',
            progress: {
                current: 0,
                total: 0,
                phase: 'initializing',
            },
            stats: {
                issuesProcessed: 0,
                labelsProcessed: 0,
                cacheHits: 0,
                cacheMisses: 0,
            },
        };

        this.syncStatuses.set(repository, syncStatus);
        this.activeSyncs.add(repository);

        try {
            // Notify clients that sync has started
            const webSocketService = getWebSocketService();
            webSocketService.notifySyncStatus(repository, 'started', {
                options,
                startTime: new Date(),
            });

            logger.info('Starting repository sync', { repository, options });

            // Phase 1: Sync labels
            syncStatus.progress.phase = 'syncing_labels';
            await this.syncLabels(owner, repo, syncStatus, options);

            // Phase 2: Sync issues
            syncStatus.progress.phase = 'syncing_issues';
            await this.syncIssues(owner, repo, syncStatus, options);

            // Phase 3: Update metadata
            syncStatus.progress.phase = 'updating_metadata';
            await this.updateMetadata(owner, repo, syncStatus, options);

            // Complete sync
            syncStatus.status = 'idle';
            syncStatus.progress.phase = 'completed';
            syncStatus.progress.current = syncStatus.progress.total;

            logger.info('Repository sync completed', {
                repository,
                stats: syncStatus.stats,
                duration: Date.now() - syncStatus.lastSync.getTime(),
            });

            // Notify clients that sync is complete
            webSocketService.notifySyncStatus(repository, 'completed', {
                stats: syncStatus.stats,
                duration: Date.now() - syncStatus.lastSync.getTime(),
            });

        } catch (error) {
            syncStatus.status = 'error';
            syncStatus.error = error instanceof Error ? error.message : 'Unknown error';

            logger.error('Repository sync failed', {
                repository,
                error: syncStatus.error,
                stats: syncStatus.stats,
            });

            // Notify clients about sync failure
            const webSocketService = getWebSocketService();
            webSocketService.notifySyncStatus(repository, 'failed', {
                error: syncStatus.error,
                stats: syncStatus.stats,
            });

            throw error;
        } finally {
            this.activeSyncs.delete(repository);
        }

        return syncStatus;
    }

    /**
     * Sync repository labels
     */
    private async syncLabels(owner: string, repo: string, syncStatus: SyncStatus, options: SyncOptions): Promise<void> {
        try {
            const cacheKey = `labels:${owner}/${repo}`;
            let labels;

            if (!options.skipCache) {
                labels = await redisService.get<any[]>(cacheKey);
                if (labels) {
                    syncStatus.stats.cacheHits++;
                    logger.debug('Using cached labels', { repository: `${owner}/${repo}`, count: labels.length });
                }
            }

            if (!labels || options.force) {
                syncStatus.stats.cacheMisses++;
                const githubService = new GitHubService();
                labels = await githubService.getRepositoryLabels(owner, repo);

                // Cache labels for 1 hour
                await redisService.set(cacheKey, labels, 3600);

                logger.debug('Fetched labels from GitHub', { repository: `${owner}/${repo}`, count: labels.length });
            }

            syncStatus.stats.labelsProcessed = labels.length;
            syncStatus.progress.current += labels.length;
            syncStatus.progress.total += labels.length;

            // Notify about cache update
            const webSocketService = getWebSocketService();
            webSocketService.notifyCacheUpdate(`${owner}/${repo}`, cacheKey, 'set');

        } catch (error) {
            logger.error('Error syncing labels', {
                repository: `${owner}/${repo}`,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Sync repository issues
     */
    private async syncIssues(owner: string, repo: string, syncStatus: SyncStatus, options: SyncOptions): Promise<void> {
        try {
            const batchSize = options.batchSize || 50;
            let page = 1;
            let hasMore = true;
            let totalIssues = 0;

            while (hasMore) {
                const cacheKey = `issues:${owner}/${repo}:page:${page}`;
                let issues;

                if (!options.skipCache) {
                    issues = await redisService.get<any[]>(cacheKey);
                    if (issues) {
                        syncStatus.stats.cacheHits++;
                    }
                }

                if (!issues || options.force) {
                    syncStatus.stats.cacheMisses++;
                    const githubService = new GitHubService();
                    issues = await githubService.getRepositoryIssues(owner, repo, {
                        state: 'all',
                        per_page: batchSize,
                        page,
                    });

                    // Cache issues for 30 minutes
                    await redisService.set(cacheKey, issues, 1800);
                }

                if (issues.length === 0) {
                    hasMore = false;
                } else {
                    totalIssues += issues.length;
                    syncStatus.stats.issuesProcessed += issues.length;
                    syncStatus.progress.current += issues.length;

                    // Process each issue for metadata extraction
                    for (const issue of issues) {
                        await this.processIssueMetadata(owner, repo, issue, syncStatus);
                    }

                    // Notify about issue updates
                    const webSocketService = getWebSocketService();
                    webSocketService.notifyIssueUpdate(`${owner}/${repo}`, {
                        type: 'batch_update',
                        issues: issues.map((issue: any) => ({
                            number: issue.number,
                            title: issue.title,
                            state: issue.state,
                            updated_at: issue.updated_at,
                        })),
                        page,
                        batchSize: issues.length,
                    });

                    page++;

                    // Add small delay to respect rate limits
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            logger.debug('Synced issues', {
                repository: `${owner}/${repo}`,
                totalIssues,
                pages: page - 1,
            });

        } catch (error) {
            logger.error('Error syncing issues', {
                repository: `${owner}/${repo}`,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Process individual issue for metadata extraction
     */
    private async processIssueMetadata(owner: string, repo: string, issue: any, syncStatus: SyncStatus): Promise<void> {
        try {
            const cacheKey = `issue_metadata:${owner}/${repo}:${issue.number}`;

            // Extract metadata from labels and body
            const metadata = {
                number: issue.number,
                title: issue.title,
                state: issue.state,
                labels: issue.labels || [],
                assignees: issue.assignees || [],
                created_at: issue.created_at,
                updated_at: issue.updated_at,
                body: issue.body || '',
                // Add extracted metadata here
                priority: this.extractPriorityFromLabels(issue.labels || []),
                category: this.extractCategoryFromLabels(issue.labels || []),
                size: this.extractSizeFromLabels(issue.labels || []),
                dependencies: this.extractDependenciesFromBody(issue.body || ''),
            };

            // Cache metadata for 15 minutes
            await redisService.set(cacheKey, metadata, 900);

        } catch (error) {
            logger.error('Error processing issue metadata', {
                repository: `${owner}/${repo}`,
                issueNumber: issue.number,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            // Don't throw here, continue processing other issues
        }
    }

    /**
     * Update aggregated metadata and statistics
     */
    private async updateMetadata(owner: string, repo: string, syncStatus: SyncStatus, options: SyncOptions): Promise<void> {
        try {
            // Update repository statistics
            const statsKey = `repo_stats:${owner}/${repo}`;
            const stats = {
                lastSync: new Date(),
                totalIssues: syncStatus.stats.issuesProcessed,
                totalLabels: syncStatus.stats.labelsProcessed,
                syncDuration: Date.now() - syncStatus.lastSync.getTime(),
                cacheHitRate: syncStatus.stats.cacheHits / (syncStatus.stats.cacheHits + syncStatus.stats.cacheMisses),
            };

            await redisService.set(statsKey, stats, 3600); // Cache for 1 hour

            // Update active repositories list
            const activeReposKey = 'active_repositories';
            const activeRepos = await redisService.get<string[]>(activeReposKey) || [];
            const repository = `${owner}/${repo}`;

            if (!activeRepos.includes(repository)) {
                activeRepos.push(repository);
                await redisService.set(activeReposKey, activeRepos, 86400); // Cache for 24 hours
            }

            logger.debug('Updated repository metadata', {
                repository,
                stats,
            });

        } catch (error) {
            logger.error('Error updating metadata', {
                repository: `${owner}/${repo}`,
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
        }
    }

    /**
     * Extract priority from labels
     */
    private extractPriorityFromLabels(labels: any[]): string | null {
        const priorityLabel = labels.find(label =>
            label.name && label.name.startsWith('priority:')
        );
        return priorityLabel ? priorityLabel.name.replace('priority:', '') : null;
    }

    /**
     * Extract category from labels
     */
    private extractCategoryFromLabels(labels: any[]): string | null {
        const categoryLabel = labels.find(label =>
            label.name && label.name.startsWith('category:')
        );
        return categoryLabel ? categoryLabel.name.replace('category:', '') : null;
    }

    /**
     * Extract size from labels
     */
    private extractSizeFromLabels(labels: any[]): string | null {
        const sizeLabel = labels.find(label =>
            label.name && label.name.startsWith('size:')
        );
        return sizeLabel ? sizeLabel.name.replace('size:', '') : null;
    }

    /**
     * Extract dependencies from issue body
     */
    private extractDependenciesFromBody(body: string): number[] {
        const dependencyRegex = /(?:depends on|blocked by|requires)\s*#(\d+)/gi;
        const dependencies: number[] = [];
        let match;

        while ((match = dependencyRegex.exec(body)) !== null) {
            const issueNumber = parseInt(match[1] || '0');
            if (!dependencies.includes(issueNumber)) {
                dependencies.push(issueNumber);
            }
        }

        return dependencies;
    }

    /**
     * Get sync status for a repository
     */
    public getSyncStatus(repository: string): SyncStatus | null {
        return this.syncStatuses.get(repository) || null;
    }

    /**
     * Get sync status for all repositories
     */
    public getAllSyncStatuses(): Record<string, SyncStatus> {
        const statuses: Record<string, SyncStatus> = {};
        for (const [repo, status] of this.syncStatuses.entries()) {
            statuses[repo] = status;
        }
        return statuses;
    }

    /**
     * Force sync for a repository
     */
    public async forceSyncRepository(repository: string): Promise<SyncStatus> {
        return this.syncRepository(repository, { force: true, skipCache: true });
    }

    /**
     * Clear cache for a repository
     */
    public async clearRepositoryCache(repository: string): Promise<void> {
        const [owner, repo] = repository.split('/');
        if (!owner || !repo) {
            throw new Error('Invalid repository format');
        }

        const patterns = [
            `labels:${repository}`,
            `issues:${repository}:*`,
            `issue_metadata:${repository}:*`,
            `repo_stats:${repository}`,
        ];

        for (const pattern of patterns) {
            await redisService.deletePattern(pattern);
        }

        // Notify about cache clear
        const webSocketService = getWebSocketService();
        webSocketService.notifyCacheUpdate(repository, 'repository_cache', 'clear');

        logger.info('Cleared repository cache', { repository });
    }

    /**
     * Get cache statistics
     */
    public async getCacheStats(): Promise<{
        totalKeys: number;
        memoryUsage: string;
        hitRate: number;
        repositories: string[];
    }> {
        try {
            const info = await redisService.getInfo();
            const activeRepos = await redisService.get<string[]>('active_repositories') || [];

            return {
                totalKeys: info.keyCount || 0,
                memoryUsage: info.memoryUsage || '0B',
                hitRate: info.hitRate || 0,
                repositories: activeRepos,
            };
        } catch (error) {
            logger.error('Error getting cache stats', { error });
            return {
                totalKeys: 0,
                memoryUsage: '0B',
                hitRate: 0,
                repositories: [],
            };
        }
    }
}

// Singleton instance
export const syncService = new SyncService();