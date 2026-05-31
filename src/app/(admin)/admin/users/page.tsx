"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { Search, UserPlus, Edit2, Trash2, Ban, Check, Shield, Eye } from "lucide-react";

const users = [
  { id: 1, name: "أحمد محمد", email: "ahmed@email.com", phone: "0500000001", role: "USER", status: "ACTIVE", plan: "ذهبي", devices: 3, joinDate: "2025-01-01" },
  { id: 2, name: "سارة علي", email: "sara@email.com", phone: "0550000002", role: "USER", status: "PENDING", plan: "مجاني", devices: 1, joinDate: "2025-01-05" },
  { id: 3, name: "خالد عبدالله", email: "khaled@email.com", phone: "0540000003", role: "USER", status: "ACTIVE", plan: "فضي", devices: 2, joinDate: "2025-01-10" },
  { id: 4, name: "نورة سعد", email: "noura@email.com", phone: "0560000004", role: "USER", status: "SUSPENDED", plan: "ذهبي", devices: 1, joinDate: "20220-01-12" },
  { id: 5, name: "فهد محمد", email: "fahad@email.com", phone: "0530000005", role: "MODERATOR", status: "ACTIVE", plan: "فضي", devices: 2, joinDate: "2024-12-20" },
];

export default function AdminUsersPage() {
  const [search, setSearch] = useState("");
  const [showEdit, setShowEdit] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [filterStatus, setFilterStatus] = useState("ALL");

  const filtered = users.filter(u => {
    const matchSearch = u.name.includes(search) || u.email.includes(search) || u.phone.includes(search);
    const matchStatus = filterStatus === "ALL" || u.status === filterStatus;
    return matchSearch && matchStatus;
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">إدارة المستخدمين</h1>
          <p className="text-gray-500 font-tajawal">عرض وإدارة جميع المستخدمين</p>
        </div>
        <Button>
          <UserPlus className="w-4 h-4 ml-2" /> إضافة مستخدم
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input className="pr-10" placeholder="بحث بالاسم أو البريد أو الهاتف..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} options={[
            { value: "ALL", label: "كل الحالات" },
            { value: "ACTIVE", label: "نشط" },
            { value: "PENDING", label: "قيد المراجعة" },
            { value: "SUSPENDED", label: "معلق" },
            { value: "BANNED", label: "محظور" },
          ]} />
        </div>
      </Card>

      {/* Users Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">المستخدم</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الدور</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الحالة</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الباقة</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الأجهزة</th>
                <th className="text-right py-3 px-4 text-xs font-bold text-gray-500 font-tajawal">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-emerald-600" />
                      </div>
                      <div>
                        <p className="font-tajawal font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-gray-500 font-tajawal">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={user.role === "ADMIN" ? "danger" : user.role === "MODERATOR" ? "warning" : "default"}>
                      {user.role === "ADMIN" ? "مدير" : user.role === "MODERATOR" ? "مشرف" : "مستخدم"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4">
                    <Badge variant={user.status === "ACTIVE" ? "success" : user.status === "PENDING" ? "warning" : "danger"}>
                      {user.status === "ACTIVE" ? "نشط" : user.status === "PENDING" ? "قيد المراجعة" : "معلق"}
                    </Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-tajawal">{user.plan}</td>
                  <td className="py-3 px-4 text-sm font-tajawal">{user.devices}</td>
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" title="عرض"><Eye className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" title="تعديل" onClick={() => { setSelectedUser(user); setShowEdit(true); }}><Edit2 className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" title="حظر"><Ban className="w-4 h-4" /></Button>
                      <Button variant="ghost" size="sm" className="text-red-600" title="حذف"><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t flex items-center justify-between">
          <p className="text-sm text-gray-500 font-tajawal">عرض {filtered.length} من {users.length} مستخدم</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">السابق</Button>
            <Button size="sm">التالي</Button>
          </div>
        </div>
      </Card>

      {/* Edit User Modal */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={`تعديل المستخدم: ${selectedUser?.name || ""}`}>
        {selectedUser && (
          <div className="space-y-4">
            <Input label="الاسم" value={selectedUser.name} onChange={() => {}} />
            <Input label="البريد الإلكتروني" value={selectedUser.email} onChange={() => {}} dir="ltr" />
            <Select label="الدور" value={selectedUser.role} onChange={() => {}} options={[
              { value: "USER", label: "مستخدم" },
              { value: "MODERATOR", label: "مشرف" },
              { value: "ADMIN", label: "مدير" },
            ]} />
            <Select label="الحالة" value={selectedUser.status} onChange={() => {}} options={[
              { value: "ACTIVE", label: "نشط" },
              { value: "PENDING", label: "قيد المراجعة" },
              { value: "SUSPENDED", label: "معلق" },
              { value: "BANNED", label: "محظور" },
            ]} />
            <div className="flex gap-3">
              <Button size="lg"><Check className="w-4 h-4 ml-2" /> حفظ التغييرات</Button>
              <Button variant="outline" size="lg" onClick={() => setShowEdit(false)}>إلغاء</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
