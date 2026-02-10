import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Change } from '@/services/changeService';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';

interface ChangeDetailsDialogProps {
    change: Change | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApprove: (id: string) => void;
    onReject: (id: string) => void;
}

export function ChangeDetailsDialog({ change, open, onOpenChange, onApprove, onReject }: ChangeDetailsDialogProps) {
    if (!change) return null;

    const rules = change.rules_affected || [];
    const isPending = change.status === 'pending';

    // Helper to render rule content based on type
    const renderContent = () => {
        if (!rules || rules.length === 0) {
            return <div className="text-center py-8 text-gray-500">No details available.</div>;
        }

        // Generic Table for varied content
        return (
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">#</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Type/Action</TableHead>
                        <TableHead>Details</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {rules.map((item: any, idx: number) => {
                        const isLegacyId = typeof item === 'string';
                        const name = isLegacyId ? `Rule ID: ${item}` : (item.name || item.id || 'Unknown');
                        const role = !isLegacyId && item.role ? item.role : null;
                        const action = !isLegacyId && item.action ? item.action : change.type;

                        return (
                            <TableRow key={idx}>
                                <TableCell>{idx + 1}</TableCell>
                                <TableCell className="font-medium">
                                    <span className="break-all">{name}</span>
                                    {role && <Badge variant="outline" className="ml-2">{role}</Badge>}
                                </TableCell>
                                <TableCell>
                                    <Badge variant={action === 'delete' ? 'destructive' : 'secondary'}>
                                        {action}
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-xs font-mono">
                                    {!isLegacyId && (
                                        <div className="space-y-1">
                                            {item.source && <div>Src: {item.source}</div>}
                                            {item.destination && <div>Dst: {item.destination}</div>}
                                            {item.service && <div>Svc: {item.service}</div>}
                                            {item.hits !== undefined && <div>Hits: {item.hits}</div>}
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        );
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Change Request Details</DialogTitle>
                    <DialogDescription>
                        Review the impacted items before approving.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-auto min-h-[300px]">
                    <div className="space-y-4">
                        <div className="bg-gray-50 p-4 rounded-lg border">
                            <h3 className="text-sm font-semibold text-gray-900">Description</h3>
                            <p className="text-gray-600 mt-1">{change.description}</p>
                            <div className="flex gap-4 mt-3 text-sm text-gray-500">
                                <div>Type: <span className="font-medium text-gray-900 capitalize">{change.type}</span></div>
                                <div>By: <span className="font-medium text-gray-900">{change.user_email}</span></div>
                            </div>
                        </div>

                        <ScrollArea className="h-[300px] border rounded-md">
                            <div className="p-4">
                                <h4 className="text-sm font-semibold mb-3">Affected Items ({rules.length})</h4>
                                {renderContent()}
                            </div>
                        </ScrollArea>
                    </div>
                </div>

                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                    {isPending && (
                        <>
                            <Button
                                variant="destructive"
                                onClick={() => { onReject(change.id); onOpenChange(false); }}
                            >
                                Reject
                            </Button>
                            <Button
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => { onApprove(change.id); onOpenChange(false); }}
                            >
                                Approve
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
