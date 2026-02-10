import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { gsap } from 'gsap';
import {
    Combine,
    ArrowRight,
    CheckCircle,
    GitMerge,
    Search,
    Shield,
    Sparkles,
    RotateCcw,
    Loader2,
    Terminal
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle } from 'lucide-react';
import { mergerService, type MergeGroup } from '@/services/mergerService';
import { cn } from '@/lib/utils';

const complexityConfig = {
    low: { color: 'text-green-600', bg: 'bg-green-100', label: 'Low Risk' },
    medium: { color: 'text-orange-600', bg: 'bg-orange-100', label: 'Medium Risk' },
    high: { color: 'text-red-600', bg: 'bg-red-100', label: 'High Risk' },
};

interface MergeGroupCardProps {
    group: MergeGroup;
    index: number;
    isSelected: boolean;
    onSelect: () => void;
    showCli: boolean;
}

function MergeGroupCard({ group, index, isSelected, onSelect, showCli }: MergeGroupCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);
    const complexity = complexityConfig[group.complexity] || complexityConfig.low;

    useEffect(() => {
        if (cardRef.current) {
            gsap.fromTo(
                cardRef.current,
                { opacity: 0, y: 20 },
                {
                    opacity: 1,
                    y: 0,
                    duration: 0.5,
                    delay: index * 0.1,
                    ease: 'power3.out',
                }
            );
        }
    }, [index]);

    // Helper to format CLI command
    const formatCli = (attrs: any) => {
        // Basic Cisco ASA Format: access-list {NAME} extended {ACTION} {PROTOCOL} {SOURCE} {DEST} {SERVICE}
        const action = attrs?.action || 'permit';
        const proto = attrs?.service?.toLowerCase().includes('tcp') ? 'tcp' :
            attrs?.service?.toLowerCase().includes('udp') ? 'udp' : 'ip';
        const src = attrs?.source || 'any';
        const dst = attrs?.destination || 'any';
        const svc = attrs?.service !== 'ip' && attrs?.service !== 'any' ? `eq ${attrs?.service}` : '';

        return `access-list acl_outside extended ${action} ${proto} ${src} ${dst} ${svc}`.trim();
    };

    return (
        <Card
            ref={cardRef}
            className={cn(
                'transition-all duration-300 overflow-hidden border-l-4',
                isSelected ? 'ring-2 ring-orange-500 shadow-card-hover border-l-orange-500' : 'hover:shadow-card border-l-transparent'
            )}
        >
            <CardContent className="p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-gray-100">

                    {/* Left: Original Rules (Before) */}
                    <div className="flex-1 p-5 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <Checkbox checked={isSelected} onCheckedChange={onSelect} />
                                <Badge variant="outline" className="bg-white">
                                    Original ({group.rules.length})
                                </Badge>
                            </div>
                            <Badge className={cn('text-xs', complexity.bg, complexity.color)}>
                                {complexity.label}
                            </Badge>
                        </div>

                        {showCli ? (
                            <div className="bg-gray-900 border border-gray-800 p-4 rounded-lg shadow-sm border-l-4 border-l-gray-600">
                                <div className="flex items-center gap-2 mb-2">
                                    <Terminal className="h-4 w-4 text-gray-400" />
                                    <span className="font-semibold text-gray-200 text-sm">Original Policies</span>
                                </div>
                                <div className="font-mono text-xs text-green-400 break-all leading-relaxed max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                                    {group.rules.map(rule => (
                                        <div key={rule.id} className="mb-1 pb-1 border-b border-gray-800 last:border-0 last:mb-0 last:pb-0">
                                            {formatCli(rule)}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {group.rules.slice(0, 3).map((rule) => {
                                    // rule.action is 'allow' or 'deny'
                                    const isAllow = rule.action === 'allow' || rule.action === 'permit';
                                    return (
                                        <div key={rule.id} className="bg-white border border-gray-200 p-3 rounded-md text-sm shadow-sm opacity-80">
                                            <div className="flex items-center gap-2 mb-1">
                                                <div className={cn("w-1.5 h-1.5 rounded-full", isAllow ? 'bg-green-500' : 'bg-red-500')} />
                                                <span className="font-mono text-xs text-gray-500 truncate w-32" title={rule.name}>{rule.name}</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                                                <span className="truncate" title={rule.source}>Src: {rule.source}</span>
                                                <span className="truncate" title={rule.destination}>Dst: {rule.destination}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                                {group.rules.length > 3 && (
                                    <div className="text-center text-xs text-gray-400 py-1">
                                        + {group.rules.length - 3} more...
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Center: Merge Action */}
                    <div className="relative flex items-center justify-center p-4 bg-white md:w-16">
                        <div className="absolute inset-0 bg-gradient-to-r from-gray-50/50 to-white pointer-events-none md:hidden" />
                        <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center z-10 shadow-sm border border-orange-200">
                            <ArrowRight className="h-4 w-4 text-orange-600 md:rotate-0 rotate-90" />
                        </div>
                    </div>

                    {/* Right: Proposed Rule (After) */}
                    <div className="flex-1 p-5 bg-white">
                        <div className="flex items-center justify-between mb-4">
                            <Badge className="bg-orange-100 text-orange-700 hover:bg-orange-200 border-orange-200">
                                <Sparkles className="h-3 w-3 mr-1" />
                                Optimized Rule
                            </Badge>

                            <div className="flex items-center gap-3">
                                <span className="text-xs font-semibold text-green-600 hidden sm:inline-block">
                                    Saves {group.potential_savings} lines
                                </span>
                            </div>
                        </div>

                        <div className={cn(
                            "p-4 rounded-lg shadow-sm border-l-4 transition-all duration-300",
                            showCli ? "bg-gray-900 border-gray-800 border-l-blue-500" : "bg-green-50/50 border-green-100 border-l-green-500"
                        )}>
                            <div className="flex items-center gap-2 mb-2">
                                {showCli ? (
                                    <>
                                        <Terminal className="h-4 w-4 text-blue-400" />
                                        <span className="font-semibold text-gray-200 text-sm">CLI Preview</span>
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle className="h-4 w-4 text-green-600" />
                                        <span className="font-semibold text-gray-900">Merged Policy</span>
                                    </>
                                )}
                            </div>

                            {showCli ? (
                                <div className="font-mono text-xs text-green-400 break-all leading-relaxed">
                                    {formatCli(group.common_attributes)}
                                </div>
                            ) : (
                                <div className="space-y-2 text-sm">
                                    <div className="grid grid-cols-[60px_1fr] gap-2">
                                        <span className="text-gray-500 text-xs uppercase tracking-wide">Source</span>
                                        <span className="font-mono text-gray-800 break-all">{group.common_attributes?.source || 'Any'}</span>
                                    </div>
                                    <div className="grid grid-cols-[60px_1fr] gap-2">
                                        <span className="text-gray-500 text-xs uppercase tracking-wide">Dest</span>
                                        <span className="font-mono text-gray-800 break-all">{group.common_attributes?.destination || 'Any'}</span>
                                    </div>
                                    <div className="grid grid-cols-[60px_1fr] gap-2">
                                        <span className="text-gray-500 text-xs uppercase tracking-wide">Service</span>
                                        <Badge variant="outline" className="w-fit text-xs font-normal">
                                            {group.common_attributes?.service || 'Any'}
                                        </Badge>
                                    </div>
                                    <div className="grid grid-cols-[60px_1fr] gap-2 mt-2 pt-2 border-t border-green-100">
                                        <span className="text-gray-500 text-xs uppercase tracking-wide">Action</span>
                                        <span className={cn(
                                            "font-bold uppercase text-xs",
                                            (group.common_attributes?.action === 'allow' || group.common_attributes?.action === 'permit') ? 'text-green-600' : 'text-red-600'
                                        )}>
                                            {group.common_attributes?.action || 'PERMIT'}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

interface MergerViewProps {
    deviceId: string;
    onUpdateStats?: (count: number) => void;
}

export default function MergerView({ deviceId, onUpdateStats }: MergerViewProps) {
    const [mergeGroups, setMergeGroups] = useState<MergeGroup[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [isMerging, setIsMerging] = useState(false);
    const [loading, setLoading] = useState(true);
    const [hasAnalysis, setHasAnalysis] = useState<boolean | null>(null);
    const [showCli, setShowCli] = useState(false);
    const [isMergeDialogOpen, setIsMergeDialogOpen] = useState(false);
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

    const checkAnalysisAndFetch = async () => {
        try {
            setLoading(true);
            const historyRes = await apiClient.get<any[]>(`/api/analyzer/device/${deviceId}?limit=1`);
            const analysisExists = historyRes.data && historyRes.data.length > 0;
            setHasAnalysis(analysisExists);

            if (analysisExists) {
                const groupsData = await mergerService.getMergeCandidates(deviceId);
                setMergeGroups(groupsData);
            }
        } catch (error) {
            console.error("Failed to fetch merge data:", error);
            toast.error("Failed to load merge candidates");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (deviceId) {
            checkAnalysisAndFetch();
        }
    }, [deviceId]);

    useEffect(() => {
        if (onUpdateStats) {
            onUpdateStats(mergeGroups.length);
        }
    }, [mergeGroups, onUpdateStats]);

    const toggleGroup = (groupId: string) => {
        setSelectedGroups((prev) =>
            prev.includes(groupId) ? prev.filter((id) => id !== groupId) : [...prev, groupId]
        );
    };

    const handleMerge = async () => {
        try {
            setIsMerging(true);
            const result = await mergerService.executeMerge(selectedGroups);
            if (result.success) {
                toast.success("Merge Request Created. Waiting for approval.");
                setSelectedGroups([]);
                setIsMergeDialogOpen(false);
                // Do not refresh immediately - pending state
                // checkAnalysisAndFetch();
            } else {
                toast.error(`Merge failed: ${result.message}`);
            }
        } catch (error) {
            console.error("Merge execution failed:", error);
            toast.error("Failed to execute merge operation");
        } finally {
            setIsMerging(false);
        }
    };

    const totalSavings = selectedGroups.reduce((acc, groupId) => {
        const group = mergeGroups.find((g) => g.id === groupId);
        return acc + (group?.potential_savings || 0);
    }, 0);

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
            </div>
        );
    }

    if (hasAnalysis === false) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                <div className="p-4 bg-purple-50 rounded-full mb-4">
                    <Combine className="h-10 w-10 text-purple-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Required</h3>
                <p className="text-gray-500 max-w-md text-center mb-6">
                    Run a comprehensive analysis to identify redundant rules that can be merged safely.
                </p>
                <Button className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                    <Search className="h-4 w-4" />
                    Start Analysis
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" ref={headerRef}>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Rule Merger</h2>
                    <p className="text-gray-500 mt-1">
                        Consolidate redundant rules to simplify policy management.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                    <div className="px-3 py-1 bg-green-50 rounded-md border border-green-100">
                        <span className="text-xs font-semibold text-green-600 uppercase">Total Opportunities</span>
                        <div className="text-lg font-bold text-green-700">{mergeGroups.length}</div>
                    </div>

                    <div className="h-8 w-px bg-gray-200 mx-2"></div>

                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-md">
                        <button
                            onClick={() => setShowCli(false)}
                            className={cn(
                                "p-1 rounded text-[10px] font-medium transition-all px-3",
                                !showCli ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            UI
                        </button>
                        <button
                            onClick={() => setShowCli(true)}
                            className={cn(
                                "p-1 rounded text-[10px] font-medium transition-all flex items-center gap-1 px-3",
                                showCli ? "bg-white text-blue-600 shadow-sm" : "text-gray-500 hover:text-gray-700"
                            )}
                        >
                            <Terminal className="h-3 w-3" />
                            CLI
                        </button>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Merge Groups */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Search Bar - Optional, can keep simple for now */}

                    <div className="space-y-6">
                        {loading ? (
                            <div className="text-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin mx-auto text-orange-500 mb-4" />
                                <p className="text-gray-500">Scanning for merge candidates...</p>
                            </div>
                        ) : mergeGroups.length > 0 ? (
                            mergeGroups.map((group, index) => (
                                <MergeGroupCard
                                    key={group.id}
                                    group={group}
                                    index={index}
                                    isSelected={selectedGroups.includes(group.id)}
                                    onSelect={() => toggleGroup(group.id)}
                                    showCli={showCli}
                                />
                            ))
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-lg border border-dashed text-gray-500">
                                <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                                <p className="font-medium">No merge candidates found</p>
                                <p className="text-sm">Your ruleset appears to be optimized!</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Panel */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-6 shadow-lg border-orange-200">
                        <CardHeader className="pb-3 border-b bg-orange-50/30">
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <GitMerge className="h-5 w-5 text-orange-600" />
                                Review & Merge
                            </CardTitle>
                            <CardDescription>
                                Selected changes to apply.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6 pt-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-gray-50 p-3 rounded-lg text-center">
                                    <span className="block text-2xl font-bold text-gray-900">{selectedGroups.length}</span>
                                    <span className="text-xs text-gray-500 uppercase font-semibold">Groups</span>
                                </div>
                                <div className="bg-green-50 p-3 rounded-lg text-center border border-green-100">
                                    <span className="block text-2xl font-bold text-green-700">{totalSavings}</span>
                                    <span className="text-xs text-green-600 uppercase font-semibold">Lines Saved</span>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <Button
                                    className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white shadow-md shadow-orange-100 h-11"
                                    disabled={selectedGroups.length === 0 || isMerging}
                                    onClick={() => setIsMergeDialogOpen(true)}
                                >
                                    {isMerging ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <GitMerge className="h-4 w-4" />
                                    )}
                                    {isMerging ? 'Creating Request...' : 'Request Merge'}
                                </Button>

                                <Button variant="outline" className="w-full gap-2" onClick={() => setSelectedGroups([])} disabled={selectedGroups.length === 0}>
                                    <RotateCcw className="h-4 w-4" />
                                    Clear Selection
                                </Button>
                            </div>

                            <div className="flex items-start gap-3 p-3 bg-blue-50 text-blue-700 rounded-lg text-xs leading-relaxed border border-blue-100">
                                <Shield className="h-4 w-4 mt-0.5 flex-shrink-0" />
                                <p>
                                    Requests to merge rules will be sent for approval. No changes are applied immediately until approved in Change Management.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Merge Confirmation Dialog */}
            <Dialog open={isMergeDialogOpen} onOpenChange={setIsMergeDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-orange-600">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Merge
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to request a merge for {selectedGroups.length} rule group{selectedGroups.length > 1 ? 's' : ''}?
                            This will create a pending Change Request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">
                            Action: Create Change Request (Pending Approval)
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            Rules will NOT be merged immediately. An approval is required in Change Management.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsMergeDialogOpen(false)} disabled={isMerging}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={handleMerge} disabled={isMerging} className="bg-orange-600 hover:bg-orange-700">
                            {isMerging ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <GitMerge className="h-4 w-4 mr-2" />}
                            {isMerging ? 'Creating Request...' : 'Request Merge'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
