"use client";

import { SidebarAdmin } from "@/components/shared/sidebar-admin";
import { Header } from "@/components/shared/header";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth/login");
    }
    if (status === "authenticated" && !["ADMIN", "SUPER_ADMIN"].includes((session?.user as any)?.role)) {
      router.push("/dashboard");
    }
  }, [status, router, session]);

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 font-tajawal text-gray-500">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <div className="flex">
        <div className="flex-1 mr-64">
          <main className="p-6">{children}</main>
        </div>
        <SidebarAdmin />
      </div>
    </div>
  );
}
