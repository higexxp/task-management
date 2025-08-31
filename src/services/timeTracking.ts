import { logger } from '../utils/logger.js';

export interface TimeEntry {
    id: string;
    issueNumber: number;
    repository: string;
    description: string;
    timeSpent: number; // in minutes
    date: string; // ISO date string
    user: string;
    category?: 'development' | 'testing' | 'review' | 'documentation' | 'meeting' | 'other';
}

export interface TimeEstimate {
    issueNumber: number;
    repository: string;
    originalEstimate: number; // in minutes
    remainingEstimate: number; // in minutes
    timeSpent: number; // in minutes
    lastUpdated: string;
}

export interface TimeReport {
    totalTimeSpent: number;
    totalEstimated: number;
    completionRate: number; // percentage
    efficiency: number; // timeSpent / estimated
    issueBreakdown: Array<{
        issueNumber: number;
        title: string;
        timeSpent: number;
        estimated: number;
        status: 'on-track' | 'over-budget' | 'completed';
    }>;
    categoryBreakdown: Record<string, number>;
    memberBreakdown: Record<string, number>;
}

export class TimeTrackingService {
    /**
     * Parse time from label text (e.g., "2h", "30m", "1h30m", "90m")
     */
    parseTimeFromLabel(labelText: string): number | null {
        const timeRegex = /(?:(\d+)h)?(?:(\d+)m)?/i;
        const match = labelText.match(timeRegex);

        if (!match || (!match[1] && !match[2])) {
            return null;
        }

        const hours = parseInt(match[1] || '0', 10);
        const minutes = parseInt(match[2] || '0', 10);

        return hours * 60 + minutes;
    }

    /**
     * Format minutes to human readable time (e.g., "2h 30m", "45m")
     */
    formatTime(minutes: number): string {
        if (minutes < 60) {
            return `${minutes}m`;
        }

        const hours = Math.floor(minutes / 60);
        const remainingMinutes = minutes % 60;

        if (remainingMinutes === 0) {
            return `${hours}h`;
        }

        return `${hours}h ${remainingMinutes}m`;
    }

    /**
     * Extract time tracking information from GitHub issue labels
     */
    extractTimeFromLabels(labels: Array<{ name: string }>): {
        timeSpent: number;
        originalEstimate: number;
        remainingEstimate: number;
    } {
        let timeSpent = 0;
        let originalEstimate = 0;
        let remainingEstimate = 0;

        for (const label of labels) {
            const labelName = label.name.toLowerCase();

            // Parse time-spent labels (e.g., "time-spent:2h30m")
            if (labelName.startsWith('time-spent:')) {
                const timeStr = labelName.replace('time-spent:', '');
                const parsedTime = this.parseTimeFromLabel(timeStr);
                if (parsedTime !== null) {
                    timeSpent += parsedTime;
                }
            }

            // Parse estimate labels (e.g., "estimate:8h")
            if (labelName.startsWith('estimate:')) {
                const timeStr = labelName.replace('estimate:', '');
                const parsedTime = this.parseTimeFromLabel(timeStr);
                if (parsedTime !== null) {
                    originalEstimate = parsedTime;
                    remainingEstimate = Math.max(0, parsedTime - timeSpent);
                }
            }

            // Parse remaining labels (e.g., "remaining:4h")
            if (labelName.startsWith('remaining:')) {
                const timeStr = labelName.replace('remaining:', '');
                const parsedTime = this.parseTimeFromLabel(timeStr);
                if (parsedTime !== null) {
                    remainingEstimate = parsedTime;
                }
            }
        }

        return {
            timeSpent,
            originalEstimate,
            remainingEstimate,
        };
    }

    /**
     * Generate time tracking labels for an issue
     */
    generateTimeLabels(timeSpent: number, originalEstimate?: number, remainingEstimate?: number): string[] {
        const labels: string[] = [];

        if (timeSpent > 0) {
            labels.push(`time-spent:${this.formatTime(timeSpent)}`);
        }

        if (originalEstimate && originalEstimate > 0) {
            labels.push(`estimate:${this.formatTime(originalEstimate)}`);
        }

        if (remainingEstimate !== undefined && remainingEstimate >= 0) {
            labels.push(`remaining:${this.formatTime(remainingEstimate)}`);
        }

        return labels;
    }

    /**
     * Add time entry to an issue
     */
    addTimeEntry(
        issueNumber: number,
        repository: string,
        timeSpent: number,
        description: string,
        user: string,
        category?: TimeEntry['category']
    ): TimeEntry {
        const timeEntry: TimeEntry = {
            id: `${repository}-${issueNumber}-${Date.now()}`,
            issueNumber,
            repository,
            description,
            timeSpent,
            date: new Date().toISOString(),
            user,
            category: category || 'development',
        };

        logger.info('Time entry added', {
            issueNumber,
            repository,
            timeSpent: this.formatTime(timeSpent),
            user,
            category,
        });

        return timeEntry;
    }

    /**
     * Calculate time report for a repository
     */
    calculateTimeReport(
        issues: Array<{
            number: number;
            title: string;
            state: 'open' | 'closed';
            labels: Array<{ name: string }>;
            assignee?: { login: string };
        }>
    ): TimeReport {
        let totalTimeSpent = 0;
        let totalEstimated = 0;
        const issueBreakdown: TimeReport['issueBreakdown'] = [];
        const categoryBreakdown: Record<string, number> = {};
        const memberBreakdown: Record<string, number> = {};

        for (const issue of issues) {
            const timeInfo = this.extractTimeFromLabels(issue.labels);

            totalTimeSpent += timeInfo.timeSpent;
            totalEstimated += timeInfo.originalEstimate;

            // Determine status
            let status: 'on-track' | 'over-budget' | 'completed' = 'on-track';
            if (issue.state === 'closed') {
                status = 'completed';
            } else if (timeInfo.originalEstimate > 0 && timeInfo.timeSpent > timeInfo.originalEstimate) {
                status = 'over-budget';
            }

            issueBreakdown.push({
                issueNumber: issue.number,
                title: issue.title,
                timeSpent: timeInfo.timeSpent,
                estimated: timeInfo.originalEstimate,
                status,
            });

            // Track member time
            if (issue.assignee && timeInfo.timeSpent > 0) {
                const member = issue.assignee.login;
                memberBreakdown[member] = (memberBreakdown[member] || 0) + timeInfo.timeSpent;
            }
        }

        // Calculate completion rate based on closed issues
        const closedIssues = issues.filter(issue => issue.state === 'closed');
        const completionRate = issues.length > 0 ? (closedIssues.length / issues.length) * 100 : 0;

        // Calculate efficiency
        const efficiency = totalEstimated > 0 ? totalTimeSpent / totalEstimated : 1;

        return {
            totalTimeSpent,
            totalEstimated,
            completionRate,
            efficiency,
            issueBreakdown,
            categoryBreakdown,
            memberBreakdown,
        };
    }

    /**
     * Get time tracking summary for a specific issue
     */
    getIssueSummary(labels: Array<{ name: string }>): {
        timeSpent: number;
        originalEstimate: number;
        remainingEstimate: number;
        progress: number; // percentage
        status: 'not-started' | 'in-progress' | 'completed' | 'over-budget';
        formattedTimeSpent: string;
        formattedEstimate: string;
        formattedRemaining: string;
    } {
        const timeInfo = this.extractTimeFromLabels(labels);

        let progress = 0;
        let status: 'not-started' | 'in-progress' | 'completed' | 'over-budget' = 'not-started';

        if (timeInfo.originalEstimate > 0) {
            progress = Math.min(100, (timeInfo.timeSpent / timeInfo.originalEstimate) * 100);

            if (timeInfo.timeSpent === 0) {
                status = 'not-started';
            } else if (timeInfo.remainingEstimate <= 0) {
                status = 'completed';
            } else if (timeInfo.timeSpent > timeInfo.originalEstimate) {
                status = 'over-budget';
            } else {
                status = 'in-progress';
            }
        } else if (timeInfo.timeSpent > 0) {
            status = 'in-progress';
            progress = 50; // Arbitrary progress when no estimate
        }

        return {
            timeSpent: timeInfo.timeSpent,
            originalEstimate: timeInfo.originalEstimate,
            remainingEstimate: timeInfo.remainingEstimate,
            progress,
            status,
            formattedTimeSpent: this.formatTime(timeInfo.timeSpent),
            formattedEstimate: this.formatTime(timeInfo.originalEstimate),
            formattedRemaining: this.formatTime(timeInfo.remainingEstimate),
        };
    }

    /**
     * Validate time entry data
     */
    validateTimeEntry(timeEntry: Partial<TimeEntry>): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (!timeEntry.issueNumber || timeEntry.issueNumber <= 0) {
            errors.push('Issue number is required and must be positive');
        }

        if (!timeEntry.repository || timeEntry.repository.trim().length === 0) {
            errors.push('Repository is required');
        }

        if (!timeEntry.description || timeEntry.description.trim().length === 0) {
            errors.push('Description is required');
        }

        if (!timeEntry.timeSpent || timeEntry.timeSpent <= 0) {
            errors.push('Time spent must be greater than 0');
        }

        if (!timeEntry.user || timeEntry.user.trim().length === 0) {
            errors.push('User is required');
        }

        if (timeEntry.category && !['development', 'testing', 'review', 'documentation', 'meeting', 'other'].includes(timeEntry.category)) {
            errors.push('Invalid category');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Calculate burndown data for a milestone or sprint
     */
    calculateBurndown(
        issues: Array<{
            number: number;
            labels: Array<{ name: string }>;
            created_at: string;
            closed_at?: string;
        }>,
        startDate: Date,
        endDate: Date
    ): Array<{
        date: string;
        remainingWork: number;
        idealRemaining: number;
        actualWork: number;
    }> {
        const totalWork = issues.reduce((sum, issue) => {
            const timeInfo = this.extractTimeFromLabels(issue.labels);
            return sum + timeInfo.originalEstimate;
        }, 0);

        const burndownData: Array<{
            date: string;
            remainingWork: number;
            idealRemaining: number;
            actualWork: number;
        }> = [];

        const totalDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const dailyIdealBurn = totalWork / totalDays;

        for (let day = 0; day <= totalDays; day++) {
            const currentDate = new Date(startDate.getTime() + day * 24 * 60 * 60 * 1000);
            const dateStr = currentDate.toISOString().split('T')[0];

            // Calculate actual work completed by this date
            const completedWork = issues
                .filter(issue => issue.closed_at && new Date(issue.closed_at) <= currentDate)
                .reduce((sum, issue) => {
                    const timeInfo = this.extractTimeFromLabels(issue.labels);
                    return sum + timeInfo.timeSpent;
                }, 0);

            const remainingWork = Math.max(0, totalWork - completedWork);
            const idealRemaining = Math.max(0, totalWork - (day * dailyIdealBurn));

            burndownData.push({
                date: dateStr!,
                remainingWork,
                idealRemaining,
                actualWork: completedWork,
            });
        }

        return burndownData;
    }
}

export const timeTrackingService = new TimeTrackingService();