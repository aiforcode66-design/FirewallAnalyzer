import { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import {
  FileText,
  Download,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Loader2,
  MoreVertical,
  Trash2,
  Eye,
  FileSpreadsheet,
  FileJson,
  File,
  TrendingUp,
  Shield,
  Sparkles,
  LayoutDashboard,
  AlertTriangle,
  Server
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { mockReports, mockDevices } from '@/data/vendors';
import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import { cn } from '@/lib/utils';


const reportTypes = [
  {
    id: 'security',
    name: 'Security Audit',
    description: 'Comprehensive security analysis report',
    icon: Shield,
    color: 'text-red-500',
    bg: 'bg-red-50',
  },
  {
    id: 'compliance',
    name: 'Compliance Report',
    description: 'PCI DSS, ISO 27001 compliance check',
    icon: CheckCircle,
    color: 'text-green-500',
    bg: 'bg-green-50',
  },
  {
    id: 'optimization',
    name: 'Optimization Report',
    description: 'Rule optimization recommendations',
    icon: Sparkles,
    color: 'text-orange-500',
    bg: 'bg-orange-50',
  },
  {
    id: 'custom',
    name: 'Custom Report',
    description: 'Build your own custom report',
    icon: FileText,
    color: 'text-blue-500',
    bg: 'bg-blue-50',
  },
];

const formatIcons: Record<string, React.ElementType> = {
  pdf: File,
  csv: FileSpreadsheet,
  json: FileJson,
};

const statusConfig = {
  generating: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Generating' },
  completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Completed' },
  failed: { icon: AlertCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Failed' },
};

interface ReportCardProps {
  report: (typeof mockReports)[0];
  index: number;
}

function ReportCard({ report, index }: ReportCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const status = statusConfig[report.status];
  const StatusIcon = status.icon;
  const FormatIcon = formatIcons[report.format];

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          delay: index * 0.05,
          ease: 'power3.out',
        }
      );
    }
  }, [index]);

  return (
    <Card
      ref={cardRef}
      className="group hover:shadow-card-hover transition-all duration-500 overflow-hidden"
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div
              className={cn(
                'w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors',
                status.bg
              )}
            >
              <FormatIcon className={cn('h-6 w-6', status.color)} />
            </div>

            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-orange-500 transition-colors">
                {report.name}
              </h3>
              <p className="text-sm text-gray-500 capitalize">{report.type} Report</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary" className={cn('text-xs', status.bg, status.color)}>
                  <StatusIcon className={cn('h-3 w-3 mr-1', report.status === 'generating' && 'animate-spin')} />
                  {status.label}
                </Badge>
                <span className="text-xs text-gray-400 uppercase">{report.format}</span>
              </div>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="gap-2">
                <Eye className="h-4 w-4" />
                View
              </DropdownMenuItem>
              {report.status === 'completed' && (
                <DropdownMenuItem className="gap-2">
                  <Download className="h-4 w-4" />
                  Download
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 text-red-600">
                <Trash2 className="h-4 w-4" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Created {new Date(report.createdAt).toLocaleDateString()}</span>
          </div>
          {report.deviceId && (
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              <span>Device: {mockDevices.find((d) => d.id === report.deviceId)?.name}</span>
            </div>
          )}
        </div>

        {report.status === 'completed' && (
          <Button variant="outline" size="sm" className="w-full mt-4 gap-2">
            <Download className="h-4 w-4" />
            Download {report.format.toUpperCase()}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

interface GlobalSummary {
  avg_security_score: number;
  total_active_devices: number;
  total_severe_risks: number;
  risky_devices: Array<{ id: string; name: string; critical_issues: number }>;
  protocol_violations: {
    telnet: number;
    ftp: number;
    http: number;
  };
}

export default function Reports() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'dashboard';

  const updateTab = (tab: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      newParams.set('tab', tab);
      return newParams;
    });
  };

  const [globalStats, setGlobalStats] = useState<GlobalSummary | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<string>('');
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  useEffect(() => {
    // Fetch global stats when dashboard tab is active
    if (activeTab === 'dashboard') {
      fetchGlobalStats();
    }
  }, [activeTab]);

  const fetchGlobalStats = async () => {
    try {
      setLoadingStats(true);
      // Assuming the endpoint will be available at /api/reports/global/summary
      // We can use a direct fetch here or via service. For now, let's use apiClient similar to reportsService
      const response = await apiClient.get(API_CONFIG.ENDPOINTS.REPORTS.SUMMARY);
      setGlobalStats(response.data);
    } catch (error) {
      console.error("Failed to fetch global stats:", error);
      // toast.error("Failed to load global dashboard");
    } finally {
      setLoadingStats(false);
    }
  };

  const filteredReports = mockReports.filter((report) => {
    const matchesSearch = report.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === 'all' || report.type === typeFilter;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Reports Center</h1>
          <p className="text-gray-500 mt-1">
            Global compliance monitoring and report management
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 gradient-primary hover:opacity-90 transition-opacity">
                <Plus className="h-4 w-4" />
                Generate Report
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Generate New Report</DialogTitle>
                <DialogDescription>
                  Select the report type and configure options
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Report Type</label>
                  <div className="grid grid-cols-2 gap-3">
                    {reportTypes.map((type) => {
                      const Icon = type.icon;
                      return (
                        <div
                          key={type.id}
                          className={cn(
                            'p-3 rounded-xl border-2 cursor-pointer transition-all',
                            selectedReportType === type.id
                              ? 'border-orange-500 bg-orange-50'
                              : 'border-gray-100 hover:border-gray-200'
                          )}
                          onClick={() => setSelectedReportType(type.id)}
                        >
                          <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center mb-2', type.bg)}>
                            <Icon className={cn('h-4 w-4', type.color)} />
                          </div>
                          <p className="text-sm font-medium">{type.name}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Device (Optional)</label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="All Devices" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Devices</SelectItem>
                      {mockDevices.map((device) => (
                        <SelectItem key={device.id} value={device.id}>
                          {device.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Format</label>
                  <div className="flex gap-3">
                    {['pdf', 'csv', 'json'].map((format) => (
                      <label
                        key={format}
                        className="flex items-center gap-2 p-3 rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50"
                      >
                        <Checkbox defaultChecked={format === 'pdf'} />
                        <span className="text-sm uppercase">{format}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button className="gradient-primary" onClick={() => setIsCreateDialogOpen(false)}>
                  Generate
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={updateTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="dashboard" className="gap-2">
            <LayoutDashboard className="h-4 w-4" /> Global Dashboard
          </TabsTrigger>
          <TabsTrigger value="archive" className="gap-2">
            <FileText className="h-4 w-4" /> Reports Library
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          {!globalStats && loadingStats ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
          ) : globalStats ? (
            <>
              {/* Top Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-green-100 rounded-full">
                      <Shield className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Avg Security Score</p>
                      <h3 className="text-2xl font-bold">{globalStats.avg_security_score}</h3>
                      <p className="text-xs text-green-600">Across {globalStats.total_active_devices} Active Devices</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-red-100 rounded-full">
                      <AlertTriangle className="h-6 w-6 text-red-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Critical Risks</p>
                      <h3 className="text-2xl font-bold">{globalStats.total_severe_risks}</h3>
                      <p className="text-xs text-red-600">Critical & High Issues</p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-6 flex items-center gap-4">
                    <div className="p-3 bg-orange-100 rounded-full">
                      <AlertCircle className="h-6 w-6 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Policy Violations</p>
                      <h3 className="text-2xl font-bold">
                        {globalStats.protocol_violations.telnet + globalStats.protocol_violations.ftp}
                      </h3>
                      <p className="text-xs text-orange-600">Insecure Protocols Active</p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Top Risky Devices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-red-500" />
                      Top Risky Firewalls
                    </CardTitle>
                    <CardDescription>Devices with highest count of critical issues</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Device Name</TableHead>
                          <TableHead className="text-right">Critical Issues</TableHead>
                          <TableHead className="text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {globalStats.risky_devices.length > 0 ? (
                          globalStats.risky_devices.map((dev) => (
                            <TableRow key={dev.id}>
                              <TableCell className="font-medium flex items-center gap-2">
                                <Server className="h-4 w-4 text-gray-400" />
                                {dev.name}
                              </TableCell>
                              <TableCell className="text-right">
                                <Badge variant="destructive">{dev.critical_issues}</Badge>
                              </TableCell>
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm" className="h-8 text-blue-600" asChild>
                                  <Link to={`/devices/${dev.id}`}>View</Link>
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center py-4 text-gray-500">
                              No critical risks found. Good job!
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Protocol Violations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-orange-500" />
                      Insecure Services Detected
                    </CardTitle>
                    <CardDescription>Global usage of risky protocols</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">Telnet (Port 23)</span>
                          <span className="text-red-500 font-bold">{globalStats.protocol_violations.telnet} rules</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-500 rounded-full" style={{ width: `${Math.min(100, globalStats.protocol_violations.telnet * 5)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">FTP (Port 21)</span>
                          <span className="text-orange-500 font-bold">{globalStats.protocol_violations.ftp} rules</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.min(100, globalStats.protocol_violations.ftp * 5)}%` }} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <div className="flex justify-between text-sm">
                          <span className="font-medium text-gray-700">HTTP (Port 80)</span>
                          <span className="text-yellow-500 font-bold">{globalStats.protocol_violations.http} rules</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-yellow-500 rounded-full" style={{ width: `${Math.min(100, globalStats.protocol_violations.http * 2)}%` }} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-6 bg-orange-50 border border-orange-100 p-3 rounded-lg text-xs text-orange-800">
                      <p className="font-semibold mb-1">Recommendation:</p>
                      Migrate all Telnet and FTP management to SSH (Port 22) and SFTP immediately.
                    </div>
                  </CardContent>
                </Card>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-gray-500">
              Failed to load dashboard data.
            </div>
          )}
        </TabsContent>

        <TabsContent value="archive" className="space-y-6 focus-visible:outline-none">
          {/* Stats - Kept from original */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Reports', value: mockReports.length, icon: FileText, color: 'text-blue-600' },
              { label: 'Completed', value: mockReports.filter((r) => r.status === 'completed').length, icon: CheckCircle, color: 'text-green-600' },
              { label: 'Generating', value: mockReports.filter((r) => r.status === 'generating').length, icon: Loader2, color: 'text-orange-600' },
              { label: 'This Month', value: 5, icon: TrendingUp, color: 'text-purple-600' },
            ].map((stat) => (
              <Card key={stat.label} className="hover:shadow-card transition-shadow">
                <CardContent className="p-4">
                  <stat.icon className={cn('h-6 w-6 mb-2', stat.color)} />
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filters */}
          <Card>
            <CardContent className="p-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Search reports..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                  <SelectTrigger className="w-[160px]">
                    <Filter className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Report Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="compliance">Compliance</SelectItem>
                    <SelectItem value="optimization">Optimization</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Reports Grid */}
          {filteredReports.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredReports.map((report, index) => (
                <ReportCard key={report.id} report={report} index={index} />
              ))}
            </div>
          ) : (
            <Card className="py-12">
              <CardContent className="flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900">No reports found</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Generate your first report to get started
                </p>
                <Button className="mt-4 gap-2 gradient-primary" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Generate Report
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

      </Tabs>
    </div>
  );
}
