import { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';

import {
  Server,
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertCircle,
  MapPin,
  Calendar,
  Shield,
  UploadCloud,
  Layers, // For Multi-Context
  GitMerge,
} from 'lucide-react';
import MigrationWizard from '@/components/features/MigrationWizard';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import DeviceDialog from '@/components/features/DeviceDialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { deviceService, vendorService } from '@/services/deviceService';
import type { Vendor } from '@/services/deviceService';
import { cn } from '@/lib/utils';
import type { Device } from '@/types';


const vendorColors: Record<string, string> = {
  cisco: 'bg-[#049fd9]',
  paloalto: 'bg-[#fa582d]',
  fortinet: 'bg-[#ee3135]',
  checkpoint: 'bg-[#e53935]',

};

const statusConfig = {
  active: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100', label: 'Active' },
  inactive: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Inactive' },
  warning: { icon: AlertCircle, color: 'text-orange-500', bg: 'bg-orange-100', label: 'Warning' },
  error: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-100', label: 'Error' },
};

interface DeviceCardProps {
  device: Device;
  vendorName: string;
  index: number;
  onUploadClick: (id: string) => void;
  onDeleteClick: (id: string) => void;
  onEditClick: (device: Device) => void;
}

function DeviceCard({ device, vendorName, index, onUploadClick, onDeleteClick, onEditClick }: DeviceCardProps) {
  const navigate = useNavigate();
  const cardRef = useRef<HTMLDivElement>(null);
  const status = statusConfig[device.status];
  const StatusIcon = status.icon;

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          delay: index * 0.05,
          ease: 'power3.out',
        }
      );
    }
  }, [index]);

  const totalRules = device.subDevices && device.subDevices.length > 0
    ? device.subDevices.reduce((acc, curr) => acc + (curr.rulesCount || 0), 0)
    : (device.rulesCount || 0);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <Card
          ref={cardRef}
          className="group hover:shadow-card-hover transition-all duration-500 overflow-hidden"
        >
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                {/* Vendor Icon */}
                <div
                  className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-lg',
                    vendorColors[device.vendorId] || 'bg-gray-500' // Fail-safe color
                  )}
                >
                  <Shield className="h-6 w-6" />
                </div>

                <div>
                  <h3 className="font-bold text-gray-900 text-lg">{device.name}</h3>
                  <p className="text-sm text-gray-500 capitalize">{vendorName} Firewall</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className={cn('text-xs', status.bg, status.color)}>
                      <StatusIcon className="h-3 w-3 mr-1" />
                      {status.label}
                    </Badge>
                    <span className="text-xs text-gray-400">{totalRules} rules</span>
                    {device.subDevices && device.subDevices.length > 0 && (
                      <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200 ml-2 gap-1">
                        <Layers className="h-3 w-3" />
                        {device.subDevices.length} Contexts
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="gap-2" onClick={() => onEditClick(device)}>
                    <Edit className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2">
                    <RefreshCw className="h-4 w-4" />
                    Sync
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" onClick={() => onUploadClick(device.id)}>
                    <UploadCloud className="h-4 w-4" />
                    Upload Config
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2 text-red-600 cursor-pointer" onClick={() => onDeleteClick(device.id)}>
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Filter className="h-4 w-4" />
                  <span className="text-xs font-medium">Rules</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{totalRules}</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-gray-500 mb-1">
                  <Server className="h-4 w-4" />
                  <span className="text-xs font-medium">Model</span>
                </div>
                <p className="text-lg font-bold text-gray-900">{device.model}</p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">{device.ipAddress}</span>
              </div>
              {device.location && (
                <div className="flex items-center gap-2 text-sm">
                  <Server className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-600">{device.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400" />
                <span className="text-gray-500">
                  {device.configDate
                    ? `Snapshot: ${new Date(device.configDate).toLocaleString()}`
                    : `Last seen: ${new Date(device.lastSeen).toLocaleString()}`
                  }
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm" className="flex-1 gap-1">
                <Shield className="h-3 w-3" />
                Analyze
              </Button>
              <Button variant="outline" size="sm" className="flex-1 gap-1" onClick={() => navigate(`/devices/${device.id}`)}>
                <Edit className="h-3 w-3" />
                Manage
              </Button>
            </div>
          </CardContent>
        </Card >
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onEditClick(device)}>
          <Edit className="h-4 w-4 mr-2" />
          Edit Device
        </ContextMenuItem>
        <ContextMenuItem
          className="text-red-600 focus:text-red-600"
          onClick={() => onDeleteClick(device.id)}
        >
          <Trash2 className="h-4 w-4 mr-2" />
          Delete Device
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

export default function Devices() {
  const [searchParams, setSearchParams] = useSearchParams();

  // Derived State
  const searchQuery = searchParams.get('q') || '';
  const vendorFilter = searchParams.get('vendor') || 'all';
  const statusFilter = searchParams.get('status') || 'all';
  const isMigrationWizardOpen = searchParams.get('wizard') === 'true';

  const updateParams = (key: string, value: string | null) => {
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

  const [devices, setDevices] = useState<Device[]>([]);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingDeviceId, setUploadingDeviceId] = useState<string | null>(null);

  // Add Device State
  const [isDeviceDialogOpen, setIsDeviceDialogOpen] = useState(false);
  const [deviceToEdit, setDeviceToEdit] = useState<Device | null>(null);

  // Reset form when dialog closes
  /* useEffect(() => {
    if (!isAddDialogOpen) {
      setNewDevice({
        name: '',
        ipAddress: '',
        vendorId: '',
        model: '',
      });
    }
  }, [isAddDialogOpen]); */

  const refreshDevices = async () => {
    try {
      setLoading(true);
      const [devicesData, vendorsData] = await Promise.all([
        deviceService.getDevices(),
        vendorService.getVendors(),
      ]);
      setDevices(devicesData);
      setVendors(vendorsData);
    } catch (err: any) {
      console.error('Failed to fetch devices:', err);
      setError(err.response?.data?.detail || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = (deviceId: string) => {
    setUploadingDeviceId(deviceId);
    if (fileInputRef.current) {
      fileInputRef.current.value = ''; // Reset
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && uploadingDeviceId) {
      const file = e.target.files[0];
      try {
        setLoading(true); // Or use a specific loading state
        await deviceService.uploadConfig(uploadingDeviceId, file);
        await refreshDevices();
      } catch (err) {
        console.error('Failed to upload config:', err);
        setError('Failed to upload configuration');
        setLoading(false);
      } finally {
        setUploadingDeviceId(null);
      }
    }
  };

  // Fetch devices and vendors on mount
  useEffect(() => {
    refreshDevices();
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

  // Show loading state
  if (loading && devices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading devices...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error && devices.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <Server className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Failed to Load Devices</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <Button onClick={refreshDevices} className="gradient-primary">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  // Filter out child devices (contexts) from the main list unless browsing explicitly
  // Strategy: Only show devices where parent_device_id is null
  const parentDevices = devices.filter(d => !d.parentDeviceId);

  const filteredDevices = parentDevices.filter((device: Device) => {
    const matchesSearch =
      device.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      device.ipAddress.includes(searchQuery);
    const matchesVendor = vendorFilter === 'all' || device.vendorId === vendorFilter;
    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;
    return matchesSearch && matchesVendor && matchesStatus;
  });

  const activeVendors = [...new Set(devices.map((d: Device) => d.vendorId))];



  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this device? This action cannot be undone.')) return;

    try {
      setLoading(true);
      await deviceService.deleteDevice(id);
      await refreshDevices();
    } catch (err: any) {
      console.error('Failed to delete device:', err);
      // alert(err.response?.data?.detail || 'Failed to delete device');
      // Ideally use a toast here
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div ref={headerRef} className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-500 mt-1">
            Manage and monitor your firewall devices across all vendors
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="gap-2 border-purple-200 text-purple-700 hover:bg-purple-50 hover:text-purple-800 transition-all duration-300 hover:shadow-sm"
            onClick={() => updateParams('wizard', 'true')}
          >
            <GitMerge className="h-4 w-4" />
            Merge Contexts
          </Button>

          <Button
            className="gap-2 gradient-primary hover:opacity-90 transition-all duration-300 shadow-sm hover:shadow-md hover:translate-y-[-1px]"
            onClick={() => {
              setDeviceToEdit(null);
              setIsDeviceDialogOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add Device
          </Button>
          {/* Legacy Dialog content removed */}
          {/* <DialogContent className="sm:max-w-lg">...</DialogContent> */}
          {/* </Dialog> */}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Devices', value: devices.length, color: 'text-blue-600' },
          { label: 'Active', value: devices.filter((d) => d.status === 'active').length, color: 'text-green-600' },
          { label: 'Warning', value: devices.filter((d) => d.status === 'warning').length, color: 'text-orange-600' },
          { label: 'Inactive', value: devices.filter((d) => d.status === 'inactive').length, color: 'text-gray-600' },
        ].map((stat) => (
          <Card key={stat.label} className="hover:shadow-card transition-shadow">
            <CardContent className="p-4">
              <p className="text-sm text-gray-500">{stat.label}</p>
              <p className={cn('text-2xl font-bold', stat.color)}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Search devices..."
                value={searchQuery}
                onChange={(e) => updateParams('q', e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Select value={vendorFilter} onValueChange={(val) => updateParams('vendor', val)}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Vendor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Vendors</SelectItem>
                  {activeVendors.map((vendorId) => (
                    <SelectItem key={vendorId} value={vendorId}>
                      {vendors.find((v) => v.id === vendorId)?.displayName || vendorId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={(val) => updateParams('status', val)}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="error">Error</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".txt,.conf,.cfg,.xml"
        onChange={handleFileChange}
      />

      {/* Devices Grid */}
      {filteredDevices.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDevices.map((device, index) => (
            <DeviceCard
              key={device.id}
              device={device}
              vendorName={vendors.find((v) => v.id === device.vendorId)?.displayName || 'Unknown'}
              index={index}
              onUploadClick={handleUploadClick}
              onDeleteClick={handleDeleteDevice}
              onEditClick={(dev) => {
                setDeviceToEdit(dev);
                setIsDeviceDialogOpen(true);
              }}
            />
          ))}
        </div>
      ) : (
        <Card className="py-12">
          <CardContent className="flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900">No devices found</h3>
            <p className="text-sm text-gray-500 mt-1">
              Try adjusting your search or filters
            </p>
          </CardContent>
        </Card>
      )}

      {isMigrationWizardOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in">
          <MigrationWizard
            availableContexts={(() => {
              // Flatten all devices and their contexts
              const allContexts: { id: string, name: string, parentName?: string }[] = [];
              devices.forEach(d => {
                const parentName = d.name;
                if (d.subDevices && d.subDevices.length > 0) {
                  d.subDevices.forEach(sub => {
                    allContexts.push({
                      id: sub.id,
                      name: sub.name,
                      parentName: parentName
                    });
                  });
                } else {
                  // Standalone device can also be a context/source
                  allContexts.push({
                    id: d.id,
                    name: d.name,
                    parentName: 'Standalone'
                  });
                }
              });
              return allContexts;
            })()}
            onClose={() => updateParams('wizard', null)}
            onMigrationSuccess={() => {
              refreshDevices();
            }}
          />
        </div>
      )}

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
