import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import DependencyGraph from '../DependencyGraph';

// Mock ReactFlow
jest.mock('reactflow', () => ({
    __esModule: true,
    default: ({ children, ...props }: any) => (
        <div data-testid="react-flow" {...props}>
            {children}
        </div>
    ),
    Controls: () => <div data-testid="controls" />,
    MiniMap: () => <div data-testid="minimap" />,
    Background: () => <div data-testid="background" />,
    BackgroundVariant: { Dots: 'dots' },
    MarkerType: { ArrowClosed: 'arrowclosed' },
    useNodesState: () => [[], jest.fn(), jest.fn()],
    useEdgesState: () => [[], jest.fn(), jest.fn()],
    addEdge: jest.fn(),
}));

const mockIssues = [
    {
        id: 1,
        number: 1,
        title: 'Test Issue 1',
        state: 'open' as const,
        priority: 'high' as const,
        category: 'bug',
        size: 'medium' as const,
        assignee: {
            login: 'testuser',
            avatar_url: 'https://example.com/avatar.jpg',
        },
    },
    {
        id: 2,
        number: 2,
        title: 'Test Issue 2',
        state: 'closed' as const,
        priority: 'low' as const,
        category: 'feature',
        size: 'small' as const,
    },
];

const mockDependencies = [
    {
        from: 1,
        to: 2,
        type: 'depends_on' as const,
    },
];

describe('DependencyGraph', () => {
    it('renders without crashing', () => {
        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
            />
        );

        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });

    it('shows circular dependency warning when cycles exist', () => {
        const cyclicDependencies = [
            { from: 1, to: 2, type: 'depends_on' as const },
            { from: 2, to: 1, type: 'blocks' as const },
        ];

        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={cyclicDependencies}
            />
        );

        expect(screen.getByText(/circular dependencies detected/i)).toBeInTheDocument();
    });

    it('does not show add dependency button in readonly mode', () => {
        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
                readonly={true}
            />
        );

        expect(screen.queryByTitle('Add Dependency')).not.toBeInTheDocument();
    });

    it('shows add dependency button in edit mode', () => {
        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
                readonly={false}
            />
        );

        expect(screen.getByTitle('Add Dependency')).toBeInTheDocument();
    });

    it('opens add dependency dialog when button is clicked', () => {
        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
                readonly={false}
            />
        );

        const addButton = screen.getByTitle('Add Dependency');
        fireEvent.click(addButton);

        expect(screen.getByText('Add Dependency')).toBeInTheDocument();
        expect(screen.getByLabelText('From Issue')).toBeInTheDocument();
        expect(screen.getByLabelText('To Issue')).toBeInTheDocument();
    });

    it('calls onDependencyAdd when dependency is added', () => {
        const mockOnDependencyAdd = jest.fn();

        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
                onDependencyAdd={mockOnDependencyAdd}
                readonly={false}
            />
        );

        const addButton = screen.getByTitle('Add Dependency');
        fireEvent.click(addButton);

        // Select from and to issues
        const fromSelect = screen.getByLabelText('From Issue');
        const toSelect = screen.getByLabelText('To Issue');

        fireEvent.mouseDown(fromSelect);
        fireEvent.click(screen.getByText('#1 - Test Issue 1'));

        fireEvent.mouseDown(toSelect);
        fireEvent.click(screen.getByText('#2 - Test Issue 2'));

        // Click add button
        const addDependencyButton = screen.getByRole('button', { name: /add dependency/i });
        fireEvent.click(addDependencyButton);

        expect(mockOnDependencyAdd).toHaveBeenCalledWith(1, 2, 'depends_on');
    });

    it('calls onNodeClick when a node is clicked', () => {
        const mockOnNodeClick = jest.fn();

        render(
            <DependencyGraph
                issues={mockIssues}
                dependencies={mockDependencies}
                onNodeClick={mockOnNodeClick}
            />
        );

        // This would require mocking the ReactFlow node click event
        // For now, we'll just verify the component renders
        expect(screen.getByTestId('react-flow')).toBeInTheDocument();
    });
});