"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Search, Plus, Edit2, CreditCard, Check, DollarSign } from "lucide-react";

const subscriptions = [
  { id: 1, userName: "أحمد محمد", plan: "ذهبي", amount: 249, status: "ACTIVE", startDate: "2025-01-01", endDate: "2025-02-01", method: "CREDIT_CARD" },
  { id: 2, userName: "سارة علي", plan: "مجاني", amount: 0, status: "ACTIVE", startDate: "2025-01-05", endDate: null, method: "FREE" },
  { id: 3, userName: "خالد عبدالله", plan: "فضي", amount: 99, status: "EXPIRED", startDate: "2024-12-01", endDate: "2025-01-01", method: "STC_PAY" },
  { id: 4, userName: "نورة سعد", plan: "ذهبي", amount: 249, status: "CANCELLED", startDate: "2025-01-10", endDate: "2025-01-12", method: "APPLE_PAY" },
];

export default function AdminSubscriptionsPage() {
  const [search, setSearch] = useState("");
  const [showAdd, setShowAdd] = useState(false);

  const filtered = subscriptions.filter(s =>
    s.userName.includes(search) || s.plan.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">إدارة الاشتراكات</h1>
          <p className="text-gray-500 font-tajawal">عرض وإدارة جميع الاشتراكات</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 ml-2" /> إضافة اشتراك
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Stat title="إجمالي الإيرادات" value={formatCurrency(597)} icon={DollarSign} />
        <Stat title="الاشتراكات النشطة" value={subscriptions.filter(s => s.status === "ACTIVE").length} icon={CreditCard} />
        <Stat title="الاشتراكات المنتهية" value={subscriptions.filter(s => s.status === "EXPIRED").length} icon={CreditCard} />
        <Stat title="الاشتراكات الملغاة" value={subscriptions.filter(s => s.status === "CANCELLED").length} icon={CreditCard} />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pr-10" placeholder="بحث باسم المستخدم أو الباقة..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">المستخدم</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الباقة</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">المبلغ</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الحالة</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">تاريخ البدء</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">تاريخ الانتهاء</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">طريقة الدفع</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(sub => (
                <tr key={sub.id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-4 text-sm font-tajawal font-medium">{sub.userName}</td>
                  <td className="py-3 px-4">
                    <Badge variant={sub.plan === "ذهبي" ? "info" : sub.plan === "فضي" ? "warning" : "default"}>{sub.plan}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-tajawal">{formatCurrency(sub.amount)}</td>
                  <td className="py-3 px-4">
                    <Badge variant={sub.status === "ACTIVE" ? "success" : sub.status === "EXPIRED" ? "danger" : "warning"}>
                      {getSubStatusAr(sub.status)}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-tajawal">{sub.startDate}</td>
                  <td className="py-3 px-4 text-sm font-tajawal">{sub.endDate || "غير محدد"}</td>
                  <td className="py-3 px-4 text-sm font-tajawal">{getPaymentMethodAr(sub.method)}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm"><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600"><Check className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="إضافة اشتراك جديد">
        <div className="space-y-4">
          <Input label="اسم المستخدم" placeholder="أدخل اسم المستخدم" />
          <Select label="الباقة" value="" onChange={() => {}} options={[
            { value: "free", label: "مجاني" }, { value: "silver", label: "فضي" }, { value: "gold", label: "ذهبي" },
          ]} />
          <Input label="تاريخ الانتهاء" type="date" value="" onChange={() => {}} />
          <Button className="w-full" size="lg"><Check className="w-4 h-4 ml-2" /> إنشاء الاشتراك</Button>
        </div>
      </Modal>
    </div>
  );
}

function Stat({ title, value, icon: Icon }: any) {
  return (
    <Card className="p-4 flex items-center gap-3">
      <div className="p-3 rounded-xl bg-emerald-50"><Icon className="w-5 h-5 text-emerald-600" /></div>
      <div>
        <p className="text-sm text-gray-500 font-tajawal">{title}</p>
        <p className="text-lg font-bold font-tajawal">{value}</p>
      </div>
    </Card>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ar-SA", { style: "currency", currency: "SAR", minimumFractionDigits: 0 }).format(amount);
}

function getSubStatusAr(status: string): string {
  const m: Record<string,string> = { ACTIVE: "نشط", EXPIRED: "منتهي", CANCELLED: "ملغي", PENDING: "قيد الانتظار", FAILED: "فشل" };
  return m[status] || status;
}

function getPaymentMethodAr(method: string): string {
  const m: Record<string,string> = { CREDIT_CARD: "بطاقة ائتمان", BANK_TRANSFER: "تحويل بنكي", APPLE_PAY: "Apple Pay", STC_PAY: "STC Pay", FREE: "مجاني" };
  return m[method] || method;
}
