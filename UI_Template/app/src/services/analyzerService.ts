/**
 * Analyzer service
 */

import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';

export interface Finding {
    id: string;
    analysis_id: string;
    rule_id?: string;
    type: 'unused' | 'redundant' | 'shadowed' | 'high-risk' | 'optimization' | 'compliance';
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
    recommendation: string;
    created_at: string;
}

export interface AnalysisSummary {
    totalRules?: number;
    unusedRules?: number;
    redundantRules?: number;
    shadowedRules?: number;
    highRiskRules?: number;
    score?: number;
    [key: string]: any;
}

export interface Analysis {
    id: string;
    device_id: string;
    timestamp: string;
    type: 'optimization' | 'security' | 'compliance';
    summary: AnalysisSummary;
    created_at: string;
    findings?: Finding[];
}

export interface AnalysisCreate {
    device_id: string;
    type: string;
    summary?: any;
}

export const analyzerService = {
    /**
     * Start new analysis
     */
    async startAnalysis(data: AnalysisCreate): Promise<Analysis> {
        const response = await apiClient.post<Analysis>(API_CONFIG.ENDPOINTS.ANALYZER.START, data);
        return response.data;
    },

    /**
     * Get analysis history for device
     */
    async getDeviceHistory(deviceId: string): Promise<Analysis[]> {
        const response = await apiClient.get<Analysis[]>(API_CONFIG.ENDPOINTS.ANALYZER.DEVICE_HISTORY(deviceId));
        return response.data;
    },

    /**
     * Get specific analysis results
     */
    async getAnalysisResults(id: string): Promise<Analysis> {
        const response = await apiClient.get<Analysis>(API_CONFIG.ENDPOINTS.ANALYZER.GET_RESULTS(id));
        return response.data;
    },

    /**
     * Get shadowed rules for a device
     */
    async getShadowedRules(deviceId: string): Promise<any[]> {
        const response = await apiClient.get<any[]>(API_CONFIG.ENDPOINTS.ANALYZER.SHADOWED(deviceId));
        return response.data;
    },

    /**
     * Get redundant rules for a device
     */
    async getRedundantRules(deviceId: string): Promise<any[]> {
        const response = await apiClient.get<any[]>(API_CONFIG.ENDPOINTS.ANALYZER.REDUNDANT(deviceId));
        return response.data;
    },

    /**
     * Get unused objects for a device
     */
    async getUnusedObjects(deviceId: string): Promise<any[]> {
        const response = await apiClient.get<any[]>(API_CONFIG.ENDPOINTS.ANALYZER.UNUSED_OBJECTS(deviceId));
        return response.data;
    },

    /**
     * Get summary stats for all categories
     */
    async getStatsSummary(deviceId: string): Promise<any> {
        const response = await apiClient.get<any>(API_CONFIG.ENDPOINTS.ANALYZER.STATS_SUMMARY(deviceId));
        return response.data;
    }
};
