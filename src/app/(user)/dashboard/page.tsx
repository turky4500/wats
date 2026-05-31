"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Smartphone, MessageSquare, CreditCard, Users, Bell } from "lucide-react";
import { useSession } from "next-auth/react";

export default function UserDashboard() {
  const { data: session } = useSession();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-tajawal">مرحباً، {(session?.user as any)?.name || "مستخدم"} 👋</h1>
        <p className="text-gray-500 font-tajawal mt-1">نظرة عامة على حسابك</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="الأجهزة المتصلة" value={2} icon={Smartphone} trend="+1 هذا الأسبوع" trendUp />
        <StatCard title="الرسائل اليوم" value={147} icon={MessageSquare} trend="+12% عن أمس" trendUp />
        <StatCard title="جهات الاتصال" value={1250} icon={Users} trend="+35 جديد" trendUp />
        <StatCard title="حالة الاشتراك" value="نشط" icon={CreditCard} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="font-bold font-tajawal mb-4 flex items-center gap-2">
            <Bell className="w-5 h-5 text-amber-500" /> الإشعارات الأخيرة
          </h3>
          <div className="space-y-3">
            {[
              { text: "تم تجديد اشتراكك بنجاح", time: "منذ ساعة", type: "success" },
              { text: "جهاز جديد تم ربطه بحسابك", time: "منذ 3 ساعات", type: "info" },
              { text: "تم إرسال 500 رسالة هذا الأسبوع", time: "منذ يوم", type: "warning" },
              { text: "تحديث جديد متاح للنظام", time: "منذ يومين", type: "info" },
            ].map((notif, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${notif.type === "success" ? "bg-emerald-500" : notif.type === "warning" ? "bg-amber-500" : "bg-blue-500"}`} />
                  <span className="text-sm font-tajawal">{notif.text}</span>
                </div>
                <span className="text-xs text-gray-400 font-tajawal">{notif.time}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="font-bold font-tajawal mb-4 flex items-center gap-2">
            <Smartphone className="w-5 h-5 text-emerald-600" /> الأجهزة المتصلة
          </h3>
          <div className="space-y-3">
            {[
              { name: "جهاز العمل", phone: "+966 50 000 0001", status: "متصل", statusColor: "success" },
              { name: "جهاز شخصي", phone: "+966 55 000 0002", status: "متصل", statusColor: "success" },
            ].map((device, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
                    <Smartphone className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold font-tajawal">{device.name}</p>
                    <p className="text-xs text-gray-500 font-tajawal" dir="ltr">{device.phone}</p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-tajawal ${device.statusColor === "success" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                  {device.status}
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
