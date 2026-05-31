import { cn } from "@/lib/utils";

export function Table({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className={cn("w-full", className)}>{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: React.ReactNode }) {
  return <thead className="bg-gray-50">{children}</thead>;
}

export function TableBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-gray-100">{children}</tbody>;
}

export function TableRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return <tr className={cn("hover:bg-gray-50/50 transition-colors", className)}>{children}</tr>;
}

export function TableHead({ className, children }: { className?: string; children: React.ReactNode }) {
  return <th className={cn("px-4 py-3 text-right text-xs font-bold text-gray-500 uppercase font-tajawal", className)}>{children}</th>;
}

export function TableCell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <td className={cn("px-4 py-3 text-sm font-tajawal", className)}>{children}</td>;
}
