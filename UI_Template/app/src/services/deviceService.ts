/**
 * Device and vendor services
 */

import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import type { Device } from '@/types';

export interface DeviceCreate {
    name: string;
    ipAddress: string;
    vendorId: string;
    model?: string;
    status?: string;
    location?: string;
    description?: string;
}

export interface DeviceUpdate {
    name?: string;
    ipAddress?: string;
    vendorId?: string;
    model?: string;
    status?: string;
    location?: string;
    description?: string;
}

export interface Vendor {
    id: string;
    name: string;
    displayName: string;
    supported: boolean;
    logoUrl?: string;
    color?: string;
    description?: string;
    features?: string[];
    gradient?: string;
}

export const deviceService = {
    /**
     * Get all devices
     */
    async getDevices(): Promise<Device[]> {
        const response = await apiClient.get<Device[]>(API_CONFIG.ENDPOINTS.DEVICES.LIST);
        return response.data;
    },

    /**
     * Get device by ID
     */
    async getDevice(id: string): Promise<Device> {
        const response = await apiClient.get<Device>(API_CONFIG.ENDPOINTS.DEVICES.GET(id));
        return response.data;
    },

    /**
     * Create new device
     */
    async createDevice(data: DeviceCreate): Promise<Device> {
        const response = await apiClient.post<Device>(API_CONFIG.ENDPOINTS.DEVICES.CREATE, data);
        return response.data;
    },

    /**
     * Update device
     */
    async updateDevice(id: string, data: DeviceUpdate): Promise<Device> {
        const response = await apiClient.put<Device>(API_CONFIG.ENDPOINTS.DEVICES.UPDATE(id), data);
        return response.data;
    },

    /**
     * Delete device
     */
    async deleteDevice(id: string): Promise<void> {
        await apiClient.delete(API_CONFIG.ENDPOINTS.DEVICES.DELETE(id));
    },

    /**
     * Upload device config
     */
    async uploadConfig(id: string, file: File): Promise<{ message: string; stats?: any }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post(
            API_CONFIG.ENDPOINTS.DEVICES.UPLOAD_CONFIG(id),
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },
    /**
     * Get device statistics (Real API)
     */
    async getDeviceStats(id: string, days: number = 7): Promise<any> {
        const response = await apiClient.get<any>(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/stats`, {
            params: { days }
        });
        return response.data;
    },

    async getDeviceObjects(id: string): Promise<any> {
        const response = await apiClient.get<any>(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/objects`);
        return response.data;
    },

    async getRules(id: string, params?: { skip?: number; limit?: number }): Promise<any[]> {
        // Fetch rules from real backend endpoint
        try {
            // We use the new endpoint
            const response = await apiClient.get<any[]>(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/rules`, {
                params: params // Pass skip/limit
            });
            return response.data;
        } catch (e) {
            console.error("Error fetching rules:", e);
            return [];
        }
    },

    async downloadConfig(id: string): Promise<void> {
        const response = await apiClient.get(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/config/download`, {
            responseType: 'blob'
        });

        // Trigger download
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;

        // Try to get filename from header
        const contentDisposition = response.headers['content-disposition'];
        let filename = 'optimized_config.cfg';
        if (contentDisposition) {
            const matches = /filename=(.+)/.exec(contentDisposition);
            if (matches && matches[1]) {
                filename = matches[1].replace(/['"]/g, '');
            }
        }

        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
    },

    /**
     * Get device config content
     */
    async getDeviceConfigContent(id: string): Promise<{ content: string }> {
        const response = await apiClient.get<{ content: string }>(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/config/content`);
        return response.data;
    },

    /**
     * Upload device configuration
     */
    async uploadDeviceConfig(id: string, file: File): Promise<Device> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<Device>(
            `${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/config`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },

    // Traffic Tuner
    async uploadTrafficLogs(id: string, file: File): Promise<{ message: string; count: number }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await apiClient.post<{ message: string; count: number }>(
            `${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/tuner/upload`,
            formData,
            {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            }
        );
        return response.data;
    },

    async getTunerCandidates(id: string): Promise<any[]> {
        const response = await apiClient.get<any[]>(`${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${id}/tuner/candidates`);
        return response.data;
    },

    async getTunerProposal(deviceId: string, ruleId: string): Promise<any> {
        const response = await apiClient.get<any>(
            `${API_CONFIG.ENDPOINTS.DEVICES.LIST}/${deviceId}/tuner/proposals/${ruleId}`
        );
        return response.data;
    }
};

export const vendorService = {
    /**
     * Get all vendors
     */
    async getVendors(): Promise<Vendor[]> {
        const response = await apiClient.get<Vendor[]>(API_CONFIG.ENDPOINTS.VENDORS.LIST);
        return response.data;
    },
};
