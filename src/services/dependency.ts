import { logger } from '../utils/logger.js';

export interface IssueDependency {
  type: 'depends_on' | 'blocks';
  issueNumber: number;
  repository?: string | undefined;
  description?: string | undefined;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  cycles: number[][];
}

export interface DependencyNode {
  issueNumber: number;
  repository: string;
  title?: string | undefined;
  state?: 'open' | 'closed' | undefined;
  level: number; // Depth in dependency tree
}

export interface DependencyEdge {
  from: number;
  to: number;
  type: 'depends_on' | 'blocks';
  repository?: string | undefined;
}

export class DependencyService {
  /**
   * Parse dependencies from issue body text
   */
  parseDependenciesFromBody(body: string, currentRepository?: string): IssueDependency[] {
    const dependencies: IssueDependency[] = [];
    
    if (!body) return dependencies;

    // Parse "Depends on: #123, #456, owner/repo#789" format
    const dependsOnRegex = /(?:depends\s+on|依存):\s*((?:(?:\w+\/\w+)?#\d+(?:\s*,\s*)?)+)/gi;
    const dependsOnMatches = body.matchAll(dependsOnRegex);
    
    for (const match of dependsOnMatches) {
      const issueRefs = match[1]?.match(/(?:(\w+\/\w+))?#(\d+)/g);
      if (issueRefs) {
        for (const issueRef of issueRefs) {
          const parsed = this.parseIssueReference(issueRef, currentRepository);
          if (parsed) {
            dependencies.push({
              type: 'depends_on',
              issueNumber: parsed.issueNumber,
              repository: parsed.repository || undefined,
            });
          }
        }
      }
    }

    // Parse "Blocks: #789, #101, owner/repo#456" format
    const blocksRegex = /(?:blocks|ブロック):\s*((?:(?:\w+\/\w+)?#\d+(?:\s*,\s*)?)+)/gi;
    const blocksMatches = body.matchAll(blocksRegex);
    
    for (const match of blocksMatches) {
      const issueRefs = match[1]?.match(/(?:(\w+\/\w+))?#(\d+)/g);
      if (issueRefs) {
        for (const issueRef of issueRefs) {
          const parsed = this.parseIssueReference(issueRef, currentRepository);
          if (parsed) {
            dependencies.push({
              type: 'blocks',
              issueNumber: parsed.issueNumber,
              repository: parsed.repository || undefined,
            });
          }
        }
      }
    }

    // Parse structured dependency sections
    const structuredDeps = this.parseStructuredDependencies(body, currentRepository);
    dependencies.push(...structuredDeps);

    return this.deduplicateDependencies(dependencies);
  }

  /**
   * Parse issue reference like "#123" or "owner/repo#456"
   */
  private parseIssueReference(
    issueRef: string, 
    currentRepository?: string
  ): { issueNumber: number; repository?: string | undefined } | null {
    const match = issueRef.match(/(?:(\w+\/\w+))?#(\d+)/);
    if (!match || !match[2]) return null;

    const repository = match[1] || currentRepository;
    const issueNumber = parseInt(match[2], 10);

    if (isNaN(issueNumber)) return null;

    return {
      issueNumber,
      repository: repository !== currentRepository ? repository : undefined,
    };
  }

  /**
   * Parse structured dependency sections in markdown
   */
  private parseStructuredDependencies(body: string, currentRepository?: string): IssueDependency[] {
    const dependencies: IssueDependency[] = [];

    // Parse dependency sections like:
    // ## Dependencies
    // - Depends on: #123 (Database schema)
    // - Blocks: #456 (Frontend integration)
    const sectionRegex = /##\s*(?:Dependencies|依存関係)\s*\n((?:[-*]\s*.*\n?)*)/gi;
    const sectionMatches = body.matchAll(sectionRegex);

    for (const sectionMatch of sectionMatches) {
      const sectionContent = sectionMatch[1];
      if (!sectionContent) continue;

      const lineRegex = /[-*]\s*(?:(Depends on|Blocks|依存|ブロック)):\s*(?:(\w+\/\w+))?#(\d+)(?:\s*\(([^)]+)\))?/gi;
      const lineMatches = sectionContent.matchAll(lineRegex);

      for (const lineMatch of lineMatches) {
        const type = lineMatch[1]?.toLowerCase().includes('depends') || lineMatch[1]?.includes('依存') 
          ? 'depends_on' 
          : 'blocks';
        const repository = lineMatch[2] || (currentRepository !== lineMatch[2] ? undefined : currentRepository);
        if (lineMatch[3]) {
          const issueNumber = parseInt(lineMatch[3], 10);
          const description = lineMatch[4];

          if (!isNaN(issueNumber)) {
            dependencies.push({
              type,
              issueNumber,
              repository: repository !== currentRepository ? repository : undefined,
              description: description || undefined,
            });
          }
        }
      }
    }

    return dependencies;
  }

  /**
   * Remove duplicate dependencies
   */
  private deduplicateDependencies(dependencies: IssueDependency[]): IssueDependency[] {
    const seen = new Set<string>();
    return dependencies.filter(dep => {
      const key = `${dep.type}:${dep.repository || 'current'}:${dep.issueNumber}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Build dependency graph from multiple issues
   */
  buildDependencyGraph(
    issuesWithDependencies: Array<{
      issueNumber: number;
      repository: string;
      title?: string;
      state?: 'open' | 'closed';
      dependencies: IssueDependency[];
    }>
  ): DependencyGraph {
    const nodes: DependencyNode[] = [];
    const edges: DependencyEdge[] = [];
    const nodeMap = new Map<string, DependencyNode>();

    // Create nodes
    for (const issue of issuesWithDependencies) {
      const nodeKey = `${issue.repository}:${issue.issueNumber}`;
      if (!nodeMap.has(nodeKey)) {
        const node: DependencyNode = {
          issueNumber: issue.issueNumber,
          repository: issue.repository,
          title: issue.title || undefined,
          state: issue.state || undefined,
          level: 0, // Will be calculated later
        };
        nodeMap.set(nodeKey, node);
        nodes.push(node);
      }

      // Create edges
      for (const dep of issue.dependencies) {
        const targetRepo = dep.repository || issue.repository;
        const targetKey = `${targetRepo}:${dep.issueNumber}`;
        
        // Ensure target node exists
        if (!nodeMap.has(targetKey)) {
          const targetNode: DependencyNode = {
            issueNumber: dep.issueNumber,
            repository: targetRepo,
            level: 0,
          };
          nodeMap.set(targetKey, targetNode);
          nodes.push(targetNode);
        }

        // Create edge based on dependency type
        if (dep.type === 'depends_on') {
          edges.push({
            from: issue.issueNumber,
            to: dep.issueNumber,
            type: 'depends_on',
            repository: dep.repository || undefined,
          });
        } else if (dep.type === 'blocks') {
          edges.push({
            from: dep.issueNumber,
            to: issue.issueNumber,
            type: 'blocks',
            repository: dep.repository || undefined,
          });
        }
      }
    }

    // Calculate levels (depth in dependency tree)
    this.calculateNodeLevels(nodes, edges);

    // Detect cycles
    const cycles = this.detectCycles(nodes, edges);

    return {
      nodes,
      edges,
      cycles,
    };
  }

  /**
   * Calculate depth levels for nodes in dependency graph
   */
  private calculateNodeLevels(nodes: DependencyNode[], edges: DependencyEdge[]): void {
    const visited = new Set<number>();
    const visiting = new Set<number>();

    const calculateLevel = (nodeNumber: number): number => {
      if (visiting.has(nodeNumber)) {
        // Cycle detected, return current level
        return 0;
      }
      if (visited.has(nodeNumber)) {
        const node = nodes.find(n => n.issueNumber === nodeNumber);
        return node?.level || 0;
      }

      visiting.add(nodeNumber);
      let maxLevel = 0;

      // Find all dependencies (incoming edges)
      const dependencies = edges.filter(e => e.to === nodeNumber);
      for (const dep of dependencies) {
        const depLevel = calculateLevel(dep.from);
        maxLevel = Math.max(maxLevel, depLevel + 1);
      }

      visiting.delete(nodeNumber);
      visited.add(nodeNumber);

      const node = nodes.find(n => n.issueNumber === nodeNumber);
      if (node) {
        node.level = maxLevel;
      }

      return maxLevel;
    };

    // Calculate levels for all nodes
    for (const node of nodes) {
      if (!visited.has(node.issueNumber)) {
        calculateLevel(node.issueNumber);
      }
    }
  }

  /**
   * Detect cycles in dependency graph using DFS
   */
  detectCycles(nodes: DependencyNode[], edges: DependencyEdge[]): number[][] {
    const cycles: number[][] = [];
    const colors = new Map<number, 'white' | 'gray' | 'black'>();
    const path: number[] = [];

    // Initialize all nodes as white (unvisited)
    for (const node of nodes) {
      colors.set(node.issueNumber, 'white');
    }

    const dfs = (nodeNumber: number): void => {
      if (colors.get(nodeNumber) === 'gray') {
        // Cycle detected, extract the cycle
        const cycleStart = path.indexOf(nodeNumber);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), nodeNumber]);
        }
        return;
      }

      if (colors.get(nodeNumber) === 'black') {
        return; // Already processed
      }

      // Mark as gray (currently being processed)
      colors.set(nodeNumber, 'gray');
      path.push(nodeNumber);

      // Visit all outgoing edges
      const outgoingEdges = edges.filter(e => e.from === nodeNumber);
      for (const edge of outgoingEdges) {
        dfs(edge.to);
      }

      // Mark as black (completely processed)
      colors.set(nodeNumber, 'black');
      path.pop();
    };

    // Check for cycles starting from each unvisited node
    for (const node of nodes) {
      if (colors.get(node.issueNumber) === 'white') {
        dfs(node.issueNumber);
      }
    }

    return cycles;
  }

  /**
   * Validate dependencies for potential issues
   */
  validateDependencies(dependencies: IssueDependency[]): {
    isValid: boolean;
    warnings: string[];
    errors: string[];
  } {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check for self-dependencies
    const selfDeps = dependencies.filter(dep => dep.issueNumber === 0); // This would need the current issue number
    if (selfDeps.length > 0) {
      errors.push('Issue cannot depend on itself');
    }

    // Check for duplicate dependencies
    const seen = new Set<string>();
    for (const dep of dependencies) {
      const key = `${dep.type}:${dep.repository || 'current'}:${dep.issueNumber}`;
      if (seen.has(key)) {
        warnings.push(`Duplicate dependency found: ${dep.type} #${dep.issueNumber}`);
      }
      seen.add(key);
    }

    // Check for conflicting dependencies (A depends on B AND B depends on A)
    const dependsOn = new Set(
      dependencies
        .filter(d => d.type === 'depends_on')
        .map(d => `${d.repository || 'current'}:${d.issueNumber}`)
    );
    const blocks = new Set(
      dependencies
        .filter(d => d.type === 'blocks')
        .map(d => `${d.repository || 'current'}:${d.issueNumber}`)
    );

    for (const dep of dependsOn) {
      if (blocks.has(dep)) {
        warnings.push(`Conflicting dependency: issue both depends on and blocks #${dep.split(':')[1]}`);
      }
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
    };
  }

  /**
   * Generate dependency markdown for issue body
   */
  generateDependencyMarkdown(dependencies: IssueDependency[]): string {
    if (dependencies.length === 0) return '';

    const dependsOn = dependencies.filter(d => d.type === 'depends_on');
    const blocks = dependencies.filter(d => d.type === 'blocks');

    let markdown = '\n## Dependencies\n\n';

    if (dependsOn.length > 0) {
      markdown += '**Depends on:**\n';
      for (const dep of dependsOn) {
        const issueRef = dep.repository ? `${dep.repository}#${dep.issueNumber}` : `#${dep.issueNumber}`;
        const description = dep.description ? ` (${dep.description})` : '';
        markdown += `- ${issueRef}${description}\n`;
      }
      markdown += '\n';
    }

    if (blocks.length > 0) {
      markdown += '**Blocks:**\n';
      for (const dep of blocks) {
        const issueRef = dep.repository ? `${dep.repository}#${dep.issueNumber}` : `#${dep.issueNumber}`;
        const description = dep.description ? ` (${dep.description})` : '';
        markdown += `- ${issueRef}${description}\n`;
      }
      markdown += '\n';
    }

    return markdown;
  }
}