"use client";

import { cn } from "@/lib/utils";
import { type TextareaHTMLAttributes, forwardRef } from "react";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, label, error, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 mb-1.5 font-tajawal">
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          className={cn(
            "w-full px-4 py-2.5 rounded-xl border font-tajawal transition-all duration-200 resize-none",
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500",
            "placeholder:text-gray-400 min-h-[100px]",
            error ? "border-red-500 bg-red-50" : "border-gray-200 bg-white",
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
Textarea.displayName = "Textarea";

export { Textarea };
