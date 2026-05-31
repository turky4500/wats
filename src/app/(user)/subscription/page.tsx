"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Check, Star, Calendar, ArrowUp } from "lucide-react";

const plans = [
  { id: "free", name: "مجاني", price: 0, features: ["جهاز واحد", "50 رسالة يومياً", "100 جهة اتصال", "دعم أساسي"], active: true },
  { id: "silver", name: "فضي", price: 99, features: ["3 أجهزة", "500 رسالة يومياً", "1,000 جهة اتصال", "API كامل", "ويب هوك", "دعم قياسي"], active: false },
  { id: "gold", name: "ذهبي", price: 249, features: ["أجهزة غير محدودة", "رسائل غير محدودة", "جهات اتصال غير محدودة", "API كامل", "ويب هوك", "أتمتة", "بث جماعي", "دعم VIP"], active: false },
];

export default function SubscriptionPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">الاشتراك</h1>
          <p className="text-gray-500 font-tajawal">إدارة باقتك الحالية</p>
        </div>
      </div>

      {/* Current Plan */}
      <Card className="mb-8 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-emerald-100 flex items-center justify-center">
              <CreditCard className="w-7 h-7 text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold font-tajawal">الباقة المجانية</h3>
                <Badge variant="success">نشطة</Badge>
              </div>
              <p className="text-sm text-gray-500 font-tajawal">تنتهي في 31 ديسمبر 2025</p>
            </div>
          </div>
          <Button>
            <ArrowUp className="w-4 h-4 ml-2" /> ترقية الباقة
          </Button>
        </div>
      </Card>

      {/* Plans */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => (
          <Card key={plan.id} className={`p-6 ${plan.active ? "ring-2 ring-emerald-500" : ""}`}>
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold font-tajawal mb-2">{plan.name}</h3>
              <div className="mb-2">
                <span className="text-4xl font-bold font-tajawal text-emerald-600">{plan.price}</span>
                <span className="text-gray-500 font-tajawal mr-1">ر.س/شهر</span>
              </div>
              {plan.active && <Badge variant="success">باقتك الحالية</Badge>}
            </div>
            <ul className="space-y-3 mb-6">
              {plan.features.map((f, i) => (
                <li key={i} className="flex items-center gap-2 text-sm font-tajawal">
                  <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <span className="text-gray-600">{f}</span>
                </li>
              ))}
            </ul>
            {!plan.active && (
              <Button className="w-full" variant={plan.price > 0 ? "default" : "outline"}>
                {plan.price === 0 ? "الباقة الحالية" : `الترقية إلى ${plan.name}`}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
