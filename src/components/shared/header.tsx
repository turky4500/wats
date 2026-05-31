"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Menu, X, User, LogOut, Settings, MessageSquare } from "lucide-react";
import { useState } from "react";
import { signOut } from "next-auth/react";
import { useSession } from "next-auth/react";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <MessageSquare className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold font-tajawal text-gray-900">MultiWA</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-gray-600 hover:text-emerald-600 font-tajawal transition">الرئيسية</Link>
            <Link href="/#features" className="text-gray-600 hover:text-emerald-600 font-tajawal transition">المميزات</Link>
            <Link href="/#pricing" className="text-gray-600 hover:text-emerald-600 font-tajawal transition">الأسعار</Link>
          </nav>

          {/* Desktop Auth */}
          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <div className="flex items-center gap-3">
                {(session.user as any)?.role === "ADMIN" || (session.user as any)?.role === "SUPER_ADMIN" ? (
                  <Link href="/admin/dashboard">
                    <Button variant="outline" size="sm">لوحة الإدارة</Button>
                  </Link>
                ) : (
                  <Link href="/dashboard">
                    <Button variant="outline" size="sm">لوحة التحكم</Button>
                  </Link>
                )}
                <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: "/" })}>
                  <LogOut className="w-4 h-4 ml-1" /> خروج
                </Button>
              </div>
            ) : (
              <>
                <Link href="/auth/login">
                  <Button variant="ghost" size="sm">تسجيل الدخول</Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="sm">حساب جديد</Button>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {/* Mobile Nav */}
        {mobileOpen && (
          <div className="md:hidden py-4 border-t">
            <div className="flex flex-col gap-3">
              <Link href="/" className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>الرئيسية</Link>
              <Link href="/#features" className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>المميزات</Link>
              <Link href="/#pricing" className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>الأسعار</Link>
              {session ? (
                <>
                  <Link href="/dashboard" className="px-3 py-2 text-gray-600 hover:bg-gray-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>لوحة التحكم</Link>
                  <button onClick={() => signOut({ callbackUrl: "/" })} className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-tajawal text-right">تسجيل الخروج</button>
                </>
              ) : (
                <>
                  <Link href="/auth/login" className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>تسجيل الدخول</Link>
                  <Link href="/auth/register" className="px-3 py-2 text-emerald-600 hover:bg-emerald-50 rounded-lg font-tajawal" onClick={() => setMobileOpen(false)}>حساب جديد</Link>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
