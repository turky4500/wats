"use client";

import { cn } from "@/lib/utils";
import { type ButtonHTMLAttributes, forwardRef } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline" | "ghost" | "destructive" | "secondary";
  size?: "sm" | "md" | "lg";
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", ...props }, ref) => {
    const variants: Record<string, string> = {
      default: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
      outline: "border-2 border-emerald-600 text-emerald-600 hover:bg-emerald-50",
      ghost: "text-gray-600 hover:bg-gray-100",
      destructive: "bg-red-600 text-white hover:bg-red-700",
      secondary: "bg-gray-100 text-gray-800 hover:bg-gray-200",
    };
    const sizes: Record<string, string> = {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2",
      lg: "px-6 py-3 text-lg",
    };

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-xl font-tajawal font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };
