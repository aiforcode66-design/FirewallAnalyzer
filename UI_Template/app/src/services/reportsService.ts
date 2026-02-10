import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';

export interface ExecutiveSummary {
    device_name: string;
    total_rules: number;
    composition: Record<string, number>;
    optimization: {
        unused: number;
        active: number;
        pct_unused: number;
    };
    security_risk: {
        critical: number;
        high: number;
        medium: number;
        low: number;
    };
}

export interface ComplianceIssue {
    severity: 'critical' | 'high' | 'medium' | 'low';
    check: string;
    description: string;
    rule_id: string;
    rule_name: string;
}

export const reportsService = {
    getExecutiveSummary: async (deviceId: string): Promise<ExecutiveSummary> => {
        const response = await apiClient.get(API_CONFIG.ENDPOINTS.REPORTS.EXECUTIVE(deviceId));
        return response.data;
    },

    getComplianceReport: async (deviceId: string): Promise<ComplianceIssue[]> => {
        const response = await apiClient.get(API_CONFIG.ENDPOINTS.REPORTS.COMPLIANCE(deviceId));
        return response.data;
    },

    downloadReport: async (analysisId: string, type: 'pdf' | 'csv') => {
        const endpoint = type === 'pdf'
            ? API_CONFIG.ENDPOINTS.ANALYZER.DOWNLOAD_PDF(analysisId)
            : API_CONFIG.ENDPOINTS.ANALYZER.DOWNLOAD_CSV(analysisId);

        const response = await apiClient.get(endpoint, {
            responseType: 'blob'
        });

        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        const filename = `report_${analysisId}.${type}`;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
    },

    getLatestAnalysis: async (deviceId: string) => {
        const response = await apiClient.get(API_CONFIG.ENDPOINTS.ANALYZER.DEVICE_HISTORY(deviceId));
        return response.data?.[0]; // Assuming sorted by timestamp desc
    }
};
