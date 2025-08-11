import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    BarElement,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Box, Typography, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { format, subDays, subWeeks, subMonths, startOfDay, endOfDay } from 'date-fns';
import { EnhancedIssue } from '../../utils/metadata';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    BarElement
);

interface ProgressChartProps {
    issues: EnhancedIssue[];
}

type TimeRange = '7days' | '30days' | '90days' | '6months';
type ChartType = 'line' | 'bar';

function ProgressChart({ issues }: ProgressChartProps) {
    const [timeRange, setTimeRange] = React.useState<TimeRange>('30days');
    const [chartType, setChartType] = React.useState<ChartType>('line');

    // Generate time series data
    const chartData = React.useMemo(() => {
        const now = new Date();
        let days: number;
        let dateFormat: string;

        switch (timeRange) {
            case '7days':
                days = 7;
                dateFormat = 'MMM dd';
                break;
            case '30days':
                days = 30;
                dateFormat = 'MMM dd';
                break;
            case '90days':
                days = 90;
                dateFormat = 'MMM dd';
                break;
            case '6months':
                days = 180;
                dateFormat = 'MMM yyyy';
                break;
            default:
                days = 30;
                dateFormat = 'MMM dd';
        }

        // Generate date labels
        const labels: string[] = [];
        const dates: Date[] = [];

        for (let i = days - 1; i >= 0; i--) {
            const date = subDays(now, i);
            dates.push(date);
            labels.push(format(date, dateFormat));
        }

        // Count issues created and closed per day
        const createdCounts = new Array(days).fill(0);
        const closedCounts = new Array(days).fill(0);

        issues.forEach(issue => {
            const createdDate = new Date(issue.created_at);
            const updatedDate = new Date(issue.updated_at);

            // Find the index for created date
            const createdIndex = dates.findIndex(date =>
                createdDate >= startOfDay(date) && createdDate <= endOfDay(date)
            );
            if (createdIndex !== -1) {
                createdCounts[createdIndex]++;
            }

            // Count closed issues (approximation using updated_at for closed issues)
            if (issue.state === 'closed') {
                const closedIndex = dates.findIndex(date =>
                    updatedDate >= startOfDay(date) && updatedDate <= endOfDay(date)
                );
                if (closedIndex !== -1) {
                    closedCounts[closedIndex]++;
                }
            }
        });

        return {
            labels,
            datasets: [
                {
                    label: 'Issues Created',
                    data: createdCounts,
                    borderColor: '#1976d2',
                    backgroundColor: 'rgba(25, 118, 210, 0.1)',
                    tension: 0.1,
                    fill: chartType === 'line',
                },
                {
                    label: 'Issues Closed',
                    data: closedCounts,
                    borderColor: '#2e7d32',
                    backgroundColor: 'rgba(46, 125, 50, 0.1)',
                    tension: 0.1,
                    fill: chartType === 'line',
                },
            ],
        };
    }, [issues, timeRange, chartType]);

    const options = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
            },
            title: {
                display: true,
                text: 'Issue Activity Over Time',
            },
            tooltip: {
                mode: 'index' as const,
                intersect: false,
            },
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Date',
                },
            },
            y: {
                display: true,
                title: {
                    display: true,
                    text: 'Number of Issues',
                },
                beginAtZero: true,
                ticks: {
                    stepSize: 1,
                },
            },
        },
        interaction: {
            mode: 'nearest' as const,
            axis: 'x' as const,
            intersect: false,
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
                <Typography variant="h6">Progress Over Time</Typography>
                <Box display="flex" gap={1}>
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                        <InputLabel>Time Range</InputLabel>
                        <Select
                            value={timeRange}
                            label="Time Range"
                            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
                        >
                            <MenuItem value="7days">Last 7 Days</MenuItem>
                            <MenuItem value="30days">Last 30 Days</MenuItem>
                            <MenuItem value="90days">Last 90 Days</MenuItem>
                            <MenuItem value="6months">Last 6 Months</MenuItem>
                        </Select>
                    </FormControl>
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                        <InputLabel>Chart Type</InputLabel>
                        <Select
                            value={chartType}
                            label="Chart Type"
                            onChange={(e) => setChartType(e.target.value as ChartType)}
                        >
                            <MenuItem value="line">Line</MenuItem>
                            <MenuItem value="bar">Bar</MenuItem>
                        </Select>
                    </FormControl>
                </Box>
            </Box>

            <Box height={400}>
                {chartType === 'line' ? (
                    <Line data={chartData} options={options} />
                ) : (
                    <Bar data={chartData} options={options} />
                )}
            </Box>

            <Box mt={2}>
                <Typography variant="body2" color="text.secondary" textAlign="center">
                    Showing activity for the last {timeRange.replace(/\d+/, (match) => match + ' ')}
                </Typography>
            </Box>
        </Box>
    );
}

export default ProgressChart;