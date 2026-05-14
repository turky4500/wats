import { useEffect, useState } from 'react'

const features = [
  { icon: '🔍', title: 'مراقبة فورية', desc: 'يراقب إعلانات حراج كل 15 دقيقة باستخدام كلمات مفتاحية مخصصة' },
  { icon: '📱', title: 'إشعارات واتساب', desc: 'يرسل رابط الإعلان مباشرة عبر واتساب أو تيليجرام فور ظهوره' },
  { icon: '🏙️', title: 'فلتر المدن', desc: 'خصّص الإشعارات حسب المدينة: الرياض، جدة، مكة وأكثر' },
  { icon: '🚫', title: 'استثناء الكلمات', desc: 'استبعد كلمات معينة مثل: مكسور، مستعمل، غير أصلي' },
  { icon: '🌙', title: 'ساعات الصمت', desc: 'حدد ساعات لا تريد فيها استلام الإشعارات بينما يستمر الرادار' },
  { icon: '📊', title: 'لوحة إدارة', desc: 'إدارة متكاملة للمستخدمين، الاشتراكات، والمدفوعات' },
]

const techStack = [
  { name: 'Flask 3.0', color: '#3b82f6', icon: '🐍' },
  { name: 'PostgreSQL', color: '#8b5cf6', icon: '🗄️' },
  { name: 'Bootstrap 5 RTL', color: '#1a6b3a', icon: '🎨' },
  { name: 'Gunicorn', color: '#f59e0b', icon: '⚙️' },
  { name: 'CloudScraper', color: '#ef4444', icon: '🕷️' },
  { name: 'Render.com', color: '#06b6d4', icon: '☁️' },
]

const screens = [
  { label: 'تسجيل الدخول', emoji: '🔐', color: '#0f4c2a' },
  { label: 'لوحة المستخدم', emoji: '📡', color: '#1a6b3a' },
  { label: 'لوحة الإدارة', emoji: '⚙️', color: '#1e3a5f' },
  { label: 'طلبات التجديد', emoji: '🔄', color: '#7c3aed' },
  { label: 'سجل الإعلانات', emoji: '📋', color: '#b45309' },
  { label: 'الإحصائيات', emoji: '📊', color: '#0891b2' },
]

export default function App() {
  const [activeTab, setActiveTab] = useState(0)
  const [counter, setCounter] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCounter(c => c + 1)
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  const tabContent = [
    {
      title: 'إعداد الرادار',
      steps: [
        '1️⃣ سجّل حساباً جديداً بجوالك',
        '2️⃣ أضف الكلمات المفتاحية (مثال: آيفون 15، بلايستيشن 5)',
        '3️⃣ حدد المدن المستهدفة اختيارياً',
        '4️⃣ اضغط تشغيل الرادار',
        '5️⃣ استلم إشعارات فورية عبر واتساب',
      ]
    },
    {
      title: 'نظام الاشتراك',
      steps: [
        '💰 تجربة مجانية 2 يوم لكل مستخدم جديد',
        '📅 التجديد الأسبوعي بـ 5 ريال فقط',
        '🏦 تحويل بنكي مع رفع إيصال الدفع',
        '✅ موافقة المدير تُجدد الاشتراك فوراً',
        '🔔 إشعارات بانتهاء الاشتراك قبل يومين',
      ]
    },
    {
      title: 'لوحة الإدارة',
      steps: [
        '👥 إدارة المستخدمين مع الفلترة والبحث',
        '📋 سجل شامل لجميع الإعلانات المُرصَدة',
        '🛡️ سجل أحداث لكل إجراء في النظام',
        '📊 إحصائيات تفصيلية وتقارير يومية',
        '⚙️ إعدادات واتساب وتيليجرام والبنك',
      ]
    },
  ]

  return (
    <div
      dir="rtl"
      style={{
        fontFamily: "'Cairo', 'Segoe UI', sans-serif",
        minHeight: '100vh',
        background: '#f0f4f8',
        color: '#1e293b',
      }}
    >
      <link
        href="https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800;900&display=swap"
        rel="stylesheet"
      />

      {/* Hero */}
      <div
        style={{
          background: 'linear-gradient(135deg, #0f4c2a 0%, #1a6b3a 60%, #16a34a 100%)',
          padding: '60px 20px',
          textAlign: 'center' as const,
          position: 'relative' as const,
          overflow: 'hidden' as const,
        }}
      >
        {/* Animated background circles */}
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              width: `${80 + i * 60}px`,
              height: `${80 + i * 60}px`,
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              animation: `pulse-ring ${3 + i}s ease-in-out infinite ${i * 0.5}s`,
            }}
          />
        ))}

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '20px',
              padding: '6px 18px',
              fontSize: '0.85rem',
              color: '#fde68a',
              fontWeight: '600',
              marginBottom: '20px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span style={{ display: 'inline-block', width: '8px', height: '8px', background: '#22c55e', borderRadius: '50%', animation: 'blink 1.5s infinite' }}></span>
            منصة SaaS متكاملة على Render.com
          </div>

          <h1
            style={{
              fontSize: 'clamp(2.2rem, 6vw, 4rem)',
              fontWeight: '900',
              color: 'white',
              margin: '0 0 12px',
              lineHeight: '1.2',
            }}
          >
            راصد <span style={{ color: '#fcd34d' }}>حراج</span>
          </h1>

          <p
            style={{
              fontSize: 'clamp(0.95rem, 2.5vw, 1.2rem)',
              color: 'rgba(255,255,255,0.8)',
              maxWidth: '600px',
              margin: '0 auto 36px',
              lineHeight: '1.8',
            }}
          >
            نظام مراقبة ذكي لإعلانات حراج يُرسل إشعارات فورية عبر واتساب وتيليجرام
            <br />فور نشر إعلان يطابق كلماتك المفتاحية
          </p>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <div
              style={{
                background: 'white',
                color: '#1a6b3a',
                borderRadius: '14px',
                padding: '14px 28px',
                fontWeight: '800',
                fontSize: '1rem',
                cursor: 'default',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
              }}
            >
              🚀 ابدأ مجاناً - يومان تجريبيان
            </div>
            <div
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: '2px solid rgba(255,255,255,0.3)',
                color: 'white',
                borderRadius: '14px',
                padding: '14px 28px',
                fontWeight: '700',
                fontSize: '1rem',
                cursor: 'default',
                backdropFilter: 'blur(10px)',
              }}
            >
              📄 توثيق كامل
            </div>
          </div>
        </div>
      </div>

      {/* Simulated notification */}
      <div
        key={counter}
        style={{
          background: '#1a6b3a',
          color: 'white',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          fontSize: '0.9rem',
          animation: 'slideDown 0.5s ease',
        }}
      >
        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '4px 12px' }}>
          🔔 إشعار جديد!
        </span>
        <span>
          {{
            0: '🏎️ سيارة لكزس IS300 موديل 2022 • الرياض',
            1: '📱 آيفون 15 Pro Max 256GB جديد بالكرتون • جدة',
            2: '💻 لابتوب ماك بوك برو M3 • مكة المكرمة',
            3: '⌚ ساعة رولكس أصلية بضمان • الدمام',
            4: '🎮 بلايستيشن 5 مع جهازين تحكم • الخبر',
          }[counter % 5]}
        </span>
        <span style={{ background: '#fcd34d', color: '#1a6b3a', borderRadius: '8px', padding: '4px 12px', fontWeight: '700' }}>
          haraj.com.sa/...
        </span>
      </div>

      {/* Features Grid */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>
            مميزات المنصة
          </h2>
          <p style={{ color: '#64748b', fontSize: '1rem' }}>
            كل ما تحتاجه لمراقبة إعلانات حراج باحترافية
          </p>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
          }}
        >
          {features.map((f, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '24px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                border: '1.5px solid #f1f5f9',
                display: 'flex',
                gap: '16px',
                alignItems: 'flex-start',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.transform = 'translateY(-4px)'
                e.currentTarget.style.boxShadow = '0 12px 32px rgba(26,107,58,0.12)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.06)'
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                  flexShrink: 0,
                }}
              >
                {f.icon}
              </div>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: '800', marginBottom: '6px', color: '#1e293b' }}>
                  {f.title}
                </h3>
                <p style={{ fontSize: '0.88rem', color: '#64748b', lineHeight: '1.6', margin: 0 }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works tabs */}
      <div style={{ background: 'white', padding: '60px 20px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>
              كيف يعمل؟
            </h2>
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {tabContent.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                style={{
                  padding: '10px 24px',
                  borderRadius: '10px',
                  border: 'none',
                  background: activeTab === i ? '#1a6b3a' : '#f1f5f9',
                  color: activeTab === i ? 'white' : '#64748b',
                  fontFamily: "'Cairo', sans-serif",
                  fontWeight: '700',
                  fontSize: '0.9rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                {t.title}
              </button>
            ))}
          </div>

          <div
            style={{
              background: '#f8fafc',
              borderRadius: '16px',
              padding: '28px',
              border: '1.5px solid #e2e8f0',
            }}
          >
            {tabContent[activeTab].steps.map((step, i) => (
              <div
                key={i}
                style={{
                  padding: '12px 0',
                  borderBottom: i < tabContent[activeTab].steps.length - 1 ? '1px solid #e2e8f0' : 'none',
                  fontSize: '0.95rem',
                  fontWeight: '600',
                  color: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <span
                  style={{
                    width: '28px',
                    height: '28px',
                    background: 'linear-gradient(135deg, #1a6b3a, #22c55e)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontSize: '0.8rem',
                    fontWeight: '800',
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </span>
                {step}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* App Screens Preview */}
      <div style={{ background: '#0f4c2a', padding: '60px 20px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '36px' }}>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '800', color: 'white', marginBottom: '8px' }}>
              شاشات التطبيق
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem' }}>
              واجهات عربية بالكامل مع دعم RTL وخط Cairo
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '16px',
            }}
          >
            {screens.map((s, i) => (
              <div
                key={i}
                style={{
                  background: s.color,
                  borderRadius: '16px',
                  padding: '28px 20px',
                  textAlign: 'center',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'default',
                  transition: 'transform 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>{s.emoji}</div>
                <div style={{ color: 'white', fontWeight: '700', fontSize: '0.9rem' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tech Stack */}
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '60px 20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h2 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '8px' }}>
            التقنيات المستخدمة
          </h2>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '16px',
          }}
        >
          {techStack.map((t, i) => (
            <div
              key={i}
              style={{
                background: 'white',
                borderRadius: '16px',
                padding: '20px',
                textAlign: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
                border: `2px solid ${t.color}20`,
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: '8px' }}>{t.icon}</div>
              <div style={{ fontWeight: '800', color: t.color, fontSize: '0.9rem' }}>{t.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Deployment Info */}
      <div
        style={{
          background: 'linear-gradient(135deg, #1e293b, #0f172a)',
          padding: '48px 20px',
          textAlign: 'center',
          color: 'white',
        }}
      >
        <div style={{ maxWidth: '700px', margin: '0 auto' }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '800', marginBottom: '16px' }}>
            ☁️ النشر على Render.com
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', lineHeight: '1.8', marginBottom: '28px' }}>
            التطبيق جاهز للنشر على Render مع قاعدة بيانات PostgreSQL.
            <br />جميع الملفات موجودة في مجلد <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px' }}>flask_app/</code>
          </p>

          <div
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: '14px',
              padding: '24px',
              textAlign: 'right',
              direction: 'ltr',
              fontFamily: 'monospace',
              fontSize: '0.9rem',
            }}
          >
            <div style={{ color: '#94a3b8', marginBottom: '8px' }}># Build Command</div>
            <div style={{ color: '#22c55e', marginBottom: '16px' }}>pip install -r requirements.txt</div>
            <div style={{ color: '#94a3b8', marginBottom: '8px' }}># Start Command</div>
            <div style={{ color: '#22c55e', marginBottom: '16px' }}>gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4</div>
            <div style={{ color: '#94a3b8', marginBottom: '8px' }}># Environment Variables</div>
            <div style={{ color: '#fcd34d' }}>DATABASE_URL=postgresql://...</div>
            <div style={{ color: '#fcd34d' }}>SECRET_KEY=your-secret-key</div>
            <div style={{ color: '#fcd34d' }}>RENDER=true</div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: '#0f172a',
          padding: '24px',
          textAlign: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.85rem',
        }}
      >
        &copy; 2024 راصد حراج - نظام مراقبة إعلانات حراج الفوري
        <br />
        <span style={{ fontSize: '0.75rem', marginTop: '4px', display: 'block' }}>
          Python 3.12.9 | Flask 3.0.3 | PostgreSQL | Bootstrap 5 RTL | Font Awesome
        </span>
      </div>

      <style>{`
        @keyframes pulse-ring {
          0%, 100% { opacity: 0.3; transform: translate(-50%, -50%) scale(1); }
          50% { opacity: 0.1; transform: translate(-50%, -50%) scale(1.1); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
