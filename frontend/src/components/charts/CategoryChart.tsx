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
import { Pie, Bar } from 'react-chartjs-2';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { EnhancedIssue } from '../../utils/metadata';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement);

interface CategoryChartProps {
    issues: EnhancedIssue[];
    chartType?: 'pie' | 'bar';
}

function CategoryChart({ issues, chartType = 'pie' }: CategoryChartProps) {
    const [displayType, setDisplayType] = React.useState<'pie' | 'bar'>(chartType);

    // Calculate category distribution
    const categoryStats = React.useMemo(() => {
        const stats = {
            bug: issues.filter(issue => issue.metadata.category === 'bug').length,
            feature: issues.filter(issue => issue.metadata.category === 'feature').length,
            enhancement: issues.filter(issue => issue.metadata.category === 'enhancement').length,
            documentation: issues.filter(issue => issue.metadata.category === 'documentation').length,
            question: issues.filter(issue => issue.metadata.category === 'question').length,
            unset: issues.filter(issue => !issue.metadata.category).length,
        };
        return stats;
    }, [issues]);

    const data = {
        labels: ['Bug', 'Feature', 'Enhancement', 'Documentation', 'Question', 'No Category'],
        datasets: [
            {
                label: 'Issues by Category',
                data: [
                    categoryStats.bug,
                    categoryStats.feature,
                    categoryStats.enhancement,
                    categoryStats.documentation,
                    categoryStats.question,
                    categoryStats.unset,
                ],
                backgroundColor: [
                    '#d32f2f', // Red for bug
                    '#1976d2', // Blue for feature
                    '#388e3c', // Green for enhancement
                    '#7b1fa2', // Purple for documentation
                    '#f57c00', // Orange for question
                    '#757575', // Gray for unset
                ],
                borderColor: [
                    '#d32f2f',
                    '#1976d2',
                    '#388e3c',
                    '#7b1fa2',
                    '#f57c00',
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
                <Typography variant="h6">Category Distribution</Typography>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                    <InputLabel>Chart Type</InputLabel>
                    <Select
                        value={displayType}
                        label="Chart Type"
                        onChange={(e) => setDisplayType(e.target.value as 'pie' | 'bar')}
                    >
                        <MenuItem value="pie">Pie</MenuItem>
                        <MenuItem value="bar">Bar</MenuItem>
                    </Select>
                </FormControl>
            </Box>

            <Box height={300}>
                {displayType === 'pie' ? (
                    <Pie data={data} options={options} />
                ) : (
                    <Bar data={data} options={barOptions} />
                )}
            </Box>

            <Box mt={2}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    Total Issues: {issues.length} |
                    Bug: {categoryStats.bug} |
                    Feature: {categoryStats.feature} |
                    Enhancement: {categoryStats.enhancement} |
                    Docs: {categoryStats.documentation} |
                    Question: {categoryStats.question} |
                    Unset: {categoryStats.unset}
                </Typography>
            </Box>
        </Box>
    );
}

export default CategoryChart;