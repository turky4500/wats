"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Smartphone, Plus, QrCode, Trash2, RefreshCw, Copy } from "lucide-react";
import { Modal } from "@/components/ui/modal";

const devices = [
  { id: 1, name: "جهاز العمل", phone: "+966 50 000 0001", status: "CONNECTED", sent: 2450, received: 1890, lastSeen: "الآن" },
  { id: 2, name: "جهاز شخصي", phone: "+966 55 000 0002", status: "CONNECTED", sent: 890, received: 650, lastSeen: "منذ 5 دقائق" },
  { id: 3, name: "جهاز الدعم", phone: "+966 54 000 0003", status: "DISCONNECTED", sent: 0, received: 0, lastSeen: "منذ يومين" },
];

export default function DevicesPage() {
  const [showAdd, setShowAdd] = useState(false);
  const [qrData, setQrData] = useState<string | null>(null);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">أجهزة الواتساب</h1>
          <p className="text-gray-500 font-tajawal">إدارة الأجهزة المتصلة</p>
        </div>
        <Button onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 ml-2" /> إضافة جهاز
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {devices.map((device) => (
          <Card key={device.id} className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <Smartphone className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold font-tajawal">{device.name}</h3>
                  <p className="text-sm text-gray-500 font-tajawal" dir="ltr">{device.phone}</p>
                </div>
              </div>
              <Badge variant={device.status === "CONNECTED" ? "success" : "danger"}>
                {device.status === "CONNECTED" ? "متصل" : "غير متصل"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-tajawal">{device.sent}</p>
                <p className="text-xs text-gray-500 font-tajawal">رسائل مرسلة</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <p className="text-lg font-bold font-tajawal">{device.received}</p>
                <p className="text-xs text-gray-500 font-tajawal">رسائل مستلمة</p>
              </div>
            </div>

            <p className="text-xs text-gray-400 font-tajawal mb-4">آخر اتصال: {device.lastSeen}</p>

            <div className="flex gap-2">
              {device.status === "CONNECTED" ? (
                <Button variant="outline" size="sm" className="flex-1">
                  <RefreshCw className="w-3 h-3 ml-1" /> إعادة ربط
                </Button>
              ) : (
                <Button size="sm" className="flex-1">
                  <QrCode className="w-3 h-3 ml-1" /> ربط الجهاز
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Add Device Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title="إضافة جهاز واتساب جديد" size="md">
        <div className="text-center">
          <p className="text-gray-500 font-tajawal mb-6">امسح رمز QR عبر واتساب في هاتفك لربط الجهاز</p>
          <div className="w-64 h-64 mx-auto bg-gray-100 rounded-xl flex items-center justify-center mb-6">
            <QrCode className="w-24 h-24 text-gray-400" />
          </div>
          <p className="text-sm text-gray-400 font-tajawal">افتح واتساب → الإعدادات → الأجهزة المرتبطة → ربط جهاز</p>
        </div>
      </Modal>
    </div>
  );
}
