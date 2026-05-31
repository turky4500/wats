"use client";

import { cn } from "@/lib/utils";
import { type SelectHTMLAttributes, forwardRef } from "react";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5 font-tajawal">
            {label}
          </label>
        )}
        <select
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl border font-tajawal transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 bg-white",
            error ? "border-red-500 bg-red-50" : "border-gray-200 hover:border-gray-300",
            className
          )}
          dir="rtl"
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {error && <p className="text-red-500 text-xs mt-1 font-tajawal">{error}</p>}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
