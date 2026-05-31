"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Settings, Save, Shield, Bell, Globe, Database } from "lucide-react";

export default function AdminSettingsPage() {
  const [appSettings, setAppSettings] = useState({
    name: "MultiWA عربي",
    url: "https://multiwa-ar.com",
    email: "admin@multiwa-ar.com",
    maxFreeDevices: "1",
    maxFreeMessages: "50",
    autoApprove: "false",
  });

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold font-tajawal">إعدادات النظام</h1>
        <p className="text-gray-500 font-tajawal">إعدادات المنصة العامة</p>
      </div>

      <div className="space-y-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold font-tajawal text-lg">إعدادات التطبيق</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="اسم التطبيق" value={appSettings.name} onChange={(e) => setAppSettings({...appSettings, name: e.target.value})} />
            <Input label="رابط التطبيق" value={appSettings.url} onChange={(e) => setAppSettings({...appSettings, url: e.target.value})} dir="ltr" />
            <Input label="بريد الإدارة" value={appSettings.email} onChange={(e) => setAppSettings({...appSettings, email: e.target.value})} dir="ltr" />
            <Select label="الموافقة التلقائية" value={appSettings.autoApprove} onChange={(e) => setAppSettings({...appSettings, autoApprove: e.target.value})} options={[
              { value: "true", label: "تفعيل" }, { value: "false", label: "تعطيل" },
            ]} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold font-tajawal text-lg">حدود الباقة المجانية</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الحد الأقصى للأجهزة" type="number" value={appSettings.maxFreeDevices} onChange={(e) => setAppSettings({...appSettings, maxFreeDevices: e.target.value})} />
            <Input label="الحد الأقصى للرسائل يومياً" type="number" value={appSettings.maxFreeMessages} onChange={(e) => setAppSettings({...appSettings, maxFreeMessages: e.target.value})} />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold font-tajawal text-lg">إعدادات الإشعارات</h3>
          </div>
          <div className="space-y-3">
            {["إشعارات تسجيل مستخدم جديد", "إشعارات تجديد الاشتراك", "إشعارات فصل الجهاز", "إشعارات تجاوز الحد"].map((label, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                <span className="text-sm font-tajawal">{label}</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input type="checkbox" defaultChecked className="sr-only peer" />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                </label>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Database className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold font-tajawal text-lg">قاعدة البيانات</h3>
          </div>
          <div className="flex gap-3">
            <Button variant="outline"><Database className="w-4 h-4 ml-2" /> نسخ احتياطي</Button>
            <Button variant="outline">استعادة النسخة الاحتياطية</Button>
          </div>
        </Card>

        <div className="flex gap-3">
          <Button size="lg"><Save className="w-4 h-4 ml-2" /> حفظ جميع الإعدادات</Button>
          <Button variant="outline" size="lg">إعادة تعيين</Button>
        </div>
      </div>
    </div>
  );
}
