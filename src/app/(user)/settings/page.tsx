"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Bell, Shield, Globe, Trash2, Save } from "lucide-react";

export default function SettingsPage() {
  const [notifications, setNotifications] = useState(true);
  const [emailNotif, setEmailNotif] = useState(true);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">الإعدادات</h1>
          <p className="text-gray-500 font-tajawal">إعدادات حسابك</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Notifications */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Bell className="w-5 h-5 text-amber-500" />
            <h3 className="font-bold font-tajawal text-lg">الإشعارات</h3>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-tajawal font-medium">إشعارات التطبيق</p>
                <p className="text-sm text-gray-500 font-tajawal">استلام إشعارات داخل التطبيق</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={notifications} onChange={() => setNotifications(!notifications)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-tajawal font-medium">إشعارات البريد</p>
                <p className="text-sm text-gray-500 font-tajawal">استلام إشعارات عبر البريد الإلكتروني</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" checked={emailNotif} onChange={() => setEmailNotif(!emailNotif)} className="sr-only peer" />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
          </div>
        </Card>

        {/* Change Password */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-5 h-5 text-emerald-600" />
            <h3 className="font-bold font-tajawal text-lg">تغيير كلمة المرور</h3>
          </div>
          <div className="space-y-4 max-w-md">
            <Input label="كلمة المرور الحالية" type="password" placeholder="••••••••" dir="ltr" />
            <Input label="كلمة المرور الجديدة" type="password" placeholder="••••••••" dir="ltr" />
            <Input label="تأكيد كلمة المرور" type="password" placeholder="••••••••" dir="ltr" />
            <Button>
              <Save className="w-4 h-4 ml-2" /> حفظ كلمة المرور
            </Button>
          </div>
        </Card>

        {/* Language */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <Globe className="w-5 h-5 text-blue-500" />
            <h3 className="font-bold font-tajawal text-lg">اللغة والمنطقة</h3>
          </div>
          <div className="max-w-md">
            <p className="text-sm text-gray-500 font-tajawal mb-2">اللغة الحالية: العربية</p>
            <p className="text-sm text-gray-500 font-tajawal">المنطقة الزمنية: Asia/Riyadh</p>
          </div>
        </Card>

        {/* Danger Zone */}
        <Card className="p-6 border-red-200">
          <div className="flex items-center gap-3 mb-4">
            <Trash2 className="w-5 h-5 text-red-500" />
            <h3 className="font-bold font-tajawal text-lg text-red-600">منطقة الخطر</h3>
          </div>
          <p className="text-sm text-gray-500 font-tajawal mb-4">حذف الحساب نهائي ولا يمكن التراجع عنه</p>
          <Button variant="destructive">حذف الحساب نهائياً</Button>
        </Card>
      </div>
    </div>
  );
}
