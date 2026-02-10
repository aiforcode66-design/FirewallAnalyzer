import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { deviceService, vendorService } from '@/services/deviceService';
import type { Device } from '@/types';

interface DeviceDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    deviceToEdit?: Device | null; // If provided, we are in Edit mode
}

export default function DeviceDialog({ isOpen, onClose, onSuccess, deviceToEdit }: DeviceDialogProps) {
    const isEditMode = !!deviceToEdit;
    const [loading, setLoading] = useState(false);
    const [vendors, setVendors] = useState<any[]>([]);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        ipAddress: '',
        vendorId: '',
        model: '',
    });

    // Load Vendors on Mount
    useEffect(() => {
        const loadVendors = async () => {
            try {
                const data = await vendorService.getVendors();
                setVendors(data);
                // Set default vendor if adding new and vendors loaded
                if (!isEditMode && data.length > 0 && !formData.vendorId) {
                    setFormData(prev => ({ ...prev, vendorId: data[0].id }));
                }
            } catch (err) {
                console.error("Failed to load vendors", err);
                toast.error("Failed to load vendor list");
            }
        };
        if (isOpen) {
            loadVendors();
        }
    }, [isOpen, isEditMode]); // Reload when dialog opens

    // Populate Form in Edit Mode
    useEffect(() => {
        if (isOpen && deviceToEdit) {
            setFormData({
                name: deviceToEdit.name,
                ipAddress: deviceToEdit.ipAddress,
                vendorId: deviceToEdit.vendorId,
                model: deviceToEdit.model || '',
            });
        } else if (isOpen && !deviceToEdit) {
            // Reset for Add Mode
            setFormData({
                name: '',
                ipAddress: '',
                vendorId: vendors.length > 0 ? vendors[0].id : '',
                model: '',
            });
        }
    }, [isOpen, deviceToEdit, vendors]);

    const handleSubmit = async () => {
        // Validation
        if (!formData.name || !formData.ipAddress) {
            toast.error("Name and IP Address are required");
            return;
        }

        const ipRegex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
        if (!ipRegex.test(formData.ipAddress)) {
            toast.error("Please enter a valid IP address");
            return;
        }

        try {
            setLoading(true);
            if (isEditMode && deviceToEdit) {
                // UPDATE
                await deviceService.updateDevice(deviceToEdit.id, {
                    name: formData.name,
                    ipAddress: formData.ipAddress,
                    vendorId: formData.vendorId,
                    model: formData.model,
                });
                toast.success("Device updated successfully");
            } else {
                // CREATE
                await deviceService.createDevice({
                    name: formData.name,
                    ipAddress: formData.ipAddress,
                    vendorId: formData.vendorId,
                    model: formData.model,
                    status: 'active',
                    location: 'Data Center',
                });
                toast.success("Device added successfully");
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(isEditMode ? "Failed to update device" : "Failed to create device", error);
            const msg = error.response?.data?.detail || (isEditMode ? "Failed to update device." : "Failed to create device.");
            toast.error(typeof msg === 'string' ? msg : JSON.stringify(msg));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? 'Edit Device' : 'Add New Device'}</DialogTitle>
                    <DialogDescription>
                        {isEditMode ? 'Update device details.' : 'Add a firewall device to your inventory.'}
                    </DialogDescription>
                </DialogHeader>

                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="grid gap-4 py-4"
                >
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Name</label>
                        <Input
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="col-span-3"
                            placeholder="FW-Core-01"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">IP</label>
                        <Input
                            value={formData.ipAddress}
                            onChange={(e) => setFormData({ ...formData, ipAddress: e.target.value })}
                            className="col-span-3"
                            placeholder="10.0.0.1"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Model</label>
                        <Input
                            value={formData.model}
                            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                            className="col-span-3"
                            placeholder="ASA 5500-X"
                        />
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Vendor</label>
                        <select
                            className="col-span-3 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={formData.vendorId}
                            onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
                        >
                            {vendors.map(v => (
                                <option key={v.id} value={v.id}>{v.displayName}</option>
                            ))}
                        </select>
                    </div>
                </motion.div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                    >
                        {loading ? (isEditMode ? 'Saving...' : 'Adding...') : (isEditMode ? 'Save Changes' : 'Add Device')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
