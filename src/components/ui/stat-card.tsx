import { cn } from "@/lib/utils";
import { type LucideIcon } from "lucide-react";

export function StatCard({ title, value, icon: Icon, trend, trendUp, className }: {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-2xl bg-white p-6 shadow-sm border hover:shadow-md transition-shadow", className)}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-500 font-tajawal">{title}</p>
          <p className="text-2xl font-bold mt-1 font-tajawal">{value}</p>
          {trend && (
            <p className={cn("text-xs mt-1 font-tajawal", trendUp ? "text-emerald-600" : "text-red-600")}>
              {trendUp ? "↑" : "↓"} {trend}
            </p>
          )}
        </div>
        <div className="p-3 rounded-xl bg-emerald-50">
          <Icon className="w-6 h-6 text-emerald-600" />
        </div>
      </div>
    </div>
  );
}
