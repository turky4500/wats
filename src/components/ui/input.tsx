"use client";

import { cn } from "@/lib/utils";
import { type InputHTMLAttributes, forwardRef } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, type = "text", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5 font-tajawal">
            {label}
          </label>
        )}
        <input
          type={type}
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl border font-tajawal transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
            "placeholder:text-gray-400",
            error ? "border-red-500 bg-red-50" : "border-gray-200 bg-white hover:border-gray-300",
            className
          )}
          dir="rtl"
          {...props}
        />
        {error && <p className="text-red-500 text-xs mt-1 font-tajawal">{error}</p>}
      </div>
    );
  }
);
Input.displayName = "Input";

export { Input };
