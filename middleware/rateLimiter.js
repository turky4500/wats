/**
 * Rate Limiter بسيط بدون مكتبات خارجية
 * يعمل بالذاكرة - مناسب لتطبيق بخادم واحد
 */

const rateLimitStore = {};

// تنظيف القيم المنتهية كل 10 دقائق
setInterval(() => {
    const now = Date.now();
    for (const key in rateLimitStore) {
        if (rateLimitStore[key].resetTime < now) {
            delete rateLimitStore[key];
        }
    }
}, 10 * 60 * 1000);

/**
 * إنشاء middleware للحد من الطلبات
 * @param {Object} options
 * @param {number} options.windowMs - فترة النافذة بالميللي ثانية
 * @param {number} options.max - الحد الأقصى للطلبات في النافذة
 * @param {string} options.message - رسالة الخطأ
 * @param {string} options.keyGenerator - طريقة تحديد المستخدم ('ip' أو 'session')
 */
function createRateLimiter(options = {}) {
    const {
        windowMs = 15 * 60 * 1000,  // 15 دقيقة افتراضياً
        max = 100,                    // 100 طلب افتراضياً
        message = 'عدد كبير من الطلبات. يرجى المحاولة لاحقاً.',
        keyGenerator = 'ip'
    } = options;

    return (req, res, next) => {
        const key = keyGenerator === 'session' && req.session?.userId 
            ? `session_${req.session.userId}` 
            : `ip_${req.ip || req.connection.remoteAddress}`;
        
        const now = Date.now();

        if (!rateLimitStore[key] || rateLimitStore[key].resetTime < now) {
            rateLimitStore[key] = {
                count: 1,
                resetTime: now + windowMs
            };
            return next();
        }

        rateLimitStore[key].count++;

        if (rateLimitStore[key].count > max) {
            const retryAfter = Math.ceil((rateLimitStore[key].resetTime - now) / 1000);
            res.set('Retry-After', retryAfter);
            
            // إذا كان طلب API يرجع JSON
            if (req.path.startsWith('/api/')) {
                return res.status(429).json({ 
                    error: message,
                    retryAfter: retryAfter 
                });
            }
            
            return res.status(429).render('error', {
                title: 'كثرة الطلبات',
                message: message,
                code: 429
            });
        }

        next();
    };
}

// ===== Rate Limiters الجاهزة =====

// حماية صفحة تسجيل الدخول من brute force
const loginLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,   // 15 دقيقة
    max: 7,                      // 7 محاولات فقط
    message: 'محاولات دخول كثيرة! يرجى الانتظار 15 دقيقة ثم المحاولة مرة أخرى.'
});

// حماية التسجيل
const registerLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000,   // ساعة
    max: 5,                      // 5 محاولات
    message: 'تم تجاوز الحد الأقصى للتسجيل. يرجى المحاولة بعد ساعة.'
});

// حماية OTP
const otpLimiter = createRateLimiter({
    windowMs: 10 * 60 * 1000,   // 10 دقائق
    max: 5,                      // 5 محاولات
    message: 'محاولات كثيرة لإدخال رمز التحقق. يرجى الانتظار 10 دقائق.'
});

// حماية API من الإرسال المفرط
const apiSendLimiter = createRateLimiter({
    windowMs: 60 * 1000,        // دقيقة واحدة
    max: 30,                     // 30 طلب بالدقيقة
    message: 'تم تجاوز الحد الأقصى لعدد الرسائل في الدقيقة. يرجى الانتظار.',
    keyGenerator: 'session'
});

// حماية عامة
const generalLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000,
    max: 200,
    message: 'عدد كبير من الطلبات. يرجى المحاولة لاحقاً.'
});

module.exports = {
    createRateLimiter,
    loginLimiter,
    registerLimiter,
    otpLimiter,
    apiSendLimiter,
    generalLimiter
};
