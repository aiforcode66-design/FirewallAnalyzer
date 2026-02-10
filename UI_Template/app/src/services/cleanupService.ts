import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import type { FirewallRule } from '@/types';

// Raw response from Backend (matches Pydantic aliases)
interface ApiUnusedRule {
    id: string;
    deviceId: string;
    name: string;
    source: string;
    destination: string;
    service: string;
    action: string;
    hits: number;
    lastHit?: string;
    daysUnused?: number;
    isUnused: boolean;
    createdAt: string;
}

export interface UnusedRule extends FirewallRule {
    daysUnused?: number;
}

export interface CleanupResult {
    success: boolean;
    deleted_count: number;
    message: string;
}

export const cleanupService = {
    getUnusedRules: async (deviceId?: string | null, skip: number = 0, limit: number = 50, retentionDays?: number): Promise<{ rules: UnusedRule[]; total: number }> => {
        const params: Record<string, string> = {
            skip: skip.toString(),
            limit: limit.toString()
        };
        if (deviceId && deviceId !== 'all') params.device_id = deviceId;
        if (retentionDays && retentionDays > 0) params.retention_days = retentionDays.toString();

        // Fetch raw data - response.data is now { items: [], total: number }
        const response = await apiClient.get<{ items: ApiUnusedRule[]; total: number }>(API_CONFIG.ENDPOINTS.RULES.UNUSED, { params });

        // Map to Frontend Model (already camelCase from backend alias)
        const mappedRules: UnusedRule[] = response.data.items.map((rule): UnusedRule => ({
            id: rule.id,
            deviceId: rule.deviceId,
            name: rule.name,
            source: rule.source,
            destination: rule.destination,
            service: rule.service,
            action: (rule.action === 'allow' || rule.action === 'deny') ? (rule.action as 'allow' | 'deny') : 'deny',
            hits: rule.hits,
            isUnused: true,
            isRedundant: false,
            isShadowed: false,
            riskLevel: 'low',
            lastHit: rule.lastHit,
            createdAt: rule.createdAt,
            daysUnused: rule.daysUnused // Backend now calculates this
        }));

        return {
            rules: mappedRules,
            total: response.data.total
        };
    },

    cleanupRules: async (ruleIds: string[]): Promise<CleanupResult> => {
        const response = await apiClient.post<CleanupResult>(API_CONFIG.ENDPOINTS.RULES.CLEANUP, { rule_ids: ruleIds });
        return response.data;
    },

    cleanupObjects: async (objectIds: string[]): Promise<CleanupResult> => {
        const response = await apiClient.post<CleanupResult>(API_CONFIG.ENDPOINTS.ANALYZER.CLEANUP_OBJECTS, objectIds);
        return response.data;
    },

    /**
     * Check if device has any usage data (last_hit) in its rules
     * This queries the database directly, NOT just the current page of unused rules
     */
    getUsageStatus: async (deviceId: string): Promise<{ hasUsageData: boolean; totalRules: number }> => {
        const response = await apiClient.get<{ device_id: string; has_last_hit_data: boolean; total_rules: number }>(
            `/api/rules/usage-status/${deviceId}`
        );
        return {
            hasUsageData: response.data.has_last_hit_data,
            totalRules: response.data.total_rules
        };
    }
};
