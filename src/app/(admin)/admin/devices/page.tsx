"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Search, Eye, Ban, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";

const devices = [
  { id: 1, name: "جهاز العمل - أحمد", user: "أحمد محمد", phone: "+966 50 000 0001", status: "CONNECTED", sent: 2450, received: 1890 },
  { id: 2, name: "جهاز شخصي - أحمد", user: "أحمد محمد", phone: "+966 55 000 0002", status: "CONNECTED", sent: 890, received: 650 },
  { id: 3, name: "جهاز الدعم - خالد", user: "خالد عبدالله", phone: "+966 54 000 0003", status: "DISCONNECTED", sent: 0, received: 0 },
  { id: 4, name: "جهاز المبيعات - سارة", user: "سارة علي", phone: "+966 56 000 0004", status: "QR_SCAN", sent: 0, received: 0 },
  { id: 5, name: "جهاز الحسابات - فهد", user: "فهد محمد", phone: "+966 53 000 0005", status: "ERROR", sent: 0, received: 0 },
];

export default function AdminDevicesPage() {
  const [search, setSearch] = useState("");

  const filtered = devices.filter(d =>
    d.name.includes(search) || d.user.includes(search) || d.phone.includes(search)
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">إدارة الأجهزة</h1>
          <p className="text-gray-500 font-tajawal">عرض جميع أجهزة الواتساب المتصلة</p>
        </div>
      </div>

      <Card className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input className="pr-10" placeholder="بحث بالجهاز أو المستخدم..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(device => (
          <Card key={device.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold font-tajawal text-sm">{device.name}</h3>
                  <p className="text-xs text-gray-500 font-tajawal">{device.user}</p>
                </div>
              </div>
              <Badge variant={device.status === "CONNECTED" ? "success" : device.status === "DISCONNECTED" ? "warning" : "danger"}>
                {getDeviceStatusAr(device.status)}
              </Badge>
            </div>

            <div className="text-xs text-gray-500 font-tajawal mb-3" dir="ltr">{device.phone}</div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-tajawal">{device.sent}</p>
                <p className="text-xs text-gray-500 font-tajawal">مرسلة</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-tajawal">{device.received}</p>
                <p className="text-xs text-gray-500 font-tajawal">مستلمة</p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1"><Eye className="w-3 h-3 ml-1" /> عرض</Button>
              <Button variant="outline" size="sm" className="flex-1"><RefreshCw className="w-3 h-3 ml-1" /> إعادة ربط</Button>
              <Button variant="ghost" size="sm" className="text-red-600"><Ban className="w-4 h-4" /></Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function getDeviceStatusAr(status: string): string {
  const m: Record<string,string> = { CONNECTED: "متصل", DISCONNECTED: "غير متصل", CONNECTING: "جاري الاتصال", QR_SCAN: "بانتظار المسح", ERROR: "خطأ" };
  return m[status] || status;
}
