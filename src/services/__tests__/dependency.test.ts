import { DependencyService, IssueDependency } from '../dependency';

describe('DependencyService', () => {
  let dependencyService: DependencyService;

  beforeEach(() => {
    dependencyService = new DependencyService();
  });

  describe('parseDependenciesFromBody', () => {
    it('should parse simple depends on format', () => {
      const body = 'This issue depends on: #123, #456';
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toEqual([
        { type: 'depends_on', issueNumber: 123 },
        { type: 'depends_on', issueNumber: 456 },
      ]);
    });

    it('should parse simple blocks format', () => {
      const body = 'This issue blocks: #789, #101';
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toEqual([
        { type: 'blocks', issueNumber: 789 },
        { type: 'blocks', issueNumber: 101 },
      ]);
    });

    it('should parse cross-repository dependencies', () => {
      const body = 'Depends on: owner/other-repo#123, #456';
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toEqual([
        { type: 'depends_on', issueNumber: 123, repository: 'owner/other-repo' },
        { type: 'depends_on', issueNumber: 456 },
      ]);
    });

    it('should parse structured dependency sections', () => {
      const body = `
## Dependencies

- Depends on: #123 (Database schema)
- Blocks: #456 (Frontend integration)
- Depends on: owner/other#789
      `;
      
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toEqual([
        { type: 'depends_on', issueNumber: 123, description: 'Database schema' },
        { type: 'blocks', issueNumber: 456, description: 'Frontend integration' },
        { type: 'depends_on', issueNumber: 789, repository: 'owner/other' },
      ]);
    });

    it('should handle Japanese dependency keywords', () => {
      const body = '依存: #123\nブロック: #456';
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toEqual([
        { type: 'depends_on', issueNumber: 123 },
        { type: 'blocks', issueNumber: 456 },
      ]);
    });

    it('should deduplicate dependencies', () => {
      const body = `
Depends on: #123, #123
Blocks: #456

## Dependencies
- Depends on: #123
      `;
      
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');

      expect(dependencies).toHaveLength(2);
      expect(dependencies).toEqual([
        { type: 'depends_on', issueNumber: 123 },
        { type: 'blocks', issueNumber: 456 },
      ]);
    });

    it('should return empty array for empty body', () => {
      const dependencies = dependencyService.parseDependenciesFromBody('', 'owner/repo');
      expect(dependencies).toEqual([]);
    });

    it('should return empty array for body without dependencies', () => {
      const body = 'This is a regular issue description without any dependencies.';
      const dependencies = dependencyService.parseDependenciesFromBody(body, 'owner/repo');
      expect(dependencies).toEqual([]);
    });
  });

  describe('buildDependencyGraph', () => {
    it('should build a simple dependency graph', () => {
      const issues = [
        {
          issueNumber: 1,
          repository: 'owner/repo',
          title: 'Issue 1',
          state: 'open' as const,
          dependencies: [{ type: 'depends_on' as const, issueNumber: 2 }],
        },
        {
          issueNumber: 2,
          repository: 'owner/repo',
          title: 'Issue 2',
          state: 'open' as const,
          dependencies: [],
        },
      ];

      const graph = dependencyService.buildDependencyGraph(issues);

      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toHaveLength(1);
      expect(graph.cycles).toHaveLength(0);

      expect(graph.edges[0]).toEqual({
        from: 1,
        to: 2,
        type: 'depends_on',
        repository: undefined,
      });
    });

    it('should calculate node levels correctly', () => {
      const issues = [
        {
          issueNumber: 1,
          repository: 'owner/repo',
          dependencies: [{ type: 'depends_on' as const, issueNumber: 2 }],
        },
        {
          issueNumber: 2,
          repository: 'owner/repo',
          dependencies: [{ type: 'depends_on' as const, issueNumber: 3 }],
        },
        {
          issueNumber: 3,
          repository: 'owner/repo',
          dependencies: [],
        },
      ];

      const graph = dependencyService.buildDependencyGraph(issues);

      const node1 = graph.nodes.find(n => n.issueNumber === 1);
      const node2 = graph.nodes.find(n => n.issueNumber === 2);
      const node3 = graph.nodes.find(n => n.issueNumber === 3);

      expect(node1?.level).toBe(2);
      expect(node2?.level).toBe(1);
      expect(node3?.level).toBe(0);
    });

    it('should detect cycles', () => {
      const issues = [
        {
          issueNumber: 1,
          repository: 'owner/repo',
          dependencies: [{ type: 'depends_on' as const, issueNumber: 2 }],
        },
        {
          issueNumber: 2,
          repository: 'owner/repo',
          dependencies: [{ type: 'depends_on' as const, issueNumber: 3 }],
        },
        {
          issueNumber: 3,
          repository: 'owner/repo',
          dependencies: [{ type: 'depends_on' as const, issueNumber: 1 }],
        },
      ];

      const graph = dependencyService.buildDependencyGraph(issues);

      expect(graph.cycles).toHaveLength(1);
      expect(graph.cycles[0]).toEqual([1, 2, 3, 1]);
    });
  });

  describe('validateDependencies', () => {
    it('should validate correct dependencies', () => {
      const dependencies: IssueDependency[] = [
        { type: 'depends_on', issueNumber: 123 },
        { type: 'blocks', issueNumber: 456 },
      ];

      const result = dependencyService.validateDependencies(dependencies);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should detect conflicting dependencies', () => {
      const dependencies: IssueDependency[] = [
        { type: 'depends_on', issueNumber: 123 },
        { type: 'blocks', issueNumber: 123 },
      ];

      const result = dependencyService.validateDependencies(dependencies);

      expect(result.warnings).toContain('Conflicting dependency: issue both depends on and blocks #123');
    });
  });

  describe('generateDependencyMarkdown', () => {
    it('should generate markdown for dependencies', () => {
      const dependencies: IssueDependency[] = [
        { type: 'depends_on', issueNumber: 123, description: 'Database setup' },
        { type: 'blocks', issueNumber: 456, repository: 'owner/other' },
      ];

      const markdown = dependencyService.generateDependencyMarkdown(dependencies);

      expect(markdown).toContain('## Dependencies');
      expect(markdown).toContain('**Depends on:**');
      expect(markdown).toContain('- #123 (Database setup)');
      expect(markdown).toContain('**Blocks:**');
      expect(markdown).toContain('- owner/other#456');
    });

    it('should return empty string for no dependencies', () => {
      const markdown = dependencyService.generateDependencyMarkdown([]);
      expect(markdown).toBe('');
    });
  });
});