import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Trash2,
    Box,
    Database,
    Network,
    Loader2,
    Search,
    Grid,
    List as ListIcon,
    AlertTriangle,
    PackageOpen,
    X,
    Clock
} from 'lucide-react';
import apiClient from '@/lib/api-client';
import { cleanupService } from '@/services/cleanupService';
import { API_CONFIG } from '@/lib/api-config';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface UnusedObjectsViewProps {
    deviceId: string;
    onUpdateStats?: (count: number) => void;
}

interface UnusedObject {
    id: string;
    name: string;
    type: string;
    value: string;
    reason: string;
    source_context?: string;
}

export default function UnusedObjectsView({ deviceId, onUpdateStats }: UnusedObjectsViewProps) {
    const [objects, setObjects] = useState<UnusedObject[]>([]);
    const [loading, setLoading] = useState(true);
    const [hasAnalysis, setHasAnalysis] = useState<boolean | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedTab, setSelectedTab] = useState('all');
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [selectedObjects, setSelectedObjects] = useState<string[]>([]);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);

    useEffect(() => {
        checkAnalysisAndFetch();
    }, [deviceId]);

    useEffect(() => {
        if (onUpdateStats) {
            onUpdateStats(objects.length);
        }
    }, [objects, onUpdateStats]);

    const checkAnalysisAndFetch = async () => {
        try {
            setLoading(true);
            const historyRes = await apiClient.get<any[]>(`/api/analyzer/device/${deviceId}?limit=1`);
            const analysisExists = historyRes.data && historyRes.data.length > 0;
            setHasAnalysis(analysisExists);

            if (analysisExists) {
                const response = await apiClient.get(API_CONFIG.ENDPOINTS.ANALYZER.UNUSED_OBJECTS(deviceId));
                setObjects(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch unused objects:', error);
            // toast.error('Failed to load unused objects');
        } finally {
            setLoading(false);
        }
    };

    const toggleSelect = (id: string) => {
        setSelectedObjects(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const getIcon = (type: string) => {
        switch (type.toLowerCase()) {
            case 'network': return <Network className="h-4 w-4 text-blue-500" />;
            case 'service': return <Database className="h-4 w-4 text-purple-500" />;
            case 'host': return <Box className="h-4 w-4 text-orange-500" />;
            case 'network-group': return <Network className="h-4 w-4 text-blue-600" />;
            case 'service-group': return <Database className="h-4 w-4 text-purple-600" />;
            default: return <Box className="h-4 w-4 text-gray-500" />;
        }
    };

    const filteredObjects = useMemo(() => {
        return objects.filter(obj => {
            const matchesSearch = obj.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (obj.value && obj.value.toLowerCase().includes(searchQuery.toLowerCase()));
            const matchesType = selectedTab === 'all' || obj.type.toLowerCase().includes(selectedTab);
            return matchesSearch && matchesType;
        });
    }, [objects, searchQuery, selectedTab]);

    const counts = useMemo(() => {
        return {
            all: objects.length,
            network: objects.filter(o => o.type.toLowerCase().includes('network')).length,
            service: objects.filter(o => o.type.toLowerCase().includes('service')).length,
            host: objects.filter(o => o.type.toLowerCase().includes('host')).length,
        };
    }, [objects]);



    const toggleSelectAll = () => {
        if (selectedObjects.length === filteredObjects.length && filteredObjects.length > 0) {
            setSelectedObjects([]);
        } else {
            setSelectedObjects(filteredObjects.map(o => o.id));
        }
    };

    const handleDelete = async () => {
        try {
            setLoading(true);
            const result = await cleanupService.cleanupObjects(selectedObjects);

            if (result.success) {
                toast.success("Change Request Created. Waiting for approval.");
                // Remove deleted objects from local state
                // setObjects(prev => prev.filter(o => !selectedObjects.includes(o.id)));
                setSelectedObjects([]);
                setShowDeleteDialog(false);
            } else {
                toast.error(`Cleanup failed: ${result.message}`);
                setShowDeleteDialog(false);
            }
        } catch (error) {
            console.error("Cleanup execution failed:", error);
            toast.error("Failed to delete objects");
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
                <div className="p-4 bg-blue-50 rounded-full mb-4">
                    <PackageOpen className="h-10 w-10 text-blue-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Analysis Required</h3>
                <p className="text-gray-500 max-w-md text-center mb-6">
                    Run a comprehensive analysis to identify unused objects in your inventory.
                </p>
                <Button className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                    <Search className="h-4 w-4" />
                    Start Analysis
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">Object Inventory</h2>
                    <p className="text-gray-500 mt-1">
                        Identify and remove empty or unused objects to declutter your configuration.
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-white p-2 rounded-lg border shadow-sm">
                    <div className="px-3 py-1 bg-gray-100 rounded-md border border-gray-200">
                        <span className="text-xs font-semibold text-gray-600 uppercase">Total Candidates</span>
                        <div className="text-lg font-bold text-gray-800">{objects.length}</div>
                    </div>
                </div>
            </div>

            <Card className="border-none shadow-none bg-transparent">
                <CardContent className="p-0 space-y-6">
                    {/* Controls */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <div className="flex items-center gap-2 mr-2">
                                <Checkbox
                                    checked={selectedObjects.length === filteredObjects.length && filteredObjects.length > 0}
                                    onCheckedChange={toggleSelectAll}
                                    id="select-all"
                                />
                                <label htmlFor="select-all" className="text-sm cursor-pointer whitespace-nowrap text-gray-700 font-medium">
                                    Select All
                                </label>
                            </div>
                            <div className="relative flex-1 sm:w-[300px]">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <Input
                                    placeholder="Search objects..."
                                    className="pl-10"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8 rounded-md", viewMode === 'grid' && "bg-white shadow-sm")}
                                    onClick={() => setViewMode('grid')}
                                >
                                    <Grid className="h-4 w-4 text-gray-600" />
                                </Button>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn("h-8 w-8 rounded-md", viewMode === 'list' && "bg-white shadow-sm")}
                                    onClick={() => setViewMode('list')}
                                >
                                    <ListIcon className="h-4 w-4 text-gray-600" />
                                </Button>
                            </div>
                        </div>

                        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full sm:w-auto">
                            <TabsList className="grid w-full grid-cols-4 sm:w-[400px]">
                                <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
                                <TabsTrigger value="network">Net ({counts.network})</TabsTrigger>
                                <TabsTrigger value="service">Svc ({counts.service})</TabsTrigger>
                                <TabsTrigger value="host">Host ({counts.host})</TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    {/* Content */}
                    {filteredObjects.length > 0 ? (
                        <div className={cn(
                            "grid gap-4",
                            viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-1"
                        )}>
                            {filteredObjects.map((obj) => {
                                const isSelected = selectedObjects.includes(obj.id);
                                return (
                                    <div
                                        key={obj.id}
                                        className={cn(
                                            "group relative bg-white border rounded-xl overflow-hidden transition-all hover:shadow-md cursor-pointer",
                                            isSelected ? "ring-2 ring-blue-500 border-transparent bg-blue-50/10" : "border-gray-200 hover:border-blue-300"
                                        )}
                                        onClick={() => toggleSelect(obj.id)}
                                    >
                                        <div className="p-4 space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className={cn(
                                                        "p-2 rounded-lg",
                                                        isSelected ? "bg-blue-100 text-blue-600" : "bg-gray-100 text-gray-500 group-hover:bg-blue-50 group-hover:text-blue-500"
                                                    )}>
                                                        {getIcon(obj.type)}
                                                    </div>
                                                    <div>
                                                        <h4 className="font-semibold text-gray-900 truncate max-w-[150px]" title={obj.name}>{obj.name}</h4>
                                                        <span className="text-xs text-gray-400 capitalize">{obj.type.replace('-', ' ')}</span>
                                                    </div>
                                                </div>
                                                <Checkbox checked={isSelected} className="data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500" />
                                            </div>

                                            <div className="bg-gray-50 rounded-md p-2 text-xs font-mono text-gray-600 truncate border border-gray-100">
                                                {obj.value || 'Empty / No Value'}
                                            </div>

                                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                                                <Badge variant="outline" className="text-[10px] font-normal text-gray-500 bg-white">
                                                    {obj.source_context ? obj.source_context : 'Global'}
                                                </Badge>
                                                {obj.reason === 'Unused' && (
                                                    <span className="ml-auto text-[10px] uppercase font-bold text-orange-400 tracking-wider">Unused</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
                            <div className="p-4 bg-gray-100 rounded-full mb-4">
                                <Search className="h-8 w-8 text-gray-400" />
                            </div>
                            <h3 className="text-lg font-medium text-gray-900">No objects found</h3>
                            <p className="text-gray-500">Try adjusting your filters or search query.</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Bulk Actions Bar */}
            {selectedObjects.length > 0 && (
                <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white text-gray-900 px-6 py-3 rounded-full shadow-2xl border border-gray-200 flex items-center gap-6 animate-in slide-in-from-bottom-10 z-50">
                    <span className="font-medium text-sm">
                        <span className="text-blue-600 font-bold">{selectedObjects.length}</span> objects selected
                    </span>
                    <div className="h-4 w-px bg-gray-200"></div>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-500 hover:text-gray-900"
                        onClick={() => setSelectedObjects([])}
                    >
                        <X className="h-4 w-4 mr-2" />
                        Cancel
                    </Button>
                    <Button
                        size="sm"
                        className="bg-blue-600 hover:bg-blue-700 text-white gap-2 rounded-full px-4 shadow-lg shadow-blue-100"
                        onClick={() => setShowDeleteDialog(true)}
                    >
                        <Trash2 className="h-4 w-4" />
                        Request Cleanup
                    </Button>
                </div>
            )}

            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <AlertTriangle className="h-5 w-5" />
                            Confirm Deletion
                        </DialogTitle>
                        <DialogDescription>
                            Are you sure you want to request deletion for {selectedObjects.length} unused objects?
                            This will create a pending Change Request.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="p-4 bg-blue-50 rounded-lg mb-4">
                        <p className="text-sm text-blue-700 font-medium">
                            Action: Create Change Request (Pending Approval)
                        </p>
                        <p className="text-xs text-blue-600 mt-1">
                            Objects will NOT be deleted immediately. An approval is required in Change Management.
                        </p>
                    </div>
                    <div className="py-2">
                        <div className="bg-gray-100 p-3 rounded-lg max-h-[200px] overflow-y-auto text-sm space-y-1">
                            {objects.filter(o => selectedObjects.includes(o.id)).map(o => (
                                <div key={o.id} className="flex justify-between text-gray-700">
                                    <span>{o.name}</span>
                                    <span className="text-xs text-gray-500">{o.type}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>Cancel</Button>
                        <Button variant="default" onClick={handleDelete} className="bg-blue-600 hover:bg-blue-700">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Clock className="h-4 w-4 mr-2" />}
                            {loading ? 'Sending Request...' : 'Request Deletion'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
