export const chartService = {
    getChartData: async (_deviceId: string) => { // deviceId currently unused but kept for API signature
        console.log("Fetching charts for", _deviceId);
        // Mock data - in real app would fetch from backend activity logs
        return [
            { name: 'Mon', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Tue', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Wed', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Thu', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Fri', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Sat', hits: Math.floor(Math.random() * 5000) + 1000 },
            { name: 'Sun', hits: Math.floor(Math.random() * 5000) + 1000 },
        ];
    },

    getActivityData: async (_deviceId: string) => { // deviceId currently unused
        console.log("Fetching activity for", _deviceId);
        // Mock data
        return [
            { name: 'Critical', value: Math.floor(Math.random() * 10), color: '#ef4444' },
            { name: 'High', value: Math.floor(Math.random() * 20), color: '#f97316' },
            { name: 'Medium', value: Math.floor(Math.random() * 50), color: '#eab308' },
            { name: 'Low', value: Math.floor(Math.random() * 100) + 50, color: '#22c55e' },
        ];
    },

    getRiskDistribution: async (_deviceId: string) => {
        // Mock data
        return [
            { name: 'Critical', value: Math.floor(Math.random() * 10), color: '#ef4444' },
            { name: 'High', value: Math.floor(Math.random() * 20), color: '#f97316' },
            { name: 'Medium', value: Math.floor(Math.random() * 50), color: '#eab308' },
            { name: 'Low', value: Math.floor(Math.random() * 100) + 50, color: '#22c55e' },
        ];
    }
};
