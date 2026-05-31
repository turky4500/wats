"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Users, CreditCard, Smartphone, Settings, BarChart3,
  MessageSquare, LogOut, Menu, X, Shield, FileText, Bell
} from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";

const menuItems = [
  { href: "/admin/dashboard", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/admin/users", label: "المستخدمون", icon: Users },
  { href: "/admin/subscriptions", label: "الاشتراكات", icon: CreditCard },
  { href: "/admin/devices", label: "الأجهزة", icon: Smartphone },
  { href: "/admin/analytics", label: "التحليلات", icon: BarChart3 },
  { href: "/admin/settings", label: "الإعدادات", icon: Settings },
];

export function SidebarAdmin() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={cn(
      "fixed right-0 top-0 h-screen bg-white border-l z-30 transition-all duration-300 flex flex-col",
      collapsed ? "w-20" : "w-64"
    )}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <Shield className="w-6 h-6 text-emerald-600" />
            <span className="font-bold text-lg font-tajawal">لوحة الإدارة</span>
          </div>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="p-1.5 hover:bg-gray-100 rounded-lg">
          {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
        </button>
      </div>

      {/* Menu */}
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

      {/* Footer */}
      <div className="p-3 border-t">
        <Link href="/dashboard" className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-gray-600 hover:bg-gray-50 transition font-tajawal",
          collapsed && "justify-center"
        )}>
          <MessageSquare className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>لوحة المستخدم</span>}
        </Link>
        <button onClick={() => signOut({ callbackUrl: "/auth/login" })} className={cn(
          "flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-600 hover:bg-red-50 transition w-full font-tajawal mt-1",
          collapsed && "justify-center"
        )}>
          <LogOut className="w-5 h-5 flex-shrink-0" />
          {!collapsed && <span>تسجيل الخروج</span>}
        </button>
      </div>
    </aside>
  );
}
