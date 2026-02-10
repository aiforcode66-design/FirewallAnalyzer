import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import {
    Trash2,
    Search,
    CheckCircle,
    Clock,
    BarChart3,

    X,
    Loader2,
    AlertTriangle,
    Info,
    AlertOctagon,
    Filter,
    Eye
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cleanupService, type UnusedRule } from '@/services/cleanupService';
import { cn } from '@/lib/utils';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';

interface UnusedRulesViewProps {
    deviceId: string;
    onUpdateStats?: (count: number) => void;
}

export default function UnusedRulesView({ deviceId, onUpdateStats }: UnusedRulesViewProps) {
    const [rules, setRules] = useState<UnusedRule[]>([]);
    const [selectedRules, setSelectedRules] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasAnalysis, setHasAnalysis] = useState<boolean | null>(null);
    const [hasUsageData, setHasUsageData] = useState<boolean | null>(null);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [retentionDays, setRetentionDays] = useState(90);
    const limit = 50;
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // New state for total count
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        checkAnalysisAndFetch();
    }, [deviceId]);

    useEffect(() => {
        if (hasAnalysis) {
            fetchData();
        }
    }, [page, retentionDays]);

    useEffect(() => {
        if (onUpdateStats && hasUsageData !== null) {
            onUpdateStats(hasUsageData ? totalCount : 0);
        }
    }, [totalCount, hasUsageData, onUpdateStats]);

    const checkAnalysisAndFetch = async () => {
        try {
            setLoading(true);
            const historyRes = await apiClient.get<any[]>(`/api/analyzer/device/${deviceId}?limit=1`);
            const analysisExists = historyRes.data && historyRes.data.length > 0;
            setHasAnalysis(analysisExists);

            try {
                const usageStatus = await cleanupService.getUsageStatus(deviceId);
                setHasUsageData(usageStatus.hasUsageData);
            } catch (err) {
                console.error('Failed to check usage status:', err);
                setHasUsageData(null);
            }

            if (analysisExists) {
                await fetchData();
            } else {
                setRules([]);
            }
        } catch (error) {
            console.error('Failed to check analysis:', error);
            setHasAnalysis(false);
        } finally {
            setLoading(false);
        }
    };

    const fetchData = async () => {
        try {
            setLoading(true);
            // Limit is 50.
            const { rules: rulesData, total } = await cleanupService.getUnusedRules(deviceId, page * limit, limit, retentionDays);

            setTotalCount(total);
            setRules(rulesData);
            setHasMore(rulesData.length === limit && (page + 1) * limit < total);

        } catch (error) {
            console.error("Failed to fetch unused rules:", error);
        } finally {
            setLoading(false);
        }
    };

    const toggleRule = (ruleId: string) => {
        setSelectedRules((prev) =>
            prev.includes(ruleId) ? prev.filter((id) => id !== ruleId) : [...prev, ruleId]
        );
    };

    const toggleSelectAll = () => {
        if (selectedRules.length === rules.length && rules.length > 0) {
            setSelectedRules([]);
        } else {
            setSelectedRules(rules.map(r => r.id));
        }
    };

    const filteredRules = rules.filter((rule) => {
        return rule.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            rule.id.toLowerCase().includes(searchQuery.toLowerCase());
    });

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            const result = await cleanupService.cleanupRules(selectedRules);
            if (result.success) {
                toast.success("Change Request Created. Waiting for approval.");
                setIsDeleteDialogOpen(false);
                setSelectedRules([]);
                // Do not remove rules immediately - waiting for approval
                // fetchData(); 
            } else {
                toast.error(`Cleanup failed: ${result.message}`);
            }
        } catch (error) {
            console.error("Cleanup execution failed:", error);
            toast.error("Failed to delete rules");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleNextPage = () => {
        if (hasMore) setPage(p => p + 1);
    };

    const handlePrevPage = () => {
        if (page > 0) setPage(p => p - 1);
    };

    // --- Visualization Data ---
    const savingsData = useMemo(() => {
        const total = totalCount; // Use total backend count
        const selected = selectedRules.length;
        // ... (rest of savingsData)
        return [
            { name: 'Rules', value: total, fill: '#e2e8f0' },
            { name: 'To Clean', value: selected, fill: '#f97316' },
        ];
    }, [totalCount, selectedRules]);

    const potentialMemorySavings = selectedRules.length * 212; // Bytes
    const savingsDisplay = potentialMemorySavings > 1024
        ? `${(potentialMemorySavings / 1024).toFixed(2)} KB`
        : `${potentialMemorySavings} B`;

    // Stats for cards
    // RAM Savings based on SELECTION now, per user request
    const selectedSavingsBytes = selectedRules.length * 212;
    const formattedSelectedSavings = selectedSavingsBytes > 1024
        ? `${(selectedSavingsBytes / 1024).toFixed(2)} KB`
        : `${selectedSavingsBytes} B`;

    const avgDays = rules.length ? Math.floor(rules.reduce((acc, r) => acc + (r.daysUnused || 0), 0) / rules.length) : 0;

    // ... 

    // Check for explicit "false" (checked and not found)
    const showNoHitDataAlert = hasUsageData === false;

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">Cleanup Assistant</h2>
                    <p className="text-gray-500 mt-1">Identify and safely remove unused policy rules to optimize performance.</p>
                </div>
                {hasAnalysis && (
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                        <div className="px-3 py-1 bg-orange-50 rounded-md border border-orange-100">
                            <span className="text-xs font-semibold text-orange-600 uppercase">Potential Savings</span>
                            <div className="text-lg font-bold text-orange-700">{savingsDisplay}</div>
                        </div>
                        <div className="h-8 w-px bg-gray-200 mx-2"></div>
                        <div className="h-12 w-24">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={savingsData}>
                                    <Bar dataKey="value" radius={[4, 4, 0, 0]} isAnimationActive={false}>
                                        {savingsData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </div>

            {!hasAnalysis ? (
                <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                    <div className="p-4 bg-orange-100 rounded-full mb-4">
                        <AlertOctagon className="h-8 w-8 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">No Unused Rules Data</h3>
                    <p className="text-gray-500 max-w-md text-center mb-6">
                        Start an analysis to check for rules that have not been matched by any traffic.
                    </p>
                    <Button
                        onClick={() => {
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                            toast.info("Click 'Start Analysis' at the top of the page to begin.");
                        }}
                        variant="outline"
                        className="gap-2"
                    >
                        How to analyze?
                    </Button>
                </div>
            ) : (
                <>
                    {/* Warning: No Hit Data Detected */}
                    {showNoHitDataAlert && (
                        <Alert variant="destructive" className="mb-6 border-orange-200 bg-orange-50">
                            <AlertTriangle className="h-4 w-4 text-orange-600" />
                            <AlertTitle className="text-orange-800 font-semibold">No hit count detected</AlertTitle>
                            <AlertDescription className="text-orange-700">
                                No hit count data found for these rules. Please upload <code>show access-list</code> output to see accurate usage statistics.
                            </AlertDescription>
                        </Alert>
                    )}

                    {!showNoHitDataAlert && (
                        <>
                            {/* Stats Cards */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { label: 'Unused Rules (Total)', value: totalCount, icon: Trash2, color: 'text-red-600' },
                                    { label: 'Selected', value: selectedRules.length, icon: CheckCircle, color: 'text-orange-600' },
                                    { label: 'Days Unused (Avg)', value: avgDays, icon: Clock, color: 'text-blue-600' },
                                    {
                                        label: 'Selected RAM Saving',
                                        value: formattedSelectedSavings,
                                        icon: BarChart3,
                                        color: 'text-green-600',
                                        tooltip: "Estimated RAM savings for the SELECTED rules only (approx 212 bytes per rule)."
                                    },
                                ].map((stat) => (
                                    <Card key={stat.label} className="hover:shadow-md transition-shadow">
                                        <CardContent className="p-4">
                                            <div className="flex justify-between items-start">
                                                <stat.icon className={cn('h-6 w-6 mb-2', stat.color)} />
                                                {stat.tooltip && (
                                                    <TooltipProvider>
                                                        <Tooltip delayDuration={300}>
                                                            <TooltipTrigger asChild>
                                                                <Info className="h-4 w-4 text-gray-400 cursor-help" />
                                                            </TooltipTrigger>
                                                            <TooltipContent className="max-w-[200px]">
                                                                <p>{stat.tooltip}</p>
                                                            </TooltipContent>
                                                        </Tooltip>
                                                    </TooltipProvider>
                                                )}
                                            </div>
                                            <p className="text-sm text-gray-500">{stat.label}</p>
                                            <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>

                            {/* Filters Bar */}
                            <Card className="shadow-sm border-gray-200">
                                <CardContent className="p-4 flex flex-wrap gap-4 items-center justify-between">
                                    <div className="flex items-center gap-4 flex-1 min-w-[300px]">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            <Input
                                                placeholder="Search rules by name, IP, or port..."
                                                className="pl-10"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-md border border-gray-200">
                                            <Filter className="h-4 w-4 text-gray-500" />
                                            <span className="text-sm text-gray-600">Unused for (days):</span>
                                            <Input
                                                type="number"
                                                className="w-20 h-8 text-sm"
                                                value={retentionDays}
                                                onChange={(e) => setRetentionDays(Number(e.target.value))}
                                                min={1}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Select All Checkbox */}
                                        <div className="flex items-center gap-2 mr-4 border-r pr-4 border-gray-200">
                                            <Checkbox
                                                checked={rules.length > 0 && selectedRules.length === rules.length}
                                                onCheckedChange={toggleSelectAll}
                                                id="select-all"
                                            />
                                            <label htmlFor="select-all" className="text-sm text-gray-600 cursor-pointer select-none">
                                                Select All Page
                                            </label>
                                        </div>

                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handlePrevPage}
                                            disabled={page === 0 || loading}
                                        >
                                            Previous
                                        </Button>
                                        <span className="text-sm text-gray-500">Page {page + 1}</span>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleNextPage}
                                            disabled={!hasMore || loading}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>





                            {/* Rules List - Table Layout */}
                            <div className="rounded-md border border-gray-200 overflow-hidden bg-white shadow-sm">
                                <Table>
                                    <TableHeader className="bg-gray-50/50">
                                        <TableRow>
                                            <TableHead className="w-[40px] px-4">
                                                <Checkbox
                                                    checked={rules.length > 0 && selectedRules.length === rules.length}
                                                    onCheckedChange={toggleSelectAll}
                                                />
                                            </TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[250px]">Rule Name</TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[200px]">Source</TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[200px]">Destination</TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[120px]">Service</TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[120px]">Stats</TableHead>
                                            <TableHead className="font-semibold text-gray-700 w-[120px]">Last Hit</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {loading ? (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-24 text-center">
                                                    <div className="flex justify-center">
                                                        <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ) : filteredRules.length > 0 ? (
                                            filteredRules.map((rule) => {
                                                const isSelected = selectedRules.includes(rule.id);
                                                const days = rule.daysUnused || 0;
                                                const isSafe = days > 90;

                                                return (
                                                    <TableRow
                                                        key={rule.id}
                                                        className={cn(
                                                            "hover:bg-gray-50/50 cursor-pointer transition-colors",
                                                            isSelected && "bg-orange-50/30 hover:bg-orange-50/50"
                                                        )}
                                                        onClick={() => toggleRule(rule.id)}
                                                    >
                                                        <TableCell className="px-4 py-3">
                                                            <Checkbox
                                                                checked={isSelected}
                                                                onCheckedChange={() => toggleRule(rule.id)}
                                                                className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium text-gray-900 py-3">
                                                            <div className="truncate max-w-[230px]" title={rule.name}>
                                                                {rule.name}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shrink-0" />
                                                                <span className="truncate max-w-[180px] font-mono text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title={rule.source}>
                                                                    {rule.source}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <div className="flex items-center gap-2">
                                                                <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                                                                <span className="truncate max-w-[180px] font-mono text-xs text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100" title={rule.destination}>
                                                                    {rule.destination}
                                                                </span>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <Badge variant="outline" className="font-mono text-[10px] bg-white text-gray-500 border-gray-200">
                                                                {rule.service}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            <Badge
                                                                variant="default"
                                                                className={cn(
                                                                    "font-mono text-[10px] px-2 py-0.5 hover:bg-opacity-80 transition-colors pointer-events-none",
                                                                    isSafe ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                                                                )}
                                                            >
                                                                {days} Days
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell className="py-3">
                                                            {rule.lastHit ? (
                                                                <span className="text-xs text-gray-500 flex items-center gap-1">
                                                                    <Clock className="h-3 w-3 text-gray-400" />
                                                                    {new Date(rule.lastHit).toLocaleDateString()}
                                                                </span>
                                                            ) : (
                                                                <span className="text-xs text-gray-300 italic">Never</span>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-3 text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-8 w-8 text-gray-400 hover:text-orange-600"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    // Add view details logic later
                                                                }}
                                                            >
                                                                <Eye className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={8} className="h-32 text-center">
                                                    <div className="flex flex-col items-center justify-center text-gray-500">
                                                        <CheckCircle className="h-8 w-8 text-green-500 mb-2" />
                                                        <p>No unused rules found matching your filters.</p>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            {/* Bulk Actions Floating Bar */}
                            {selectedRules.length > 0 && (
                                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-6 py-3 rounded-full shadow-2xl border border-gray-200 flex items-center gap-6 animate-in slide-in-from-bottom-10 z-50">
                                    <span className="font-medium text-sm">
                                        <span className="text-orange-600 font-bold">{selectedRules.length}</span> rules selected
                                    </span>
                                    <div className="h-4 w-px bg-gray-200"></div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-gray-500 hover:text-gray-900"
                                        onClick={() => setSelectedRules([])}
                                    >
                                        <X className="h-4 w-4 mr-2" />
                                        Cancel
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-red-600 hover:bg-red-700 text-white gap-2 rounded-full px-4 shadow-lg shadow-red-100"
                                        onClick={() => setIsDeleteDialogOpen(true)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                        Request Cleanup
                                    </Button>
                                </div>
                            )}

                            {/* Delete Confirmation Dialog */}
                            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-red-600">
                                            <AlertTriangle className="h-5 w-5" />
                                            Confirm Cleanup
                                        </DialogTitle>
                                        <DialogDescription>
                                            Are you sure you want to request deletion for {selectedRules.length} rule
                                            {selectedRules.length > 1 ? 's' : ''}?
                                            This will create a pending Change Request.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="p-4 bg-blue-50 rounded-lg">
                                        <p className="text-sm text-blue-700 font-medium">
                                            Action: Create Change Request (Pending Approval)
                                        </p>
                                        <p className="text-xs text-blue-600 mt-1">
                                            Rules will NOT be deleted immediately. An approval is required in Change Management.
                                        </p>
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                                            Cancel
                                        </Button>
                                        <Button variant="default" onClick={handleDelete} disabled={isDeleting} className="bg-blue-600 hover:bg-blue-700">
                                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                                            {isDeleting ? 'Creating Request...' : 'Request Deletion'}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </>
                    )}
                </>
            )}
        </div>
    );
}
