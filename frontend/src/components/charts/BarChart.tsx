import React from 'react';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ChartOptions,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import { Box, Typography, Card, CardContent } from '@mui/material';

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend
);

interface BarChartProps {
    title: string;
    data: Record<string, any>;
    height?: number;
    horizontal?: boolean;
}

function BarChart({ title, data, height = 300, horizontal = false }: BarChartProps) {
    const labels = Object.keys(data);
    const values = Object.values(data).map(item =>
        typeof item === 'object' ? item.totalIssues || 0 : item
    );

    const chartData = {
        labels: labels.map(label =>
            label.charAt(0).toUpperCase() + label.slice(1).replace('-', ' ')
        ),
        datasets: [
            {
                label: 'Issues',
                data: values,
                backgroundColor: [
                    '#FF638420',
                    '#36A2EB20',
                    '#FFCE5620',
                    '#4BC0C020',
                    '#9966FF20',
                    '#FF9F4020',
                ],
                borderColor: [
                    '#FF6384',
                    '#36A2EB',
                    '#FFCE56',
                    '#4BC0C0',
                    '#9966FF',
                    '#FF9F40',
                ],
                borderWidth: 2,
                borderRadius: 4,
                borderSkipped: false,
            },
        ],
    };

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? 'y' as const : 'x' as const,
        plugins: {
            legend: {
                display: false,
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed.y || context.parsed.x;
                        return `${label}: ${value} issues`;
                    },
                },
            },
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: !horizontal,
                    text: horizontal ? 'Number of Issues' : 'Categories',
                },
                grid: {
                    display: horizontal,
                },
                beginAtZero: true,
                ticks: horizontal ? {
                    stepSize: 1,
                } : undefined,
            },
            y: {
                display: true,
                title: {
                    display: horizontal,
                    text: horizontal ? 'Categories' : 'Number of Issues',
                },
                grid: {
                    display: !horizontal,
                },
                beginAtZero: true,
                ticks: !horizontal ? {
                    stepSize: 1,
                } : undefined,
            },
        },
    };

    if (values.every(value => value === 0)) {
        return (
            <Card>
                <CardContent>
                    <Typography variant="h6" gutterBottom>
                        {title}
                    </Typography>
                    <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="center"
                        height={height}
                        color="text.secondary"
                    >
                        <Typography variant="body2">
                            No data available
                        </Typography>
                    </Box>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardContent>
                <Typography variant="h6" gutterBottom>
                    {title}
                </Typography>
                <Box height={height}>
                    <Bar data={chartData} options={options} />
                </Box>
            </CardContent>
        </Card>
    );
}

export default BarChart;