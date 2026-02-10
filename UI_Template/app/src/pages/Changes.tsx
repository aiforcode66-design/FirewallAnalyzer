import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { gsap } from 'gsap';
import {
  GitBranch,
  Plus,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  MoreHorizontal,
  Loader2,
  FileText,
  Trash2,
  History,
  User,
  Server,
} from 'lucide-react';
import { ChangeDetailsDialog } from '@/components/features/ChangeDetailsDialog';
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
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { deviceService } from '@/services/deviceService';
import { changeService, type Change } from '@/services/changeService';
import { cn } from '@/lib/utils';
import type { Device } from '@/types';

const statusConfig: Record<string, { icon: any, color: string, bg: string, label: string }> = {
  pending: { icon: Clock, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Pending' },
  approved: { icon: CheckCircle, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Approved' },
  rejected: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Rejected' },
  implemented: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Implemented' },
};

const typeConfig: Record<string, { color: string, bg: string, label: string }> = {
  add: { color: 'text-green-600', bg: 'bg-green-100', label: 'Add' },
  modify: { color: 'text-blue-600', bg: 'bg-blue-100', label: 'Modify' },
  delete: { color: 'text-red-600', bg: 'bg-red-100', label: 'Delete' },
  cleanup: { color: 'text-slate-600', bg: 'bg-slate-50', label: 'Clean' },
  "cleanup-objects": { color: 'text-purple-600', bg: 'bg-purple-50', label: 'Obj-Clean' },
  merge: { color: 'text-orange-600', bg: 'bg-orange-50', label: 'Merge' },
};

// Status Colors
const getStatusBadge = (status: string) => {
  const config = statusConfig[status] || statusConfig.pending;
  const Icon = config.icon;
  return (
    <Badge className={cn('text-xs gap-1 py-1 pr-2.5', config.bg, config.color)}>
      <Icon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

// Type Badge
const getTypeBadge = (typeString: string) => {
  const type = typeConfig[typeString] || typeConfig.modify;
  return (
    <Badge variant="outline" className={cn('text-xs capitalize h-6 font-medium border bg-white', type.color)}>
      {type.label}
    </Badge>
  );
};

export default function Changes() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derived state
  const activeTab = searchParams.get('tab') || 'all';
  // const statusFilter = searchParams.get('status') || 'all'; // Removed
  const searchQuery = searchParams.get('q') || '';

  const updateParams = (key: string, value: string) => {
    setSearchParams(prev => {
      const newParams = new URLSearchParams(prev);
      if (value && value !== 'all') {
        newParams.set(key, value);
      } else {
        newParams.delete(key);
      }
      return newParams;
    });
  };

  const updateTab = (tab: string) => updateParams('tab', tab);
  const [changes, setChanges] = useState<Change[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // New Change Form State
  const [newChange, setNewChange] = useState<{
    device_id: string;
    type: 'add' | 'modify' | 'delete';
    description: string;
  }>({
    device_id: '',
    type: 'add',
    description: '',
  });

  // Details Dialog State
  const [detailsChange, setDetailsChange] = useState<Change | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const headerRef = useRef<HTMLDivElement>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [fetchedChanges, fetchedDevices] = await Promise.all([
        changeService.getChanges(),
        deviceService.getDevices()
      ]);
      setChanges(fetchedChanges);
      setDevices(fetchedDevices);
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (headerRef.current) {
      gsap.fromTo(
        headerRef.current,
        { opacity: 0, y: -20 },
        { opacity: 1, y: 0, duration: 0.6, ease: 'power3.out' }
      );
    }
  }, []);

  const handleCreateChange = async () => {
    if (!newChange.device_id || !newChange.description) return;

    try {
      setCreating(true);
      await changeService.createChange({
        device_id: newChange.device_id,
        type: newChange.type,
        description: newChange.description,
        rules_affected: [], // Mock empty rules for now
        timestamp: new Date().toISOString()
      });

      setCreateDialogOpen(false);
      setNewChange({ device_id: '', type: 'add', description: '' });
      fetchData(); // Refresh list
      toast.success('Change request created successfully');
    } catch (error) {
      console.error("Failed to create change:", error);
      toast.error('Failed to create change request');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdateStatus = async (id: string, status: 'approved' | 'rejected') => {
    try {
      await changeService.updateStatus(id, status);
      fetchData();
      toast.success(`Change ${status} successfully`);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(`Failed to ${status} change`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this change request?')) return;
    try {
      await changeService.deleteChange(id);
      fetchData();
      toast.success('Change request deleted');
    } catch (error) {
      console.error("Failed to delete change:", error);
      toast.error('Failed to delete change request');
    }
  };

  const filteredChanges = changes.filter((change) => {
    // Only filter by search query, status is handled by tabs
    const matchesSearch =
      change.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      change.user_email.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  // Displayed changes logic
  const displayedChanges = filteredChanges.filter(c => {
    if (activeTab === 'all') return true;
    return c.status === activeTab;
  });

  const pendingCount = changes.filter((c) => c.status === 'pending').length;

  // Selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Bulk Actions
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(displayedChanges.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selectedIds.length} changes?`)) return;
    try {
      await Promise.all(selectedIds.map(id => changeService.deleteChange(id)));
      toast.success(`Deleted ${selectedIds.length} changes`);
      setSelectedIds([]);
      fetchData();
    } catch (e) {
      toast.error("Failed to delete selected changes");
    }
  };

  const handleBulkApprove = async () => {
    if (!confirm(`Approve ${selectedIds.length} pending changes?`)) return;
    try {
      // Only approve pending ones
      const pendingSelected = changes.filter(c => selectedIds.includes(c.id) && c.status === 'pending');
      await Promise.all(pendingSelected.map(c => changeService.updateStatus(c.id, 'approved')));
      toast.success(`Approved ${pendingSelected.length} changes`);
      setSelectedIds([]);
      fetchData();
    } catch (e) {
      toast.error("Failed to approve changes");
    }
  };

  if (loading && changes.length === 0) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 relative pb-20">
      <ChangeDetailsDialog
        change={detailsChange}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onApprove={(id) => handleUpdateStatus(id, 'approved')}
        onReject={(id) => handleUpdateStatus(id, 'rejected')}
      />

      {/* Floating Action Bar */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-white border shadow-xl rounded-full px-6 py-3 animate-in slide-in-from-bottom-5">
          <span className="text-sm font-medium text-gray-600 border-r pr-4 mr-2">
            {selectedIds.length} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-2 rounded-full"
            onClick={handleBulkDelete}
          >
            <Trash2 className="h-4 w-4" />
            Delete Selected
          </Button>
          {/* Show Approve only if pending items are selected */}
          {changes.some(c => selectedIds.includes(c.id) && c.status === 'pending') && (
            <Button
              variant="default"
              size="sm"
              className="gap-2 rounded-full bg-green-600 hover:bg-green-700"
              onClick={handleBulkApprove}
            >
              <CheckCircle className="h-4 w-4" />
              Approve Selected
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full"
            onClick={() => setSelectedIds([])}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Header */}
      <div ref={headerRef} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Change Management</h1>
          <p className="text-gray-500 mt-1">
            Track and manage firewall configuration changes
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 gradient-primary hover:opacity-90 transition-opacity">
              <Plus className="h-4 w-4" />
              New Change
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Create New Change</DialogTitle>
              <DialogDescription>
                Submit a new firewall configuration change
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Device</label>
                <Select
                  value={newChange.device_id}
                  onValueChange={(val) => setNewChange({ ...newChange, device_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map((device) => (
                      <SelectItem key={device.id} value={device.id}>
                        {device.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Change Type</label>
                <div className="flex gap-2">
                  {(['add', 'modify', 'delete'] as const).map((type) => (
                    <Button
                      key={type}
                      variant={newChange.type === type ? "default" : "outline"}
                      className={cn(
                        "flex-1 capitalize",
                        newChange.type === type ? "bg-primary text-primary-foreground" : ""
                      )}
                      onClick={() => setNewChange({ ...newChange, type })}
                    >
                      {type}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Input
                  placeholder="Describe the change..."
                  value={newChange.description}
                  onChange={(e) => setNewChange({ ...newChange, description: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
              <Button
                className="gradient-primary"
                onClick={handleCreateChange}
                disabled={creating || !newChange.device_id || !newChange.description}
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Submit'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Changes', value: changes.length, icon: GitBranch, color: 'text-blue-600' },
          { label: 'Pending', value: pendingCount, icon: Clock, color: 'text-orange-600' },
          { label: 'Approved', value: changes.filter((c) => c.status === 'approved').length, icon: CheckCircle, color: 'text-green-600' },
          { label: 'Implemented', value: changes.filter((c) => c.status === 'implemented').length, icon: History, color: 'text-purple-600' },
        ].map((stat) => (
          <Card key={stat.label} className="hover:shadow-card transition-shadow">
            <CardContent className="p-4">
              <stat.icon className={cn('h-6 w-6 mb-2', stat.color)} />
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs & Filters */}
      <Tabs value={activeTab} onValueChange={updateTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending" className="gap-1">
              Pending
              {pendingCount > 0 && (
                <span className="ml-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="implemented">Implemented</TabsTrigger>
          </TabsList>

          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search changes..."
                value={searchQuery}
                onChange={(e) => updateParams('q', e.target.value)}
                className="pl-10 w-[250px]"
              />
            </div>
            {/* Removed redundant status filter select */}
          </div>
        </div>

        <div className="rounded-md border bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-gray-50/50">
              <TableRow>
                <TableHead className="w-[40px] pl-4">
                  <Checkbox
                    checked={displayedChanges.length > 0 && selectedIds.length === displayedChanges.length}
                    onCheckedChange={handleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead className="w-[180px]">Date</TableHead>
                <TableHead className="w-[100px]">Type</TableHead>
                <TableHead className="w-[150px]">Device</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[150px]">User</TableHead>
                <TableHead className="w-[120px]">Status</TableHead>
                <TableHead className="w-[80px] text-right pr-4">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedChanges.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-gray-500">
                    No changes found.
                  </TableCell>
                </TableRow>
              ) : (
                displayedChanges.map((change) => {
                  const device = devices.find(d => d.id === change.device_id);
                  return (
                    <TableRow key={change.id} className="hover:bg-gray-50/50">
                      <TableCell className="pl-4">
                        <Checkbox
                          checked={selectedIds.includes(change.id)}
                          onCheckedChange={(checked) => handleSelectRow(change.id, checked as boolean)}
                          aria-label="Select row"
                        />
                      </TableCell>
                      <TableCell className="font-medium text-xs text-gray-600">
                        {new Date(change.created_at).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {getTypeBadge(change.type)}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {device ? (
                          <div className="flex items-center gap-1.5">
                            <Server className="h-3 w-3 text-gray-400" />
                            {device.name}
                          </div>
                        ) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm font-medium text-gray-900 truncate max-w-[300px]" title={change.description}>
                          {change.description}
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5">
                          {change.rules_affected?.length || 0} items impacted
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-gray-500">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-gray-400" />
                          {change.user_email.split('@')[0]}
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(change.status)}
                      </TableCell>
                      <TableCell className="text-right pr-4">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setDetailsChange(change); setDetailsOpen(true); }}>
                              <FileText className="mr-2 h-4 w-4" />
                              View Details
                            </DropdownMenuItem>
                            {change.status === 'pending' && (
                              <>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(change.id, 'approved')}>
                                  <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                                  Approve
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleUpdateStatus(change.id, 'rejected')}>
                                  <XCircle className="mr-2 h-4 w-4 text-red-600" />
                                  Reject
                                </DropdownMenuItem>
                              </>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={() => handleDelete(change.id)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete Log
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Tabs>
    </div>
  );
}
