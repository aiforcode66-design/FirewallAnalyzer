import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ShieldAlert, Loader2, Layers, ArrowRight, Ban, CheckCircle, Search, Terminal } from 'lucide-react';
import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import { cn } from '@/lib/utils';
import { gsap } from 'gsap';
import { changeService } from '@/services/changeService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { AlertTriangle, Clock } from 'lucide-react';

interface ShadowedRulesViewProps {
    deviceId: string;
    onUpdateStats?: (count: number) => void;
}

interface RuleSummary {
    id: string;
    name: string;
    line_number: number;
    action: string;
    source?: string;
    destination?: string;
    service?: string;
}

interface ShadowIssue {
    shadowed_rule: RuleSummary;
    shadowing_rule: RuleSummary;
    reason: string;
}

interface ShadowIssueCardProps {
    issue: ShadowIssue;
    index: number;
    showCli: boolean;
    onRemove: (rule: RuleSummary) => void;
}

function ShadowIssueCard({ issue, index, showCli, onRemove }: ShadowIssueCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

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

    const formatCli = (rule: RuleSummary) => {
        const action = rule.action || 'permit';
        const src = rule.source || 'any';
        const dst = rule.destination || 'any';
        const svc = rule.service || 'ip';

        // Infer protocol
        let proto = 'ip';
        if (svc.toLowerCase().includes('tcp')) proto = 'tcp';
        else if (svc.toLowerCase().includes('udp')) proto = 'udp';
        else if (svc.toLowerCase().includes('icmp')) proto = 'icmp';

        // Format service port if not generic
        const svcPort = (svc !== 'ip' && svc !== 'any' && svc !== 'tcp' && svc !== 'udp' && svc !== 'icmp')
            ? `eq ${svc}`
            : '';

        return `access-list ${rule.name || 'outside_access_in'} extended ${action} ${proto} ${src} ${dst} ${svcPort}`.trim();
    };

    const isShadowingAllow = ['allow', 'permit'].includes(issue.shadowing_rule.action.toLowerCase());

    return (
        <div ref={cardRef} className="relative group">
            <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200 group-hover:bg-orange-200 transition-colors z-0"></div>

            <div className="space-y-4">
                {/* Top Rule (The Shadowing Rule - Active) */}
                <div className="relative z-10 ml-0 mr-4">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-white text-gray-500 border-gray-300">
                                Line {issue.shadowing_rule.line_number}
                            </Badge>
                            <span className="text-xs uppercase font-bold text-green-600 tracking-wider">Active Rule</span>
                        </div>
                    </div>

                    {showCli ? (
                        <div className="bg-gray-900 border rounded-lg p-4 shadow-sm border-l-4 border-l-green-500">
                            <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                                <Terminal className="h-3 w-3" />
                                <span className="font-semibold">CLI Preview</span>
                            </div>
                            <div className="font-mono text-xs text-green-400 overflow-x-auto">
                                {formatCli(issue.shadowing_rule)}
                            </div>
                        </div>
                    ) : (
                        <div className="bg-white border rounded-lg p-4 shadow-sm group-hover:shadow-md transition-shadow border-l-4 border-l-green-500">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h4 className="font-medium text-gray-900">{issue.shadowing_rule.name}</h4>
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 font-mono">
                                        <span className="bg-gray-50 px-1.5 py-0.5 rounded border">Src: {issue.shadowing_rule.source || 'Any'}</span>
                                        <ArrowRight className="h-3 w-3" />
                                        <span className="bg-gray-50 px-1.5 py-0.5 rounded border">Dst: {issue.shadowing_rule.destination || 'Any'}</span>
                                    </div>
                                </div>
                                <Badge className={cn(isShadowingAllow ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-red-100 text-red-700 hover:bg-red-200')}>
                                    {issue.shadowing_rule.action.toUpperCase()}
                                </Badge>
                            </div>
                        </div>
                    )}
                </div>

                {/* Overlap Indicator */}
                <div className="relative z-10 flex items-center gap-3 py-1 ml-6">
                    <div className="bg-orange-100 text-orange-700 text-xs px-3 py-1 rounded-full flex items-center gap-2 font-medium border border-orange-200">
                        <ArrowDown className="h-3 w-3" />
                        Shadows
                    </div>
                    <span className="text-xs text-gray-400 italic">This rule matches all traffic designed for the rule below.</span>
                </div>

                {/* Bottom Rule (The Shadowed Rule - Inactive) */}
                <div className="relative z-10 ml-4 mr-0 opacity-75 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Badge variant="outline" className="bg-gray-50 text-gray-400 border-gray-200">
                                Line {issue.shadowed_rule.line_number}
                            </Badge>
                            <span className="text-xs uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1">
                                <Ban className="h-3 w-3" /> Inactive
                            </span>
                        </div>
                    </div>

                    {showCli ? (
                        <div className="bg-gray-900 border rounded-lg p-4 shadow-inner border-l-4 border-l-gray-600 relative overflow-hidden">
                            {/* Diagonal stripes overlay for "disabled" look */}
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.02)_25%,rgba(0,0,0,0.02)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.02)_75%,rgba(0,0,0,0.02)_100%)] bg-[length:10px_10px] pointer-events-none"></div>

                            <div className="relative z-10">
                                <div className="flex items-center gap-2 mb-2 text-xs text-gray-500">
                                    <Terminal className="h-3 w-3" />
                                    <span className="font-semibold">CLI Preview</span>
                                </div>
                                <div className="font-mono text-xs text-green-400 overflow-x-auto">
                                    {formatCli(issue.shadowed_rule)}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 shadow-inner border-l-4 border-l-gray-300 relative overflow-hidden">
                            {/* Diagonal stripes overlay for "disabled" look */}
                            <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(0,0,0,0.02)_25%,rgba(0,0,0,0.02)_50%,transparent_50%,transparent_75%,rgba(0,0,0,0.02)_75%,rgba(0,0,0,0.02)_100%)] bg-[length:10px_10px] pointer-events-none"></div>

                            <div className="relative z-10">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-medium text-gray-700 line-through decoration-gray-400">{issue.shadowed_rule.name}</h4>
                                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500 font-mono">
                                            <span>Src: {issue.shadowed_rule.source || 'Any'}</span>
                                            <ArrowRight className="h-3 w-3" />
                                            <span>Dst: {issue.shadowed_rule.destination || 'Any'}</span>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-2">
                                        <Badge variant="outline" className="text-gray-400 border-gray-300">
                                            {issue.shadowed_rule.action.toUpperCase()}
                                        </Badge>
                                        <Button
                                            size="sm"
                                            variant="destructive"
                                            className="h-7 text-xs gap-1 shadow-sm"
                                            onClick={() => onRemove(issue.shadowed_rule)}
                                        >
                                            Remove Rule
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ShadowedRulesView({ deviceId, onUpdateStats }: ShadowedRulesViewProps) {
    const [issues, setIssues] = useState<ShadowIssue[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAnalysis, setHasAnalysis] = useState<boolean | null>(null);
    const [showCli, setShowCli] = useState(false);
    const [selectedRuleToRemove, setSelectedRuleToRemove] = useState<RuleSummary | null>(null);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const headerRef = useRef<HTMLDivElement>(null);
    const { user } = useAuth();

    const confirmRemoveRule = (rule: RuleSummary) => {
        setSelectedRuleToRemove(rule);
        setIsDeleteDialogOpen(true);
    };

    const handleRemoveRule = async () => {
        if (!user?.email || !selectedRuleToRemove) {
            toast.error("User or rule not identified");
            return;
        }

        try {
            setIsDeleting(true);
            await changeService.createChange({
                device_id: deviceId,
                timestamp: new Date().toISOString(),
                type: 'delete',
                description: `Remove shadowed rule '${selectedRuleToRemove.name}'`,
                rules_affected: [{
                    id: selectedRuleToRemove.id,
                    name: selectedRuleToRemove.name,
                    action: selectedRuleToRemove.action,
                    source: selectedRuleToRemove.source,
                    destination: selectedRuleToRemove.destination,
                    service: selectedRuleToRemove.service,
                    role: 'shadowed'
                }]
            });
            toast.success(`Request to remove rule '${selectedRuleToRemove.name}' created`);
            setIsDeleteDialogOpen(false);
            setSelectedRuleToRemove(null);
        } catch (error) {
            console.error(error);
            toast.error("Failed to create removal request");
        } finally {
            setIsDeleting(false);
        }
    };

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
        checkAnalysisAndFetch();
    }, [deviceId]);

    useEffect(() => {
        if (onUpdateStats) {
            onUpdateStats(issues.length);
        }
    }, [issues, onUpdateStats]);

    const checkAnalysisAndFetch = async () => {
        try {
            setLoading(true);
            const historyRes = await apiClient.get<any[]>(`/api/analyzer/device/${deviceId}?limit=1`);
            const analysisExists = historyRes.data && historyRes.data.length > 0;
            setHasAnalysis(analysisExists);

            if (analysisExists) {
                // Mock data if backend fields are missing (transitional)
                // In a real scenario, the backend should provide source/dest.
                // If the current API doesn't return them, we might need to fetch rule details or use what we have.
                // For now, we'll assume the API returns the structure we need or we accept basic info.
                const response = await apiClient.get(API_CONFIG.ENDPOINTS.ANALYZER.SHADOWED(deviceId));
                setIssues(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch shadowed rules:', error);
            // toast.error('Failed to load shadowed rules analysis');
        } finally {
            setLoading(false);
        }
    };

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
                <div className="p-4 bg-orange-50 rounded-full mb-4">
                    <Layers className="h-10 w-10 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Required</h3>
                <p className="text-gray-500 max-w-md text-center mb-6">
                    Run a comprehensive analysis to identify shadowed rules that are completely blocked by other rules.
                </p>
                <Button className="gap-2 bg-orange-600 hover:bg-orange-700 text-white">
                    <Search className="h-4 w-4" />
                    Start Analysis
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" ref={headerRef}>
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Shadowed Rules</h2>
                    <p className="text-gray-500 mt-1">
                        Visualize and remove unreachable rules to clean up your policy.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                    <div className="px-3 py-1 bg-red-50 rounded-md border border-red-100">
                        <span className="text-xs font-semibold text-red-600 uppercase">Conflicts Found</span>
                        <div className="text-lg font-bold text-red-700">{issues.length}</div>
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
                <div className="lg:col-span-2 space-y-6">
                    {issues.length > 0 ? (
                        issues.map((issue, idx) => (
                            <ShadowIssueCard
                                key={idx}
                                issue={issue}
                                index={idx}
                                showCli={showCli}
                                onRemove={confirmRemoveRule}
                            />
                        ))
                    ) : (
                        <div className="text-center py-12 bg-white rounded-lg border border-dashed text-gray-500 shadow-sm">
                            <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                            <p className="font-medium text-gray-900">No Shadowing Detected</p>
                            <p className="text-sm mt-1">Your rule order is optimized and free of blockage.</p>
                        </div>
                    )}
                </div>

                <div className="lg:col-span-1">
                    <Card className="sticky top-6 shadow-lg border-blue-200 bg-blue-50/30">
                        <CardHeader className="pb-3 border-b border-blue-100">
                            <CardTitle className="flex items-center gap-2 text-lg text-blue-900">
                                <ShieldAlert className="h-5 w-5 text-blue-600" />
                                What is Shadowing?
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4 text-sm text-blue-800">
                            <p>
                                A <strong>Shadowed Rule</strong> is a rule that is located below another rule that matches the exact same traffic (or a superset of it).
                            </p>
                            <p>
                                Because firewalls process rules from top to bottom, the shadowed rule will <strong>never be reached</strong> or executed.
                            </p>
                            <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm text-xs">
                                <span className="font-semibold text-blue-900 block mb-1">Recommendation:</span>
                                Review the top rule. If it is correct, the bottom rule is redundant and should be removed. If the bottom rule is intended to be an exception, move it <strong>above</strong> the shadowing rule.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Removal
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to request deletion for rule <strong>{selectedRuleToRemove?.name}</strong>?
                            This will create a pending Change Request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-blue-50 rounded-lg">
                        <p className="text-sm text-blue-700 font-medium">
                            Action: Create Change Request (Pending Approval)
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            The rule will NOT be deleted immediately. An approval is required in Change Management.
                        </p>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)} disabled={isDeleting}>
                            Cancel
                        </Button>
                        <Button variant="default" onClick={handleRemoveRule} disabled={isDeleting} className="bg-blue-600 hover:bg-blue-700">
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                            {isDeleting ? 'Creating Request...' : 'Request Deletion'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
