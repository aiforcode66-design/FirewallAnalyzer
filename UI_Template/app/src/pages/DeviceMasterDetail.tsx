
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
    Search,
    Server,
    Plus,
    LayoutGrid,
    Shield,
    CircleDashed,
    Monitor,
    ChevronDown,
    ChevronRight,
    Pencil,
    Trash2
} from 'lucide-react';

import DeviceDialog from '@/components/features/DeviceDialog';
import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

import { deviceService } from '@/services/deviceService';
import type { Device } from '@/types';
import DeviceDetail from './DeviceDetail'; // We'll reuse logic from here or refactor
import ContextDashboard from '@/components/features/ContextDashboard';
import { cn } from '@/lib/utils';

// --- Types ---
type GroupingType = 'all' | 'vendor' | 'status' | 'location';

export default function DeviceMasterDetail() {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: paramId } = useParams<{ id: string }>();

    const [devices, setDevices] = useState<Device[]>([]);
    const [loading, setLoading] = useState(true);
    // Sync state with URL param
    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(paramId || null);

    useEffect(() => {
        if (paramId) {
            setSelectedDeviceId(paramId);
        }
    }, [paramId]);
    const [searchQuery, setSearchQuery] = useState('');
    const [grouping, setGrouping] = useState<GroupingType>('all');
    // Expanded state for Sidebar Tree items
    const [expandedDevices, setExpandedDevices] = useState<Set<string>>(new Set());

    // --- Device Dialog State ---
    const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
    const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);

    // Mock vendors for now or load if needed (DeviceDialog handles it internally too)
    // We can keep specific vendor loading if used for filtering in sidebar, else remove.
    // Keeping it for grouping logic if needed.
    // const [vendors, setVendors] = useState<any[]>([]);

    useEffect(() => {
        // const loadVendors = async () => {
        //      try {
        //         const data = await vendorService.getVendors();
        //         setVendors(data);
        //     } catch (err) {
        //         console.error("Failed to load vendors", err);
        //     }
        // };
        // loadVendors();
    }, []);

    const handleDeleteDevice = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to delete ${name}?`)) return;
        try {
            await deviceService.deleteDevice(id);
            toast.success("Device deleted");
            refreshDevices();
            if (selectedDeviceId === id) {
                setSelectedDeviceId(null);
                navigate('/app/devices');
            }
        } catch (err) {
            toast.error("Failed to delete device");
        }
    };
    // Fetch Devices
    const refreshDevices = async () => {
        try {
            setLoading(true);
            const data = await deviceService.getDevices();
            setDevices(data);
            if (data.length > 0) {
                if (paramId) {
                    setSelectedDeviceId(paramId);
                    // Open parent if it's a child context
                    // const device = data.find(d => d.id === paramId) ||
                    //    data.flatMap(d => d.subDevices || []).find(d => d.id === paramId);
                    // Disable auto-expand
                    /* if (device && device.parentDeviceId) {
                        setExpandedDevices(prev => new Set(prev).add(device.parentDeviceId!));
                    } */
                } else if (!selectedDeviceId) {
                    // Default to first device and update URL replace
                    setSelectedDeviceId(data[0].id);
                    navigate(`/app/devices/${data[0].id}${location.search}`, { replace: true });
                }
            }
        } catch (error) {
            console.error("Failed to fetch devices", error);
        } finally {
            setLoading(false);
        }
    };

    // Fetch Devices on Mount
    useEffect(() => {
        refreshDevices();
    }, []);

    // Selection Handler
    const handleDeviceSelect = (id: string) => {
        if (id === selectedDeviceId) return;
        navigate(`/app/devices/${id}${location.search}`);
    };

    const toggleExpand = (e: React.MouseEvent, deviceId: string) => {
        e.stopPropagation();
        const newSet = new Set(expandedDevices);
        if (newSet.has(deviceId)) {
            newSet.delete(deviceId);
        } else {
            newSet.add(deviceId);
        }
        setExpandedDevices(newSet);
    };

    // Filter Logic
    const filteredDevices = devices.filter(d => {
        // Exclude child contexts from top-level list
        if (d.parentDeviceId) return false;

        const matchParent = d.name.toLowerCase().includes(searchQuery.toLowerCase()) || d.ipAddress.includes(searchQuery);
        // Also check if any child matches
        const matchChild = d.subDevices?.some(sub =>
            sub.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (sub.ipAddress || '').includes(searchQuery)
        );
        return matchParent || matchChild;
    });

    // Grouping Logic
    const groupedDevices = () => {
        if (grouping === 'all') return { "All Devices": filteredDevices };
        if (grouping === 'vendor') {
            return filteredDevices.reduce((acc, dev) => {
                const key = dev.vendor?.displayName || 'Unknown';
                if (!acc[key]) acc[key] = [];
                acc[key].push(dev);
                return acc;
            }, {} as Record<string, Device[]>);
        }
        // Add other groupings as needed
        return { "Devices": filteredDevices };
    };

    const groups = groupedDevices();

    // Derived state for passing to Detail
    const selectedDevice = devices.find(d => d.id === selectedDeviceId) ||
        devices.flatMap(d => d.subDevices || []).find(d => d.id === selectedDeviceId);

    return (
        <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-white">
            {/* --- LEFT SIDEBAR (MASTER) --- */}
            <div className="w-[300px] bg-slate-50/50 border-r border-slate-200 flex flex-col shrink-0 z-20">
                {/* Sidebar Header */}
                <div className="p-4 space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="font-bold text-base text-slate-900 tracking-tight">Devices</h2>
                        <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                                setDeviceToEdit(null);
                                setIsDeviceDialogOpen(true);
                            }}
                            className="h-8 w-8 hover:bg-slate-200 text-slate-500 hover:text-slate-900 rounded-full transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
                        <Input
                            placeholder="Search fleet..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9 bg-white border-slate-200 shadow-sm focus-visible:ring-slate-200 focus-visible:border-slate-300 transition-all h-9 text-sm"
                        />
                    </div>

                    {/* Minimalist Segmented Control */}
                    <div className="flex p-1 bg-slate-100/50 rounded-lg border border-slate-100">
                        {(['all', 'vendor', 'status'] as const).map((g) => (
                            <button
                                key={g}
                                onClick={() => setGrouping(g)}
                                className={cn(
                                    "flex-1 py-1 text-[11px] font-medium rounded-md transition-all capitalize",
                                    grouping === g
                                        ? "bg-white text-slate-900 shadow-sm border border-slate-100"
                                        : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                                )}
                            >
                                {g}
                            </button>
                        ))}
                    </div>
                </div>

                <Separator className="bg-slate-100" />

                {/* Device List */}
                <ScrollArea className="flex-1">
                    <div className="px-3 py-4 space-y-6">
                        {loading ? (
                            <div className="flex flex-col items-center justify-center py-12 space-y-3 opacity-50">
                                <div className="relative">
                                    <div className="absolute inset-0 bg-orange-100 blur-xl rounded-full opacity-50 animate-pulse"></div>
                                    <CircleDashed className="h-6 w-6 animate-spin text-orange-500 relative z-10" />
                                </div>
                            </div>
                        ) : Object.entries(groups).map(([groupName, groupDevices]) => (
                            <div key={groupName} className="space-y-1">
                                {grouping !== 'all' && (
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2 flex items-center gap-2">
                                        {groupName}
                                        <Badge variant="secondary" className="h-4 px-1 text-[9px] bg-slate-100 text-slate-500 hover:bg-slate-100 border-0">{groupDevices.length}</Badge>
                                    </h3>
                                )}
                                <div className="space-y-0.5">
                                    {groupDevices.map((device) => {
                                        const isSelected = selectedDeviceId === device.id;
                                        const hasContexts = device.subDevices && device.subDevices.length > 0;
                                        const isExpanded = expandedDevices.has(device.id);

                                        return (
                                            <div key={device.id} className="group/item">
                                                <ContextMenu>
                                                    <ContextMenuTrigger>
                                                        {/* Parent Item */}
                                                        <div
                                                            onClick={() => handleDeviceSelect(device.id)}
                                                            className={cn(
                                                                "relative flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all duration-200 select-none group-hover/item:bg-white group-hover/item:shadow-sm border border-transparent",
                                                                isSelected
                                                                    ? "bg-white shadow-sm ring-1 ring-slate-200 z-10"
                                                                    : "hover:border-slate-100"
                                                            )}
                                                        >
                                                            {/* Status Ring */}
                                                            <div className="relative shrink-0">
                                                                <div className={cn(
                                                                    "w-8 h-8 rounded-lg flex items-center justify-center transition-colors bg-white border border-slate-100",
                                                                    device.status === 'active' ? "text-emerald-600" : "text-slate-400"
                                                                )}>
                                                                    {device.vendor?.displayName?.startsWith('Cisco') ? <Shield className="h-4 w-4" /> :
                                                                        device.vendor?.displayName?.startsWith('Palo') ? <LayoutGrid className="h-4 w-4" /> :
                                                                            <Server className="h-4 w-4" />}
                                                                </div>
                                                                <span className={cn(
                                                                    "absolute -top-1 -right-1 flex h-2.5 w-2.5",
                                                                    device.status === 'active' ? "" : "hidden"
                                                                )}>
                                                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border-2 border-white"></span>
                                                                </span>
                                                                {device.status !== 'active' && (
                                                                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 border-2 border-white bg-slate-300 rounded-full" />
                                                                )}
                                                            </div>

                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center justify-between">
                                                                    <h4 className={cn("text-sm font-medium truncate transition-colors", isSelected ? "text-slate-900" : "text-slate-700")}>
                                                                        {device.name}
                                                                    </h4>
                                                                    {hasContexts && (
                                                                        <Button
                                                                            variant="ghost"
                                                                            size="icon"
                                                                            className="h-5 w-5 -mr-1 hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                                                                            onClick={(e) => toggleExpand(e, device.id)}
                                                                        >
                                                                            {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                                                                        </Button>
                                                                    )}
                                                                </div>
                                                                <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5 opacity-80">{device.ipAddress}</p>
                                                            </div>
                                                        </div>
                                                    </ContextMenuTrigger>
                                                    <ContextMenuContent>
                                                        <ContextMenuItem onClick={() => {
                                                            setDeviceToEdit(device);
                                                            setIsDeviceDialogOpen(true);
                                                        }}>
                                                            <Pencil className="h-4 w-4 mr-2" />
                                                            Edit Device
                                                        </ContextMenuItem>
                                                        <ContextMenuItem
                                                            className="text-red-600 focus:text-red-600"
                                                            onClick={() => handleDeleteDevice(device.id, device.name)}
                                                        >
                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                            Delete Device
                                                        </ContextMenuItem>
                                                    </ContextMenuContent>
                                                </ContextMenu>

                                                {/* Contexts Tree */}
                                                <AnimatePresence>
                                                    {hasContexts && isExpanded && (
                                                        <motion.div
                                                            initial={{ height: 0, opacity: 0 }}
                                                            animate={{ height: "auto", opacity: 1 }}
                                                            exit={{ height: 0, opacity: 0 }}
                                                            className="ml-5 pl-3 border-l-[1.5px] border-slate-200/60 pb-1 space-y-0.5 overflow-hidden"
                                                        >
                                                            {device.subDevices?.map(sub => (
                                                                <ContextMenu key={sub.id}>
                                                                    <ContextMenuTrigger>
                                                                        <div
                                                                            className={cn(
                                                                                "relative flex items-center gap-2.5 px-2 py-2 rounded-md text-sm cursor-pointer transition-colors group/sub",
                                                                                selectedDeviceId === sub.id
                                                                                    ? "bg-slate-100 text-slate-900 font-medium"
                                                                                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                                                            )}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleDeviceSelect(sub.id);
                                                                            }}
                                                                        >
                                                                            {/* Connector Line Visual */}
                                                                            <div className="absolute -left-[13px] top-1/2 w-2.5 h-[1.5px] bg-slate-200/60" />

                                                                            <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", sub.status === 'active' ? "bg-emerald-500" : "bg-slate-300")} />
                                                                            <span className="truncate text-xs">{sub.name}</span>
                                                                        </div>
                                                                    </ContextMenuTrigger>
                                                                    <ContextMenuContent>
                                                                        <ContextMenuItem onClick={() => {
                                                                            setDeviceToEdit({ ...sub, vendorId: device.vendorId } as Device);
                                                                            setIsDeviceDialogOpen(true);
                                                                        }}>
                                                                            <Pencil className="h-4 w-4 mr-2" />
                                                                            Edit Context
                                                                        </ContextMenuItem>
                                                                        <ContextMenuItem
                                                                            className="text-red-600 focus:text-red-600"
                                                                            onClick={() => handleDeleteDevice(sub.id, sub.name)}
                                                                        >
                                                                            <Trash2 className="h-4 w-4 mr-2" />
                                                                            Delete Context
                                                                        </ContextMenuItem>
                                                                    </ContextMenuContent>
                                                                </ContextMenu>
                                                            ))}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                    <span>
                        {devices.length} Physical • {devices.reduce((acc, d) => acc + (d.subDevices?.length || 0), 0)} Virtual
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-50 animate-pulse" />
                        Online
                    </span>
                </div>
            </div>

            {/* --- RIGHT CONTENT (DETAIL) --- */}
            <div className="flex-1 flex flex-col min-w-0 bg-white">
                {selectedDeviceId ? (
                    <motion.div
                        key={selectedDeviceId}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.2 }}
                        className="h-full flex flex-col"
                    >
                        <div className="flex-1 overflow-auto">
                            <DetailWrapper
                                deviceId={selectedDeviceId}
                                parentDevice={selectedDevice as any}
                                onDataChange={refreshDevices}
                                onDelete={() => {
                                    refreshDevices();
                                    setSelectedDeviceId(null);
                                    navigate('/app/devices');
                                }}
                                onSelectDevice={handleDeviceSelect}
                            />
                        </div>
                    </motion.div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-slate-300 bg-slate-50/30">
                        <Monitor className="h-16 w-16 mb-4 opacity-50 stroke-[1.5]" />
                        <p className="font-medium text-slate-400">Select a device to view details</p>
                    </div>
                )}
            </div>

            {/* --- DEVICE DIALOG --- */}
            <DeviceDialog
                isOpen={isDeviceDialogOpen}
                onClose={() => {
                    setIsDeviceDialogOpen(false);
                    setDeviceToEdit(null);
                }}
                onSuccess={() => {
                    refreshDevices();
                }}
                deviceToEdit={deviceToEdit}
            />
        </div>
    );
}

// Wrapper to bridge the selection to the 'Page' component logic
//Ideally we refactor DeviceDetail to take props.


function DetailWrapper({ deviceId, onDelete, onDataChange, parentDevice, onSelectDevice }: { deviceId: string, onDelete: () => void, onDataChange: () => void, parentDevice?: Device | null, onSelectDevice: (id: string) => void }) {
    // If it's a parent device with contexts, show Dashboard
    if (parentDevice && parentDevice.subDevices && parentDevice.subDevices.length > 0) {
        return (
            <ContextDashboard
                parentDevice={parentDevice}
                onSelectContext={(ctxId) => onSelectDevice(ctxId)}
                onDelete={onDelete}
                onDataChange={onDataChange}
            />
        );
    }
    // Otherwise show standard detail
    return <DeviceDetail overrideId={deviceId} onDelete={onDelete} onDataChange={onDataChange} />;
}
