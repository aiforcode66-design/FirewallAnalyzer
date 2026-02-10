
import axios from 'axios';

const API_URL = 'http://localhost:8000/api';

export interface TrafficRecommendation {
    type: 'over_permissive' | 'frequent_deny' | 'consolidation' | 'tighten_scope';
    severity: 'high' | 'medium' | 'low';
    rule_id: string | null;
    rule_name: string;
    description: string;
    suggestion: string;
    cli_commands?: string[];
}

export interface TrafficStats {
    total_logs: number;
    denied_logs: number;
    unmatched_logs: number;
    rule_stats: Record<string, {
        name: string;
        action: string;
        source: string;
        destination: string;
        service: string;
        hits: number;
        bytes: number;
        last_seen: string | null;
    }>;
    recommendations: TrafficRecommendation[];
}

export interface TrafficAnalysisResult {
    device_id: string;
    filename: string;
    summary: TrafficStats;
}

const trafficService = {
    uploadTrafficLog: async (deviceId: string, file: File): Promise<TrafficAnalysisResult> => {
        const formData = new FormData();
        formData.append('file', file);

        const response = await axios.post(`${API_URL}/traffic/upload/${deviceId}`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    getAnalysisHistory: async (deviceId: string) => {
        // Not implemented fully on backend yet
        const response = await axios.get(`${API_URL}/traffic/analysis/${deviceId}`);
        return response.data;
    }
};

export default trafficService;
