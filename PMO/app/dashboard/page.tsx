'use client';

import { useEffect, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Clock, DollarSign } from 'lucide-react';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function DashboardPage() {
  const [dashboardType, setDashboardType] = useState<'executive' | 'operational'>('executive');

  // Sample data - in production, this would come from your data service
  const kpis = [
    {
      title: 'Active Projects',
      value: '24',
      change: '+12%',
      trend: 'up',
      icon: CheckCircle,
      color: 'blue',
    },
    {
      title: 'Total Budget',
      value: '$2.4M',
      change: '+8%',
      trend: 'up',
      icon: DollarSign,
      color: 'green',
    },
    {
      title: 'High Risks',
      value: '8',
      change: '-3',
      trend: 'down',
      icon: AlertTriangle,
      color: 'red',
    },
    {
      title: 'Overdue Tasks',
      value: '15',
      change: '+5',
      trend: 'up',
      icon: Clock,
      color: 'yellow',
    },
  ];

  // Project health distribution
  const healthData = {
    labels: ['Green', 'Yellow', 'Red'],
    datasets: [
      {
        label: 'Projects by Health Status',
        data: [15, 6, 3],
        backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
      },
    ],
  };

  // Budget vs Actual
  const budgetData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
    datasets: [
      {
        label: 'Planned Budget',
        data: [400000, 450000, 500000, 550000, 600000, 650000],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
      },
      {
        label: 'Actual Spend',
        data: [380000, 420000, 480000, 530000, 570000, 620000],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
      },
    ],
  };

  // Resource utilization
  const resourceData = {
    labels: ['Design', 'Development', 'Testing', 'PM', 'BA'],
    datasets: [
      {
        label: 'Utilization %',
        data: [85, 92, 78, 88, 75],
        backgroundColor: [
          '#3b82f6',
          '#8b5cf6',
          '#ec4899',
          '#f59e0b',
          '#10b981',
        ],
      },
    ],
  };

  // Tasks by status
  const taskData = {
    labels: ['Not Started', 'In Progress', 'Completed', 'Blocked'],
    datasets: [
      {
        data: [45, 120, 230, 15],
        backgroundColor: ['#94a3b8', '#3b82f6', '#10b981', '#ef4444'],
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    plugins: {
      legend: {
        position: 'bottom' as const,
      },
    },
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-1">Overview of your project portfolio</p>
        </div>

        {/* Dashboard Type Toggle */}
        <div className="flex space-x-2 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
          <button
            onClick={() => setDashboardType('executive')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dashboardType === 'executive'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Executive View
          </button>
          <button
            onClick={() => setDashboardType('operational')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              dashboardType === 'operational'
                ? 'bg-primary-600 text-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Operational View
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          const isPositive = kpi.trend === 'down' && kpi.color === 'red' ? true : kpi.trend === 'up';

          return (
            <div key={kpi.title} className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg bg-${kpi.color}-100`}>
                  <Icon className={`h-6 w-6 text-${kpi.color}-600`} />
                </div>
                <div className="flex items-center space-x-1">
                  {isPositive ? (
                    <TrendingUp className="h-4 w-4 text-green-600" />
                  ) : (
                    <TrendingDown className="h-4 w-4 text-red-600" />
                  )}
                  <span className={`text-sm font-medium ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                    {kpi.change}
                  </span>
                </div>
              </div>
              <div className="mt-4">
                <h3 className="text-2xl font-bold text-gray-900">{kpi.value}</h3>
                <p className="text-sm text-gray-600 mt-1">{kpi.title}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts */}
      {dashboardType === 'executive' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Project Health */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Project Health Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={healthData} options={chartOptions} />
            </div>
          </div>

          {/* Budget Performance */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Budget Performance (YTD)
            </h3>
            <div className="h-64">
              <Line data={budgetData} options={chartOptions} />
            </div>
          </div>

          {/* Resource Utilization */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Resource Utilization by Role
            </h3>
            <div className="h-64">
              <Bar data={resourceData} options={chartOptions} />
            </div>
          </div>

          {/* Task Distribution */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Task Status Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut data={taskData} options={chartOptions} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Operational View Charts */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Daily Task Completion
            </h3>
            <div className="h-64">
              <Line
                data={{
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                  datasets: [
                    {
                      label: 'Completed Tasks',
                      data: [12, 18, 15, 22, 19, 8, 5],
                      borderColor: '#10b981',
                      backgroundColor: 'rgba(16, 185, 129, 0.1)',
                      fill: true,
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Time Tracking (This Week)
            </h3>
            <div className="h-64">
              <Bar
                data={{
                  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
                  datasets: [
                    {
                      label: 'Hours Logged',
                      data: [38, 42, 40, 45, 35],
                      backgroundColor: '#3b82f6',
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Issue Priority Distribution
            </h3>
            <div className="h-64 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Low', 'Medium', 'High', 'Critical'],
                  datasets: [
                    {
                      data: [12, 25, 15, 8],
                      backgroundColor: ['#3b82f6', '#f59e0b', '#ef4444', '#7f1d1d'],
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Risk Trend (Last 6 Months)
            </h3>
            <div className="h-64">
              <Line
                data={{
                  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                  datasets: [
                    {
                      label: 'Critical Risks',
                      data: [5, 4, 6, 3, 2, 3],
                      borderColor: '#ef4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    },
                    {
                      label: 'High Risks',
                      data: [8, 10, 9, 7, 6, 8],
                      borderColor: '#f59e0b',
                      backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    },
                  ],
                }}
                options={chartOptions}
              />
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
        <div className="space-y-4">
          {[
            { type: 'project', message: 'New project "Website Redesign" created', time: '2 hours ago' },
            { type: 'risk', message: 'High risk identified in "Mobile App Development"', time: '4 hours ago' },
            { type: 'budget', message: 'Budget approved for Q2 initiatives', time: '6 hours ago' },
            { type: 'task', message: '15 tasks completed in "Infrastructure Upgrade"', time: '8 hours ago' },
          ].map((activity, index) => (
            <div key={index} className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-center space-x-3">
                <div className="h-2 w-2 bg-primary-600 rounded-full"></div>
                <p className="text-sm text-gray-700">{activity.message}</p>
              </div>
              <span className="text-xs text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
