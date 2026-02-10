import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import type { FirewallRule } from '@/types';

export interface RuleQueryParams {
    deviceId?: string;
    skip?: number;
    limit?: number;
    search?: string;
    action?: 'allow' | 'deny';
}

// Backend response interface (snake_case)
// Backend response interface (matches Pydantic serialization_aliases)
interface ApiFirewallRule {
    id: string;
    deviceId: string;
    name: string;
    source: string;
    destination: string;
    service: string;
    action: 'allow' | 'deny';
    hits: number;
    lastHit?: string;
    createdAt: string;
    isUnused: boolean;
    isRedundant: boolean;
    isShadowed: boolean;
    riskLevel?: 'low' | 'medium' | 'high' | 'critical';
    children?: ApiFirewallRule[];
}

export const ruleService = {
    getRules: async (params: RuleQueryParams = {}): Promise<FirewallRule[]> => {
        const queryParams = new URLSearchParams();
        if (params.deviceId) queryParams.append('device_id', params.deviceId);
        if (params.skip) queryParams.append('skip', params.skip.toString());
        if (params.limit) queryParams.append('limit', params.limit.toString());
        if (params.search) queryParams.append('search', params.search);
        if (params.action) queryParams.append('action', params.action);

        const response = await apiClient.get<ApiFirewallRule[]>(`${API_CONFIG.ENDPOINTS.RULES.BASE}?${queryParams.toString()}`);

        const mapRule = (rule: ApiFirewallRule): FirewallRule => ({
            id: rule.id,
            deviceId: rule.deviceId,
            name: rule.name,
            source: rule.source,
            destination: rule.destination,
            service: rule.service,
            action: rule.action,
            hits: rule.hits,
            lastHit: rule.lastHit,
            createdAt: rule.createdAt,
            isUnused: rule.isUnused,
            isRedundant: rule.isRedundant,
            isShadowed: rule.isShadowed,
            riskLevel: rule.riskLevel,
            children: rule.children ? rule.children.map(mapRule) : undefined
        });

        return response.data.map(mapRule);
    }
};
