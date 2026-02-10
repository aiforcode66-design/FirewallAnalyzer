/**
 * API Configuration
 */

const API_URL = import.meta.env.VITE_API_URL || '';

export const API_CONFIG = {
  BASE_URL: API_URL,
  ENDPOINTS: {
    // Auth
    AUTH: {
      REGISTER: '/api/auth/register',
      LOGIN: '/api/auth/login',
      REFRESH: '/api/auth/refresh',
      ME: '/api/auth/me',
    },
    // Devices
    DEVICES: {
      LIST: '/api/devices',
      GET: (id: string) => `/api/devices/${id}`,
      CREATE: '/api/devices',
      UPDATE: (id: string) => `/api/devices/${id}`,
      DELETE: (id: string) => `/api/devices/${id}`,
      UPLOAD_CONFIG: (id: string) => `/api/devices/${id}/config`,
      STATS: (id: string) => `/api/devices/${id}/stats`,
      CONFIG: {
        CONTENT: (id: string) => `/api/devices/${id}/config/content`,
      }
    },
    // Vendors
    VENDORS: {
      LIST: '/api/vendors',
      CREATE: '/api/vendors',
    },
    // Dashboard
    DASHBOARD: {
      STATS: '/api/dashboard/stats',
    },
    // Analyzer
    ANALYZER: {
      START: '/api/analyzer/start',
      DEVICE_HISTORY: (deviceId: string) => `/api/analyzer/device/${deviceId}`,
      GET_RESULTS: (id: string) => `/api/analyzer/${id}`,
      SHADOWED: (id: string) => `/api/analyzer/${id}/shadowed`,
      REDUNDANT: (id: string) => `/api/analyzer/${id}/redundant`,
      UNUSED_OBJECTS: (id: string) => `/api/analyzer/${id}/unused-objects`,
      STATS_SUMMARY: (id: string) => `/api/analyzer/${id}/stats-summary`,
      DOWNLOAD_PDF: (id: string) => `/api/analyzer/${id}/report/pdf`,
      DOWNLOAD_CSV: (id: string) => `/api/analyzer/${id}/report/csv`,
      CLEANUP_OBJECTS: '/api/analyzer/objects/cleanup',
    },
    // Changes
    CHANGES: {
      BASE: '/api/changes',
      LIST: '/api/changes',
      CREATE: '/api/changes',
      UPDATE: (id: string) => `/api/changes/${id}`,
      DELETE: (id: string) => `/api/changes/${id}`,
    },
    // Rules
    RULES: {
      BASE: '/api/rules',
      MERGE_CANDIDATES: '/api/rules/merge-candidates',
      MERGE: '/api/rules/merge',
      UNUSED: '/api/rules/unused',
      CLEANUP: '/api/rules/cleanup'
    },
    // Migration
    MIGRATION: {
      ANALYZE: '/api/migration/analyze',
      EXECUTE: '/api/migration/execute'
    },
    // Reports
    REPORTS: {
      EXECUTIVE: (id: string) => `/api/reports/executive/${id}`,
      COMPLIANCE: (id: string) => `/api/reports/compliance/${id}`,
      SUMMARY: '/api/reports/global/summary',
    }
  },
} as const;

export default API_CONFIG;
