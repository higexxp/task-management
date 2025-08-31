import { logger } from '../utils/logger.js';

export interface WorkloadMetrics {
    assignee: string;
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    estimatedHours: number;
    actualHours: number;
    priorityBreakdown: {
        high: number;
        medium: number;
        low: number;
        unset: number;
    };
    sizeBreakdown: {
        small: number;
        medium: number;
        large: number;
        unset: number;
    };
    categoryBreakdown: {
        bug: number;
        feature: number;
        enhancement: number;
        documentation: number;
        question: number;
        unset: number;
    };
    overloadRisk: 'low' | 'medium' | 'high';
    efficiency: number; // actualHours / estimatedHours
}

export interface TeamWorkload {
    totalMembers: number;
    totalIssues: number;
    totalEstimatedHours: number;
    totalActualHours: number;
    averageIssuesPerMember: number;
    averageHoursPerMember: number;
    workloadBalance: number; // 0-1, where 1 is perfectly balanced
    overloadedMembers: string[];
    underloadedMembers: string[];
    memberMetrics: WorkloadMetrics[];
}

export interface WorkloadSettings {
    maxIssuesPerMember: number;
    maxHoursPerMember: number;
    sizeToHoursMapping: {
        small: number;
        medium: number;
        large: number;
    };
    overloadThreshold: number; // percentage above average
    underloadThreshold: number; // percentage below average
}

export class WorkloadService {
    private defaultSettings: WorkloadSettings = {
        maxIssuesPerMember: 10,
        maxHoursPerMember: 40,
        sizeToHoursMapping: {
            small: 2,
            medium: 8,
            large: 20,
        },
        overloadThreshold: 150, // 150% of average
        underloadThreshold: 50,  // 50% of average
    };

    /**
     * Calculate workload metrics for a single team member
     */
    calculateMemberWorkload(
        assignee: string,
        issues: any[],
        settings: WorkloadSettings = this.defaultSettings
    ): WorkloadMetrics {
        const assigneeIssues = issues.filter(issue =>
            issue.assignees?.some((a: any) => a.login === assignee)
        );

        const openIssues = assigneeIssues.filter(issue => issue.state === 'open');
        const closedIssues = assigneeIssues.filter(issue => issue.state === 'closed');

        // Calculate priority breakdown
        const priorityBreakdown = {
            high: assigneeIssues.filter(issue => issue.metadata?.priority === 'high').length,
            medium: assigneeIssues.filter(issue => issue.metadata?.priority === 'medium').length,
            low: assigneeIssues.filter(issue => issue.metadata?.priority === 'low').length,
            unset: assigneeIssues.filter(issue => !issue.metadata?.priority).length,
        };

        // Calculate size breakdown
        const sizeBreakdown = {
            small: assigneeIssues.filter(issue => issue.metadata?.size === 'small').length,
            medium: assigneeIssues.filter(issue => issue.metadata?.size === 'medium').length,
            large: assigneeIssues.filter(issue => issue.metadata?.size === 'large').length,
            unset: assigneeIssues.filter(issue => !issue.metadata?.size).length,
        };

        // Calculate category breakdown
        const categoryBreakdown = {
            bug: assigneeIssues.filter(issue => issue.metadata?.category === 'bug').length,
            feature: assigneeIssues.filter(issue => issue.metadata?.category === 'feature').length,
            enhancement: assigneeIssues.filter(issue => issue.metadata?.category === 'enhancement').length,
            documentation: assigneeIssues.filter(issue => issue.metadata?.category === 'documentation').length,
            question: assigneeIssues.filter(issue => issue.metadata?.category === 'question').length,
            unset: assigneeIssues.filter(issue => !issue.metadata?.category).length,
        };

        // Calculate estimated hours based on size
        const estimatedHours = assigneeIssues.reduce((total, issue) => {
            const size = issue.metadata?.size || 'medium';
            return total + (settings.sizeToHoursMapping[size as keyof typeof settings.sizeToHoursMapping] || settings.sizeToHoursMapping.medium);
        }, 0);

        // Calculate actual hours from time tracking
        const actualHours = assigneeIssues.reduce((total, issue) => {
            return total + (issue.metadata?.timeSpent || 0);
        }, 0);

        // Calculate efficiency
        const efficiency = estimatedHours > 0 ? actualHours / estimatedHours : 1;

        // Determine overload risk
        let overloadRisk: 'low' | 'medium' | 'high' = 'low';
        if (assigneeIssues.length > settings.maxIssuesPerMember || estimatedHours > settings.maxHoursPerMember) {
            overloadRisk = 'high';
        } else if (assigneeIssues.length > settings.maxIssuesPerMember * 0.8 || estimatedHours > settings.maxHoursPerMember * 0.8) {
            overloadRisk = 'medium';
        }

        return {
            assignee,
            totalIssues: assigneeIssues.length,
            openIssues: openIssues.length,
            closedIssues: closedIssues.length,
            estimatedHours,
            actualHours,
            priorityBreakdown,
            sizeBreakdown,
            categoryBreakdown,
            overloadRisk,
            efficiency,
        };
    }

    /**
     * Calculate team-wide workload metrics
     */
    calculateTeamWorkload(
        issues: any[],
        settings: WorkloadSettings = this.defaultSettings
    ): TeamWorkload {
        // Get all unique assignees
        const assignees = Array.from(new Set(
            issues
                .filter(issue => issue.assignees && issue.assignees.length > 0)
                .flatMap(issue => issue.assignees.map((a: any) => a.login))
        ));

        // Calculate metrics for each member
        const memberMetrics = assignees.map(assignee =>
            this.calculateMemberWorkload(assignee, issues, settings)
        );

        const totalMembers = memberMetrics.length;
        const totalIssues = issues.length;
        const totalEstimatedHours = memberMetrics.reduce((sum, member) => sum + member.estimatedHours, 0);
        const totalActualHours = memberMetrics.reduce((sum, member) => sum + member.actualHours, 0);

        const averageIssuesPerMember = totalMembers > 0 ? totalIssues / totalMembers : 0;
        const averageHoursPerMember = totalMembers > 0 ? totalEstimatedHours / totalMembers : 0;

        // Calculate workload balance (standard deviation from mean)
        const issueVariances = memberMetrics.map(member =>
            Math.pow(member.totalIssues - averageIssuesPerMember, 2)
        );
        const issueStdDev = Math.sqrt(issueVariances.reduce((sum, variance) => sum + variance, 0) / totalMembers);
        const workloadBalance = averageIssuesPerMember > 0 ? Math.max(0, 1 - (issueStdDev / averageIssuesPerMember)) : 1;

        // Identify overloaded and underloaded members
        const overloadThreshold = averageIssuesPerMember * (settings.overloadThreshold / 100);
        const underloadThreshold = averageIssuesPerMember * (settings.underloadThreshold / 100);

        const overloadedMembers = memberMetrics
            .filter(member => member.totalIssues > overloadThreshold)
            .map(member => member.assignee);

        const underloadedMembers = memberMetrics
            .filter(member => member.totalIssues < underloadThreshold)
            .map(member => member.assignee);

        return {
            totalMembers,
            totalIssues,
            totalEstimatedHours,
            totalActualHours,
            averageIssuesPerMember,
            averageHoursPerMember,
            workloadBalance,
            overloadedMembers,
            underloadedMembers,
            memberMetrics,
        };
    }

    /**
     * Generate workload rebalancing suggestions
     */
    generateRebalancingSuggestions(teamWorkload: TeamWorkload): {
        suggestions: Array<{
            type: 'reassign' | 'reduce' | 'increase';
            from?: string;
            to?: string;
            issueCount: number;
            reason: string;
        }>;
        priority: 'low' | 'medium' | 'high';
    } {
        const suggestions: Array<{
            type: 'reassign' | 'reduce' | 'increase';
            from?: string;
            to?: string;
            issueCount: number;
            reason: string;
        }> = [];

        // Generate reassignment suggestions
        for (const overloadedMember of teamWorkload.overloadedMembers) {
            const overloadedMetrics = teamWorkload.memberMetrics.find(m => m.assignee === overloadedMember);
            if (!overloadedMetrics) continue;

            const excessIssues = Math.ceil(overloadedMetrics.totalIssues - teamWorkload.averageIssuesPerMember);

            for (const underloadedMember of teamWorkload.underloadedMembers) {
                const underloadedMetrics = teamWorkload.memberMetrics.find(m => m.assignee === underloadedMember);
                if (!underloadedMetrics) continue;

                const capacity = Math.floor(teamWorkload.averageIssuesPerMember - underloadedMetrics.totalIssues);
                const transferCount = Math.min(excessIssues, capacity);

                if (transferCount > 0) {
                    suggestions.push({
                        type: 'reassign',
                        from: overloadedMember,
                        to: underloadedMember,
                        issueCount: transferCount,
                        reason: `${overloadedMember} is overloaded (${overloadedMetrics.totalIssues} issues), ${underloadedMember} has capacity`,
                    });
                }
            }
        }

        // Determine priority based on workload balance
        let priority: 'low' | 'medium' | 'high' = 'low';
        if (teamWorkload.workloadBalance < 0.5) {
            priority = 'high';
        } else if (teamWorkload.workloadBalance < 0.7) {
            priority = 'medium';
        }

        return { suggestions, priority };
    }

    /**
     * Calculate workload trends over time
     */
    calculateWorkloadTrends(
        historicalData: Array<{ date: string; issues: any[] }>,
        settings: WorkloadSettings = this.defaultSettings
    ): Array<{
        date: string;
        teamWorkload: TeamWorkload;
        workloadBalance: number;
        overloadedCount: number;
    }> {
        return historicalData.map(snapshot => {
            const teamWorkload = this.calculateTeamWorkload(snapshot.issues, settings);
            return {
                date: snapshot.date,
                teamWorkload,
                workloadBalance: teamWorkload.workloadBalance,
                overloadedCount: teamWorkload.overloadedMembers.length,
            };
        });
    }

    /**
     * Validate workload settings
     */
    validateSettings(settings: Partial<WorkloadSettings>): {
        isValid: boolean;
        errors: string[];
    } {
        const errors: string[] = [];

        if (settings.maxIssuesPerMember !== undefined && settings.maxIssuesPerMember <= 0) {
            errors.push('Max issues per member must be greater than 0');
        }

        if (settings.maxHoursPerMember !== undefined && settings.maxHoursPerMember <= 0) {
            errors.push('Max hours per member must be greater than 0');
        }

        if (settings.sizeToHoursMapping) {
            const { small, medium, large } = settings.sizeToHoursMapping;
            if (small <= 0 || medium <= 0 || large <= 0) {
                errors.push('Size to hours mapping values must be greater than 0');
            }
            if (small >= medium || medium >= large) {
                errors.push('Size to hours mapping must be in ascending order (small < medium < large)');
            }
        }

        if (settings.overloadThreshold !== undefined && settings.overloadThreshold <= 100) {
            errors.push('Overload threshold must be greater than 100%');
        }

        if (settings.underloadThreshold !== undefined && settings.underloadThreshold >= 100) {
            errors.push('Underload threshold must be less than 100%');
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }
}

export const workloadService = new WorkloadService();