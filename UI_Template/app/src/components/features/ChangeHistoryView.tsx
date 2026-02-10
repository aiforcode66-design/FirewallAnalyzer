import { useState, useRef, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { gsap } from 'gsap';
import {
    History,
    CheckCircle2,
    XCircle,
    AlertCircle,
    FileCode2,
    Loader2,
    ArrowRight,
    User,
    GitCommit,
    RefreshCw
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { changeService, type ChangeRecord } from '@/services/changeService';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';

interface ChangeHistoryViewProps {
    deviceId: string;
}

const statusConfig = {
    pending: { color: 'text-amber-600', bg: 'bg-amber-50 border-amber-100', icon: AlertCircle, label: 'Pending Review' },
    approved: { color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-100', icon: CheckCircle2, label: 'Approved' },
    rejected: { color: 'text-rose-600', bg: 'bg-rose-50 border-rose-100', icon: XCircle, label: 'Rejected' },
    implemented: { color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-100', icon: CheckCircle2, label: 'Implemented' },
};

const typeConfig = {
    add: { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-100', label: 'ADD' },
    modify: { color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-100', label: 'MOD' },
    delete: { color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-100', label: 'DEL' },
    cleanup: { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-100', label: 'CLEAN' },
    "cleanup-objects": { color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100', label: 'OBJ-CLEAN' },
    merge: { color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-100', label: 'MERGE' },
};

function ChangeItem({ change, index, isLast }: { change: ChangeRecord; index: number, isLast: boolean }) {
    const itemRef = useRef<HTMLDivElement>(null);
    const StatusIcon = statusConfig[change.status]?.icon || AlertCircle;
    const status = statusConfig[change.status] || statusConfig.pending;
    const type = typeConfig[change.type] || typeConfig.modify;

    useEffect(() => {
        if (itemRef.current) {
            gsap.fromTo(
                itemRef.current,
                { opacity: 0, x: -10 },
                { opacity: 1, x: 0, duration: 0.4, delay: index * 0.05, ease: 'power2.out' }
            );
        }
    }, [index]);

    return (
        <div ref={itemRef} className="relative pl-8 pb-8 last:pb-0 group">
            {/* Minimalist Timeline Line */}
            <div className={cn(
                "absolute left-[11px] top-6 bottom-0 w-px bg-slate-200 group-last:bg-transparent",
                isLast && "bg-gradient-to-b from-slate-200 to-transparent h-6"
            )}></div>

            {/* Node */}
            <div className="absolute left-[7px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white group-hover:bg-indigo-500 group-hover:ring-indigo-50 transition-all duration-300 z-10"></div>

            {/* Content Container */}
            <div className="flex flex-col gap-3 group-hover:translate-x-1 transition-transform duration-300">
                {/* Header Metadata */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5 bg-slate-100 px-2 py-0.5 rounded-full">
                            <User className="h-3 w-3 text-slate-500" />
                            {change.user_email.split('@')[0]}
                        </span>
                        <span className="text-xs text-slate-400 font-medium">
                            {format(new Date(change.timestamp), 'h:mm a')}
                        </span>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white border boundary-slate-100 rounded-xl p-4 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200 group-hover:bg-slate-50/30">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                            <p className="text-sm text-slate-800 leading-relaxed font-medium">
                                {change.description}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                <Badge variant="outline" className={cn("text-[10px] h-5 px-2 font-bold border", type.bg, type.color, type.border)}>
                                    {type.label}
                                </Badge>
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border", status.bg, status.color)}>
                                    <StatusIcon className="h-3 w-3" />
                                    {status.label}
                                </span>
                                <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                                    <GitCommit className="h-3 w-3" />
                                    {change.id.substring(0, 7)}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Footer / Actions */}
                    {change.rules_affected && change.rules_affected.length > 0 && (
                        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors bg-slate-50 hover:bg-indigo-50 px-3 py-1.5 rounded-md w-full sm:w-auto justify-center sm:justify-start">
                                        <FileCode2 className="h-3.5 w-3.5" />
                                        View {change.rules_affected.length} Affected Rules
                                        <ArrowRight className="h-3 w-3 ml-auto sm:ml-0 opacity-50" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2">
                                            <FileCode2 className="h-5 w-5 text-indigo-500" />
                                            Configuration Context
                                        </DialogTitle>
                                        <DialogDescription>
                                            Snapshot of the configuration affected by this change.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="mt-4 space-y-2">
                                        {change.rules_affected.map((item: any, idx) => {
                                            let content = "";
                                            if (typeof item === 'string') {
                                                content = item;
                                            } else if (item.name) {
                                                // Handle Object-like or Rule-like items gracefully
                                                if (item.action) {
                                                    content = `access-list ${item.name} extended ${item.action} ${item.service} ${item.source} ${item.destination}`;
                                                } else {
                                                    // Likely an object
                                                    content = `object ${item.type} ${item.name}\n  ${item.value}`;
                                                }
                                            } else {
                                                content = item.id || JSON.stringify(item, null, 2);
                                            }

                                            return (
                                                <div key={idx} className="p-4 bg-slate-900 text-slate-50 font-mono text-xs rounded-lg border border-slate-700 break-all leading-relaxed shadow-inner">
                                                    <pre className="whitespace-pre-wrap">{content}</pre>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function ChangeHistoryView({ deviceId }: ChangeHistoryViewProps) {
    const [changes, setChanges] = useState<ChangeRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchChanges = async () => {
        try {
            setLoading(true);
            const data = await changeService.getChanges({ deviceId, limit: 50 });
            setChanges(data);
        } catch (error) {
            console.error("Failed to fetch history:", error);
            toast.error("Failed to load change history");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (deviceId) {
            fetchChanges();
        }
    }, [deviceId]);

    // Group changes by date
    const groupedChanges = useMemo(() => {
        const groups: Record<string, ChangeRecord[]> = {
            'Today': [],
            'Yesterday': [],
            'This Week': [],
            'This Month': [],
            'Older': []
        };

        changes.forEach(change => {
            const date = new Date(change.timestamp);
            if (isToday(date)) {
                groups['Today'].push(change);
            } else if (isYesterday(date)) {
                groups['Yesterday'].push(change);
            } else if (isThisWeek(date)) {
                groups['This Week'].push(change);
            } else if (isThisMonth(date)) {
                groups['This Month'].push(change);
            } else {
                groups['Older'].push(change);
            }
        });

        // Filter out empty groups
        return Object.entries(groups).filter(([_, items]) => items.length > 0);
    }, [changes]);

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between border-b border-gray-100 pb-6">
                <div>
                    <h3 className="text-2xl font-bold text-gray-900 tracking-tight">Activity Log</h3>
                    <p className="text-sm text-gray-500 mt-1">Audit trail of configuration changes and optimizations.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={fetchChanges} disabled={loading} className="gap-2">
                        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
                        Refresh
                    </Button>
                    <Button variant="outline" size="sm" className="gap-2 bg-white hover:bg-gray-50">
                        <History className="h-4 w-4 text-gray-500" /> Export Log
                    </Button>
                </div>
            </div>

            <div className="relative min-h-[400px]">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-500 mb-3" />
                        <p className="text-slate-500 font-medium animate-pulse">Syncing history...</p>
                    </div>
                ) : changes.length > 0 ? (
                    <div className="space-y-10 pl-2">
                        {groupedChanges.map(([label, groupChanges]) => (
                            <div key={label} className="relative animate-in fade-in slide-in-from-bottom-4 duration-700">
                                <div className="sticky top-0 z-20 bg-gray-50/95 backdrop-blur-md py-3 mb-6 border-b border-gray-100/50 flex items-center gap-3">
                                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider bg-indigo-50 px-2 py-1 rounded-md">
                                        {label}
                                    </span>
                                    <div className="h-px bg-slate-100 flex-1"></div>
                                </div>
                                <div className="space-y-2">
                                    {groupChanges.map((change, index) => (
                                        <ChangeItem
                                            key={change.id}
                                            change={change}
                                            index={index}
                                            isLast={index === groupChanges.length - 1}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <Card className="border-dashed bg-slate-50/50 border-slate-200">
                        <CardContent className="flex flex-col items-center justify-center py-20 text-slate-500">
                            <div className="bg-white p-4 rounded-full shadow-sm mb-4 ring-1 ring-slate-100">
                                <History className="h-8 w-8 text-slate-400" />
                            </div>
                            <p className="font-semibold text-slate-900">No history available</p>
                            <p className="text-sm text-slate-500 mt-1">No recorded changes for this device yet.</p>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
