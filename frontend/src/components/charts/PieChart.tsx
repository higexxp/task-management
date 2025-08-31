import React from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    Tooltip,
    Legend,
    ChartOptions,
} from 'chart.js';
import { Pie } from 'react-chartjs-2';
import { Box, Typography, Card, CardContent } from '@mui/material';

ChartJS.register(ArcElement, Tooltip, Legend);

interface PieChartProps {
    title: string;
    data: Record<string, number>;
    colors?: string[];
    height?: number;
}

const DEFAULT_COLORS = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40',
    '#FF6384',
    '#C9CBCF',
];

function PieChart({ title, data, colors = DEFAULT_COLORS, height = 300 }: PieChartProps) {
    const labels = Object.keys(data);
    const values = Object.values(data);

    // Filter out zero values
    const filteredData = labels.reduce((acc, label, index) => {
        if (values[index] > 0) {
            acc.labels.push(label);
            acc.values.push(values[index]);
            acc.colors.push(colors[index % colors.length]);
        }
        return acc;
    }, { labels: [] as string[], values: [] as number[], colors: [] as string[] });

    const chartData = {
        labels: filteredData.labels.map(label =>
            label.charAt(0).toUpperCase() + label.slice(1).replace('-', ' ')
        ),
        datasets: [
            {
                data: filteredData.values,
                backgroundColor: filteredData.colors,
                borderColor: filteredData.colors.map(color => color + '80'),
                borderWidth: 2,
                hoverBorderWidth: 3,
            },
        ],
    };

    const options: ChartOptions<'pie'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom' as const,
                labels: {
                    padding: 20,
                    usePointStyle: true,
                    font: {
                        size: 12,
                    },
                },
            },
            tooltip: {
                callbacks: {
                    label: function (context) {
                        const label = context.label || '';
                        const value = context.parsed;
                        const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
                        const percentage = ((value / total) * 100).toFixed(1);
                        return `${label}: ${value} (${percentage}%)`;
                    },
                },
            },
        },
    };

    if (filteredData.values.length === 0) {
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
                    <Pie data={chartData} options={options} />
                </Box>
            </CardContent>
        </Card>
    );
}

export default PieChart;