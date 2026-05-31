"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, User, Smartphone, MessageSquare, CreditCard, Settings,
  LogOut, Menu, X
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";

const menuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: LayoutDashboard },
  { href: "/profile", label: "الملف الشخصي", icon: User },
  { href: "/devices", label: "أجهزة الواتساب", icon: Smartphone },
  { href: "/messages", label: "الرسائل", icon: MessageSquare },
  { href: "/subscription", label: "الاشتراك", icon: CreditCard },
  { href: "/settings", label: "الإعدادات", icon: Settings },
];

export function SidebarUser() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "fixed right-0 top-0 h-screen bg-white border-l z-30 transition-all duration-300 flex flex-col",
      collapsed ? "w-20" : "w-64"
    )}>
      <div className="p-4 border-b flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <User className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-lg font-tajawal">حسابي</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 font-tajawal",
                isActive
                  ? "bg-emerald-50 text-emerald-700 font-bold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              )}
            >
              <item.icon className={cn("w-5 h-5 flex-shrink-0", isActive && "text-emerald-600")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <button onClick={() => signOut({ callbackUrl: "/auth/login" })} className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition w-full font-tajawal",
          collapsed && "justify-center"
        )}>
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
