import { TimeTrackingService, TimeEntry, TimeSession } from '../timeTracking';

describe('TimeTrackingService', () => {
    let service: TimeTrackingService;

    beforeEach(() => {
        service = new TimeTrackingService();
    });

    describe('Session Management', () => {
        test('should start a new session', () => {
            const session = service.startSession(123, 'owner/repo', 'user1', 'Working on feature');

            expect(session).toMatchObject({
                issueNumber: 123,
                repository: 'owner/repo',
                userId: 'user1',
                description: 'Working on feature',
                isActive: true,
            });
            expect(session.id).toBeDefined();
            expect(session.startTime).toBeInstanceOf(Date);
        });

        test('should stop existing sessions when starting a new one for the same user', () => {
            // Start first session
            service.startSession(123, 'owner/repo', 'user1', 'First task');

            // Start second session - should stop the first one
            const session2 = service.startSession(456, 'owner/repo', 'user1', 'Second task');

            expect(session2.issueNumber).toBe(456);

            // First session should be stopped and converted to time entry
            const entries = service.getTimeEntries({ userId: 'user1' });
            expect(entries).toHaveLength(1);
            expect(entries[0].issueNumber).toBe(123);
        });

        test('should stop a session and create time entry', () => {
            // Start session
            service.startSession(123, 'owner/repo', 'user1', 'Working on feature');

            // Wait a bit to ensure duration > 0
            jest.advanceTimersByTime(60000); // 1 minute

            // Stop session
            const timeEntry = service.stopSession(123, 'owner/repo', 'user1', 'Completed feature work');

            expect(timeEntry).toMatchObject({
                issueNumber: 123,
                repository: 'owner/repo',
                userId: 'user1',
                description: 'Completed feature work',
                isActive: false,
            });
            expect(timeEntry!.duration).toBeGreaterThan(0);
            expect(timeEntry!.endTime).toBeInstanceOf(Date);
        });

        test('should return null when stopping non-existent session', () => {
            const result = service.stopSession(123, 'owner/repo', 'user1');
            expect(result).toBeNull();
        });

        test('should pause and resume sessions', () => {
            // Start session
            service.startSession(123, 'owner/repo', 'user1');

            // Pause session
            const pausedSession = service.pauseSession(123, 'owner/repo', 'user1');
            expect(pausedSession?.isActive).toBe(false);

            // Resume session
            const resumedSession = service.resumeSession(123, 'owner/repo', 'user1');
            expect(resumedSession?.isActive).toBe(true);
        });

        test('should get active session for user', () => {
            service.startSession(123, 'owner/repo', 'user1');

            const activeSession = service.getActiveSession('user1');
            expect(activeSession).toMatchObject({
                issueNumber: 123,
                userId: 'user1',
                isActive: true,
            });
        });

        test('should get all sessions for user', () => {
            service.startSession(123, 'owner/repo', 'user1');
            service.pauseSession(123, 'owner/repo', 'user1'); \n      service.startSession(456, 'owner/repo', 'user1'); \n      \n      const sessions = service.getUserSessions('user1'); \n      expect(sessions).toHaveLength(1); // Only active session\n      expect(sessions[0].issueNumber).toBe(456);\n    });\n  });\n\n  describe('Manual Time Entries', () => {\n    test('should add manual time entry', () => {\n      const entry = service.addManualEntry(\n        123,\n        'owner/repo',\n        'user1',\n        90, // 1.5 hours\n        'Code review',\n        new Date('2023-01-01T10:00:00Z'),\n        ['review', 'frontend']\n      );\n\n      expect(entry).toMatchObject({\n        issueNumber: 123,\n        repository: 'owner/repo',\n        userId: 'user1',\n        duration: 90,\n        description: 'Code review',\n        tags: ['review', 'frontend'],\n        isActive: false,\n      });\n      expect(entry.startTime).toEqual(new Date('2023-01-01T10:00:00Z'));\n      expect(entry.endTime).toEqual(new Date('2023-01-01T11:30:00Z'));\n    });\n\n    test('should add manual entry with default start time', () => {\n      const entry = service.addManualEntry(123, 'owner/repo', 'user1', 60);\n      \n      expect(entry.duration).toBe(60);\n      expect(entry.startTime).toBeInstanceOf(Date);\n      expect(entry.endTime).toBeInstanceOf(Date);\n      \n      const timeDiff = entry.endTime!.getTime() - entry.startTime.getTime();\n      expect(timeDiff).toBe(60 * 60 * 1000); // 60 minutes in milliseconds\n    });\n  });\n\n  describe('Time Entry Management', () => {\n    test('should update time entry', () => {\n      const entry = service.addManualEntry(123, 'owner/repo', 'user1', 60, 'Original description');\n      \n      const updatedEntry = service.updateTimeEntry(entry.id, {\n        duration: 90,\n        description: 'Updated description',\n        tags: ['updated'],\n      });\n\n      expect(updatedEntry).toMatchObject({\n        duration: 90,\n        description: 'Updated description',\n        tags: ['updated'],\n      });\n      expect(updatedEntry!.updatedAt).toBeInstanceOf(Date);\n    });\n\n    test('should recalculate duration when updating times', () => {\n      const entry = service.addManualEntry(123, 'owner/repo', 'user1', 60);\n      \n      const newStartTime = new Date('2023-01-01T10:00:00Z');\n      const newEndTime = new Date('2023-01-01T12:00:00Z');\n      \n      const updatedEntry = service.updateTimeEntry(entry.id, {\n        startTime: newStartTime,\n        endTime: newEndTime,\n      });\n\n      expect(updatedEntry!.duration).toBe(120); // 2 hours\n    });\n\n    test('should return null when updating non-existent entry', () => {\n      const result = service.updateTimeEntry('non-existent', { duration: 60 });\n      expect(result).toBeNull();\n    });\n\n    test('should delete time entry', () => {\n      const entry = service.addManualEntry(123, 'owner/repo', 'user1', 60);\n      \n      const deleted = service.deleteTimeEntry(entry.id);\n      expect(deleted).toBe(true);\n      \n      const entries = service.getTimeEntries();\n      expect(entries).toHaveLength(0);\n    });\n\n    test('should return false when deleting non-existent entry', () => {\n      const result = service.deleteTimeEntry('non-existent');\n      expect(result).toBe(false);\n    });\n  });\n\n  describe('Time Entry Queries', () => {\n    beforeEach(() => {\n      // Add test data\n      service.addManualEntry(123, 'owner/repo1', 'user1', 60, 'Task 1', new Date('2023-01-01T10:00:00Z'), ['frontend']);\n      service.addManualEntry(456, 'owner/repo1', 'user2', 90, 'Task 2', new Date('2023-01-02T10:00:00Z'), ['backend']);\n      service.addManualEntry(789, 'owner/repo2', 'user1', 120, 'Task 3', new Date('2023-01-03T10:00:00Z'), ['frontend']);\n    });\n\n    test('should filter by issue number', () => {\n      const entries = service.getTimeEntries({ issueNumber: 123 });\n      expect(entries).toHaveLength(1);\n      expect(entries[0].issueNumber).toBe(123);\n    });\n\n    test('should filter by repository', () => {\n      const entries = service.getTimeEntries({ repository: 'owner/repo1' });\n      expect(entries).toHaveLength(2);\n      expect(entries.every(e => e.repository === 'owner/repo1')).toBe(true);\n    });\n\n    test('should filter by user', () => {\n      const entries = service.getTimeEntries({ userId: 'user1' });\n      expect(entries).toHaveLength(2);\n      expect(entries.every(e => e.userId === 'user1')).toBe(true);\n    });\n\n    test('should filter by date range', () => {\n      const entries = service.getTimeEntries({\n        startDate: new Date('2023-01-01T00:00:00Z'),\n        endDate: new Date('2023-01-02T23:59:59Z'),\n      });\n      expect(entries).toHaveLength(2);\n    });\n\n    test('should filter by tags', () => {\n      const entries = service.getTimeEntries({ tags: ['frontend'] });\n      expect(entries).toHaveLength(2);\n      expect(entries.every(e => e.tags?.includes('frontend'))).toBe(true);\n    });\n\n    test('should return entries sorted by start time (newest first)', () => {\n      const entries = service.getTimeEntries();\n      expect(entries).toHaveLength(3);\n      expect(entries[0].startTime.getTime()).toBeGreaterThan(entries[1].startTime.getTime());\n      expect(entries[1].startTime.getTime()).toBeGreaterThan(entries[2].startTime.getTime());\n    });\n  });\n\n  describe('Time Summary Calculations', () => {\n    test('should calculate summary for empty entries', () => {\n      const summary = service.calculateTimeSummary([]);\n      expect(summary).toEqual({\n        totalMinutes: 0,\n        totalHours: 0,\n        entriesCount: 0,\n        averageSessionMinutes: 0,\n        longestSessionMinutes: 0,\n        shortestSessionMinutes: 0,\n        activeDays: 0,\n      });\n    });\n\n    test('should calculate summary for multiple entries', () => {\n      const entries = [\n        service.addManualEntry(123, 'owner/repo', 'user1', 60, 'Task 1', new Date('2023-01-01T10:00:00Z')),\n        service.addManualEntry(456, 'owner/repo', 'user1', 90, 'Task 2', new Date('2023-01-01T14:00:00Z')),\n        service.addManualEntry(789, 'owner/repo', 'user1', 30, 'Task 3', new Date('2023-01-02T10:00:00Z')),\n      ];\n\n      const summary = service.calculateTimeSummary(entries);\n      expect(summary).toEqual({\n        totalMinutes: 180,\n        totalHours: 3,\n        entriesCount: 3,\n        averageSessionMinutes: 60,\n        longestSessionMinutes: 90,\n        shortestSessionMinutes: 30,\n        activeDays: 2,\n      });\n    });\n  });\n\n  describe('Time Reports', () => {\n    beforeEach(() => {\n      // Add test data across multiple days and users\n      service.addManualEntry(123, 'owner/repo', 'user1', 60, 'Task 1', new Date('2023-01-01T10:00:00Z'));\n      service.addManualEntry(456, 'owner/repo', 'user2', 90, 'Task 2', new Date('2023-01-01T14:00:00Z'));\n      service.addManualEntry(789, 'owner/repo', 'user1', 120, 'Task 3', new Date('2023-01-02T10:00:00Z'));\n      service.addManualEntry(101, 'owner/repo', 'user2', 45, 'Task 4', new Date('2023-01-02T15:00:00Z'));\n    });\n\n    test('should generate comprehensive time report', () => {\n      const report = service.generateTimeReport(\n        new Date('2023-01-01T00:00:00Z'),\n        new Date('2023-01-02T23:59:59Z')\n      );\n\n      expect(report.summary.totalMinutes).toBe(315); // 60+90+120+45\n      expect(report.summary.entriesCount).toBe(4);\n      \n      // By issue\n      expect(report.byIssue[123].totalMinutes).toBe(60);\n      expect(report.byIssue[456].totalMinutes).toBe(90);\n      \n      // By user\n      expect(report.byUser['user1'].totalMinutes).toBe(180); // 60+120\n      expect(report.byUser['user2'].totalMinutes).toBe(135); // 90+45\n      \n      // By day\n      expect(report.byDay['2023-01-01'].totalMinutes).toBe(150); // 60+90\n      expect(report.byDay['2023-01-02'].totalMinutes).toBe(165); // 120+45\n    });\n\n    test('should determine period type correctly', () => {\n      const dayReport = service.generateTimeReport(\n        new Date('2023-01-01T00:00:00Z'),\n        new Date('2023-01-01T23:59:59Z')\n      );\n      expect(dayReport.period.type).toBe('day');\n\n      const weekReport = service.generateTimeReport(\n        new Date('2023-01-01T00:00:00Z'),\n        new Date('2023-01-07T23:59:59Z')\n      );\n      expect(weekReport.period.type).toBe('week');\n\n      const monthReport = service.generateTimeReport(\n        new Date('2023-01-01T00:00:00Z'),\n        new Date('2023-01-31T23:59:59Z')\n      );\n      expect(monthReport.period.type).toBe('month');\n\n      const customReport = service.generateTimeReport(\n        new Date('2023-01-01T00:00:00Z'),\n        new Date('2023-03-01T23:59:59Z')\n      );\n      expect(customReport.period.type).toBe('custom');\n    });\n  });\n\n  describe('Utility Functions', () => {\n    test('should format duration correctly', () => {\n      expect(TimeTrackingService.formatDuration(30)).toBe('30m');\n      expect(TimeTrackingService.formatDuration(60)).toBe('1h');\n      expect(TimeTrackingService.formatDuration(90)).toBe('1h 30m');\n      expect(TimeTrackingService.formatDuration(120)).toBe('2h');\n    });\n\n    test('should parse duration strings correctly', () => {\n      expect(TimeTrackingService.parseDuration('30m')).toBe(30);\n      expect(TimeTrackingService.parseDuration('1h')).toBe(60);\n      expect(TimeTrackingService.parseDuration('1h 30m')).toBe(90);\n      expect(TimeTrackingService.parseDuration('2h')).toBe(120);\n      expect(TimeTrackingService.parseDuration('90')).toBe(90); // Plain number\n    });\n  });\n});\n\n// Mock timers for testing\nbeforeAll(() => {\n  jest.useFakeTimers();\n});\n\nafterAll(() => {\n  jest.useRealTimers();\n});"