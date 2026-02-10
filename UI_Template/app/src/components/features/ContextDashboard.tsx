import { useState, useEffect } from 'react';
import {
    Search,
    ArrowUpDown,

    Activity,
    FileText,
    Database,
    Edit2,
    Trash2,
    GitMerge,
    CheckCircle2
} from 'lucide-react';
import { toast } from 'sonner';
import { deviceService } from '@/services/deviceService';
import type { Device } from '@/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';

import {
    Dialog,
} from "@/components/ui/dialog";
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import MigrationWizard from '@/components/features/MigrationWizard';
import DeviceDialog from '@/components/features/DeviceDialog';

interface ContextDashboardProps {
    parentDevice: Device;
    onSelectContext?: (contextId: string) => void;
    onDelete?: () => void;
    onDataChange?: () => void;
}

export default function ContextDashboard({ parentDevice, onSelectContext, onDataChange }: ContextDashboardProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
    const [showMergeWizard, setShowMergeWizard] = useState(false);
    const [allContexts, setAllContexts] = useState<{ id: string, name: string, parentName?: string }[]>([]);
    const [isLoadingContexts, setIsLoadingContexts] = useState(false);
    // Edit Device State
    const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
    const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);
    const [initSelectedIds, setInitSelectedIds] = useState<string[]>([]);

    // Mock data enrichment (since basic Device type might not have all stats yet)
    // In real app, subDevices would be fully populated
    const contexts = parentDevice.subDevices || [];

    const handleSort = (key: string) => {
        let direction: 'asc' | 'desc' = 'asc';
        if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
            direction = 'desc';
        }
        setSortConfig({ key, direction });
    };

    const sortedContexts = [...contexts].filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.ipAddress || '').includes(searchQuery)
    ).sort((a, b) => {
        if (!sortConfig) return 0;

        const aValue = sortConfig.key === 'name' ? a.name :
            sortConfig.key === 'ip' ? (a.ipAddress || '') : '';
        const bValue = sortConfig.key === 'name' ? b.name :
            sortConfig.key === 'ip' ? (b.ipAddress || '') : '';

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    // Fetch ALL contexts when wizard opens to allow cross-parent merging
    useEffect(() => {
        if (showMergeWizard) {
            const fetchAllContexts = async () => {
                try {
                    setIsLoadingContexts(true);
                    const allDevices = await deviceService.getDevices();
                    const flattened: { id: string, name: string, parentName?: string }[] = [];

                    allDevices.forEach(d => {
                        const parentName = d.name;
                        if (d.subDevices && d.subDevices.length > 0) {
                            d.subDevices.forEach(sub => {
                                flattened.push({
                                    id: sub.id,
                                    name: sub.name,
                                    parentName: parentName
                                });
                            });
                        } else {
                            // Standalone device can also be a context/source
                            flattened.push({
                                id: d.id,
                                name: d.name,
                                parentName: 'Standalone'
                            });
                        }
                    });
                    setAllContexts(flattened);
                } catch (err) {
                    console.error("Failed to fetch all contexts for merge:", err);
                    toast.error("Could not load all contexts. Showing local only.");
                    // Fallback to local contexts
                    setAllContexts(contexts.map(c => ({ id: c.id, name: c.name, parentName: parentDevice.name })));
                } finally {
                    setIsLoadingContexts(false);
                }
            };
            fetchAllContexts();
        }
    }, [showMergeWizard, contexts, parentDevice.name]);

    return (
        <div className="h-full flex flex-col bg-white">
            {/* Header Dashboard Stats for Parent */}
            <div className="p-6 border-b bg-gray-50/50 space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight text-gray-900">{parentDevice.name}</h2>
                        <p className="text-gray-500 text-sm mt-1">Multi-Context Firewall • {contexts.length} Active Contexts</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            className="text-purple-600 bg-purple-50 border-purple-200 hover:bg-purple-100"
                            onClick={() => {
                                setInitSelectedIds([]);
                                setShowMergeWizard(true);
                            }}
                        >
                            <GitMerge className="mr-2 h-4 w-4" />
                            Merge/Consolidate
                        </Button>

                    </div>
                </div>

                <div className="grid grid-cols-4 gap-4">
                    <div className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Contexts</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{contexts.length}</h3>
                            </div>
                            <Database className="h-5 w-5 text-orange-500 opacity-80" />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Total Policy</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">
                                    {contexts.reduce((sum, ctx) => sum + (ctx.rulesCount || 0), 0)}
                                </h3>
                            </div>
                            <FileText className="h-5 w-5 text-blue-500 opacity-80" />
                        </div>
                    </div>
                    <div className="bg-white p-4 rounded-lg border shadow-sm">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-xs font-medium text-gray-500 uppercase">Health</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <h3 className="text-lg font-bold text-green-600">100%</h3>
                                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                                </div>
                            </div>
                            <Activity className="h-5 w-5 text-green-500 opacity-80" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Table Controls */}
            <div className="p-4 border-b flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="Search contexts by name or IP..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Showing {sortedContexts.length} contexts</span>
                </div>
            </div>

            {/* Dense Table */}
            <div className="flex-1 overflow-auto bg-white">
                <Table>
                    <TableHeader className="bg-gray-50 sticky top-0 z-10">
                        <TableRow>
                            <TableHead className="w-[40px]"></TableHead>
                            <TableHead className="cursor-pointer hover:text-gray-900" onClick={() => handleSort('name')}>
                                <div className="flex items-center gap-2">Name <ArrowUpDown className="h-3 w-3" /></div>
                            </TableHead>
                            <TableHead className="cursor-pointer hover:text-gray-900" onClick={() => handleSort('ip')}>
                                <div className="flex items-center gap-2">IP Address <ArrowUpDown className="h-3 w-3" /></div>
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Rules</TableHead>

                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {sortedContexts.map((context) => (
                            <ContextMenu key={context.id}>
                                <ContextMenuTrigger asChild>
                                    <TableRow
                                        className="group hover:bg-orange-50/30 cursor-pointer transition-colors"
                                        onClick={() => onSelectContext?.(context.id)}
                                    >
                                        <TableCell>
                                            <div className="h-2 w-2 rounded-full bg-green-500" />
                                        </TableCell>
                                        <TableCell className="font-medium">
                                            <div
                                                className="font-medium text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onSelectContext?.(context.id);
                                                }}
                                            >
                                                {context.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs text-gray-600">
                                            {context.ipAddress}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] px-2 py-0">
                                                Active
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600 text-sm">
                                            {context.rulesCount || 0}
                                        </TableCell>

                                    </TableRow>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                    <ContextMenuItem onClick={() => {
                                        setDeviceToEdit({ ...context, vendorId: parentDevice.vendorId } as Device);
                                        setIsDeviceDialogOpen(true);
                                    }}>
                                        <Edit2 className="mr-2 h-4 w-4" />
                                        Edit Context
                                    </ContextMenuItem>
                                    <ContextMenuItem
                                        className="text-red-600 focus:text-red-600"
                                        onClick={async () => {
                                            if (confirm(`Delete context ${context.name}?`)) {
                                                try {
                                                    await deviceService.deleteDevice(context.id);
                                                    toast.success("Context deleted");
                                                    onDataChange?.();
                                                } catch (err) {
                                                    toast.error("Failed to delete context");
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Delete Context
                                    </ContextMenuItem>
                                </ContextMenuContent>
                            </ContextMenu>
                        ))}
                        {sortedContexts.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    No contexts found matching your search.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Merge Wizard Dialog */}
            <Dialog open={showMergeWizard} onOpenChange={setShowMergeWizard}>
                {isLoadingContexts ? (
                    <div className="flex items-center justify-center p-8 bg-white/80 backdrop-blur-sm fixed inset-0 z-50">
                        <div className="flex flex-col items-center gap-4">
                            <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            <p className="text-indigo-600 animate-pulse font-medium">Loading all contexts for global merge...</p>
                        </div>
                    </div>
                ) : (
                    <MigrationWizard
                        availableContexts={allContexts.length > 0 ? allContexts : contexts.map(c => ({ id: c.id, name: c.name, parentName: parentDevice.name }))}
                        initialSelectedIds={initSelectedIds}
                        onClose={() => setShowMergeWizard(false)}
                        onMigrationSuccess={() => {
                            onDataChange?.();
                        }}
                    />
                )}
            </Dialog>

            {/* Device Dialog */}
            <DeviceDialog
                isOpen={isDeviceDialogOpen}
                onClose={() => {
                    setIsDeviceDialogOpen(false);
                    setDeviceToEdit(null);
                }}
                onSuccess={() => {
                    onDataChange?.();
                }}
                deviceToEdit={deviceToEdit}
            />
        </div>
    );
}
