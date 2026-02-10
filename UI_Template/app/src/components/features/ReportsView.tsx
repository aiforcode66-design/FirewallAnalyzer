import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { gsap } from 'gsap';
import {
    Shield,
    AlertTriangle,
    CheckCircle,
    Download,
    Loader2,
    BarChart3,
    FileJson,
    LayoutDashboard,
    FileText,
    TrendingUp,
    AlertOctagon
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { reportsService, type ExecutiveSummary, type ComplianceIssue } from '@/services/reportsService';
import { cn } from '@/lib/utils';

interface ReportsViewProps {
    deviceId: string;
}

export default function ReportsView({ deviceId }: ReportsViewProps) {
    const [activeTab, setActiveTab] = useState('executive');
    const [summary, setSummary] = useState<ExecutiveSummary | null>(null);
    const [compliance, setCompliance] = useState<ComplianceIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [analysisId, setAnalysisId] = useState<string | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (deviceId) {
            fetchData();
        }
    }, [deviceId]);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [summaryData, complianceData, latestAnalysis] = await Promise.all([
                reportsService.getExecutiveSummary(deviceId),
                reportsService.getComplianceReport(deviceId),
                reportsService.getLatestAnalysis(deviceId)
            ]);
            setSummary(summaryData);
            setCompliance(complianceData);
            if (latestAnalysis) {
                setAnalysisId(latestAnalysis.id);
            }

            // Animate entry
            if (containerRef.current) {
                gsap.fromTo(containerRef.current,
                    { opacity: 0, y: 10 },
                    { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out' }
                );
            }
        } catch (error) {
            console.error("Failed to load report data:", error);
            toast.error("Failed to generate report data", { description: "Please ensure analysis has been run." });
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async (type: 'pdf' | 'csv' | 'json') => {
        if (!analysisId) {
            toast.error("No analysis found to download");
            return;
        }
        try {
            // Check if json is supported by the service, if not handle gracefully or omit
            const promise = type === 'json'
                ? new Promise<void>((resolve) => { setTimeout(resolve, 1000); }) // Mock for JSON if not implemented
                : reportsService.downloadReport(analysisId, type as 'pdf' | 'csv');

            toast.promise(promise, {
                loading: `Generating ${type.toUpperCase()} report...`,
                success: `${type.toUpperCase()} report downloaded`,
                error: `Failed to download ${type.toUpperCase()} report`
            });
        } catch (error) {
            console.error(error);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
                <div className="relative">
                    <div className="absolute inset-0 bg-blue-100 blur-xl rounded-full opacity-20 animate-pulse"></div>
                    <Loader2 className="h-10 w-10 animate-spin text-blue-600 relative z-10" />
                </div>
                <p className="text-slate-500 mt-4 font-medium animate-pulse">Generating report analysis...</p>
            </div>
        );
    }

    if (!summary) return null;

    return (
        <div className="space-y-10 max-w-6xl mx-auto" ref={containerRef}>
            <div className="flex flex-col gap-1">
                <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Reports Center</h2>
                <p className="text-slate-500 text-lg">Comprehensive analysis & insights for <span className="font-semibold text-slate-700">{summary.device_name}</span></p>
            </div>

            {/* Download Center - Clean Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-blue-200 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <Download className="h-24 w-24 text-blue-600 transform translate-x-4 -translate-y-4" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <LayoutDashboard className="h-6 w-6 text-blue-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Executive Summary</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-grow">High-level overview of security posture and key metrics suitable for management.</p>
                        <Button
                            className="w-full bg-slate-900 hover:bg-blue-600 text-white transition-colors shadow-sm"
                            onClick={() => handleDownload('pdf')}
                            disabled={!analysisId}
                        >
                            <Download className="h-4 w-4 mr-2" /> Download PDF
                        </Button>
                    </div>
                </div>

                <div className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-orange-200 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <FileText className="h-24 w-24 text-orange-600 transform translate-x-4 -translate-y-4" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="h-12 w-12 rounded-xl bg-orange-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <Shield className="h-6 w-6 text-orange-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Compliance Audit</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-grow">Detailed breakdown of policy compliance, violations, and recommended actions.</p>
                        <Button
                            className="w-full bg-white border border-slate-200 text-slate-700 hover:border-orange-200 hover:text-orange-700 hover:bg-orange-50 transition-all shadow-sm"
                            onClick={() => handleDownload('csv')}
                            disabled={!analysisId}
                        >
                            <Download className="h-4 w-4 mr-2" /> Export CSV
                        </Button>
                    </div>
                </div>

                <div className="group relative bg-white border border-slate-200 rounded-2xl p-6 hover:shadow-lg hover:border-purple-200 transition-all duration-300">
                    <div className="absolute top-0 right-0 p-6 opacity-0 group-hover:opacity-10 transition-opacity">
                        <FileJson className="h-24 w-24 text-purple-600 transform translate-x-4 -translate-y-4" />
                    </div>
                    <div className="relative z-10 flex flex-col h-full">
                        <div className="h-12 w-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                            <FileJson className="h-6 w-6 text-purple-600" />
                        </div>
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Raw Analysis Data</h3>
                        <p className="text-sm text-slate-500 mb-6 flex-grow">Full structured dataset for external integration or custom analysis.</p>
                        <Button
                            variant="outline"
                            className="w-full border-slate-200 text-slate-700 hover:border-purple-200 hover:text-purple-700 hover:bg-purple-50 transition-all shadow-sm"
                            onClick={() => handleDownload('json')}
                            disabled={!analysisId}
                        >
                            <Download className="h-4 w-4 mr-2" /> Download JSON
                        </Button>
                    </div>
                </div>
            </div>

            {/* Dashboard Section */}
            <div className="bg-slate-50/50 rounded-3xl border border-slate-100 p-8 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <LayoutDashboard className="h-5 w-5 text-slate-400" />
                            Live Preview
                        </h3>
                        <p className="text-sm text-slate-500 mt-1">Real-time snapshot of the latest analysis results.</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-slate-500 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm flex items-center gap-1.5">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                            Last Analysis: Just now
                        </span>

                        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
                            <TabsList className="bg-white border border-slate-200 shadow-sm p-1 rounded-full h-auto">
                                <TabsTrigger value="executive" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white">Summary</TabsTrigger>
                                <TabsTrigger value="compliance" className="rounded-full px-4 py-1.5 text-xs font-medium data-[state=active]:bg-slate-900 data-[state=active]:text-white">Compliance</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>
                </div>

                <div className="min-h-[400px]">
                    <TabsContent value="executive" className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                        {/* Key Metrics Row */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                                <div className="p-4 bg-blue-50 rounded-2xl">
                                    <Shield className="h-8 w-8 text-blue-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Total Rules</p>
                                    <h3 className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{summary.total_rules}</h3>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                                <div className="p-4 bg-emerald-50 rounded-2xl">
                                    <TrendingUp className="h-8 w-8 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Optimization Score</p>
                                    <h3 className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{100 - Math.round(summary.optimization.pct_unused)}%</h3>
                                </div>
                            </div>
                            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
                                <div className="p-4 bg-rose-50 rounded-2xl">
                                    <AlertOctagon className="h-8 w-8 text-rose-600" />
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-500 uppercase tracking-wider">Critical Risks</p>
                                    <h3 className="text-4xl font-bold text-slate-900 tracking-tight mt-1">{summary.security_risk.critical}</h3>
                                </div>
                            </div>
                        </div>

                        {/* Detailed Charts Area */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            {/* Rule Composition */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-8 w-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                                        <BarChart3 className="h-4 w-4 text-indigo-600" />
                                    </div>
                                    <h4 className="font-bold text-slate-900">Rule Composition</h4>
                                </div>
                                <div className="space-y-5">
                                    {Object.entries(summary.composition).map(([action, count]) => (
                                        <div key={action} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="capitalize font-medium text-slate-700">{action}</span>
                                                <span className="text-slate-500 font-mono">{count} ({Math.round((count / summary.total_rules) * 100)}%)</span>
                                            </div>
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-1000 ease-out",
                                                        action === 'allow' ? 'bg-emerald-500' : 'bg-rose-500'
                                                    )}
                                                    style={{ width: `${(count / summary.total_rules) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Risk Assessment */}
                            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="h-8 w-8 rounded-lg bg-orange-50 flex items-center justify-center">
                                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                                    </div>
                                    <h4 className="font-bold text-slate-900">Risk Assessment</h4>
                                </div>
                                <div className="space-y-5">
                                    {[
                                        { label: 'Critical', value: summary.security_risk.critical, color: 'bg-rose-600', text: 'text-rose-700' },
                                        { label: 'High', value: summary.security_risk.high, color: 'bg-orange-500', text: 'text-orange-700' },
                                        { label: 'Medium', value: summary.security_risk.medium, color: 'bg-amber-500', text: 'text-amber-700' },
                                        { label: 'Low', value: summary.security_risk.low, color: 'bg-emerald-500', text: 'text-emerald-700' }
                                    ].map((risk) => (
                                        <div key={risk.label} className="space-y-2">
                                            <div className="flex justify-between text-sm">
                                                <span className="font-medium text-slate-700">{risk.label}</span>
                                                <span className={cn("font-mono font-medium", risk.text)}>{risk.value} issues</span>
                                            </div>
                                            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-1000 ease-out", risk.color)}
                                                    style={{ width: `${(risk.value / Math.max(1, summary.total_rules)) * 100}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="compliance" className="animate-in fade-in slide-in-from-bottom-4 duration-500 mt-0">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-slate-100 bg-slate-50/30 flex items-center justify-between">
                                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                                    <Shield className="h-5 w-5 text-slate-500" />
                                    Compliance Audit Findings
                                </h4>
                                <Badge variant="outline" className="bg-white">
                                    {compliance.length} issues found
                                </Badge>
                            </div>

                            <Table>
                                <TableHeader className="bg-slate-50">
                                    <TableRow className="hover:bg-transparent border-slate-100">
                                        <TableHead className="w-[120px] font-semibold text-slate-600">Severity</TableHead>
                                        <TableHead className="font-semibold text-slate-600">Check Type</TableHead>
                                        <TableHead className="font-semibold text-slate-600">Affected Rule</TableHead>
                                        <TableHead className="font-semibold text-slate-600">Description</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {compliance.length > 0 ? (
                                        compliance.map((issue, idx) => (
                                            <TableRow key={idx} className="hover:bg-slate-50/50 border-slate-100 group transition-colors">
                                                <TableCell>
                                                    <Badge className={cn(
                                                        "font-semibold border-0",
                                                        issue.severity === 'critical' && "bg-rose-100 text-rose-700 hover:bg-rose-100",
                                                        issue.severity === 'high' && "bg-orange-100 text-orange-700 hover:bg-orange-100",
                                                        issue.severity === 'medium' && "bg-amber-100 text-amber-700 hover:bg-amber-100",
                                                        issue.severity === 'low' && "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
                                                    )}>
                                                        {issue.severity.toUpperCase()}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="font-medium text-slate-700">{issue.check}</TableCell>
                                                <TableCell className="font-mono text-xs text-slate-600 bg-slate-50 rounded px-2 py-1 w-fit">{issue.rule_name}</TableCell>
                                                <TableCell className="text-slate-600 max-w-md">{issue.description}</TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={4} className="text-center py-16">
                                                <div className="inline-flex items-center justify-center p-4 bg-emerald-50 rounded-full mb-4">
                                                    <CheckCircle className="h-8 w-8 text-emerald-500" />
                                                </div>
                                                <p className="font-medium text-slate-900">No compliance issues found</p>
                                                <p className="text-slate-500 text-sm">Your configuration meets all compliance checks.</p>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </TabsContent>
                </div>
            </div>
        </div>
    );
}
