"use client";

import { Card } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Users, Smartphone, CreditCard, TrendingUp, DollarSign, MessageSquare } from "lucide-react";

export default function AnalyticsPage() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-tajawal">التحليلات والإحصائيات</h1>
        <p className="text-gray-500 font-tajawal">نظرة شاملة على أداء المنصة</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="إجمالي المستخدمين" value={1247} icon={Users} trend="+58 هذا الشهر" trendUp />
        <StatCard title="الأجهزة النشطة" value={892} icon={Smartphone} trend="+12%" trendUp />
        <StatCard title="الاشتراكات النشطة" value={456} icon={CreditCard} trend="+23%" trendUp />
        <StatCard title="الإيرادات" value={formatCurrency(45600)} icon={DollarSign} trend="+18%" trendUp />
      </div>

      {/* Charts Placeholder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="font-bold font-tajawal text-lg mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-600" /> نمو المستخدمين
          </h3>
          <div className="h-64 flex items-end justify-around gap-2 px-4">
            {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"].map((month, i) => {
              const heights = [40, 55, 45, 70, 60, 85];
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-emerald-200 rounded-t-lg transition-all duration-500 hover:bg-emerald-300" style={{ height: `${heights[i]}%` }} />
                  <span className="text-xs text-gray-500 font-tajawal">{month}</span>
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-bold font-tajawal text-lg mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-emerald-600" /> الرسائل المرسلة
          </h3>
          <div className="h-64 flex items-end justify-around gap-2 px-4">
            {["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو"].map((month, i) => {
              const heights = [30, 50, 65, 45, 80, 70];
              return (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div className="w-full bg-amber-200 rounded-t-lg transition-all duration-500 hover:bg-amber-300" style={{ height: `${heights[i]}%` }} />
                  <span className="text-xs text-gray-500 font-tajawal">{month}</span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Distribution */}
      <Card className="p-6 mt-6">
        <h3 className="font-bold font-tajawal text-lg mb-6">توزيع الاشتراكات</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { name: "مجاني", count: 680, pct: 54.5, color: "bg-gray-400" },
            { name: "فضي", count: 312, pct: 24.8, color: "bg-amber-400" },
            { name: "ذهبي", count: 55, pct: 20.7, color: "bg-emerald-500" },
          ].map((plan, i) => (
            <div key={i} className="text-center">
              <div className="relative w-32 h-32 mx-auto mb-4">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${plan.pct} ${100 - plan.pct}`} className={plan.color.replace("bg-", "text-")} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xl font-bold font-tajawal">{plan.pct}%</span>
                </div>
              </div>
              <h4 className="font-bold font-tajawal">{plan.name}</h4>
              <p className="text-sm text-gray-500 font-tajawal">{plan.count} مستخدم</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(amount);
}
