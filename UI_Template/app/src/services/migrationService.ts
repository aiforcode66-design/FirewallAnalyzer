import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';

export interface MigrationContext {
    name: string;
    objects: any[];
    rules: any[];
}

export interface ConflictReview {
    conflict_count: number;
    conflicts: any[];
    clean_count: number;
    clean_objects?: any[];
}

export interface UnifiedPolicy {
    unified_device_id: string;
    message: string;
    policy: {
        objects: any[];
        rules: any[];
    };
}

export const migrationService = {
    analyzeConflicts: async (contexts: MigrationContext[]): Promise<ConflictReview> => {
        const response = await apiClient.post<ConflictReview>(API_CONFIG.ENDPOINTS.MIGRATION.ANALYZE, { contexts });
        return response.data;
    },

    executeMigration: async (contexts: MigrationContext[], strategy: string = 'auto_rename_context', targetDeviceName: string = 'Unified-Device'): Promise<UnifiedPolicy> => {
        const response = await apiClient.post<UnifiedPolicy>(API_CONFIG.ENDPOINTS.MIGRATION.EXECUTE, {
            contexts,
            strategy,
            target_device_name: targetDeviceName
        });
        return response.data;
    }
};
