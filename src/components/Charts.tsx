'use client';

import {
    PieChart,
    Pie,
    Cell,
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    BarChart,
    Bar,
    Area,
    AreaChart,
} from 'recharts';
import { formatCurrency } from '@/lib/currency';

interface CategoryData {
    name: string;
    value: number;
    color: string;
    icon?: string;
    [key: string]: any;
}

interface MonthlyData {
    month: string;
    income: number;
    expense: number;
    balance: number;
}

// Custom tooltip styles
const tooltipStyle = {
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    border: '1px solid rgba(75, 85, 99, 0.5)',
    borderRadius: '12px',
    padding: '12px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
};

const tooltipLabelStyle = {
    color: '#9CA3AF',
    marginBottom: '4px',
};

// Expense Pie Chart by Category
export function ExpensePieChart({ data }: { data: CategoryData[] }) {
    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500">
                No expense data yet
            </div>
        );
    }

    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Pie
                        data={data}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={2}
                        dataKey="value"
                        stroke="none"
                    >
                        {data.map((entry, index) => (
                            <Cell
                                key={`cell-${index}`}
                                fill={entry.color}
                                stroke="transparent"
                            />
                        ))}
                    </Pie>
                    <Tooltip
                        content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                                const item = payload[0].payload as CategoryData;
                                const percent = ((item.value / total) * 100).toFixed(1);
                                return (
                                    <div style={tooltipStyle}>
                                        <p className="font-medium text-white flex items-center gap-2">
                                            <span>{item.icon}</span>
                                            {item.name}
                                        </p>
                                        <p className="text-gray-300 text-lg font-bold mt-1">
                                            {formatCurrency(item.value, 'IDR')}
                                        </p>
                                        <p className="text-gray-500 text-sm">{percent}% of total</p>
                                    </div>
                                );
                            }
                            return null;
                        }}
                    />
                </PieChart>
            </ResponsiveContainer>
        </div>
    );
}

// Monthly Income vs Expense Bar Chart
export function MonthlyBarChart({ data }: { data: MonthlyData[] }) {
    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500">
                No monthly data yet
            </div>
        );
    }

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} barGap={8}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.3)" />
                    <XAxis
                        dataKey="month"
                        stroke="#6B7280"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(value) => {
                            const date = new Date(value + '-01');
                            return date.toLocaleDateString('en-US', { month: 'short' });
                        }}
                    />
                    <YAxis
                        stroke="#6B7280"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(value) => {
                            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                            return value;
                        }}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        itemStyle={{ color: '#fff' }}
                        formatter={(value: number | undefined, name: string | undefined) => [
                            formatCurrency(value || 0, 'IDR'),
                            (name || '').charAt(0).toUpperCase() + (name || '').slice(1),
                        ]}
                        labelFormatter={(label) => {
                            const date = new Date(label + '-01');
                            return date.toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                            });
                        }}
                    />
                    <Legend
                        wrapperStyle={{ paddingTop: '16px' }}
                        iconType="circle"
                        iconSize={8}
                        formatter={(value) => (
                            <span className="text-gray-400 text-sm capitalize">{value}</span>
                        )}
                    />
                    <Bar
                        dataKey="income"
                        fill="url(#incomeGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                    />
                    <Bar
                        dataKey="expense"
                        fill="url(#expenseGradient)"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={50}
                    />
                    <defs>
                        <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10B981" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#EF4444" />
                            <stop offset="100%" stopColor="#DC2626" />
                        </linearGradient>
                    </defs>
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

// Balance Trend Line Chart
export function BalanceTrendChart({ data }: { data: MonthlyData[] }) {
    if (data.length === 0) {
        return (
            <div className="h-64 flex items-center justify-center text-gray-500">
                No trend data yet
            </div>
        );
    }

    return (
        <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(75, 85, 99, 0.3)" />
                    <XAxis
                        dataKey="month"
                        stroke="#6B7280"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(value) => {
                            const date = new Date(value + '-01');
                            return date.toLocaleDateString('en-US', { month: 'short' });
                        }}
                    />
                    <YAxis
                        stroke="#6B7280"
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#9CA3AF', fontSize: 12 }}
                        tickFormatter={(value) => {
                            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                            return value;
                        }}
                    />
                    <Tooltip
                        contentStyle={tooltipStyle}
                        labelStyle={tooltipLabelStyle}
                        formatter={(value: number | undefined) => [formatCurrency(value || 0, 'IDR'), 'Balance']}
                        labelFormatter={(label) => {
                            const date = new Date(label + '-01');
                            return date.toLocaleDateString('en-US', {
                                month: 'long',
                                year: 'numeric',
                            });
                        }}
                    />
                    <defs>
                        <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                        </linearGradient>
                    </defs>
                    <Area
                        type="monotone"
                        dataKey="balance"
                        stroke="#8B5CF6"
                        strokeWidth={2}
                        fill="url(#balanceGradient)"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </div>
    );
}

// Category Legend Component
export function CategoryLegend({ data }: { data: CategoryData[] }) {
    const total = data.reduce((sum, item) => sum + item.value, 0);

    return (
        <div className="grid grid-cols-2 gap-3 mt-4">
            {data.slice(0, 6).map((item, index) => (
                <div key={index} className="flex items-center gap-2 overflow-hidden">
                    <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: item.color }}
                    />
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="flex-shrink-0 text-gray-400">{item.icon}</span>
                        <span className="text-gray-400 text-sm truncate">{item.name}</span>
                    </div>
                    <span className="text-gray-500 text-xs ml-auto flex-shrink-0">
                        {((item.value / total) * 100).toFixed(0)}%
                    </span>
                </div>
            ))}
            {data.length > 6 && (
                <p className="text-gray-500 text-xs col-span-2">
                    +{data.length - 6} more categories
                </p>
            )}
        </div>
    );
}
