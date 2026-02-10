import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';

import {
    Search,
    Filter,
    ArrowRight,
    Shield,
    Loader2,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    Download,
    ChevronDown,
    MoreVertical
} from 'lucide-react';

import { deviceService } from '@/services/deviceService';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { ruleService } from '@/services/ruleService';
import type { FirewallRule } from '@/types';
import { cn } from '@/lib/utils';

interface RulesViewProps {
    deviceId: string;
}

export default function RulesView({ deviceId }: RulesViewProps) {
    const [rules, setRules] = useState<FirewallRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [actionFilter, setActionFilter] = useState<string>('all');
    const [page, setPage] = useState(0);

    const [hasMore, setHasMore] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const limit = 20;

    const headerRef = useRef<HTMLDivElement>(null);
    const tableRef = useRef<HTMLTableSectionElement>(null);



    const fetchRules = async () => {
        try {
            setLoading(true);
            const fetchedRules = await ruleService.getRules({
                deviceId,
                skip: page * limit,
                limit: limit + 1, // Fetch one extra to check "hasMore"
                search: searchQuery,
                action: actionFilter !== 'all' ? (actionFilter as 'allow' | 'deny') : undefined
            });

            if (fetchedRules.length > limit) {
                setHasMore(true);
                setRules(fetchedRules.slice(0, limit));
            } else {
                setHasMore(false);
                setRules(fetchedRules);
            }
        } catch (error) {
            console.error("Failed to fetch rules:", error);
            toast.error("Failed to load rules");
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = async () => {
        try {
            setDownloading(true);
            await deviceService.downloadConfig(deviceId);
            toast.success("Configuration downloaded successfully");
        } catch (error) {
            console.error("Download failed:", error);
            toast.error("Failed to download configuration");
        } finally {
            setDownloading(false);
        }
    };

    useEffect(() => {
        // Debounce only for search query to prevent typing lag
        if (searchQuery) {
            const timer = setTimeout(() => {
                setPage(0);
                fetchRules();
            }, 300);
            return () => clearTimeout(timer);
        } else {
            // Immediate fetch for filters or initial load
            setPage(0);
            fetchRules();
        }
    }, [deviceId, searchQuery, actionFilter]);

    // Page change effect
    useEffect(() => {
        fetchRules();
    }, [page]);

    const handleNextPage = () => {
        if (hasMore) setPage(p => p + 1);
    };

    const handlePrevPage = () => {
        if (page > 0) setPage(p => p - 1);
    };

    const [expandedRuleIds, setExpandedRuleIds] = useState<Set<string>>(new Set());

    const toggleRuleForExpansion = (ruleId: string) => {
        const newSet = new Set(expandedRuleIds);
        if (newSet.has(ruleId)) {
            newSet.delete(ruleId);
        } else {
            newSet.add(ruleId);
        }
        setExpandedRuleIds(newSet);
    };

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div ref={headerRef} className="flex flex-col lg:flex-row gap-4 items-center justify-between">
                <div className="relative flex-1 w-full lg:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search rules by name, source, destination..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="flex gap-2 w-full lg:w-auto items-center">
                    <Select value={actionFilter} onValueChange={setActionFilter}>
                        <SelectTrigger className="w-[140px]">
                            <Filter className="h-4 w-4 mr-2" />
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="allow">Allow</SelectItem>
                            <SelectItem value="deny">Deny</SelectItem>
                        </SelectContent>
                    </Select>

                    <Button
                        variant="outline"
                        className="gap-2"
                        onClick={handleDownload}
                        disabled={downloading}
                    >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Download Optimized
                    </Button>

                    <Button variant="outline" size="icon" onClick={() => { setPage(0); fetchRules(); }}>
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            {/* Hierarchical Rules Table */}
            <Card>
                <CardContent className="p-0">
                    <div className="overflow-auto max-h-[calc(100vh-280px)] min-h-[500px]">
                        <table className="w-full">
                            <thead className="bg-gray-50/95 backdrop-blur border-b border-gray-200 sticky top-0 z-10 shadow-sm">
                                <tr>
                                    <th className="p-4 w-8"></th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Status</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Name</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Source <span className="text-gray-400 mx-1">→</span> Destination</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Service</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">Action</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[120px]">Hitcount</th>
                                    <th className="p-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider w-[120px]">Last Hit</th>
                                    <th className="p-4 w-10"></th>
                                </tr>
                            </thead>
                            <tbody ref={tableRef}>
                                {loading ? (
                                    <tr>
                                        <td colSpan={9} className="p-12 text-center">
                                            <div className="flex flex-col items-center justify-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-orange-500 mb-4" />
                                                <p className="text-gray-500 font-medium">Loading rules...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : rules.length > 0 ? (
                                    rules.map((rule) => {
                                        const hasChildren = rule.children && rule.children.length > 0;
                                        const isExpanded = expandedRuleIds.has(rule.id);
                                        const isPermit = ['allow', 'permit'].includes(rule.action.toLowerCase());

                                        return (
                                            <>
                                                <tr
                                                    key={rule.id}
                                                    className={cn(
                                                        "group border-b border-gray-100 transition-all hover:bg-gray-50",
                                                        rule.isUnused ? "bg-gray-50/50" : "bg-white",
                                                        isExpanded && "bg-blue-50/30 border-l-4 border-l-blue-500"
                                                    )}
                                                >
                                                    <td className="p-4 w-8 text-center relative">
                                                        {hasChildren && (
                                                            <button
                                                                onClick={() => toggleRuleForExpansion(rule.id)}
                                                                className="p-1 hover:bg-white rounded-md text-gray-400 hover:text-blue-600 transition-colors shadow-sm border border-transparent hover:border-gray-200"
                                                            >
                                                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className={cn(
                                                            "w-2.5 h-2.5 rounded-full ring-2 ring-white shadow-sm",
                                                            rule.isUnused ? "bg-gray-300" : "bg-emerald-500"
                                                        )} title={rule.isUnused ? "Unused" : "Active"}></div>
                                                    </td>
                                                    <td className="p-4">
                                                        <p className="font-semibold text-gray-900 text-sm">{rule.name}</p>
                                                        {hasChildren && (
                                                            <div className="flex items-center gap-1.5 mt-1">
                                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-gray-100 text-gray-500 border-gray-200">
                                                                    {rule.children?.length} sub-rules
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3 text-sm text-gray-600">
                                                            <div className="flex flex-col max-w-[180px]">
                                                                <span className="truncate font-medium text-gray-700" title={rule.source}>{rule.source}</span>
                                                                <span className="text-[10px] text-gray-400">src</span>
                                                            </div>
                                                            <div className="p-1.5 rounded-full bg-gray-50 text-gray-300">
                                                                <ArrowRight className="h-3 w-3" />
                                                            </div>
                                                            <div className="flex flex-col max-w-[180px]">
                                                                <span className="truncate font-medium text-gray-700" title={rule.destination}>{rule.destination}</span>
                                                                <span className="text-[10px] text-gray-400">dest</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="p-4">
                                                        <code className="text-xs bg-gray-50 px-2 py-1 rounded border border-gray-200 text-gray-600 font-mono">
                                                            {rule.service}
                                                        </code>
                                                    </td>
                                                    <td className="p-4">
                                                        <Badge
                                                            className={cn(
                                                                "capitalize shadow-none border font-medium rounded-md px-2.5",
                                                                isPermit
                                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                                                    : "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100"
                                                            )}
                                                        >
                                                            {rule.action}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className="font-mono text-sm text-gray-700 font-medium">{rule.hits.toLocaleString()}</span>
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={cn(
                                                            "text-xs whitespace-nowrap",
                                                            rule.lastHit ? "text-gray-600" : "text-gray-400 italic"
                                                        )}>
                                                            {rule.lastHit ? new Date(rule.lastHit).toLocaleDateString() : 'Never'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-gray-400 hover:text-gray-700">
                                                            <MoreVertical className="h-4 w-4" />
                                                        </Button>
                                                    </td>
                                                </tr>
                                                {/* Recursively Render Children */}
                                                {isExpanded && hasChildren && rule.children && rule.children.map((child, idx) => (
                                                    <tr key={child.id || `${rule.id}-child-${idx}`} className="bg-gray-50/50 border-b border-gray-100 group">
                                                        <td className="p-4 border-l-4 border-l-blue-500"></td> {/* Indent visual link */}
                                                        <td className="p-4 pl-4 relative">
                                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-[1px] bg-blue-200"></div>
                                                            <div className={cn(
                                                                "w-2 h-2 rounded-full relative z-10 ml-2",
                                                                child.isUnused ? "bg-gray-300" : "bg-emerald-400"
                                                            )}></div>
                                                        </td>
                                                        <td className="p-4 text-sm text-gray-500 pl-8">
                                                            ACE line {idx + 1}
                                                        </td>
                                                        <td className="p-4">
                                                            <div className="flex items-center gap-2 text-sm text-gray-500 pl-4 border-l-2 border-gray-100 ml-4">
                                                                <span className="max-w-[140px] truncate font-mono text-xs" title={child.source}>{child.source}</span>
                                                                <ArrowRight className="h-3 w-3 text-gray-300" />
                                                                <span className="max-w-[140px] truncate font-mono text-xs" title={child.destination}>{child.destination}</span>
                                                            </div>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-mono text-xs text-gray-500">{child.service}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className={cn(
                                                                "text-xs px-2 py-0.5 rounded font-medium capitalize border",
                                                                ['allow', 'permit'].includes(child.action.toLowerCase())
                                                                    ? "text-emerald-700 bg-emerald-50 border-emerald-100"
                                                                    : "text-rose-700 bg-rose-50 border-rose-100"
                                                            )}>{child.action}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="font-mono text-xs text-gray-500">{child.hits.toLocaleString()}</span>
                                                        </td>
                                                        <td className="p-4">
                                                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                                                {child.lastHit ? new Date(child.lastHit).toLocaleDateString() : '-'}
                                                            </span>
                                                        </td>
                                                        <td className="p-4"></td>
                                                    </tr>
                                                ))}

                                            </>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={9}>
                                            <div className="py-20 text-center flex flex-col items-center justify-center">
                                                <div className="bg-gray-50 p-4 rounded-full mb-4">
                                                    <Shield className="h-10 w-10 text-gray-300" />
                                                </div>
                                                <h3 className="text-lg font-medium text-gray-900">No rules found</h3>
                                                <p className="text-gray-500 mt-1 max-w-sm">
                                                    No firewall rules match your current search criteria. Try adjusting your filters.
                                                </p>
                                                <Button
                                                    variant="outline"
                                                    className="mt-6 gap-2"
                                                    onClick={() => { setSearchQuery(''); setActionFilter('all'); }}
                                                >
                                                    <RefreshCw className="h-4 w-4" /> Clear Filters
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between">
                        <span className="text-xs text-gray-500">
                            Page {page + 1}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handlePrevPage}
                                disabled={page === 0 || loading}
                            >
                                <ChevronLeft className="h-4 w-4" /> Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleNextPage}
                                disabled={!hasMore || loading}
                            >
                                Next <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
