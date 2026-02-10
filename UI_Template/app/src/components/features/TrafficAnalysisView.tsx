
import { useState, useMemo } from 'react';
import {
    Upload,
    RefreshCw,
    Lightbulb,
    Layers,
    ShieldAlert,
    ShieldCheck,
    Target,
    Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from '@/components/ui/table';
import {
    BarChart as RechartsBarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts';
import { toast } from 'sonner';
import trafficService, { type TrafficAnalysisResult } from '@/services/trafficService';

interface TrafficAnalysisViewProps {
    deviceId: string;
}

export default function TrafficAnalysisView({ deviceId }: TrafficAnalysisViewProps) {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [result, setResult] = useState<TrafficAnalysisResult | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        setIsLoading(true);
        try {
            const data = await trafficService.uploadTrafficLog(deviceId, file);
            setResult(data);
            toast.success("Traffic analysis complete");
        } catch (error) {
            console.error(error);
            toast.error("Failed to analyze traffic logs");
        } finally {
            setIsLoading(false);
        }
    };

    const statsArray = useMemo(() => {
        if (!result) return [];
        return Object.entries(result.summary.rule_stats)
            .map(([id, data]) => ({ id, ...data }))
            .sort((a, b) => b.hits - a.hits);
    }, [result]);

    const topRules = useMemo(() => {
        return statsArray.slice(0, 10);
    }, [statsArray]);

    const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    if (!result) {
        return (
            <div className="space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Traffic Analysis</CardTitle>
                        <CardDescription>
                            Upload a Syslog file (e.g., Cisco ASA 'show logging' or syslog export) to analyze traffic patterns and verify rule usage.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center justify-center p-12 border-2 border-dashed rounded-lg bg-muted/50">
                        <Upload className="h-12 w-12 text-muted-foreground mb-4" />
                        <h3 className="text-lg font-medium mb-2">Upload Traffic Logs</h3>
                        <p className="text-sm text-muted-foreground mb-6 text-center max-w-md">
                            Supports Cisco ASA Syslog IDs: 106023 (Deny), 106100 (Access-List), 302013-302016 (Connection Built/Teardown).
                        </p>
                        <div className="flex items-center gap-4">
                            <input
                                type="file"
                                accept=".txt,.log"
                                onChange={handleFileChange}
                                className="hidden"
                                id="log-upload"
                            />
                            <label htmlFor="log-upload">
                                <Button variant="outline" asChild className="cursor-pointer">
                                    <span>{file ? file.name : "Select File"}</span>
                                </Button>
                            </label>
                            <Button onClick={handleAnalyze} disabled={!file || isLoading}>
                                {isLoading ? "Analyzing..." : "Start Analysis"}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const total = result.summary.total_logs;
    const denied = result.summary.denied_logs;
    const unmatched = result.summary.unmatched_logs;
    const allowed = total - denied - unmatched;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Total Logs</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{total.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">Processed lines</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-green-600">Allowed Traffic</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{allowed.toLocaleString()}</div>
                        <Progress value={(allowed / total) * 100} className="h-2 mt-2" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-red-600">Denied Traffic</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{denied.toLocaleString()}</div>
                        <Progress value={(denied / total) * 100} className="h-2 mt-2" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-amber-600">Unmatched (Implicit)</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{unmatched.toLocaleString()}</div>
                        <p className="text-xs text-muted-foreground mt-1">No specific rule found</p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Top 10 Rules by Hits</CardTitle>
                        <CardDescription>Most active firewall rules based on traffic volume</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={topRules} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={150}
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val}
                                />
                                <Tooltip
                                    formatter={(value: number) => [value.toLocaleString(), 'Hits']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="hits" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                                    {topRules.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.action === 'deny' ? '#ef4444' : '#3b82f6'} />
                                    ))}
                                </Bar>
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Traffic Volume by Rule</CardTitle>
                        <CardDescription>Top rules by total bytes transferred</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart
                                data={[...statsArray].sort((a, b) => b.bytes - a.bytes).slice(0, 10)}
                                layout="vertical"
                                margin={{ left: 20 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="name"
                                    type="category"
                                    width={150}
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(val) => val.length > 20 ? val.substring(0, 20) + '...' : val}
                                />
                                <Tooltip
                                    formatter={(value: number) => [formatBytes(value), 'Bytes']}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Bar dataKey="bytes" fill="#10b981" radius={[0, 4, 4, 0]} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>


            {/* Optimization Insights Section */}
            {result?.summary && (
                <Card className="border-l-4 border-l-amber-500">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-amber-500" />
                            Optimization Insights
                        </CardTitle>
                        <CardDescription>Actionable recommendations based on traffic pattern analysis</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(!result.summary.recommendations || result.summary.recommendations.length === 0) ? (
                            <div className="text-center py-6 text-muted-foreground bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                <ShieldCheck className="h-8 w-8 mx-auto mb-2 text-slate-300" />
                                <p>No immediate optimization opportunities detected.</p>
                                <p className="text-xs mt-1">Your traffic patterns appear consistent with current rules.</p>
                            </div>
                        ) : (
                            result.summary.recommendations.map((rec, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                                    <div className="mt-1">
                                        {rec.type === 'over_permissive' && <ShieldAlert className="h-4 w-4 text-red-500" />}
                                        {rec.type === 'frequent_deny' && <ShieldAlert className="h-4 w-4 text-orange-500" />}
                                        {rec.type === 'consolidation' && <Layers className="h-4 w-4 text-blue-500" />}
                                        {rec.type === 'tighten_scope' && <Target className="h-4 w-4 text-purple-500" />}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold text-slate-800">
                                            {rec.type === 'over_permissive' && "Over-Permissive Rule Detected"}
                                            {rec.type === 'frequent_deny' && "Frequent Deny Pattern"}
                                            {rec.type === 'consolidation' && "Consolidation Opportunity"}
                                            {rec.type === 'tighten_scope' && "Scope Tightening Recommended"}
                                            {rec.severity === 'high' && <Badge className="ml-2 bg-red-100 text-red-700 hover:bg-red-100">High Impact</Badge>}
                                        </h4>
                                        <p className="text-xs text-slate-600 mt-1">{rec.description}</p>
                                        <div className="mt-2 text-xs bg-white p-2 rounded border border-slate-200 text-slate-700">
                                            <span className="font-medium text-slate-900">Suggestion:</span> {rec.suggestion}
                                        </div>

                                        {rec.cli_commands && rec.cli_commands.length > 0 && (
                                            <div className="mt-3 bg-slate-950 rounded-md p-3 font-mono text-xs overflow-x-auto selection:bg-blue-500 selection:text-white">
                                                <div className="flex items-center gap-2 text-slate-400 mb-2 border-b border-slate-800 pb-1">
                                                    <Terminal className="h-3 w-3" />
                                                    <span>Proposed CLI Commands</span>
                                                </div>
                                                <div className="space-y-1">
                                                    {rec.cli_commands.map((cmd, cIdx) => (
                                                        <div key={cIdx} className="text-green-400 whitespace-pre-wrap flex gap-2">
                                                            <span className="select-none text-slate-600">$</span>
                                                            <span>{cmd}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Detailed Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Rule Usage Details</CardTitle>
                    <CardDescription>Comprehensive list of rule hits and activity based on logs</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Rule Name</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Source</TableHead>
                                    <TableHead>Destination</TableHead>
                                    <TableHead>Service</TableHead>
                                    <TableHead className="text-right">Hits</TableHead>
                                    <TableHead className="text-right">Bytes</TableHead>
                                    <TableHead className="text-right">Last Seen</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {statsArray.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                                            No matching rules found in logs.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    statsArray.slice(0, 50).map((rule, idx) => (
                                        <TableRow key={idx}>
                                            <TableCell className="font-medium text-xs font-mono">{rule.name}</TableCell>
                                            <TableCell>
                                                <Badge variant={rule.action === 'deny' ? 'destructive' : 'default'} className="text-[10px]">
                                                    {rule.action.toUpperCase()}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={rule.source}>{rule.source}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={rule.destination}>{rule.destination}</TableCell>
                                            <TableCell className="text-xs text-muted-foreground">{rule.service}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{rule.hits.toLocaleString()}</TableCell>
                                            <TableCell className="text-right font-mono text-xs">{formatBytes(rule.bytes)}</TableCell>
                                            <TableCell className="text-right text-xs text-muted-foreground">
                                                {rule.last_seen ? new Date(rule.last_seen).toLocaleString() : '-'}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                    {statsArray.length > 50 && (
                        <p className="text-center text-xs text-muted-foreground mt-4">Showing top 50 rules only.</p>
                    )}
                </CardContent>
            </Card>

            <div className="flex justify-end">
                <Button variant="outline" onClick={() => setResult(null)}>
                    <RefreshCw className="mr-2 h-4 w-4" /> Reset Analysis
                </Button>
            </div>
        </div >
    );
}
