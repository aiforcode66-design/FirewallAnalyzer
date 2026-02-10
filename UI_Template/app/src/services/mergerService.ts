import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import type { FirewallRule } from '@/types';

export interface MergeGroup {
    id: string;
    device_id: string;
    device_name: string;
    common_attributes: {
        source: string;
        destination: string;
        service: string;
        action: string;
    };
    rules: FirewallRule[];
    potential_savings: number;
    complexity: 'low' | 'medium' | 'high';
}

export interface MergeResult {
    success: boolean;
    merged_count: number;
    message: string;
}

export const mergerService = {
    getMergeCandidates: async (deviceId?: string | null): Promise<MergeGroup[]> => {
        const params: Record<string, string> = {};
        if (deviceId && deviceId !== 'all') params.device_id = deviceId;

        const response = await apiClient.get<MergeGroup[]>(API_CONFIG.ENDPOINTS.RULES.MERGE_CANDIDATES, { params });
        return response.data;
    },

    executeMerge: async (groupIds: string[]): Promise<MergeResult> => {
        const response = await apiClient.post<MergeResult>(API_CONFIG.ENDPOINTS.RULES.MERGE, { group_ids: groupIds });
        return response.data;
    }
};
