import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
    Node,
    Edge,
    addEdge,
    Connection,
    useNodesState,
    useEdgesState,
    Controls,
    MiniMap,
    Background,
    BackgroundVariant,
    NodeTypes,
    EdgeTypes,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import {
    Box,
    Card,
    CardContent,
    Typography,
    Chip,
    IconButton,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Alert,
    Tooltip,
} from '@mui/material';
import {
    Add as AddIcon,
    Delete as DeleteIcon,
    Warning as WarningIcon,
    Info as InfoIcon,
} from '@mui/icons-material';

interface Issue {
    id: number;
    number: number;
    title: string;
    state: 'open' | 'closed';
    priority?: 'high' | 'medium' | 'low';
    category?: string;
    size?: 'small' | 'medium' | 'large';
    assignee?: {
        login: string;
        avatar_url: string;
    };
}

interface Dependency {
    from: number;
    to: number;
    type: 'blocks' | 'depends_on' | 'related';
}

interface DependencyGraphProps {
    issues: Issue[];
    dependencies: Dependency[];
    onDependencyAdd?: (from: number, to: number, type: string) => void;
    onDependencyRemove?: (from: number, to: number) => void;
    onNodeClick?: (issue: Issue) => void;
    readonly?: boolean;
}

// Custom node component for issues
function IssueNode({ data }: { data: Issue & { isInCycle?: boolean } }) {
    const getPriorityColor = (priority?: string) => {
        switch (priority) {
            case 'high': return '#d32f2f';
            case 'medium': return '#ed6c02';
            case 'low': return '#2e7d32';
            default: return '#757575';
        }
    };

    const getStateColor = (state: string) => {
        return state === 'open' ? '#1976d2' : '#4caf50';
    };

    return (
        <Card
            sx={{
                minWidth: 200,
                maxWidth: 250,
                border: data.isInCycle ? '2px solid #d32f2f' : '1px solid #e0e0e0',
                boxShadow: data.isInCycle ? '0 0 10px rgba(211, 47, 47, 0.3)' : undefined,
            }}
        >
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                    <Typography variant="body2" fontWeight="bold">
                        #{data.number}
                    </Typography>
                    <Chip
                        label={data.state}
                        size="small"
                        sx={{
                            backgroundColor: getStateColor(data.state),
                            color: 'white',
                            fontSize: '0.7rem',
                        }}
                    />
                    {data.isInCycle && (
                        <Tooltip title="Part of circular dependency">
                            <WarningIcon color="error" fontSize="small" />
                        </Tooltip>
                    )}
                </Box>

                <Typography variant="body2" sx={{ mb: 1, lineHeight: 1.3 }}>
                    {data.title.length > 50 ? `${data.title.substring(0, 50)}...` : data.title}
                </Typography>

                <Box display="flex" flexWrap="wrap" gap={0.5}>
                    {data.priority && (
                        <Chip
                            label={data.priority}
                            size="small"
                            sx={{
                                backgroundColor: getPriorityColor(data.priority),
                                color: 'white',
                                fontSize: '0.6rem',
                                height: 20,
                            }}
                        />
                    )}
                    {data.category && (
                        <Chip
                            label={data.category}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 20 }}
                        />
                    )}
                    {data.size && (
                        <Chip
                            label={data.size}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.6rem', height: 20 }}
                        />
                    )}
                </Box>

                {data.assignee && (
                    <Box display="flex" alignItems="center" gap={1} mt={1}>
                        <img
                            src={data.assignee.avatar_url}
                            alt={data.assignee.login}
                            style={{ width: 16, height: 16, borderRadius: '50%' }}
                        />
                        <Typography variant="caption" color="text.secondary">
                            {data.assignee.login}
                        </Typography>
                    </Box>
                )}
            </CardContent>
        </Card>
    );
}

// Custom edge component for dependencies
function DependencyEdge({ data }: { data: { type: string; isInCycle?: boolean } }) {
    const getEdgeColor = (type: string) => {
        switch (type) {
            case 'blocks': return '#d32f2f';
            case 'depends_on': return '#1976d2';
            case 'related': return '#757575';
            default: return '#757575';
        }
    };

    return (
        <g>
            <defs>
                <marker
                    id={`arrow-${data.type}`}
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                >
                    <path
                        d="M0,0 L0,6 L9,3 z"
                        fill={getEdgeColor(data.type)}
                    />
                </marker>
            </defs>
        </g>
    );
}

const nodeTypes: NodeTypes = {
    issue: IssueNode,
};

const edgeTypes: EdgeTypes = {
    dependency: DependencyEdge,
};

function DependencyGraph({
    issues,
    dependencies,
    onDependencyAdd,
    onDependencyRemove,
    onNodeClick,
    readonly = false,
}: DependencyGraphProps) {
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [selectedFromNode, setSelectedFromNode] = useState<number | null>(null);
    const [selectedToNode, setSelectedToNode] = useState<number | null>(null);
    const [dependencyType, setDependencyType] = useState<string>('depends_on');

    // Detect circular dependencies
    const circularDependencies = useMemo(() => {
        const cycles = new Set<number>();
        const visited = new Set<number>();
        const recursionStack = new Set<number>();

        const hasCycle = (nodeId: number): boolean => {
            if (recursionStack.has(nodeId)) {
                return true;
            }
            if (visited.has(nodeId)) {
                return false;
            }

            visited.add(nodeId);
            recursionStack.add(nodeId);

            const dependentIssues = dependencies
                .filter(dep => dep.from === nodeId)
                .map(dep => dep.to);

            for (const dependentId of dependentIssues) {
                if (hasCycle(dependentId)) {
                    cycles.add(nodeId);
                    cycles.add(dependentId);
                    return true;
                }
            }

            recursionStack.delete(nodeId);
            return false;
        };

        issues.forEach(issue => {
            if (!visited.has(issue.number)) {
                hasCycle(issue.number);
            }
        });

        return cycles;
    }, [issues, dependencies]);

    // Convert issues to nodes
    const initialNodes: Node[] = useMemo(() => {
        return issues.map((issue, index) => ({
            id: issue.number.toString(),
            type: 'issue',
            position: {
                x: (index % 4) * 300,
                y: Math.floor(index / 4) * 200,
            },
            data: {
                ...issue,
                isInCycle: circularDependencies.has(issue.number),
            },
        }));
    }, [issues, circularDependencies]);

    // Convert dependencies to edges
    const initialEdges: Edge[] = useMemo(() => {
        return dependencies.map((dep, index) => ({
            id: `${dep.from}-${dep.to}-${index}`,
            source: dep.from.toString(),
            target: dep.to.toString(),
            type: 'dependency',
            animated: dep.type === 'blocks',
            style: {
                stroke: dep.type === 'blocks' ? '#d32f2f' : dep.type === 'depends_on' ? '#1976d2' : '#757575',
                strokeWidth: 2,
            },
            markerEnd: {
                type: MarkerType.ArrowClosed,
                color: dep.type === 'blocks' ? '#d32f2f' : dep.type === 'depends_on' ? '#1976d2' : '#757575',
            },
            data: {
                type: dep.type,
                isInCycle: circularDependencies.has(dep.from) && circularDependencies.has(dep.to),
            },
            label: dep.type,
            labelStyle: { fontSize: 12, fontWeight: 'bold' },
            labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        }));
    }, [dependencies, circularDependencies]);

    const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

    // Handle new connections
    const onConnect = useCallback(
        (params: Connection) => {
            if (readonly) return;

            const fromId = parseInt(params.source!);
            const toId = parseInt(params.target!);

            if (onDependencyAdd) {
                onDependencyAdd(fromId, toId, 'depends_on');
            }

            setEdges((eds) => addEdge({
                ...params,
                type: 'dependency',
                animated: false,
                style: { stroke: '#1976d2', strokeWidth: 2 },
                markerEnd: { type: MarkerType.ArrowClosed, color: '#1976d2' },
                data: { type: 'depends_on' },
                label: 'depends_on',
            }, eds));
        },
        [readonly, onDependencyAdd, setEdges]
    );

    // Handle node clicks
    const onNodeClick = useCallback(
        (event: React.MouseEvent, node: Node) => {
            if (onNodeClick) {
                const issue = issues.find(i => i.number.toString() === node.id);
                if (issue) {
                    onNodeClick(issue);
                }
            }
        },
        [issues, onNodeClick]
    );

    // Handle edge deletion
    const onEdgeClick = useCallback(
        (event: React.MouseEvent, edge: Edge) => {
            if (readonly) return;

            const fromId = parseInt(edge.source);
            const toId = parseInt(edge.target);

            if (onDependencyRemove) {
                onDependencyRemove(fromId, toId);
            }

            setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        },
        [readonly, onDependencyRemove, setEdges]
    );

    const handleAddDependency = () => {
        if (selectedFromNode && selectedToNode && selectedFromNode !== selectedToNode) {
            if (onDependencyAdd) {
                onDependencyAdd(selectedFromNode, selectedToNode, dependencyType);
            }

            const newEdge: Edge = {
                id: `${selectedFromNode}-${selectedToNode}-${Date.now()}`,
                source: selectedFromNode.toString(),
                target: selectedToNode.toString(),
                type: 'dependency',
                animated: dependencyType === 'blocks',
                style: {
                    stroke: dependencyType === 'blocks' ? '#d32f2f' : dependencyType === 'depends_on' ? '#1976d2' : '#757575',
                    strokeWidth: 2,
                },
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    color: dependencyType === 'blocks' ? '#d32f2f' : dependencyType === 'depends_on' ? '#1976d2' : '#757575',
                },
                data: { type: dependencyType },
                label: dependencyType,
            };

            setEdges((eds) => [...eds, newEdge]);
            setAddDialogOpen(false);
            setSelectedFromNode(null);
            setSelectedToNode(null);
            setDependencyType('depends_on');
        }
    };

    return (
        <Box sx={{ height: '600px', width: '100%' }}>
            {circularDependencies.size > 0 && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <WarningIcon />
                        <Typography variant="body2">
                            Circular dependencies detected! Issues: {Array.from(circularDependencies).join(', ')}
                        </Typography>
                    </Box>
                </Alert>
            )}

            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                edgeTypes={edgeTypes}
                fitView
                attributionPosition="bottom-left"
            >
                <Controls />
                <MiniMap />
                <Background variant={BackgroundVariant.Dots} gap={12} size={1} />

                {!readonly && (
                    <Box
                        sx={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            zIndex: 1000,
                        }}
                    >
                        <Tooltip title="Add Dependency">
                            <IconButton
                                color="primary"
                                onClick={() => setAddDialogOpen(true)}
                                sx={{ backgroundColor: 'white', boxShadow: 1 }}
                            >
                                <AddIcon />
                            </IconButton>
                        </Tooltip>
                    </Box>
                )}
            </ReactFlow>

            {/* Add Dependency Dialog */}
            <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Add Dependency</DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 1 }}>
                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>From Issue</InputLabel>
                            <Select
                                value={selectedFromNode || ''}
                                label="From Issue"
                                onChange={(e) => setSelectedFromNode(Number(e.target.value))}
                            >
                                {issues.map((issue) => (
                                    <MenuItem key={issue.number} value={issue.number}>
                                        #{issue.number} - {issue.title}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>To Issue</InputLabel>
                            <Select
                                value={selectedToNode || ''}
                                label="To Issue"
                                onChange={(e) => setSelectedToNode(Number(e.target.value))}
                            >
                                {issues.map((issue) => (
                                    <MenuItem key={issue.number} value={issue.number}>
                                        #{issue.number} - {issue.title}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <FormControl fullWidth sx={{ mb: 2 }}>
                            <InputLabel>Dependency Type</InputLabel>
                            <Select
                                value={dependencyType}
                                label="Dependency Type"
                                onChange={(e) => setDependencyType(e.target.value)}
                            >
                                <MenuItem value="depends_on">Depends On</MenuItem>
                                <MenuItem value="blocks">Blocks</MenuItem>
                                <MenuItem value="related">Related</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
                    <Button
                        onClick={handleAddDependency}
                        variant="contained"
                        disabled={!selectedFromNode || !selectedToNode || selectedFromNode === selectedToNode}
                    >
                        Add Dependency
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default DependencyGraph;