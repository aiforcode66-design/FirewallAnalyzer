
import { cn } from '@/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';

interface HitCountBarProps {
    value: number;
    max?: number;
    className?: string;
    showValue?: boolean;
}

export function HitCountBar({ value, max = 10000, className, showValue = true }: HitCountBarProps) {
    // Determine color based on value intensity
    let colorClass = 'bg-gray-200';
    let label = 'Unused';

    if (value > 10000) {
        colorClass = 'bg-red-500';
        label = 'Critical Traffic';
    } else if (value > 1000) {
        colorClass = 'bg-orange-500';
        label = 'High Traffic';
    } else if (value > 100) {
        colorClass = 'bg-blue-500';
        label = 'Moderate Traffic';
    } else if (value > 0) {
        colorClass = 'bg-green-500';
        label = 'Low Traffic';
    }

    // Calculate width percentage (logarithmic scale usually works better for hitcounts, but linear capped is simpler for now)
    // Using a simple linear scale capped at 100% relative to a "max" baseline or purely arbitrary "visual max"
    const percentage = Math.max(5, Math.min(100, (value / max) * 100));

    return (
        <div className={cn("flex items-center gap-3", className)}>
            <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden min-w-[60px]">
                <TooltipProvider>
                    <Tooltip delayDuration={100}>
                        <TooltipTrigger asChild>
                            <div
                                className={cn("h-full rounded-full transition-all duration-500", colorClass)}
                                style={{ width: `${value === 0 ? 0 : percentage}%` }}
                            />
                        </TooltipTrigger>
                        <TooltipContent>
                            <p className="font-medium">{value.toLocaleString()} hits</p>
                            <p className="text-xs text-gray-400">{label}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
            {showValue && (
                <span className="text-xs font-mono text-gray-500 w-[60px] text-right">
                    {value.toLocaleString()}
                </span>
            )}
        </div>
    );
}
