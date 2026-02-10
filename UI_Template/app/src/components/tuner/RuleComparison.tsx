
import { useState, useEffect } from 'react';
import { ArrowRight, AlertTriangle, Copy, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { deviceService } from '@/services/deviceService';
import { toast } from 'sonner';

interface RuleComparisonProps {
    deviceId: string;
    ruleId: string;
    rule: any; // The original rule object
}

export default function RuleComparison({ deviceId, ruleId, rule }: RuleComparisonProps) {
    const [loading, setLoading] = useState(false);
    const [proposal, setProposal] = useState<any>(null);

    useEffect(() => {
        const fetchProposal = async () => {
            if (!ruleId || !deviceId) return;

            try {
                setLoading(true);
                const data = await deviceService.getTunerProposal(deviceId, ruleId);
                setProposal(data);
            } catch (error) {
                console.error("Failed to load proposal", error);
                setProposal(null); // Ensure error state is handled
            } finally {
                setLoading(false);
            }
        };

        fetchProposal();
    }, [deviceId, ruleId]);

    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
    };

    if (loading) {
        return (
            <div className="h-64 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
        );
    }

    if (!proposal || !proposal.proposals || proposal.proposals.length === 0) {
        return (
            <div className="h-64 flex flex-col items-center justify-center text-gray-500">
                <AlertTriangle className="h-10 w-10 text-yellow-500 mb-2" />
                <p>No traffic data matched this rule.</p>
                <p className="text-xs">It might be effectively unused.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
            {/* Left: Original Rule */}
            <Card className="border-red-100 bg-red-50/10">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                        <ShieldAlert className="h-4 w-4" /> Current Permissive Rule
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">SOURCE</label>
                        <div className="p-2 bg-red-100/50 rounded text-sm font-mono text-red-900 border border-red-100">
                            {rule.source}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">DESTINATION</label>
                        <div className="p-2 bg-red-100/50 rounded text-sm font-mono text-red-900 border border-red-100">
                            {rule.destination}
                        </div>
                    </div>
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-500">SERVICE</label>
                        <div className="p-2 bg-red-100/50 rounded text-sm font-mono text-red-900 border border-red-100">
                            {rule.service}
                        </div>
                    </div>
                    <div className="pt-2">
                        <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                            Permissiveness: Critical
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* Middle: Arrow */}
            <div className="flex flex-col items-center justify-center py-4">
                <div className="bg-blue-50 p-3 rounded-full mb-2">
                    <ArrowRight className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-center">
                    <p className="text-xs font-bold text-blue-600">{proposal.matched_log_count} Flows</p>
                    <p className="text-[10px] text-gray-400 uppercase">Analyzed</p>
                </div>
            </div>

            {/* Right: Proposed Rules */}
            <Card className="border-green-100 bg-green-50/10 h-full">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-green-700 flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4" /> Proposed Specific Rules
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                        {proposal.proposals.map((prop: any, idx: number) => (
                            <div key={idx} className="p-3 bg-white rounded border border-green-100 shadow-sm relative group">
                                <Button
                                    className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
                                    size="icon"
                                    variant="ghost"
                                    onClick={() => handleCopy(`permit ${prop.service} ${prop.sources.join(" ")} ${prop.destinations.join(" ")}`)}
                                >
                                    <Copy className="h-3 w-3" />
                                </Button>
                                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                                    <div>
                                        <span className="text-gray-400 font-bold block">SRC</span>
                                        <div className="font-mono text-gray-700">
                                            {prop.sources.map((s: string) => <div key={s}>{s}</div>)}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-gray-400 font-bold block">DST</span>
                                        <div className="font-mono text-gray-700">
                                            {prop.destinations.map((d: string) => <div key={d}>{d}</div>)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between pt-1 border-t border-gray-50">
                                    <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50 font-mono text-[10px]">
                                        {prop.service}
                                    </Badge>
                                    <span className="text-[10px] text-gray-400">{prop.hit_count} hits</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
