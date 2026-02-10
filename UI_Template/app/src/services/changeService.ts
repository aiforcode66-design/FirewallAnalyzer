import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';

export interface ChangeRecord {
    id: string;
    device_id: string;
    timestamp: string;
    user_email: string;
    type: 'add' | 'modify' | 'delete';
    description: string;
    rules_affected: any[];
    status: 'pending' | 'approved' | 'rejected' | 'implemented';
    rollback_available: boolean;
    created_at: string;
}

export interface ChangeQueryParams {
    deviceId?: string;
    status?: string;
    skip?: number;
    limit?: number;
}

export type Change = ChangeRecord;

export const changeService = {
    getChanges: async (params: ChangeQueryParams = {}): Promise<ChangeRecord[]> => {
        const queryParams = new URLSearchParams();
        if (params.deviceId) queryParams.append('device_id', params.deviceId);
        if (params.status) queryParams.append('status', params.status);
        if (params.skip) queryParams.append('skip', params.skip.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());

        const response = await apiClient.get<ChangeRecord[]>(`${API_CONFIG.ENDPOINTS.CHANGES.BASE}?${queryParams.toString()}`);
        return response.data;
    },

    getChange: async (id: string): Promise<ChangeRecord> => {
        const response = await apiClient.get<ChangeRecord>(`${API_CONFIG.ENDPOINTS.CHANGES.BASE}/${id}`);
        return response.data;
    },

    createChange: async (data: Omit<ChangeRecord, 'id' | 'user_email' | 'status' | 'rollback_available' | 'created_at'>): Promise<ChangeRecord> => {
        const response = await apiClient.post<ChangeRecord>(API_CONFIG.ENDPOINTS.CHANGES.BASE, data);
        return response.data;
    },

    updateStatus: async (id: string, status: 'approved' | 'rejected' | 'implemented'): Promise<ChangeRecord> => {
        const response = await apiClient.put<ChangeRecord>(`${API_CONFIG.ENDPOINTS.CHANGES.BASE}/${id}`, { status });
        return response.data;
    },

    deleteChange: async (id: string): Promise<void> => {
        await apiClient.delete(`${API_CONFIG.ENDPOINTS.CHANGES.BASE}/${id}`);
    }
};
