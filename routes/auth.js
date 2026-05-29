const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter, registerLimiter, otpLimiter } = require('../middleware/rateLimiter');
const { getSettings } = require('../utils/settingsCache');
const { cleanPhone, generateOTP, getOTPExpiry, calculateSubscriptionDate } = require('../utils/helpers');
const { getSession } = require('../whatsappManager');

const SYSTEM_ID = process.env.SYSTEM_ID || '111111111111111111111111';

// ===== دالة إرسال OTP عبر رقم الإدارة =====
async function sendSystemOTP(phone, message) {
    let sock = getSession(SYSTEM_ID);
    if (!sock || !sock.user) throw new Error('رقم الإدارة غير متصل! تواصل مع الدعم الفني.');
    const jid = `${phone}@s.whatsapp.net`;
    const wpCheck = await sock.onWhatsApp(jid);
    if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم الذي أدخلته غير موجود في الواتساب.');
    await sock.sendMessage(jid, { text: message });
}

// ===== الصفحة الرئيسية =====
router.get('/', async (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('landing', { loggedIn });
});

// ===== التسجيل =====
router.get('/register', (req, res) => res.render('register', { error: null }));

router.post('/register', registerLimiter, async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        
        // التحقق من قوة كلمة المرور
        if (!password || password.length < 6) {
            return res.render('register', { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
        }
        
        const cleaned = cleanPhone(phone);
        let user = await User.findOne({ $or: [{ username }, { phone: cleaned }] });
        if (user) return res.render('register', { error: 'اسم المستخدم أو رقم الجوال مستخدم مسبقاً.' });

        const settings = await getSettings();
        const otp = generateOTP();
        const otpExp = getOTPExpiry();
        const subDate = calculateSubscriptionDate(settings.freeTrialDays);

        user = await User.create({
            username, phone: cleaned, password,
            apiToken: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2),
            subscriptionEndsAt: subDate, isVerified: false, otpCode: otp, otpExpires: otpExp
        });

        await sendSystemOTP(cleaned, `أهلاً بك في منصتنا 🚀\nرمز التفعيل الخاص بك هو: *${otp}*\n(صالح لمدة 10 دقائق)`);
        req.session.verifyUserId = user._id;
        res.redirect('/verify');
    } catch (e) { res.render('register', { error: e.message }); }
});

// ===== التحقق من OTP =====
router.get('/verify', (req, res) => {
    if (!req.session.verifyUserId) return res.redirect('/register');
    res.render('verify', { error: null });
});

router.post('/verify', otpLimiter, async (req, res) => {
    try {
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');
        if (user.otpCode !== req.body.otp || new Date() > user.otpExpires) {
            return res.render('verify', { error: 'الرمز غير صحيح أو منتهي الصلاحية' });
        }

        user.isVerified = true; user.otpCode = null; user.otpExpires = null;
        await user.save();
        req.session.userId = user._id;
        req.session.verifyUserId = null;
        res.redirect('/dashboard');
    } catch (e) { res.render('verify', { error: 'حدث خطأ' }); }
});

// ===== نسيت كلمة المرور =====
router.get('/forgot-password', (req, res) => res.render('forgot-password', { error: null }));

router.post('/forgot-password', otpLimiter, async (req, res) => {
    try {
        const cleaned = cleanPhone(req.body.phone);
        const user = await User.findOne({ phone: cleaned });
        if (!user) return res.render('forgot-password', { error: 'رقم الجوال غير مسجل لدينا' });

        const otp = generateOTP();
        const otpExp = getOTPExpiry();
        user.otpCode = otp; user.otpExpires = otpExp; await user.save();

        await sendSystemOTP(cleaned, `مرحباً 👋\nرمز التحقق لاستعادة المرور هو: *${otp}*`);
        req.session.resetUserId = user._id;
        res.redirect('/reset-password');
    } catch (e) { res.render('forgot-password', { error: e.message }); }
});

// ===== إعادة تعيين كلمة المرور =====
router.get('/reset-password', (req, res) => {
    if (!req.session.resetUserId) return res.redirect('/forgot-password');
    res.render('reset-password', { error: null });
});

router.post('/reset-password', otpLimiter, async (req, res) => {
    try {
        const { otp, newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.render('reset-password', { error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.' });
        }
        const user = await User.findById(req.session.resetUserId);
        if (user.otpCode !== otp || new Date() > user.otpExpires) {
            return res.render('reset-password', { error: 'الرمز غير صحيح أو منتهي' });
        }

        user.password = newPassword; user.otpCode = null; user.otpExpires = null; await user.save();
        req.session.resetUserId = null; res.redirect('/login');
    } catch (e) { res.render('reset-password', { error: 'حدث خطأ' }); }
});

// ===== تسجيل الدخول =====
router.get('/login', (req, res) => res.render('login', { error: null }));

router.post('/login', loginLimiter, async (req, res) => {
    try {
        const { username, password } = req.body;
        const user = await User.findOne({ username });
        if (user && user.isActive && await user.comparePassword(password)) {
            // تحديث وقت آخر تسجيل دخول
            user.lastLoginAt = new Date();
            await user.save();

            if (!user.isVerified) { req.session.verifyUserId = user._id; return res.redirect('/verify'); }
            req.session.userId = user._id;
            return res.redirect('/dashboard');
        }
        res.render('login', { error: 'بيانات غير صحيحة.' });
    } catch (e) {
        res.render('login', { error: 'حدث خطأ في تسجيل الدخول' });
    }
});

// ===== تسجيل الخروج =====
router.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ===== العودة لحساب الأدمن =====
router.get('/return-to-admin', (req, res) => {
    if (req.session.originalAdminId) {
        req.session.userId = req.session.originalAdminId;
        req.session.originalAdminId = null;
        res.redirect('/admin');
    } else {
        res.redirect('/dashboard');
    }
});

// ===== تحديث التوكن =====
router.post('/refresh-token', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    await user.save(); res.redirect('/api-guide');
});

module.exports = router;
module.exports.sendSystemOTP = sendSystemOTP;
