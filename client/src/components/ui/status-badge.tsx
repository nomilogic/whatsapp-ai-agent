import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

interface StatusBadgeProps {
  status: 'connected' | 'connecting' | 'disconnected';
  lastError?: string;
  className?: string;
}

export function StatusBadge({ status, lastError, className }: StatusBadgeProps) {
  const styles = {
    connected: "bg-green-100 text-green-700 border-green-200 dark:bg-green-500/10 dark:text-green-400 dark:border-green-500/20",
    connecting: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/20",
    disconnected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
  };

  const icons = {
    connected: <Wifi className="w-3.5 h-3.5 mr-1.5" />,
    connecting: <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />,
    disconnected: <WifiOff className="w-3.5 h-3.5 mr-1.5" />,
  };

  const labels = {
    connected: "Connected",
    connecting: "Connecting...",
    disconnected: "Disconnected",
  };

  return (
    <div className={cn("flex flex-col items-start gap-2", className)}>
      <div className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        styles[status]
      )}>
        {icons[status]}
        {labels[status]}
      </div>
      {status === 'disconnected' && lastError && (
        <span className="text-xs text-destructive mt-1 max-w-[200px] truncate">
          {lastError}
        </span>
      )}
    </div>
  );
}
