import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
    ShieldCheck,
    Zap,
    Activity,
    ChevronRight,
    ArrowUpRight,
    ShieldAlert,
    Clock,
    CheckCircle2
} from 'lucide-react';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer
} from 'recharts';

interface DeviceOverviewProps {
    stats: any;
    counts: any;
    hasAnalysis: boolean;
    onNavigate: (tab: string) => void;
}

export default function DeviceOverview({ stats, counts, hasAnalysis, onNavigate }: DeviceOverviewProps) {
    // Calculate Security Score (Mock logic based on risks)
    // 100 - (Critical * 10) - (High * 5) - (Medium * 2) - (Low * 1)
    // But constrained between 0 and 100
    const criticalRisks = counts.criticalRisks || 0;
    const score = Math.max(0, 100 - (criticalRisks * 10));

    // Determine Status Color
    const getScoreColor = (s: number) => {
        if (s >= 80) return 'text-green-600';
        if (s >= 50) return 'text-orange-500';
        return 'text-red-600';
    };

    const getScoreBg = (s: number) => {
        if (s >= 80) return 'bg-green-100 text-green-700';
        if (s >= 50) return 'bg-orange-100 text-orange-700';
        return 'bg-red-100 text-red-700';
    };

    // Optimization Score (simple ratio of used/total rules)
    const totalRules = stats?.totalRulesCount || 100;
    const unusedRules = counts.unusedRules || 0;
    const optimizationScore = Math.round(((totalRules - unusedRules) / totalRules) * 100) || 100;

    // Mock Chart Data if empty
    const activityData = [
        { day: 'Mon', hits: 120 },
        { day: 'Tue', hits: 145 },
        { day: 'Wed', hits: 132 },
        { day: 'Thu', hits: 190 },
        { day: 'Fri', hits: 165 },
        { day: 'Sat', hits: 85 },
        { day: 'Sun', hits: 95 },
    ];

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Strip - The "Clean" Dashboard Header */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* 1. Security Score */}
                <Card className="shadow-sm border-none bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldCheck className={`h-16 w-16 ${hasAnalysis ? getScoreColor(score) : 'text-gray-300'}`} />
                    </div>
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Security Score</p>
                        {hasAnalysis ? (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className={`text-3xl font-bold ${getScoreColor(score)}`}>{score}</h2>
                                    <span className="text-sm text-gray-400">/ 100</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2">
                                    <Badge variant="outline" className={`${getScoreBg(score)} border-none`}>
                                        {score >= 80 ? 'Good' : score >= 50 ? 'Needs Attention' : 'Critical'}
                                    </Badge>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className="text-3xl font-bold text-gray-300">--</h2>
                                    <span className="text-sm text-gray-400">/ 100</span>
                                </div>
                                <div className="mt-4 text-sm text-gray-400 italic">
                                    Run analysis to calculate
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 2. Risk Profile */}
                <Card className="shadow-sm border-none bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <ShieldAlert className="h-16 w-16 text-red-600" />
                    </div>
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Critical Risks</p>
                        {hasAnalysis ? (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className="text-3xl font-bold text-gray-900">{criticalRisks}</h2>
                                    <span className="text-sm text-gray-400">Issues</span>
                                </div>
                                <div className="mt-4 w-full">
                                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                                        <span>Impact Level</span>
                                        <span className={criticalRisks > 0 ? "text-red-500 font-medium" : "text-green-500"}>
                                            {criticalRisks > 5 ? 'High' : criticalRisks > 0 ? 'Moderate' : 'Low'}
                                        </span>
                                    </div>
                                    <Progress value={Math.min(100, criticalRisks * 10)} className="h-1.5" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className="text-3xl font-bold text-gray-300">--</h2>
                                    <span className="text-sm text-gray-400">Issues</span>
                                </div>
                                <div className="mt-4 text-sm text-gray-400 italic">
                                    Run analysis to calculate
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Optimization */}
                <Card className="shadow-sm border-none bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Zap className="h-16 w-16 text-blue-500" />
                    </div>
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Optimization</p>
                        {hasAnalysis ? (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className="text-3xl font-bold text-gray-900">{optimizationScore}%</h2>
                                    <span className="text-sm text-gray-400">Efficiency</span>
                                </div>
                                <div className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-blue-600 cursor-pointer transition-colors" onClick={() => onNavigate('unused')}>
                                    <span>{counts.unusedRules + counts.redundantRules + counts.shadowedRules} Items to clean</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="flex items-baseline gap-2 mt-2">
                                    <h2 className="text-3xl font-bold text-gray-300">--</h2>
                                    <span className="text-sm text-gray-400">Efficiency</span>
                                </div>
                                <div className="mt-4 text-sm text-gray-400 italic">
                                    Run analysis to calculate
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* 4. Health / Uptime */}
                <Card className="shadow-sm border-none bg-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <Activity className="h-16 w-16 text-green-500" />
                    </div>
                    <CardContent className="p-5">
                        <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">System Health</p>
                        <div className="flex items-baseline gap-2 mt-2">
                            <h2 className="text-3xl font-bold text-gray-900">100%</h2>
                            <span className="text-sm text-gray-400">Uptime</span>
                        </div>
                        <div className="mt-4 flex items-center gap-2 overflow-hidden">
                            <div className="flex gap-0.5">
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} className={`w-1 h-3 rounded-sm ${Math.random() > 0.9 ? 'bg-yellow-400' : 'bg-green-400'}`} title="Hourly Status" />
                                ))}
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content Grid: Chart vs Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column: Activity Chart */}
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-none shadow-sm bg-white h-full">
                        <CardHeader>
                            <CardTitle className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <Activity className="h-5 w-5 text-gray-500" />
                                Rule Activity Trend
                            </CardTitle>
                            <CardDescription>Traffic hit counts over the last 7 days</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[300px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={activityData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                        <XAxis
                                            dataKey="day"
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                            dy={10}
                                        />
                                        <YAxis
                                            axisLine={false}
                                            tickLine={false}
                                            tick={{ fill: '#6B7280', fontSize: 12 }}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                                            }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="hits"
                                            stroke="#F97316"
                                            strokeWidth={3}
                                            dot={{ r: 4, fill: '#fff', stroke: '#F97316', strokeWidth: 2 }}
                                            activeDot={{ r: 6, fill: '#F97316' }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column: Action Center */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-gray-800 ml-1">Recommended Actions</h3>

                    {/* Show placeholder if no analysis */}
                    {!hasAnalysis && (
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-gray-100 rounded-lg">
                                    <Activity className="h-5 w-5 text-gray-400" />
                                </div>
                                <div>
                                    <h4 className="font-semibold text-gray-600">Run Analysis First</h4>
                                    <p className="text-sm text-gray-400">Click "Start Analysis" to get recommendations.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action 1: Critical Risks */}
                    {hasAnalysis && criticalRisks > 0 && (
                        <div
                            className="bg-white p-4 rounded-xl border border-red-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => onNavigate('critical')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-red-50 rounded-lg group-hover:bg-red-100 transition-colors">
                                        <ShieldAlert className="h-5 w-5 text-red-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 group-hover:text-red-700 transition-colors">Review Critical Risks</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {criticalRisks} critical issues require immediate attention.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500" />
                            </div>
                        </div>
                    )}

                    {/* Action 2: Unused Rules */}
                    {hasAnalysis && counts.unusedRules > 0 && (
                        <div
                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => onNavigate('unused')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-orange-50 rounded-lg group-hover:bg-orange-100 transition-colors">
                                        <Clock className="h-5 w-5 text-orange-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 group-hover:text-orange-700 transition-colors">Cleanup Unused Rules</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {counts.unusedRules} rules have zero hits. Remove them to reduce attack surface.
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500" />
                            </div>
                        </div>
                    )}

                    {/* Action 3: Shadowed / Redundant */}
                    {hasAnalysis && (counts.shadowedRules > 0 || counts.redundantRules > 0) && (
                        <div
                            className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                            onClick={() => onNavigate(counts.shadowedRules > 0 ? 'shadowed' : 'redundan')}
                        >
                            <div className="flex justify-between items-start">
                                <div className="flex gap-3">
                                    <div className="p-2 bg-blue-50 rounded-lg group-hover:bg-blue-100 transition-colors">
                                        <Zap className="h-5 w-5 text-blue-600" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">Optimize Logic</h4>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {counts.shadowedRules + counts.redundantRules} logic issues detected (Shadowed/Redundant).
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="h-5 w-5 text-gray-300 group-hover:text-gray-500" />
                            </div>
                        </div>
                    )}

                    {/* Action 4: All Clear (if no issues) */}
                    {hasAnalysis && criticalRisks === 0 && counts.unusedRules === 0 && (
                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 shadow-sm">
                            <div className="flex items-center gap-3">
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                                <div>
                                    <h4 className="font-semibold text-green-800">System Healthy</h4>
                                    <p className="text-sm text-green-700">No immediate optimizations required.</p>
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>
        </div>
    );
}
