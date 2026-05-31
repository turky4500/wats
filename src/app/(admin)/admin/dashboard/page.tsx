"use client";

import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Smartphone, CreditCard, TrendingUp, Activity, DollarSign } from "lucide-react";

const recentUsers = [
  { id: 1, name: "أحمد محمد", email: "ahmed@email.com", status: "ACTIVE", plan: "ذهبي", date: "2025-01-15" },
  { id: 2, name: "سارة علي", email: "sara@email.com", status: "PENDING", plan: "مجاني", date: "2025-01-14" },
  { id: 3, name: "خالد عبدالله", email: "khaled@email.com", status: "ACTIVE", plan: "فضي", date: "2025-01-14" },
  { id: 4, name: "نورة سعد", email: "noura@email.com", status: "SUSPENDED", plan: "ذهبي", date: "2025-01-13" },
  { id: 5, name: "فهد محمد", email: "fahad@email.com", status: "ACTIVE", plan: "مجاني", date: "2025-01-12" },
];

const recentActivity = [
  { user: "أحمد محمد", action: "ترقية الاشتراك", details: "من فضي إلى ذهبي", time: "منذ 10 دقائق", type: "success" },
  { user: "سارة علي", action: "تسجيل جديد", details: "حساب جديد", time: "منذ 30 دقيقة", type: "info" },
  { user: "خالد عبدالله", action: "ربط جهاز جديد", details: "جهاز العمل", time: "منذ ساعة", type: "warning" },
  { user: "نورة سعد", action: "إيقاف الحساب", details: "مخالفة الشروط", time: "منذ 3 ساعات", type: "danger" },
];

export default function AdminDashboard() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-tajawal">لوحة تحكم الإدارة 🛡️</h1>
        <p className="text-gray-500 font-tajawal mt-1">نظرة عامة على المنصة</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="إجمالي المستخدمين" value={1247} icon={Users} trend="+58 هذا الشهر" trendUp />
        <StatCard title="الأجهزة النشطة" value={892} icon={Smartphone} trend="+12% عن الشهر السابق" trendUp />
        <StatCard title="الاشتراكات النشطة" value={456} icon={CreditCard} trend="+23% نمو" trendUp />
        <StatCard title="الإيرادات الشهرية" value={formatCurrency(45600)} icon={DollarSign} trend="+18% عن الشهر السابق" trendUp />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Users */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-tajawal text-lg">آخر المستخدمين</h3>
            <Badge variant="info">5 جدد</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 font-tajawal">المستخدم</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 font-tajawal">الحالة</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 font-tajawal">الباقة</th>
                  <th className="text-right py-2 px-3 text-xs font-bold text-gray-500 font-tajawal">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentUsers.map(user => (
                  <tr key={user.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-3">
                      <p className="font-tajawal text-sm font-medium">{user.name}</p>
                      <p className="text-xs text-gray-500 font-tajawal">{user.email}</p>
                    </td>
                    <td className="py-2 px-3">
                      <Badge variant={user.status === "ACTIVE" ? "success" : user.status === "PENDING" ? "warning" : "danger"}>
                        {getStatusAr(user.status)}
                      </Badge>
                    </td>
                    <td className="py-2 px-3 text-sm font-tajawal">{user.plan}</td>
                    <td className="py-2 px-3 text-sm text-gray-500 font-tajawal">{user.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Recent Activity */}
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold font-tajawal text-lg">آخر النشاطات</h3>
            <Activity className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {recentActivity.map((activity, i) => (
              <div key={i} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  activity.type === "success" ? "bg-emerald-500" :
                  activity.type === "info" ? "bg-blue-500" :
                  activity.type === "warning" ? "bg-amber-500" : "bg-red-500"
                }`} />
                <div className="flex-1">
                  <p className="text-sm font-tajawal font-medium">{activity.user}</p>
                  <p className="text-xs text-gray-500 font-tajawal">{activity.action} - {activity.details}</p>
                </div>
                <span className="text-xs text-gray-400 font-tajawal whitespace-nowrap">{activity.time}</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(amount);
}

function getStatusAr(status: string): string {
  const m: Record<string,string> = { ACTIVE: "نشط", PENDING: "قيد المراجعة", SUSPENDED: "معلق", BANNED: "محظور" };
  return m[status] || status;
}
