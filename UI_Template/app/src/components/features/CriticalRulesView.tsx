import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    AlertTriangle,
    Loader2,
    ShieldAlert,
    AlertOctagon,
    AlertCircle,
    CheckCircle,
    Activity,
    Search,
    ShieldCheck,
    ChevronDown,
    ChevronUp,
    FileText,
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { toast } from 'sonner';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
// Sheet imports removed as we reverted to Accordion view
import { cn } from '@/lib/utils';


interface CriticalRulesViewProps {
    deviceId: string;
}

interface AssessmentFinding {
    id: string;
    type: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    message: string;
    recommendation: string;
    rule_content?: string;
}

export default function CriticalRulesView({ deviceId }: CriticalRulesViewProps) {
    const [findings, setFindings] = useState<AssessmentFinding[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAnalysis, setHasAnalysis] = useState<boolean | null>(null);
    const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

    const toggleExpand = (id: string) => {
        const newExpanded = new Set(expandedItems);
        if (newExpanded.has(id)) {
            newExpanded.delete(id);
        } else {
            newExpanded.add(id);
        }
        setExpandedItems(newExpanded);
    };

    useEffect(() => {
        if (deviceId) {
            checkAnalysisAndFetch();
        }
    }, [deviceId]);

    const checkAnalysisAndFetch = async () => {
        try {
            setLoading(true);
            const historyRes = await apiClient.get<any[]>(`/api/analyzer/device/${deviceId}?limit=1`);
            const analysisExists = historyRes.data && historyRes.data.length > 0;
            setHasAnalysis(analysisExists);

            if (analysisExists) {
                const response = await apiClient.get<AssessmentFinding[]>(`/api/analyzer/${deviceId}/critical-risks`);
                setFindings(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch data:', error);
            toast.error('Failed to load analysis data');
        } finally {
            setLoading(false);
        }
    };

    const stats = useMemo(() => {
        const counts = { critical: 0, high: 0, medium: 0, low: 0 };
        findings.forEach(f => {
            const sev = f.severity.toLowerCase() as keyof typeof counts;
            if (counts[sev] !== undefined) counts[sev]++;
        });

        // Calculate Risk Score (0-100), where 100 is best (safe)
        // Penalty: Critical=25, High=10, Medium=5, Low=1
        const totalPenalty = (counts.critical * 25) + (counts.high * 10) + (counts.medium * 5) + (counts.low * 1);
        const score = Math.max(0, 100 - totalPenalty);

        return { counts, score };
    }, [findings]);

    const getScoreColor = (score: number) => {
        if (score >= 90) return '#10b981'; // Emerald
        if (score >= 70) return '#f59e0b'; // Amber
        if (score >= 50) return '#f97316'; // Orange
        return '#ef4444'; // Red
    };

    const gaugeData = [
        { name: 'Score', value: stats.score },
        { name: 'Gap', value: 100 - stats.score }
    ];

    // Removed unused expandedItems state
    // Removed unused toggleExpand function since table doesn't use accordion logic anymore

    if (loading) {
        return (
            <div className="flex justify-center py-24">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-10 w-10 animate-spin text-orange-500" />
                    <p className="text-gray-500 animate-pulse">Calculating security posture...</p>
                </div>
            </div>
        );
    }

    if (hasAnalysis === false) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                <div className="p-4 bg-blue-50 rounded-full mb-4">
                    <Activity className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Required</h3>
                <p className="text-gray-500 max-w-md text-center mb-6">
                    Run a comprehensive analysis to calculate your Security Risk Score and identify critical vulnerabilities.
                </p>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Search className="h-4 w-4" />
                    Start Analysis
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* ... Header and Summary Sections remain unchanged ... */}
            <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Security Dashboard</h2>
                <p className="text-gray-500 mt-1">Real-time assessment of your firewall's configuration security posture.</p>
            </div>

            <Card className="bg-white shadow-sm border border-gray-200 overflow-hidden">
                <div className="flex flex-col lg:flex-row divide-y lg:divide-y-0 lg:divide-x divide-gray-100">

                    {/* Security Score Section - Compact */}
                    <div className="p-6 flex items-center gap-6 lg:w-1/3 min-w-fit">
                        <div className="h-24 w-24 relative flex-shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={gaugeData}
                                        cx="50%"
                                        cy="50%"
                                        startAngle={180}
                                        endAngle={0}
                                        innerRadius={35}
                                        outerRadius={45}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                        cornerRadius={4}
                                    >
                                        <Cell key="score" fill={getScoreColor(stats.score)} />
                                        <Cell key="gap" fill="#f3f4f6" />
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pt-4">
                                <span className="text-2xl font-bold text-gray-900 leading-none">{stats.score}</span>
                            </div>
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Security Score</h3>
                            <p className="text-sm text-gray-500 mb-1">Based on {findings.length} findings</p>
                            <Badge variant="outline" className={cn(
                                "capitalize font-medium",
                                stats.score >= 90 ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                                    stats.score >= 70 ? "bg-amber-50 text-amber-700 border-amber-200" :
                                        stats.score >= 50 ? "bg-orange-50 text-orange-700 border-orange-200" : "bg-red-50 text-red-700 border-red-200"
                            )}>
                                {stats.score >= 90 ? 'Excellent' : stats.score >= 70 ? 'Good' : stats.score >= 50 ? 'Fair' : 'Critical'} POSTURE
                            </Badge>
                        </div>
                    </div>

                    {/* Stats Grid - Horizontal */}
                    <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 divide-x divide-gray-100 bg-gray-50/30">
                        <div className="p-4 flex flex-col items-center justify-center hover:bg-white transition-colors">
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                                <AlertOctagon className="h-4 w-4 text-red-500" /> Critical
                            </span>
                            <span className="text-2xl font-bold text-gray-900">{stats.counts.critical}</span>
                        </div>
                        <div className="p-4 flex flex-col items-center justify-center hover:bg-white transition-colors">
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                                <ShieldAlert className="h-4 w-4 text-orange-500" /> High
                            </span>
                            <span className="text-2xl font-bold text-gray-900">{stats.counts.high}</span>
                        </div>
                        <div className="p-4 flex flex-col items-center justify-center hover:bg-white transition-colors">
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" /> Medium
                            </span>
                            <span className="text-2xl font-bold text-gray-900">{stats.counts.medium}</span>
                        </div>
                        <div className="p-4 flex flex-col items-center justify-center hover:bg-white transition-colors">
                            <span className="flex items-center gap-2 text-sm font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                                <AlertCircle className="h-4 w-4 text-blue-500" /> Low
                            </span>
                            <span className="text-2xl font-bold text-gray-900">{stats.counts.low}</span>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Findings List Section */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Detailed Findings</h3>
                    <Badge variant="outline" className="px-3 py-1">
                        Total {findings.length} findings
                    </Badge>
                </div>

                {findings.length > 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm divide-y divide-gray-100">
                        {findings.map((finding) => {
                            const isExpanded = expandedItems.has(finding.id);
                            return (
                                <div key={finding.id} className="group transition-colors duration-200 hover:bg-slate-50">
                                    {/* Compact Row Header */}
                                    <div
                                        className="p-4 flex items-center gap-4 cursor-pointer select-none"
                                        onClick={() => toggleExpand(finding.id)}
                                    >
                                        {/* Icon */}
                                        <div className="flex-shrink-0">
                                            {finding.severity === 'critical' && <AlertOctagon className="h-5 w-5 text-red-600" />}
                                            {finding.severity === 'high' && <ShieldAlert className="h-5 w-5 text-orange-600" />}
                                            {finding.severity === 'medium' && <AlertTriangle className="h-5 w-5 text-yellow-600" />}
                                            {finding.severity === 'low' && <AlertCircle className="h-5 w-5 text-blue-600" />}
                                        </div>

                                        {/* Main Info */}
                                        <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                                            <div className="md:col-span-1">
                                                <div className="flex items-center gap-2">
                                                    <Badge className={cn(
                                                        "uppercase text-[10px] px-1.5 py-0.5 h-5",
                                                        finding.severity === 'critical' ? "bg-red-100 text-red-700 hover:bg-red-100" :
                                                            finding.severity === 'high' ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
                                                                finding.severity === 'medium' ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-100" : "bg-blue-100 text-blue-700 hover:bg-blue-100"
                                                    )}>
                                                        {finding.severity}
                                                    </Badge>
                                                    <span className="text-xs text-gray-400 font-mono truncate hidden sm:inline-block">
                                                        {finding.type}
                                                    </span>
                                                </div>
                                            </div>

                                            <div className="md:col-span-3">
                                                <p className="text-sm font-medium text-gray-900 truncate">
                                                    {finding.message}
                                                </p>
                                            </div>
                                        </div>

                                        {/* Expand Toggle */}
                                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-gray-400 group-hover:text-gray-600">
                                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                        </Button>
                                    </div>

                                    {/* Expanded Details */}
                                    {isExpanded && (
                                        <div className="px-4 pb-4 pt-0 sm:px-12 animate-in slide-in-from-top-2 duration-200">
                                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-100 space-y-4">

                                                {/* Full Message & ID */}
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Issue Detected</span>
                                                        <span className="text-xs text-gray-400 font-mono">ID: {finding.id}</span>
                                                    </div>
                                                    <p className="text-sm text-gray-700 leading-relaxed">
                                                        {finding.message}
                                                    </p>
                                                </div>

                                                {/* Recommendation */}
                                                <div className="flex items-start gap-3 bg-white p-3 rounded border border-green-100 shadow-sm">
                                                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                                                    <div>
                                                        <h5 className="text-sm font-semibold text-green-900 mb-0.5">Recommended Action</h5>
                                                        <p className="text-sm text-gray-600">
                                                            {finding.recommendation}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Inline Raw Rule */}
                                                <div className="mt-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <FileText className="h-4 w-4 text-gray-500" />
                                                        <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Raw Rule Content</span>
                                                    </div>
                                                    <div className="bg-slate-950 text-slate-50 p-4 rounded-md font-mono text-sm overflow-x-auto border border-slate-800 shadow-inner">
                                                        {finding.rule_content || "No raw content available."}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="py-12 bg-green-50 border border-green-100 rounded-xl text-center">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <ShieldCheck className="h-8 w-8 text-green-600" />
                        </div>
                        <h3 className="text-lg font-medium text-green-900">All Clear</h3>
                        <p className="text-green-700 max-w-sm mx-auto mt-2">
                            No active security risks were detected in your configuration. Great job keeping your policy secure!
                        </p>
                    </div>
                )}
            </div>

            {/* Sheet component removed */}
        </div>
    );
}
