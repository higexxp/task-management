import {
  extractMetadataFromLabels,
  getPriorityColor,
  getCategoryColor,
  getSizeColor,
  getStatusColor,
  sortIssues,
  filterIssues,
  EnhancedIssue,
  Label,
} from '../metadata';

describe('metadata utils', () => {
  const mockLabels: Label[] = [
    { id: 1, name: 'priority:high', color: 'ff0000' },
    { id: 2, name: 'category:bug', color: '00ff00' },
    { id: 3, name: 'size:medium', color: '0000ff' },
    { id: 4, name: 'status:in-progress', color: 'ffff00' },
    { id: 5, name: 'time-spent:2.5h', color: 'ff00ff' },
    { id: 6, name: 'regular-label', color: '000000' },
  ];

  describe('extractMetadataFromLabels', () => {
    it('should extract metadata from labels correctly', () => {
      const metadata = extractMetadataFromLabels(mockLabels);

      expect(metadata).toEqual({
        priority: 'high',
        category: 'bug',
        size: 'medium',
        status: 'in-progress',
        timeSpent: 2.5,
      });
    });

    it('should handle empty labels array', () => {
      const metadata = extractMetadataFromLabels([]);
      expect(metadata).toEqual({});
    });

    it('should ignore invalid metadata values', () => {
      const invalidLabels: Label[] = [
        { id: 1, name: 'priority:invalid', color: 'ff0000' },
        { id: 2, name: 'category:unknown', color: '00ff00' },
      ];

      const metadata = extractMetadataFromLabels(invalidLabels);
      expect(metadata).toEqual({});
    });
  });

  describe('color functions', () => {
    it('should return correct priority colors', () => {
      expect(getPriorityColor('high')).toBe('#d32f2f');
      expect(getPriorityColor('medium')).toBe('#ed6c02');
      expect(getPriorityColor('low')).toBe('#2e7d32');
      expect(getPriorityColor('invalid')).toBe('#757575');
    });

    it('should return correct category colors', () => {
      expect(getCategoryColor('bug')).toBe('#d32f2f');
      expect(getCategoryColor('feature')).toBe('#1976d2');
      expect(getCategoryColor('enhancement')).toBe('#388e3c');
      expect(getCategoryColor('invalid')).toBe('#757575');
    });

    it('should return correct size colors', () => {
      expect(getSizeColor('small')).toBe('#2e7d32');
      expect(getSizeColor('medium')).toBe('#ed6c02');
      expect(getSizeColor('large')).toBe('#d32f2f');
      expect(getSizeColor('invalid')).toBe('#757575');
    });

    it('should return correct status colors', () => {
      expect(getStatusColor('todo')).toBe('#757575');
      expect(getStatusColor('in-progress')).toBe('#1976d2');
      expect(getStatusColor('review')).toBe('#ed6c02');
      expect(getStatusColor('done')).toBe('#2e7d32');
      expect(getStatusColor('invalid')).toBe('#757575');
    });
  });

  describe('sortIssues', () => {
    const mockIssues: EnhancedIssue[] = [
      {
        id: 1,
        number: 1,
        title: 'Issue 1',
        body: 'Body 1',
        state: 'open',
        labels: [],
        user: { login: 'user1', avatar_url: '' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        metadata: { priority: 'low' },
      },
      {
        id: 2,
        number: 2,
        title: 'Issue 2',
        body: 'Body 2',
        state: 'open',
        labels: [],
        user: { login: 'user2', avatar_url: '' },
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        metadata: { priority: 'high' },
      },
    ];

    it('should sort by priority correctly', () => {
      const sorted = sortIssues(mockIssues, 'priority', 'desc');
      expect(sorted[0].metadata.priority).toBe('high');
      expect(sorted[1].metadata.priority).toBe('low');
    });

    it('should sort by created date correctly', () => {
      const sorted = sortIssues(mockIssues, 'created', 'asc');
      expect(sorted[0].id).toBe(1);
      expect(sorted[1].id).toBe(2);
    });

    it('should sort by number correctly', () => {
      const sorted = sortIssues(mockIssues, 'number', 'desc');
      expect(sorted[0].number).toBe(2);
      expect(sorted[1].number).toBe(1);
    });
  });

  describe('filterIssues', () => {
    const mockIssues: EnhancedIssue[] = [
      {
        id: 1,
        number: 1,
        title: 'Bug Issue',
        body: 'This is a bug',
        state: 'open',
        labels: [],
        user: { login: 'user1', avatar_url: '' },
        created_at: '2023-01-01T00:00:00Z',
        updated_at: '2023-01-02T00:00:00Z',
        metadata: { priority: 'high', category: 'bug' },
      },
      {
        id: 2,
        number: 2,
        title: 'Feature Request',
        body: 'This is a feature',
        state: 'closed',
        labels: [],
        user: { login: 'user2', avatar_url: '' },
        created_at: '2023-01-02T00:00:00Z',
        updated_at: '2023-01-01T00:00:00Z',
        metadata: { priority: 'low', category: 'feature' },
      },
    ];

    it('should filter by priority', () => {
      const filtered = filterIssues(mockIssues, { priority: ['high'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].metadata.priority).toBe('high');
    });

    it('should filter by category', () => {
      const filtered = filterIssues(mockIssues, { category: ['bug'] });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].metadata.category).toBe('bug');
    });

    it('should filter by state', () => {
      const filtered = filterIssues(mockIssues, { state: 'open' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].state).toBe('open');
    });

    it('should filter by search term', () => {
      const filtered = filterIssues(mockIssues, { search: 'bug' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].title).toContain('Bug');
    });

    it('should apply multiple filters', () => {
      const filtered = filterIssues(mockIssues, {
        priority: ['high'],
        category: ['bug'],
        state: 'open',
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe(1);
    });
  });
});