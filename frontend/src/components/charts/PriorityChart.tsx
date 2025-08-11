import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    CategoryScale,
    LinearScale,
    BarElement,
} from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { EnhancedIssue } from '../../utils/metadata';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface PriorityChartProps {
    issues: EnhancedIssue[];
    chartType?: 'doughnut' | 'bar';
}

function PriorityChart({ issues, chartType = 'doughnut' }: PriorityChartProps) {
    const [displayType, setDisplayType] = React.useState<'doughnut' | 'bar'>(chartType);

    // Calculate priority distribution
    const priorityStats = React.useMemo(() => {
        const stats = {
            high: issues.filter(issue => issue.metadata.priority === 'high').length,
            medium: issues.filter(issue => issue.metadata.priority === 'medium').length,
            low: issues.filter(issue => issue.metadata.priority === 'low').length,
            unset: issues.filter(issue => !issue.metadata.priority).length,
        };
        return stats;
    }, [issues]);

    const data = {
        labels: ['High Priority', 'Medium Priority', 'Low Priority', 'No Priority'],
        datasets: [
            {
                label: 'Issues by Priority',
                data: [
                    priorityStats.high,
                    priorityStats.medium,
                    priorityStats.low,
                    priorityStats.unset,
                ],
                backgroundColor: [
                    '#d32f2f', // Red for high
                    '#ed6c02', // Orange for medium
                    '#2e7d32', // Green for low
                    '#757575', // Gray for unset
                ],
                borderColor: [
                    '#d32f2f',
                    '#ed6c02',
                    '#2e7d32',
                    '#757575',
                ],
                borderWidth: 2,
            },
        ],
    };

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 20,
                    usePointStyle: true,
                },
            },
            tooltip: {
                callbacks: {
                    label: function (context: any) {
                        const label = context.label || '';
                        const value = context.parsed || context.raw;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0';
                        return `${label}: ${value} (${percentage}%)`;
                    },
                },
            },
        },
    };

    const barOptions = {
        ...options,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                },
            },
        },
    };

    if (issues.length === 0) {
        return (
            <Box textAlign="center" py={4}>
                <Typography variant="body2" color="text.secondary">
                    No issues to display
                </Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Priority Distribution</Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select
                        value={displayType}
                        label="Chart Type"
                        onChange={(e) => setDisplayType(e.target.value as 'doughnut' | 'bar')}
                    >
                        <MenuItem value="doughnut">Doughnut</MenuItem>
                        <MenuItem value="bar">Bar</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box height={300}>
                {displayType === 'doughnut' ? (
                    <Doughnut data={data} options={options} />
                ) : (
                    <Bar data={data} options={barOptions} />
                )}
            </Box>

            <Box mt={2}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    Total Issues: {issues.length} |
                    High: {priorityStats.high} |
                    Medium: {priorityStats.medium} |
                    Low: {priorityStats.low} |
                    Unset: {priorityStats.unset}
                </Typography>
            </Box>
        </Box>
    );
}

export default PriorityChart;