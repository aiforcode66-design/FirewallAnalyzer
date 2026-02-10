import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
    Server,
    Clock,
    MapPin,
    MoreVertical,
    Trash2,
    UploadCloud,
    RefreshCw,
    ArrowLeft,
    LayoutDashboard,
    FileCode2,
    Zap,
    History,
    Layers,
    Eraser,
    Copy,
    ShieldAlert,
    Box,
    AlertOctagon,
    Activity,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { deviceService } from '@/services/deviceService';
import type { Device } from '@/types';
import apiClient from '@/lib/api-client';
import { API_CONFIG } from '@/lib/api-config';
import MergerView from '@/components/features/MergerView';
import UnusedRulesView from '@/components/features/UnusedRulesView';
import RulesView from '@/components/features/RulesView';
import ChangeHistoryView from '@/components/features/ChangeHistoryView';
import ReportsView from '@/components/features/ReportsView';
import ShadowedRulesView from '@/components/features/ShadowedRulesView';
import UnusedObjectsView from '@/components/features/UnusedObjectsView';
import DeviceOverview from '@/components/features/DeviceOverview';
import CriticalRulesView from '@/components/features/CriticalRulesView';
import TrafficAnalysisView from '@/components/features/TrafficAnalysisView';
import { analyzerService } from '@/services/analyzerService';

import { cn } from '@/lib/utils';

// Mock data for charts


// Add props support
interface DeviceDetailProps {
    overrideId?: string;
    onDelete?: () => void;
    onDataChange?: () => void;
}

export default function DeviceDetail({ overrideId, onDelete, onDataChange }: DeviceDetailProps = {}) {
    const { id: paramId } = useParams<{ id: string }>();
    const id = overrideId || paramId;
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Derived state from URL or defaults
    const activeTab = searchParams.get('tab') || 'overview';
    const activeOptimizerTab = searchParams.get('view') || 'critical';

    // Helpers to update URL params
    const updateTab = (tab: string) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', tab);
            return newParams;
        });
    };

    const updateOptimizerTab = (view: string) => {
        setSearchParams(prev => {
            const newParams = new URLSearchParams(prev);
            newParams.set('tab', 'optimize');
            newParams.set('view', view);
            return newParams;
        });
    };

    const [device, setDevice] = useState<Device | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<any | null>(null);
    const [criticalRiskCount, setCriticalRiskCount] = useState(0);
    const [hasAnalysis, setHasAnalysis] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Sync stats from children & backend summary
    const [counts, setCounts] = useState({
        unusedRules: 0,
        unusedObjects: 0,
        shadowedRules: 0,
        redundantRules: 0,
        criticalRisks: 0
    });

    const refreshStats = async () => {
        if (!id) return;
        try {
            const summary = await analyzerService.getStatsSummary(id);
            setCounts(prev => ({
                ...prev,
                ...summary
            }));
            // Also update hasAnalysis status based on summary
            if (summary.hasAnalysis !== undefined) {
                setHasAnalysis(summary.hasAnalysis);
            }
        } catch (err) {
            console.error("Failed to load stats summary:", err);
        }
    };

    useEffect(() => {
        if (id) {
            refreshStats();
        }
    }, [id, refreshKey]);

    const handleStatsUpdate = useCallback((type: string, count: number) => {
        setCounts(prev => {
            // @ts-ignore
            if (prev[type] === count) return prev;
            return { ...prev, [type]: count };
        });
    }, []);

    const [configContent, setConfigContent] = useState<string>('');
    const [showConfigDialog, setShowConfigDialog] = useState(false);
    const [configLoading, setConfigLoading] = useState(false);
    const [showDeleteAlert, setShowDeleteAlert] = useState(false);

    // Fetch config content when dialog opens
    useEffect(() => {
        if (showConfigDialog && id) {
            setConfigLoading(true);
            deviceService.getDeviceConfigContent(id)
                .then(data => setConfigContent(data.content))
                .catch(err => {
                    console.error("Failed to load config:", err);
                    setConfigContent("Error loading configuration.");
                    toast.error("Failed to load configuration");
                })
                .finally(() => setConfigLoading(false));
        }
    }, [showConfigDialog, id]);

    const handleDeleteDevice = async () => {
        if (!id) return;
        try {
            await deviceService.deleteDevice(id);
            toast.success("Device deleted successfully");
            setShowDeleteAlert(false);

            if (onDelete) {
                onDelete();
            } else {
                navigate('/devices');
            }
        } catch (error) {
            console.error("Delete failed", error);
            toast.error("Failed to delete device");
        }
    };

    const handleUploadConfig = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.[0] || !id) return;

        try {
            const file = e.target.files[0];
            const promise = deviceService.uploadDeviceConfig(id, file);

            toast.promise(promise, {
                loading: 'Uploading configuration...',
                success: 'Configuration uploaded successfully',
                error: 'Failed to upload configuration'
            });


            await promise;
            // Silent refresh
            await loadDeviceData(false);
            setRefreshKey(prev => prev + 1);

            // Notify parent to refresh list (e.g. for new contexts)
            if (onDataChange) {
                onDataChange();
            }
        } catch (error) {
            console.error("Upload error:", error);
        } finally {
            // Reset input
            e.target.value = '';
        }
    };

    const [isAnalyzing, setIsAnalyzing] = useState(false);

    const handleRunAnalysis = async () => {
        if (!id) return;
        try {
            setIsAnalyzing(true);
            const promise = analyzerService.startAnalysis({
                device_id: id,
                type: 'optimization'
            });

            toast.promise(promise, {
                loading: 'Running comprehensive analysis...',
                success: 'Analysis completed successfully',
                error: 'Analysis failed'
            });

            await promise;
            // Silent refresh
            await loadDeviceData(false);
            setRefreshKey(prev => prev + 1);

            // Ensure we are on the optimize tab to see results (optional, but good UX)
            if (activeTab === 'overview') {
                updateTab('optimize');
            }

        } catch (error) {
            console.error("Analysis error:", error);
        } finally {
            setIsAnalyzing(false);
        }
    };

    const loadDeviceData = async (showLoading = true) => {
        if (!id) return;
        try {
            if (showLoading) setLoading(true);
            const [deviceRes, statsRes, criticalRes, historyRes] = await Promise.all([
                apiClient.get(API_CONFIG.ENDPOINTS.DEVICES.GET(id)),
                apiClient.get(API_CONFIG.ENDPOINTS.DEVICES.STATS(id)),
                apiClient.get(`/api/analyzer/${id}/critical-risks`),
                apiClient.get(`/api/analyzer/device/${id}?limit=1`)
            ]);

            setDevice(deviceRes.data);
            setStats(statsRes.data);
            setCriticalRiskCount(criticalRes.data.length);
            setHasAnalysis(historyRes.data && historyRes.data.length > 0);



        } catch (error) {
            console.error('Failed to load device details:', error);
            toast.error('Failed to load device information');
            navigate('/devices');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    useEffect(() => {
        loadDeviceData();
    }, [id, navigate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-gray-500 animate-pulse">Loading device telemetry...</p>
                </div>
            </div>
        );
    }

    if (!device) return null;

    // Default stats if API fails or returns null
    const safeStats = stats || {
        security_score: 0,
        risk_profile: [],
        optimization_score: 0,
        unused_rules_count: 0,
        total_rules_count: 0,
        activity_trend: []
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white/80 backdrop-blur-md p-4 rounded-xl border border-gray-200/50 shadow-sm sticky top-4 z-40 transition-all duration-200 hover:shadow-md supports-[backdrop-filter]:bg-white/60">
                {!overrideId && (
                    <Button variant="ghost" size="icon" onClick={() => navigate('/devices')} className="hover:bg-gray-100 shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                )}
                <div className="flex-1">
                    <div className="flex items-center gap-3">
                        {/* CONTEXT SWITCHER LOGIC - SIMPLIFIED (Dropdown removed as per user request) */}
                        {device.subDevices && device.subDevices.length > 0 ? (
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{device.name}</h1>
                                <Badge variant="outline" className="text-sm font-normal bg-purple-50 text-purple-700 border-purple-200">
                                    Parent
                                </Badge>
                            </div>
                        ) : device.parentDeviceId ? (
                            // IF CHILD, SHOW PARENT LINK (Removed as per user request - sidebar handles nav)
                            <div className="flex flex-col">
                                <h1 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
                                    <Layers className="h-6 w-6 text-purple-600" />
                                    {device.name}
                                </h1>
                            </div>
                        ) : (
                            // STANDARD DEVICE
                            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{device.name}</h1>
                        )}

                        <Badge variant={device.status === 'active' ? 'default' : 'secondary'} className={cn(
                            "px-2.5 py-0.5 capitalize hidden sm:inline-flex shadow-none border-0 ring-1 ring-inset",
                            device.status === 'active'
                                ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20 hover:bg-emerald-100'
                                : 'bg-gray-50 text-gray-600 ring-gray-500/10 hover:bg-gray-100'
                        )}>
                            <div className={cn(
                                "w-1.5 h-1.5 rounded-full mr-1.5",
                                device.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-gray-400"
                            )} />
                            {device.status}
                        </Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 text-sm text-gray-500">
                        <div className="flex items-center gap-1.5">
                            <Server className="h-3.5 w-3.5 text-gray-400" />
                            <span className="font-medium text-gray-700">{device.model}</span>
                            <span className="text-gray-300 mx-1">•</span>
                            <span className="text-gray-600">{device.vendor?.displayName || 'Unknown Vendor'}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5 text-gray-400" />
                            <span className="text-gray-600">{device.location || 'HQ - Data Center'}</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            <Clock className={cn("h-3.5 w-3.5", device.status === 'active' ? "text-emerald-500" : "text-gray-400")} />
                            <span className="text-gray-600">
                                {device.status === 'active' ? <span className="text-emerald-700 font-medium">Live</span> : new Date(device.lastSeen).toLocaleTimeString()}
                            </span>
                        </div>

                        {device.configDate && (
                            <div className="flex items-center gap-1.5 ml-auto sm:ml-0 bg-blue-50/50 px-2 py-0.5 rounded-full border border-blue-100/50">
                                <FileCode2 className="h-3 w-3 text-blue-600" />
                                <span className="text-xs font-medium text-blue-700">
                                    {new Intl.DateTimeFormat('en-GB', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                        second: '2-digit',
                                        timeZone: 'Asia/Jakarta',
                                        timeZoneName: 'short'
                                    }).format(new Date(device.configDate)).replace('GMT+7', 'WIB')}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {activeTab === 'optimize' && (
                        <Button
                            onClick={handleRunAnalysis}
                            disabled={isAnalyzing}
                            className="gap-2 hidden lg:flex bg-orange-500 hover:bg-orange-600 text-white"
                        >
                            {isAnalyzing ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                            ) : (
                                <Zap className="h-4 w-4" />
                            )}
                            {isAnalyzing ? 'Analyzing...' : 'Start Analysis'}
                        </Button>
                    )}
                    <Button variant="outline" className="gap-2 hidden lg:flex">
                        <RefreshCw className="h-4 w-4" /> Sync Stats
                    </Button>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => document.getElementById('config-upload')?.click()}>
                                <UploadCloud className="h-4 w-4" /> Upload New Config
                            </DropdownMenuItem>
                            <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => setShowConfigDialog(true)}>
                                <FileCode2 className="h-4 w-4" /> View Raw Source
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="gap-2 text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
                                onClick={() => setShowDeleteAlert(true)}
                            >
                                <Trash2 className="h-4 w-4" /> Remove Device
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                    <input
                        type="file"
                        id="config-upload"
                        className="hidden"
                        accept=".cfg,.txt,.conf,.zip"
                        onChange={handleUploadConfig}
                    />
                </div>
            </div>

            {/* View Config Dialog */}
            <Dialog open={showConfigDialog} onOpenChange={setShowConfigDialog}>
                <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Device Configuration</DialogTitle>
                        <DialogDescription>
                            Raw configuration source for {device.name}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-auto bg-slate-950 p-4 rounded-md font-mono text-sm text-slate-50 mt-4">
                        {configLoading ? (
                            <div className="flex items-center justify-center h-full text-slate-400">
                                <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                                Loading configuration...
                            </div>
                        ) : (
                            <pre className="whitespace-pre-wrap">{configContent || "No configuration content available."}</pre>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Empty State for New Devices (Only for Parents/Standalone) */}
            {!device.configDate && !device.parentDeviceId && (
                <div className="flex flex-col items-center justify-center py-16 bg-white border border-dashed border-gray-300 rounded-xl">
                    <div className="bg-orange-50 p-4 rounded-full mb-4 animate-pulse">
                        <UploadCloud className="h-10 w-10 text-orange-600" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Setup Required</h3>
                    <p className="text-gray-500 text-center max-w-md mb-6">
                        This device has no configuration data. Upload a configuration file (running-config) to start analyzing security risks and optimizations.
                    </p>
                    <div className="flex gap-4">
                        <Button
                            onClick={() => document.getElementById('config-upload-empty')?.click()}
                            className="bg-orange-500 hover:bg-orange-600 text-white gap-2 shadow-lg shadow-orange-200"
                        >
                            <UploadCloud className="h-4 w-4" />
                            Upload Configuration
                        </Button>
                        <input
                            type="file"
                            id="config-upload-empty"
                            className="hidden"
                            accept=".cfg,.txt,.conf,.zip"
                            onChange={handleUploadConfig}
                        />
                    </div>
                </div>
            )}

            {/* Main Content - Only show if config exists OR if it's a context (inherited) */}
            {(device.configDate || device.parentDeviceId) && (
                <Tabs value={activeTab} onValueChange={updateTab} className="space-y-6">
                    <TabsList className="grid w-full grid-cols-5 lg:w-[600px] h-auto p-1 bg-white border border-gray-200 shadow-sm rounded-lg">
                        <TabsTrigger value="overview" className="gap-2 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 data-[state=active]:shadow-sm transition-all">
                            <LayoutDashboard className="h-4 w-4" /> Overview
                        </TabsTrigger>
                        <TabsTrigger value="rules" className="gap-2 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 data-[state=active]:shadow-sm transition-all">
                            <FileCode2 className="h-4 w-4" /> Rules
                        </TabsTrigger>
                        <TabsTrigger value="optimize" className="gap-2 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 data-[state=active]:shadow-sm transition-all">
                            <Zap className="h-4 w-4" /> Optimize
                        </TabsTrigger>
                        <TabsTrigger value="history" className="gap-2 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 data-[state=active]:shadow-sm transition-all">
                            <History className="h-4 w-4" /> History
                        </TabsTrigger>
                        <TabsTrigger value="reports" className="gap-2 py-2.5 data-[state=active]:bg-orange-50 data-[state=active]:text-orange-700 data-[state=active]:border-orange-200 data-[state=active]:shadow-sm transition-all">
                            <FileCode2 className="h-4 w-4" /> Reports
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="overview" className="focus-visible:outline-none">
                        <DeviceOverview
                            stats={safeStats}
                            counts={counts}
                            hasAnalysis={hasAnalysis}
                            onNavigate={(target) => {
                                if (['critical', 'unused', 'shadowed', 'redundan', 'objects'].includes(target)) {
                                    updateOptimizerTab(target);
                                } else {
                                    updateTab(target);
                                }
                            }}
                        />
                    </TabsContent>

                    <TabsContent value="rules" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
                        <RulesView deviceId={device.id} />
                    </TabsContent>


                    <TabsContent value="optimize" className="focus-visible:outline-none min-h-[500px]">
                        {/* Optimization Hub - Vertical Sidebar Layout */}
                        <div className="flex flex-col lg:flex-row gap-6">
                            {/* Sidebar Navigation */}
                            <div className="w-full lg:w-64 flex-shrink-0 space-y-1">
                                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 px-2">Optimization Menu</h3>

                                <button
                                    onClick={() => updateOptimizerTab('critical')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'critical'
                                            ? "bg-red-50 text-red-700 border border-red-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <AlertOctagon className={cn("h-4 w-4", activeOptimizerTab === 'critical' ? "text-red-600" : "text-gray-400")} />
                                        Critical Risks
                                    </div>
                                    {hasAnalysis && criticalRiskCount > 0 && (
                                        <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                                            {criticalRiskCount}
                                        </Badge>
                                    )}
                                </button>

                                <button
                                    onClick={() => updateOptimizerTab('unused')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'unused'
                                            ? "bg-orange-50 text-orange-700 border border-orange-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Eraser className={cn("h-4 w-4", activeOptimizerTab === 'unused' ? "text-orange-600" : "text-gray-400")} />
                                        Unused Rules
                                    </div>
                                    {hasAnalysis && counts.unusedRules > 0 && (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 h-5 px-1.5 text-[10px]">
                                            {counts.unusedRules}
                                        </Badge>
                                    )}
                                </button>

                                <button
                                    onClick={() => updateOptimizerTab('redundan')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'redundan'
                                            ? "bg-blue-50 text-blue-700 border border-blue-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Copy className={cn("h-4 w-4", activeOptimizerTab === 'redundan' ? "text-blue-600" : "text-gray-400")} />
                                        Redundant
                                    </div>
                                    {hasAnalysis && counts.redundantRules > 0 && (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 h-5 px-1.5 text-[10px]">
                                            {counts.redundantRules}
                                        </Badge>
                                    )}
                                </button>

                                <button
                                    onClick={() => updateOptimizerTab('shadowed')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'shadowed'
                                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <ShieldAlert className={cn("h-4 w-4", activeOptimizerTab === 'shadowed' ? "text-indigo-600" : "text-gray-400")} />
                                        Shadowed
                                    </div>
                                    {hasAnalysis && counts.shadowedRules > 0 && (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 h-5 px-1.5 text-[10px]">
                                            {counts.shadowedRules}
                                        </Badge>
                                    )}
                                </button>

                                <button
                                    onClick={() => updateOptimizerTab('objects')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'objects'
                                            ? "bg-purple-50 text-purple-700 border border-purple-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Box className={cn("h-4 w-4", activeOptimizerTab === 'objects' ? "text-purple-600" : "text-gray-400")} />
                                        Unused Objects
                                    </div>
                                    {hasAnalysis && counts.unusedObjects > 0 && (
                                        <Badge variant="secondary" className="bg-gray-100 text-gray-600 h-5 px-1.5 text-[10px]">
                                            {counts.unusedObjects}
                                        </Badge>
                                    )}
                                </button>

                                <button
                                    onClick={() => updateOptimizerTab('traffic')}
                                    className={cn(
                                        "w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-all",
                                        activeOptimizerTab === 'traffic'
                                            ? "bg-teal-50 text-teal-700 border border-teal-200 shadow-sm"
                                            : "text-gray-600 hover:bg-gray-50 border border-transparent"
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Activity className={cn("h-4 w-4", activeOptimizerTab === 'traffic' ? "text-teal-600" : "text-gray-400")} />
                                        Traffic Analysis
                                    </div>
                                    {/* No count for traffic, as it is on-demand */}
                                </button>
                            </div>

                            {/* Main Content Area */}
                            <div className="flex-1 animate-in fade-in slide-in-from-right-4 duration-500" key={`${refreshKey}-${activeOptimizerTab}`}>
                                {activeOptimizerTab === 'critical' && (
                                    <CriticalRulesView deviceId={device.id} />
                                )}
                                {activeOptimizerTab === 'unused' && (
                                    <UnusedRulesView deviceId={device.id} onUpdateStats={(count) => handleStatsUpdate('unusedRules', count)} />
                                )}
                                {activeOptimizerTab === 'redundan' && (
                                    <MergerView deviceId={device.id} onUpdateStats={(count) => handleStatsUpdate('redundantRules', count)} />
                                )}
                                {activeOptimizerTab === 'shadowed' && (
                                    <ShadowedRulesView deviceId={device.id} onUpdateStats={(count) => handleStatsUpdate('shadowedRules', count)} />
                                )}
                                {activeOptimizerTab === 'objects' && (
                                    <UnusedObjectsView deviceId={device.id} onUpdateStats={(count) => handleStatsUpdate('unusedObjects', count)} />
                                )}
                                {activeOptimizerTab === 'traffic' && (
                                    <TrafficAnalysisView deviceId={device.id} />
                                )}
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="history" className="focus-visible:outline-none animate-in fade-in slide-in-from-right-4 duration-500">
                        <ChangeHistoryView deviceId={device.id} />
                    </TabsContent>



                    <TabsContent value="reports" className="focus-visible:outline-none animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <ReportsView deviceId={device.id} />
                    </TabsContent>

                </Tabs>
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={showDeleteAlert} onOpenChange={setShowDeleteAlert}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the device
                            <span className="font-semibold text-gray-900"> {device.name} </span>
                            and all of its associated data including analysis history and reports.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteDevice} className="bg-red-600 hover:bg-red-700 text-white">
                            Delete Device
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
