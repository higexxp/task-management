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
    ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Box, Typography, Card, CardContent } from '@mui/material';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

interface LineChartProps {
    title: string;
    data: Array<{
        date: string;
        created: number;
        closed: number;
        open: number;
    }>;
    height?: number;
}

function LineChart({ title, data, height = 300 }: LineChartProps) {
    const chartData = {
        labels: data.map(item => {
            const date = new Date(item.date);
            return date.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric'
            });
        }),
        datasets: [
            {
                label: 'Created',
                data: data.map(item => item.created),
                borderColor: '#36A2EB',
                backgroundColor: '#36A2EB20',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
            },
            {
                label: 'Closed',
                data: data.map(item => item.closed),
                borderColor: '#4BC0C0',
                backgroundColor: '#4BC0C020',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
            },
            {
                label: 'Open',
                data: data.map(item => item.open),
                borderColor: '#FF6384',
                backgroundColor: '#FF638420',
                borderWidth: 2,
                fill: false,
                tension: 0.1,
            },
        ],
    };

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'top' as const,
                labels: {
                    usePointStyle: true,
                    padding: 20,
                },
            },
            tooltip: {
                mode: 'index',
                intersect: false,
                callbacks: {
                    title: function (context) {
                        const index = context[0].dataIndex;
                        const date = new Date(data[index].date);
                        return date.toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                        });
                    },
                },
            },
        },
        scales: {
            x: {
                display: true,
                title: {
                    display: true,
                    text: 'Date',
                },
                grid: {
                    display: false,
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
            mode: 'nearest',
            axis: 'x',
            intersect: false,
        },
    };

    if (data.length === 0) {
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
                    <Line data={chartData} options={options} />
                </Box>
            </CardContent>
        </Card>
    );
}

export default LineChart;