"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { MessageSquare, Eye, EyeOff } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    name: "", email: "", phone: "", password: "",
    gender: "MALE", age: "", nationality: "", country: "", city: "",
    maritalStatus: "SINGLE", religiousLevel: "committed", tribe: "", bio: "",
  });

  const handleChange = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, age: parseInt(form.age) }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "حدث خطأ");
      } else {
        setSuccess(true);
        setTimeout(() => router.push("/auth/login"), 3000);
      }
    } catch {
      setError("حدث خطأ أثناء التسجيل");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-emerald-600" />
          </div>
          <h2 className="text-2xl font-bold font-tajawal mb-2">تم التسجيل بنجاح!</h2>
          <p className="text-gray-500 font-tajawal">جاري تحويلك لصفحة تسجيل الدخول...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-gray-50 flex items-center justify-center p-4 py-8">
      <Card className="w-full max-w-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold font-tajawal">إنشاء حساب جديد</h1>
          <p className="text-gray-500 font-tajawal mt-1">أدخل بياناتك للتسجيل</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-6 font-tajawal text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* البيانات الأساسية */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الاسم الكامل" value={form.name} onChange={(e) => handleChange("name", e.target.value)} required placeholder="أدخل اسمك" />
            <Input label="البريد الإلكتروني" type="email" value={form.email} onChange={(e) => handleChange("email", e.target.value)} required placeholder="example@email.com" dir="ltr" />
            <Input label="رقم الهاتف" type="tel" value={form.phone} onChange={(e) => handleChange("phone", e.target.value)} required placeholder="05xxxxxxxx" dir="ltr" />
            <div className="relative">
              <Input label="كلمة المرور" type={showPassword ? "text" : "password"} value={form.password} onChange={(e) => handleChange("password", e.target.value)} required placeholder="••••••••" dir="ltr" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-9 text-gray-400">
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select label="الجنس" value={form.gender} onChange={(e) => handleChange("gender", e.target.value)} options={[
              { value: "MALE", label: "ذكر" }, { value: "FEMALE", label: "أنثى" },
            ]} />
            <Input label="العمر" type="number" value={form.age} onChange={(e) => handleChange("age", e.target.value)} required min="18" max="100" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="الجنسية" value={form.nationality} onChange={(e) => handleChange("nationality", e.target.value)} required placeholder="سعودي" />
            <Input label="الدولة" value={form.country} onChange={(e) => handleChange("country", e.target.value)} required placeholder="المملكة العربية السعودية" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="المدينة" value={form.city} onChange={(e) => handleChange("city", e.target.value)} required placeholder="الرياض" />
            <Select label="الحالة الاجتماعية" value={form.maritalStatus} onChange={(e) => handleChange("maritalStatus", e.target.value)} options={[
              { value: "SINGLE", label: "أعزب/عزباء" }, { value: "DIVORCED", label: "مطلق/مطلقة" },
              { value: "WIDOWED", label: "أرمل/أرملة" }, { value: "MARRIED", label: "متزوج/متزوجة" },
            ]} />
          </div>

          <Select label="المستوى الديني" value={form.religiousLevel} onChange={(e) => handleChange("religiousLevel", e.target.value)} options={[
            { value: "committed", label: "ملتزم/ة" }, { value: "moderate", label: "متوسط الالتزام" },
            { value: "basic", label: "مسلم/ة" },
          ]} />

          <Input label="القبيلة / العائلة" value={form.tribe} onChange={(e) => handleChange("tribe", e.target.value)} placeholder="اختياري" />

          <Input label="نبذة عنك" value={form.bio} onChange={(e) => handleChange("bio", e.target.value)} placeholder="اكتب نبذة مختصرة عن نفسك..." />

          <Button type="submit" disabled={loading} className="w-full" size="lg">
            {loading ? "جاري التسجيل..." : "إنشاء الحساب"}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-gray-500 font-tajawal text-sm">
            لديك حساب بالفعل؟{" "}
            <Link href="/auth/login" className="text-emerald-600 hover:underline font-bold">
              تسجيل الدخول
            </Link>
          </p>
        </div>
      </Card>
    </div>
  );
}
