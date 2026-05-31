import Link from "next/link";
import { MessageSquare, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-white font-tajawal">MultiWA</span>
            </div>
            <p className="text-sm font-tajawal leading-relaxed">
              منصة واتساب متكاملة للأعمال - أدر محادثاتك بذكاء واحترافية
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 font-tajawal">روابط سريعة</h4>
            <ul className="space-y-2 font-tajawal text-sm">
              <li><Link href="/" className="hover:text-emerald-400 transition">الرئيسية</Link></li>
              <li><Link href="/#features" className="hover:text-emerald-400 transition">المميزات</Link></li>
              <li><Link href="/#pricing" className="hover:text-emerald-400 transition">الأسعار</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 font-tajawal">الدعم</h4>
            <ul className="space-y-2 font-tajawal text-sm">
              <li><Link href="#" className="hover:text-emerald-400 transition">مركز المساعدة</Link></li>
              <li><Link href="#" className="hover:text-emerald-400 transition">سياسة الخصوصية</Link></li>
              <li><Link href="#" className="hover:text-emerald-400 transition">الشروط والأحكام</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4 font-tajawal">تواصل معنا</h4>
            <ul className="space-y-3 font-tajawal text-sm">
              <li className="flex items-center gap-2"><Mail className="w-4 h-4" /> info@multiwa-ar.com</li>
              <li className="flex items-center gap-2"><Phone className="w-4 h-4" dir="ltr" /> +966 50 000 0000</li>
              <li className="flex items-center gap-2"><MapPin className="w-4 h-4" /> المملكة العربية السعودية</li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm font-tajawal">
          © {new Date().getFullYear()} MultiWA عربي. جميع الحقوق محفوظة.
        </div>
      </div>
    </footer>
  );
}
