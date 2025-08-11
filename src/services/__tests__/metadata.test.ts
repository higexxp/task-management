import { MetadataService, LABEL_PREFIXES, LABEL_VALUES } from '../metadata';
import { GitHubLabel, LabelBasedMetadata } from '../../types/github';

describe('MetadataService', () => {
  let metadataService: MetadataService;

  beforeEach(() => {
    metadataService = new MetadataService();
  });

  describe('extractMetadataFromLabels', () => {
    it('should extract metadata from valid labels', () => {
      const labels: GitHubLabel[] = [
        { id: 1, name: 'priority:high', color: 'D93F0B', description: 'High priority' },
        { id: 2, name: 'category:frontend', color: '1D76DB', description: 'Frontend work' },
        { id: 3, name: 'size:large', color: 'D93F0B', description: 'Large task' },
        { id: 4, name: 'status:in-progress', color: 'FBCA04', description: 'In progress' },
        { id: 5, name: 'time-spent:4-8h', color: 'D93F0B', description: 'Time spent' },
        { id: 6, name: 'bug', color: 'D73A4A', description: 'Bug report' }, // Non-metadata label
      ];

      const metadata = metadataService.extractMetadataFromLabels(labels);

      expect(metadata).toEqual({
        priority: 'high',
        category: 'frontend',
        estimatedSize: 'large',
        status: 'in-progress',
        timeSpent: '4-8h',
      });
    });

    it('should use default values for missing metadata', () => {
      const labels: GitHubLabel[] = [
        { id: 1, name: 'bug', color: 'D73A4A', description: 'Bug report' },
      ];

      const metadata = metadataService.extractMetadataFromLabels(labels);

      expect(metadata).toEqual({
        priority: 'medium',
        category: 'backend',
        estimatedSize: 'medium',
        status: 'todo',
      });
    });

    it('should ignore invalid label values', () => {
      const labels: GitHubLabel[] = [
        { id: 1, name: 'priority:invalid', color: 'CCCCCC', description: 'Invalid priority' },
        { id: 2, name: 'category:unknown', color: 'CCCCCC', description: 'Unknown category' },
      ];

      const metadata = metadataService.extractMetadataFromLabels(labels);

      expect(metadata).toEqual({
        priority: 'medium', // Default value
        category: 'backend', // Default value
        estimatedSize: 'medium',
        status: 'todo',
      });
    });
  });

  describe('convertMetadataToLabels', () => {
    it('should convert metadata to label names', () => {
      const metadata: LabelBasedMetadata = {
        priority: 'high',
        category: 'frontend',
        estimatedSize: 'large',
        status: 'in-progress',
        timeSpent: '4-8h',
      };

      const labels = metadataService.convertMetadataToLabels(metadata);

      expect(labels).toEqual([
        'priority:high',
        'category:frontend',
        'size:large',
        'status:in-progress',
        'time-spent:4-8h',
      ]);
    });

    it('should handle partial metadata', () => {
      const metadata: Partial<LabelBasedMetadata> = {
        priority: 'critical',
        status: 'done',
      };

      const labels = metadataService.convertMetadataToLabels(metadata);

      expect(labels).toEqual([
        'priority:critical',
        'status:done',
      ]);
    });
  });

  describe('validateMetadata', () => {
    it('should validate correct metadata', () => {
      const metadata: LabelBasedMetadata = {
        priority: 'high',
        category: 'frontend',
        estimatedSize: 'large',
        status: 'in-progress',
        timeSpent: '4-8h',
      };

      const result = metadataService.validateMetadata(metadata);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return errors for invalid metadata', () => {
      const metadata = {
        priority: 'invalid' as any,
        category: 'unknown' as any,
        estimatedSize: 'huge' as any,
      };

      const result = metadataService.validateMetadata(metadata);

      expect(result.isValid).toBe(false);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toContain('Invalid priority');
      expect(result.errors[1]).toContain('Invalid category');
      expect(result.errors[2]).toContain('Invalid size');
    });
  });

  describe('getLabelDefinition', () => {
    it('should return label definition for valid prefix and value', () => {
      const definition = metadataService.getLabelDefinition('PRIORITY', 'high');

      expect(definition).toEqual({
        name: 'priority:high',
        color: 'D93F0B',
        description: 'Priority: high',
      });
    });

    it('should return default color for invalid combinations', () => {
      const definition = metadataService.getLabelDefinition('PRIORITY', 'invalid');

      expect(definition).toEqual({
        name: 'priority:invalid',
        color: 'CCCCCC',
        description: '',
      });
    });
  });

  describe('getAllRequiredLabels', () => {
    it('should return all required labels', () => {
      const labels = metadataService.getAllRequiredLabels();

      // Should have labels for all categories
      const totalExpected = 
        LABEL_VALUES.PRIORITY.length +
        LABEL_VALUES.CATEGORY.length +
        LABEL_VALUES.SIZE.length +
        LABEL_VALUES.STATUS.length +
        LABEL_VALUES.TIME_SPENT.length;

      expect(labels).toHaveLength(totalExpected);
      
      // Check that all labels have required properties
      labels.forEach(label => {
        expect(label).toHaveProperty('name');
        expect(label).toHaveProperty('color');
        expect(label).toHaveProperty('description');
        expect(label.name).toMatch(/^(priority|category|size|status|time-spent):/);
      });
    });
  });

  describe('filterMetadataLabels', () => {
    it('should filter only metadata labels', () => {
      const labels: GitHubLabel[] = [
        { id: 1, name: 'priority:high', color: 'D93F0B', description: 'High priority' },
        { id: 2, name: 'bug', color: 'D73A4A', description: 'Bug report' },
        { id: 3, name: 'category:frontend', color: '1D76DB', description: 'Frontend work' },
        { id: 4, name: 'enhancement', color: 'A2EEEF', description: 'Enhancement' },
      ];

      const metadataLabels = metadataService.filterMetadataLabels(labels);

      expect(metadataLabels).toHaveLength(2);
      expect(metadataLabels[0]?.name).toBe('priority:high');
      expect(metadataLabels[1]?.name).toBe('category:frontend');
    });
  });

  describe('filterNonMetadataLabels', () => {
    it('should filter only non-metadata labels', () => {
      const labels: GitHubLabel[] = [
        { id: 1, name: 'priority:high', color: 'D93F0B', description: 'High priority' },
        { id: 2, name: 'bug', color: 'D73A4A', description: 'Bug report' },
        { id: 3, name: 'category:frontend', color: '1D76DB', description: 'Frontend work' },
        { id: 4, name: 'enhancement', color: 'A2EEEF', description: 'Enhancement' },
      ];

      const nonMetadataLabels = metadataService.filterNonMetadataLabels(labels);

      expect(nonMetadataLabels).toHaveLength(2);
      expect(nonMetadataLabels[0]?.name).toBe('bug');
      expect(nonMetadataLabels[1]?.name).toBe('enhancement');
    });
  });

  describe('mergeLabelsWithMetadata', () => {
    it('should merge existing labels with metadata labels', () => {
      const existingLabels: GitHubLabel[] = [
        { id: 1, name: 'bug', color: 'D73A4A', description: 'Bug report' },
        { id: 2, name: 'priority:low', color: '0E8A16', description: 'Low priority' },
        { id: 3, name: 'enhancement', color: 'A2EEEF', description: 'Enhancement' },
      ];

      const metadata: Partial<LabelBasedMetadata> = {
        priority: 'high',
        category: 'frontend',
        status: 'in-progress',
      };

      const mergedLabels = metadataService.mergeLabelsWithMetadata(existingLabels, metadata);

      expect(mergedLabels).toEqual([
        'bug',
        'enhancement',
        'priority:high',
        'category:frontend',
        'status:in-progress',
      ]);
    });
  });
});