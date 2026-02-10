/**
 * Dashboard service
 */

import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import type { DashboardStats } from '@/types';

export const dashboardService = {
    /**
     * Get dashboard statistics
     */
    async getStats(): Promise<DashboardStats> {
        const response = await apiClient.get<DashboardStats>(API_CONFIG.ENDPOINTS.DASHBOARD.STATS);
        return response.data;
    },

    /**
     * Get recent activity
     */
    async getActivity(): Promise<DashboardActivity[]> {
        const response = await apiClient.get<DashboardActivity[]>('/api/dashboard/activity');
        return response.data;
    },

    /**
     * Get traffic history
     */
    async getTraffic(days: number = 7): Promise<TrafficPoint[]> {
        const response = await apiClient.get<TrafficPoint[]>('/api/dashboard/traffic', { params: { days } });
        return response.data;
    }
};

export interface TrafficPoint {
    name: string;
    traffic: number;
    rules: number;
}

export interface DashboardActivity {
    id: string;
    type: 'analysis' | 'change' | 'report' | 'alert';
    title: string;
    description: string;
    timestamp: string;
    status: 'success' | 'warning' | 'info' | 'error';
    metadata?: Record<string, any>;
}
