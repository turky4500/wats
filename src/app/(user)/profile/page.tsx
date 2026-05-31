"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { User, Save, Upload, Camera } from "lucide-react";

export default function ProfilePage() {
  const [form, setForm] = useState({
    name: "أحمد محمد", email: "ahmed@email.com", phone: "0500000001",
    age: "28", nationality: "سعودي", country: "المملكة العربية السعودية",
    city: "الرياض", gender: "MALE", maritalStatus: "SINGLE",
    religiousLevel: "committed", tribe: "عتيبة", education: "جامعي",
    job: "مهندس برمجيات", bio: "أبحث عن شريكة حياة ملتزمة",
    height: "175", weight: "75",
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold font-tajawal">الملف الشخصي</h1>
          <p className="text-gray-500 font-tajawal">إدارة بياناتك الشخصية</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Photo */}
        <Card className="lg:col-span-1 text-center p-8">
          <div className="relative inline-block mb-4">
            <div className="w-32 h-32 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
              <User className="w-16 h-16 text-emerald-600" />
            </div>
            <button className="absolute bottom-0 left-0 w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white hover:bg-emerald-700 transition">
              <Camera className="w-5 h-5" />
            </button>
          </div>
          <h3 className="font-bold font-tajawal text-lg">{form.name}</h3>
          <p className="text-gray-500 font-tajawal text-sm">{form.email}</p>
          <Button variant="outline" className="mt-4 w-full">
            <Upload className="w-4 h-4 ml-2" /> رفع صورة
          </Button>
        </Card>

        {/* Profile Form */}
        <Card className="lg:col-span-2 p-6">
          <h3 className="font-bold font-tajawal text-lg mb-6">البيانات الشخصية</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الكامل" value={form.name} onChange={(e) => handleChange("name", e.target.value)} />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} dir="ltr" />
            <Input label="رقم الهاتف" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} dir="ltr" />
            <Input label="العمر" type="number" value={form.age} onChange={(e) => handleChange("age", e.target.value)} />
            <Select label="الجنس" value={form.gender} onChange={(e) => handleChange("gender", e.target.value)} options={[
              { value: "MALE", label: "ذكر" }, { value: "FEMALE", label: "أنثى" },
            ]} />
            <Input label="الجنسية" value={form.nationality} onChange={(e) => handleChange("nationality", e.target.value)} />
            <Input label="الدولة" value={form.country} onChange={(e) => handleChange("country", e.target.value)} />
            <Input label="المدينة" value={form.city} onChange={(e) => handleChange("city", e.target.value)} />
            <Select label="الحالة الاجتماعية" value={form.maritalStatus} onChange={(e) => handleChange("maritalStatus", e.target.value)} options={[
              { value: "SINGLE", label: "أعزب/عزباء" }, { value: "DIVORCED", label: "مطلق/مطلقة" },
              { value: "WIDOWED", label: "أرمل/أرملة" }, { value: "MARRIED", label: "متزوج/متزوجة" },
            ]} />
            <Select label="المستوى الديني" value={form.religiousLevel} onChange={(e) => handleChange("religiousLevel", e.target.value)} options={[
              { value: "committed", label: "ملتزم/ة" }, { value: "moderate", label: "متوسط" },
              { value: "basic", label: "مسلم/ة" },
            ]} />
            <Input label="القبيلة" value={form.tribe} onChange={(e) => handleChange("tribe", e.target.value)} />
            <Input label="المؤهل العلمي" value={form.education} onChange={(e) => handleChange("education", e.target.value)} />
            <Input label="الوظيفة" value={form.job} onChange={(e) => handleChange("job", e.target.value)} />
            <Input label="الطول (سم)" type="number" value={form.height} onChange={(e) => handleChange("height", e.target.value)} />
            <Input label="الوزن (كجم)" type="number" value={form.weight} onChange={(e) => handleChange("weight", e.target.value)} />
          </div>

          <div className="mt-4">
            <Textarea label="نبذة عنك" value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} />
          </div>

          <div className="mt-6 flex gap-3">
            <Button size="lg">
              <Save className="w-4 h-4 ml-2" /> حفظ التغييرات
            </Button>
            <Button variant="outline" size="lg">إلغاء</Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
