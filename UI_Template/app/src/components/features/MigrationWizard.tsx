import { useState, useEffect } from 'react';
import { DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, ArrowRight, GitMerge, Loader2, Search, LayoutDashboard, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { deviceService } from '@/services/deviceService';
import { migrationService, type ConflictReview, type MigrationContext, type UnifiedPolicy } from '@/services/migrationService';
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";

interface MigrationWizardProps {
    availableContexts: { id: string, name: string, parentName?: string }[];
    onClose: () => void;
    initialSelectedIds?: string[];
    onMigrationSuccess?: () => void;
}

export default function MigrationWizard({ availableContexts, onClose, initialSelectedIds = [], onMigrationSuccess }: MigrationWizardProps) {
    const [step, setStep] = useState(1);
    const [selectedContextIds, setSelectedContextIds] = useState<string[]>(initialSelectedIds);
    const [analyzing, setAnalyzing] = useState(false);
    const [conflictReport, setConflictReport] = useState<ConflictReview | null>(null);
    const [unifiedPolicy, setUnifiedPolicy] = useState<UnifiedPolicy | null>(null);
    const [targetDeviceName, setTargetDeviceName] = useState("Unified-Firewall-v1");

    // UI States for Clean Layout
    const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [contextSearchTerm, setContextSearchTerm] = useState("");
    const [viewFilter, setViewFilter] = useState<'all' | 'conflicts' | 'clean'>('conflicts');
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

    useEffect(() => {
        // Expand all groups initially
        const groups = availableContexts.reduce((acc, ctx) => {
            const key = ctx.parentName || 'Standalone Devices';
            acc[key] = true;
            return acc;
        }, {} as Record<string, boolean>);
        setExpandedGroups(groups);
    }, [availableContexts]);

    useEffect(() => {
        if (initialSelectedIds.length > 0) {
            setSelectedContextIds(initialSelectedIds);
        }
    }, [initialSelectedIds]);

    const loadContextData = async (ids: string[]): Promise<MigrationContext[]> => {
        const promises = ids.map(async (id) => {
            const device = await deviceService.getDevice(id);
            const objectsResponse = await deviceService.getDeviceObjects(id);
            // Backend returns { objects: [], groups: [] }, so we flatten them
            const objects = [
                ...(objectsResponse.objects || []),
                ...(objectsResponse.groups || [])
            ];

            const rules = await deviceService.getRules(id, { limit: 100000 });

            return {
                name: device.name,
                objects: objects,
                rules: rules.map((r: any) => ({
                    name: r.name,
                    source: r.source,
                    destination: r.destination,
                    service: r.service,
                    action: r.action,
                    hits: r.hits || 0,
                    last_hit: r.lastHit || null,
                    original_context: device.name,
                    children: r.children ? r.children.map((c: any) => ({
                        name: c.name,
                        source: c.source,
                        destination: c.destination,
                        service: c.service,
                        action: c.action,
                        hits: c.hits || 0,
                        last_hit: c.lastHit || null,
                    })) : []
                }))
            };
        });

        return Promise.all(promises);
    };

    const handleAnalyze = async () => {
        if (selectedContextIds.length < 2) {
            toast.error("Please select at least 2 contexts to merge");
            return;
        }

        try {
            setAnalyzing(true);
            const data = await loadContextData(selectedContextIds);

            const report = await migrationService.analyzeConflicts(data);
            setConflictReport(report);
            setStep(2);

            // Auto-select first conflict
            if (report.conflicts.length > 0) {
                setSelectedObjectId(report.conflicts[0].name);
            }
        } catch (error) {
            console.error("Analysis failed:", error);
            toast.error("Failed to analyze contexts");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleExecute = async () => {
        try {
            setAnalyzing(true);
            const data = await loadContextData(selectedContextIds);

            const result = await migrationService.executeMigration(data, 'auto_rename_context', targetDeviceName);
            setUnifiedPolicy(result);
            toast.success("Migration completed successfully! New device created.");

            // Notify parent to refresh devices
            if (onMigrationSuccess) {
                onMigrationSuccess();
            }

            // Close dialog automatically after successful merge
            onClose();
        } catch (error) {
            console.error("Migration failed:", error);
            toast.error("Failed to execute migration");
        } finally {
            setAnalyzing(false);
        }
    };

    const toggleContext = (id: string) => {
        if (selectedContextIds.includes(id)) {
            setSelectedContextIds(selectedContextIds.filter(cid => cid !== id));
        } else {
            setSelectedContextIds([...selectedContextIds, id]);
        }
    };

    const toggleAllContexts = () => {
        if (selectedContextIds.length === availableContexts.length) {
            setSelectedContextIds([]);
        } else {
            setSelectedContextIds(availableContexts.map(c => c.id));
        }
    };

    const filteredContexts = availableContexts.filter(c =>
        c.name.toLowerCase().includes(contextSearchTerm.toLowerCase()) &&
        c.parentName !== 'Standalone'
    );

    const resolveAnalysisView = () => {
        if (!conflictReport) return null;

        // Combine conflicts and clean objects for "Show All"
        const cleanObjects = (conflictReport.clean_objects || []).map((c: any) => ({ ...c, status: 'clean' }));
        const conflictObjects = conflictReport.conflicts.map(c => ({ ...c, status: 'conflict' }));

        let filteredObjects = [...conflictObjects, ...cleanObjects];

        if (viewFilter === 'conflicts') {
            filteredObjects = filteredObjects.filter(o => o.status === 'conflict');
        } else if (viewFilter === 'clean') {
            filteredObjects = filteredObjects.filter(o => o.status === 'clean');
        }

        if (searchTerm) {
            filteredObjects = filteredObjects.filter(o => o.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        const selectedObject = [...conflictObjects, ...cleanObjects].find(c => c.name === selectedObjectId);

        return (
            <div className="flex flex-col h-full w-full">
                {/* Header Stats */}
                <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
                    <div className="flex gap-4">
                        <div className="flex items-center gap-2 text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-semibold">{conflictReport.clean_count} Clean</span>
                        </div>
                        <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-1 rounded-full border border-amber-100">
                            <AlertTriangle className="h-4 w-4" />
                            <span className="font-semibold">{conflictReport.conflict_count} Conflicts</span>
                        </div>
                    </div>
                </div>

                {/* Split View Content */}
                <div className="flex flex-1 overflow-hidden h-full">
                    {/* LEFT PANEL: Master List */}
                    <div className="w-1/3 border-r flex flex-col bg-muted/10 overflow-hidden h-full">
                        <div className="p-4 space-y-3 border-b shrink-0 bg-white/50 backdrop-blur-sm">
                            <div className="relative">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search objects..."
                                    className="pl-8"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Tabs value={viewFilter} onValueChange={(v: any) => setViewFilter(v)} className="w-full">
                                <TabsList className="w-full grid grid-cols-2">
                                    <TabsTrigger value="conflicts">Conflicts Only</TabsTrigger>
                                    <TabsTrigger value="all">Show All</TabsTrigger>
                                </TabsList>
                            </Tabs>
                        </div>
                        <ScrollArea className="flex-1 w-full h-full">
                            <div className="p-2 space-y-1">
                                {filteredObjects.length === 0 && (
                                    <div className="text-center p-8 text-muted-foreground text-sm">
                                        No objects found meeting criteria.
                                    </div>
                                )}
                                {filteredObjects.map((obj) => (
                                    <button
                                        key={obj.name}
                                        onClick={() => setSelectedObjectId(obj.name)}
                                        className={`w-full text-left px-4 py-3 rounded-md flex items-center justify-between group transition-all ${selectedObjectId === obj.name
                                            ? 'bg-blue-50 border-blue-200 shadow-sm ring-1 ring-blue-200'
                                            : 'hover:bg-muted/50 border border-transparent'
                                            }`}
                                    >
                                        <div className="flex flex-col gap-1 min-w-0">
                                            <span className={`font-medium truncate ${selectedObjectId === obj.name ? 'text-blue-700' : 'text-foreground'}`}>
                                                {obj.name}
                                            </span>
                                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                                <Badge variant="outline" className="text-[10px] h-5 px-1 bg-white">
                                                    {obj.instances.length} Contexts
                                                </Badge>
                                                {(obj as any).status === 'conflict' && (
                                                    <AlertTriangle className="h-3 w-3 text-amber-500" />
                                                )}
                                            </div>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>

                    {/* RIGHT PANEL: Detail View */}
                    <div className="flex-1 bg-white flex flex-col overflow-hidden w-full h-full">
                        {selectedObject ? (
                            <div className="h-full flex flex-col overflow-hidden">
                                {/* Object Header */}
                                <div className="p-6 border-b flex justify-between items-start bg-slate-50/50 shrink-0">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-xl font-bold text-slate-900">{selectedObject.name}</h3>
                                            {(selectedObject as any).status === 'conflict' ? (
                                                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200">
                                                    Naming Conflict
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-green-200">
                                                    Clean Object
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            Defined in {selectedObject.instances.length} contexts.
                                        </p>
                                    </div>
                                    <Button size="sm" variant="outline" className="text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100 cursor-default">
                                        Auto-Resolve (Rename)
                                    </Button>
                                </div>

                                {/* Comparison Table Container - Scrollable */}
                                <ScrollArea className="flex-1 w-full">
                                    <div className="p-6 space-y-6">
                                        {(selectedObject as any).status === 'conflict' ? (
                                            <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-4">
                                                <div className="flex gap-3 text-amber-800 text-sm">
                                                    <AlertTriangle className="h-5 w-5 shrink-0" />
                                                    <p>
                                                        The object <strong>{selectedObject.name}</strong> has different values in different contexts.
                                                        During merger, these must be resolved. The default strategy is to <strong>Rename</strong> specific context objects to avoid collision.
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="bg-green-50/50 border border-green-100 rounded-lg p-4">
                                                <div className="flex gap-3 text-green-800 text-sm">
                                                    <CheckCircle className="h-5 w-5 shrink-0" />
                                                    <p>
                                                        The object <strong>{selectedObject.name}</strong> is clean. It is either unique to one context or defined identically across contexts. No action needed.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="border rounded-lg overflow-hidden shadow-sm">
                                            <table className="w-full">
                                                <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                                                    <tr>
                                                        <th className="px-4 py-3 text-left w-1/3">Value / Definition</th>
                                                        <th className="px-4 py-3 text-left w-1/3">Contexts</th>
                                                        <th className="px-4 py-3 text-left w-1/3">Resolution Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-slate-100">
                                                    {selectedObject.instances.map((inst: any, i: number) => (
                                                        <tr key={i} className="hover:bg-slate-50/50">
                                                            <td className="px-4 py-3 font-mono text-sm text-slate-700 break-all">
                                                                {Array.isArray(inst.value) ? inst.value.join(', ') : inst.value}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                                                    {inst.context}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {(selectedObject as any).status === 'conflict' ? (
                                                                    <div className="flex items-center gap-2 text-sm text-slate-400">
                                                                        <ArrowRight className="h-3 w-3" />
                                                                        <span className="text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded">
                                                                            Rename to {selectedObject.name}_{inst.context.replace(/[^a-zA-Z0-9]/g, '').toUpperCase()}
                                                                        </span>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-center gap-2 text-sm text-green-600">
                                                                        <Check className="h-3 w-3" />
                                                                        <span>Keep as is</span>
                                                                    </div>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </ScrollArea>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
                                <LayoutDashboard className="h-12 w-12 mb-4 opacity-20" />
                                <p className="text-lg font-medium">Select an object to review details</p>
                                <p className="text-sm">Choose from the list on the left to see conflict resolution strategies.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <DialogContent className="sm:max-w-[95vw] w-[95vw] h-[95vh] p-0 overflow-hidden flex flex-col gap-0 bg-white">
            <DialogHeader className="px-6 py-4 border-b flex-none bg-white z-10">
                <DialogTitle className="flex items-center gap-2 text-xl">
                    <div className="p-2 bg-indigo-100 rounded-lg text-indigo-600">
                        <GitMerge className="h-6 w-6" />
                    </div>
                    Context Consolidation Wizard
                </DialogTitle>
                <DialogDescription>
                    Merge multiple contexts into a single unified policy. Review and resolve object conflicts.
                </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-hidden relative flex flex-col">
                {step === 1 && (
                    <div className="grid grid-cols-3 h-full divide-x">
                        {/* LEFT: Configuration */}
                        <div className="col-span-1 p-6 space-y-8 bg-slate-50/50">
                            <div>
                                <h3 className="text-lg font-semibold text-slate-900 mb-4">Unified Device Settings</h3>
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-medium">Target Device Name</label>
                                        <Input
                                            value={targetDeviceName}
                                            onChange={(e) => setTargetDeviceName(e.target.value)}
                                            placeholder="e.g. Unified-Firewall-v1"
                                            className="bg-white"
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            This will be the name of the new logical device created directly in your dashboard.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 text-sm text-blue-800 space-y-2">
                                <p className="font-semibold flex items-center gap-2">
                                    <CheckCircle className="h-4 w-4" />
                                    Consolidation Strategy
                                </p>
                                <ul className="list-disc list-inside space-y-1 opacity-90">
                                    <li>Objects with same name but different values will be <strong>Renamed</strong>.</li>
                                    <li>Unique objects are preserved.</li>
                                    <li>Identical objects are merged.</li>
                                </ul>
                            </div>
                        </div>

                        {/* RIGHT: Context Selection */}
                        <div className="col-span-2 flex flex-col h-full overflow-hidden bg-white">
                            <div className="p-4 border-b flex items-center justify-between gap-4">
                                <div className="flex items-center gap-2 font-medium">
                                    <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs">
                                        {selectedContextIds.length}
                                    </div>
                                    Contexts Selected
                                </div>
                                <div className="flex items-center gap-2 flex-1 max-w-sm">
                                    <Search className="h-4 w-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search contexts..."
                                        value={contextSearchTerm}
                                        onChange={(e) => setContextSearchTerm(e.target.value)}
                                        className="h-9"
                                    />
                                </div>
                                <Button variant="ghost" size="sm" onClick={toggleAllContexts}>
                                    {selectedContextIds.length === availableContexts.length ? 'Deselect All' : 'Select All'}
                                </Button>
                            </div>

                            <ScrollArea className="flex-1">
                                <div className="p-2 space-y-4">
                                    {/* Group contexts by parentName */}
                                    {(() => {
                                        const grouped = filteredContexts.reduce((acc, ctx) => {
                                            const key = (ctx.parentName && ctx.parentName !== 'Standalone') ? ctx.parentName : 'Standalone Devices';
                                            if (!acc[key]) acc[key] = [];
                                            acc[key].push(ctx);
                                            return acc;
                                        }, {} as Record<string, typeof availableContexts>);

                                        if (Object.keys(grouped).length === 0) {
                                            return (
                                                <div className="text-center p-8 text-muted-foreground text-sm">
                                                    No contexts found matching your search.
                                                </div>
                                            );
                                        }

                                        return (
                                            <div className="space-y-4">
                                                {Object.entries(grouped).map(([groupName, contexts]) => {
                                                    const allSelected = contexts.every(c => selectedContextIds.includes(c.id));
                                                    const someSelected = contexts.some(c => selectedContextIds.includes(c.id));
                                                    const isExpanded = expandedGroups[groupName] !== false; // Default true if undefined

                                                    return (
                                                        <div key={groupName} className="border rounded-lg overflow-hidden bg-slate-50 transition-all duration-200">
                                                            <div
                                                                className="flex items-center justify-between px-4 py-3 bg-slate-100/80 border-b hover:bg-slate-100 transition-colors cursor-pointer select-none"
                                                                onClick={() => setExpandedGroups(prev => ({ ...prev, [groupName]: !isExpanded }))}
                                                            >
                                                                <div className="flex items-center gap-3">
                                                                    <div
                                                                        className={`h-5 w-5 rounded border flex items-center justify-center transition-colors cursor-pointer z-10 ${allSelected
                                                                            ? 'bg-indigo-600 border-indigo-600'
                                                                            : someSelected
                                                                                ? 'bg-indigo-100 border-indigo-600'
                                                                                : 'bg-white border-slate-300'
                                                                            }`}
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const groupIds = contexts.map(c => c.id);
                                                                            let newIds = [...selectedContextIds];

                                                                            if (allSelected) {
                                                                                // Deselect all in group
                                                                                newIds = newIds.filter(id => !groupIds.includes(id));
                                                                            } else {
                                                                                // Select all in group (add missing ones)
                                                                                const missing = groupIds.filter(id => !newIds.includes(id));
                                                                                newIds = [...newIds, ...missing];
                                                                            }
                                                                            setSelectedContextIds(newIds);
                                                                        }}
                                                                    >
                                                                        {allSelected && <Check className="h-3 w-3 text-white" />}
                                                                        {!allSelected && someSelected && <div className="h-2 w-2 bg-indigo-600 rounded-sm" />}
                                                                    </div>
                                                                    <div className="font-semibold text-sm text-slate-700">{groupName}</div>
                                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-slate-200 text-slate-600 font-mono">
                                                                        {contexts.length}
                                                                    </Badge>
                                                                </div>
                                                                {isExpanded ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                                                            </div>

                                                            {isExpanded && (
                                                                <div className="p-2 space-y-1 bg-white max-h-[300px] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
                                                                    {contexts.map((context) => {
                                                                        const isSelected = selectedContextIds.includes(context.id);
                                                                        return (
                                                                            <div
                                                                                key={context.id}
                                                                                onClick={() => toggleContext(context.id)}
                                                                                className={`flex items-center gap-3 p-2.5 rounded-md cursor-pointer transition-all ml-8 hover:bg-slate-50 ${isSelected ? 'bg-indigo-50/50 text-indigo-900 border border-indigo-100' : 'text-slate-600 border border-transparent'
                                                                                    }`}
                                                                            >
                                                                                <div className={`h-4 w-4 rounded-sm border flex items-center justify-center transition-colors ${isSelected ? 'bg-indigo-600 border-indigo-600' : 'bg-white border-slate-300'
                                                                                    }`}>
                                                                                    {isSelected && <Check className="h-3 w-3 text-white" />}
                                                                                </div>
                                                                                <div className="font-medium text-sm truncate">{context.name}</div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })()}
                                </div>
                            </ScrollArea>
                        </div>
                    </div>
                )}

                {step === 2 && resolveAnalysisView()}

                {step === 3 && unifiedPolicy && (
                    <div className="flex flex-col items-center justify-center h-full space-y-6 animate-in fade-in zoom-in-95 duration-300">
                        <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center text-green-600 mb-2">
                            <CheckCircle className="h-12 w-12" />
                        </div>
                        <div className="text-center space-y-2 max-w-md">
                            <h2 className="text-2xl font-bold text-slate-900">Migration Successful!</h2>
                            <p className="text-muted-foreground">
                                Unified device <strong>{targetDeviceName}</strong> has been created with {unifiedPolicy.policy.objects.length || 0} objects and {unifiedPolicy.policy.rules.length || 0} rules.
                            </p>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <Button variant="outline" onClick={onClose}>Close Wizard</Button>
                        </div>
                    </div>
                )}

                {/* Loading Overlay */}
                {analyzing && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm z-50 flex flex-col items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-4" />
                        <h3 className="text-lg font-semibold text-slate-900">Analyzing Policy...</h3>
                        <p className="text-slate-500">Comparing objects across {selectedContextIds.length} contexts</p>
                    </div>
                )}
            </div>

            <DialogFooter className="border-t p-4 flex justify-between bg-white z-10 shrink-0">
                <Button variant="outline" onClick={onClose} disabled={analyzing}>
                    Cancel
                </Button>

                {step === 1 && (
                    <Button
                        onClick={handleAnalyze}
                        disabled={selectedContextIds.length < 2 || analyzing}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
                    >
                        {analyzing ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Analyzing...
                            </>
                        ) : (
                            <>
                                Analyze Conflicts <ArrowRight className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                )}

                {step === 2 && (
                    <div className="flex gap-3">
                        <Button variant="outline" onClick={() => setStep(1)} disabled={analyzing}>
                            Back
                        </Button>
                        <Button
                            onClick={handleExecute}
                            disabled={analyzing}
                            className="bg-green-600 hover:bg-green-700 text-white min-w-[140px]"
                        >
                            {analyzing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Merging...
                                </>
                            ) : (
                                <>
                                    Execute Merge ({conflictReport?.conflicts.length} Conflicts)
                                </>
                            )}
                        </Button>
                    </div>
                )}
            </DialogFooter>
        </DialogContent>
    );
}
