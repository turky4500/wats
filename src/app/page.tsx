import { Header } from "@/components/shared/header";
import { Footer } from "@/components/shared/footer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import Link from "next/link";
import { MessageSquare, Shield, Zap, Users, BarChart3, Smartphone, Check, Star } from "lucide-react";

const features = [
  { icon: Shield, title: "آمن وموثوق", desc: "تشفير كامل للبيانات وحماية متقدمة لحسابك" },
  { icon: Zap, title: "سريع وفعّال", desc: "أداء عالي مع استجابة فورية للرسائل" },
  { icon: Users, title: "إدارة الفريق", desc: "تحكم كامل في صلاحيات أعضاء فريقك" },
  { icon: BarChart3, title: "تحليلات متقدمة", desc: "تقارير وإحصائيات شاملة لأدائك" },
  { icon: Smartphone, title: "أجهزة متعددة", desc: "ربط عدة أجهزة واتساب في مكان واحد" },
  { icon: MessageSquare, title: "رسائل ذكية", desc: "قوالب جاهزة وأتمتة للردود التلقائية" },
];

const plans = [
  {
    name: "مجاني",
    price: 0,
    features: ["جهاز واحد", "50 رسالة يومياً", "100 جهة اتصال", "دعم أساسي"],
    popular: false,
  },
  {
    name: "فضي",
    price: 99,
    features: ["3 أجهزة", "500 رسالة يومياً", "1000 جهة اتصال", "API كامل", "ويب هوك", "دعم قياسي"],
    popular: true,
  },
  {
    name: "ذهبي",
    price: 249,
    features: ["أجهزة غير محدودة", "رسائل غير محدودة", "جهات اتصال غير محدودة", "API كامل", "أتمتة", "بث جماعي", "دعم VIP"],
    popular: false,
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      <Header />

      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 text-white">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 bg-amber-300 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-24 md:py-32">
          <div className="text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-full mb-6 backdrop-blur-sm">
              <Star className="w-4 h-4 text-amber-400" />
              <span className="text-sm font-tajawal">المنصة العربية الأولى لإدارة واتساب</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold font-tajawal mb-6 leading-tight">
              أدر أعمالك عبر واتساب<br />
              <span className="text-amber-300">بذكاء واحترافية</span>
            </h1>
            <p className="text-lg md:text-xl text-emerald-100 mb-8 font-tajawal max-w-2xl mx-auto">
              منصة متكاملة تتيح لك إدارة أجهزة واتساب متعددة، إرسال رسائل جماعية، أتمتة الردود، ومتابعة كل شيء من لوحة تحكم واحدة
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/register">
                <Button size="lg" className="bg-amber-500 hover:bg-amber-600 text-white px-8 font-tajawal text-lg">
                  ابدأ مجاناً
                </Button>
              </Link>
              <Link href="/auth/login">
                <Button variant="outline" size="lg" className="border-white text-white hover:bg-white/10 px-8 font-tajawal text-lg">
                  تسجيل الدخول
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-tajawal mb-4">مميزات <span className="text-emerald-600">استثنائية</span></h2>
            <p className="text-gray-500 font-tajawal max-w-2xl mx-auto">كل ما تحتاجه لإدارة واتساب للأعمال في مكان واحد</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, i) => (
              <Card key={i} className="hover:shadow-lg transition-shadow border-gray-100">
                <div className="p-2 w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-emerald-600" />
                </div>
                <h3 className="text-lg font-bold font-tajawal mb-2">{feature.title}</h3>
                <p className="text-gray-500 font-tajawal text-sm leading-relaxed">{feature.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { num: "+10,000", label: "مستخدم نشط" },
              { num: "+5M", label: "رسالة مُرسلة" },
              { num: "99.9%", label: "وقت التشغيل" },
              { num: "24/7", label: "دعم فني" },
            ].map((stat, i) => (
              <div key={i}>
                <div className="text-3xl md:text-4xl font-bold font-tajawal text-emerald-600">{stat.num}</div>
                <div className="text-gray-500 font-tajawal mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold font-tajawal mb-4">باقات <span className="text-emerald-600">الاشتراك</span></h2>
            <p className="text-gray-500 font-tajawal max-w-2xl mx-auto">اختر الباقة المناسبة لاحتياجاتك</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan, i) => (
              <Card key={i} className={`relative ${plan.popular ? "ring-2 ring-emerald-500 shadow-xl" : "border-gray-200"}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-600 text-white px-4 py-1 rounded-full text-sm font-tajawal font-bold">الأكثر طلباً</span>
                  </div>
                )}
                <div className="p-6 text-center">
                  <h3 className="text-xl font-bold font-tajawal mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold font-tajawal text-emerald-600">{plan.price}</span>
                    <span className="text-gray-500 font-tajawal mr-1">ر.س/شهر</span>
                  </div>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((f, j) => (
                      <li key={j} className="flex items-center gap-2 text-sm font-tajawal">
                        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                        <span className="text-gray-600">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link href="/auth/register">
                    <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                      {plan.price === 0 ? "ابدأ مجاناً" : "اشترك الآن"}
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-emerald-600 to-emerald-700 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-3xl md:text-4xl font-bold font-tajawal mb-4">جاهز للبدء؟</h2>
          <p className="text-emerald-100 font-tajawal text-lg mb-8">انضم لآلاف المستخدمين الذين يثقون بمنصتنا</p>
          <Link href="/auth/register">
            <Button size="lg" className="bg-white text-emerald-700 hover:bg-gray-100 px-8 font-tajawal text-lg">
              سجّل مجاناً الآن
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
