export interface Device {
  id: string;
  name: string;
  ipAddress: string;
  vendorId: string;
  model: string;
  status: 'active' | 'inactive' | 'warning' | 'error';
  lastSeen: string;
  rulesCount?: number;
  location?: string;
  description?: string;
  parentDeviceId?: string | null;
  configDate?: string; // ISO Date String
  subDevices?: DeviceSummary[];
  vendor?: {
    name: string;
    displayName: string;
  };
}

export interface DeviceSummary {
  id: string;
  name: string;
  ipAddress?: string;
  status: 'active' | 'inactive' | 'warning' | 'error';
  rulesCount?: number;
  parentDeviceId?: string | null;
  vendor?: {
    name: string;
    displayName: string;
  };
}

export interface FirewallRule {
  id: string;
  deviceId: string;
  name: string;
  source: string;
  destination: string;
  service: string;
  action: 'allow' | 'button' | 'permit' | 'deny';
  hits: number;
  lastHit?: string;
  createdAt: string;
  isUnused: boolean;
  isRedundant?: boolean;
  isShadowed?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | 'critical';
  daysUnused?: number;
  children?: FirewallRule[];
}

export interface AnalysisResult {
  id: string;
  deviceId: string;
  timestamp: string;
  type: 'optimization' | 'security' | 'compliance';
  findings: Finding[];
  summary: {
    totalRules: number;
    unusedRules: number;
    redundantRules: number;
    shadowedRules: number;
    highRiskRules: number;
  };
}

export interface Finding {
  id: string;
  ruleId: string;
  type: 'unused' | 'redundant' | 'shadowed' | 'high-risk' | 'optimization';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  recommendation: string;
}

export interface Report {
  id: string;
  name: string;
  type: 'compliance' | 'security' | 'optimization' | 'custom';
  createdAt: string;
  deviceId?: string;
  format: 'pdf' | 'csv' | 'json';
  status: 'generating' | 'completed' | 'failed';
  downloadUrl?: string;
}

export interface Change {
  id: string;
  deviceId: string;
  timestamp: string;
  user: string;
  type: 'add' | 'modify' | 'delete';
  description: string;
  rulesAffected: any[];
  status: 'pending' | 'approved' | 'rejected' | 'implemented';
  rollbackAvailable: boolean;
}

export interface VendorInfo {
  id: string;
  name: string;
  displayName: string;
  color: string;
  gradient: string;
  icon: string;
  description: string;
  features: string[];
  supported: boolean;
}

export interface DashboardStats {
  totalDevices: number;
  activeDevices: number;
  totalRules: number;
  unusedRules: number;
  optimizationScore: number;
  securityScore: number;
  recentAnalyses: number;
  pendingChanges: number;
  unusedObjectsCount: number;
}


export interface RiskData {
  label: string;
  value: number;
  color: string;
}

export interface ActivityData {
  date: string;
  hits: number;
}

export interface DeviceStats {
  securityScore: number;
  riskProfile: RiskData[];
  optimizationScore: number;
  unusedRulesCount: number;
  totalRulesCount: number;
  activityTrend: ActivityData[];
}

export interface NavItem {
  id: string;
  label: string;
  icon: string;
  path: string;
  badge?: number;
}
