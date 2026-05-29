const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MessageLog = require('../models/MessageLog');
const { requireAdmin } = require('../middleware/auth');
const { getSettings, invalidateCache } = require('../utils/settingsCache');
const { calculateSubscriptionDate } = require('../utils/helpers');
const { startWhatsAppSession, disconnectSession, requestPairingCode } = require('../whatsappManager');

const SYSTEM_ID = process.env.SYSTEM_ID || '111111111111111111111111';

// ===== لوحة الأدمن الرئيسية =====
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
        const totalSystemMessages = await MessageLog.countDocuments();
        const settings = await getSettings();

        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyStats = await MessageLog.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        const topUsers = await MessageLog.aggregate([
            { $group: { _id: "$userId", count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
        ]);
        for (let t of topUsers) {
            const u = await User.findById(t._id);
            t.username = u ? u.username : 'عميل محذوف';
        }

        res.render('admin', { users, totalSystemMessages, dailyStats, topUsers, settings });
    } catch (e) {
        console.error('خطأ في لوحة الأدمن:', e);
        res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ في تحميل لوحة الإدارة', code: 500 });
    }
});

// ===== إضافة عميل =====
router.post('/admin/add-user', requireAdmin, async (req, res) => {
    try {
        const { username, password, phone } = req.body;
        const apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const settings = await getSettings();
        const subDate = calculateSubscriptionDate(settings.freeTrialDays);
        await User.create({ username, phone, password, apiToken, subscriptionEndsAt: subDate, isVerified: true });
        res.redirect('/admin');
    } catch (e) { res.status(400).send('خطأ: المستخدم أو الجوال موجود.'); }
});

// ===== تعديل عميل =====
router.post('/admin/edit-user/:id', requireAdmin, async (req, res) => {
    try {
        const { password, addDays } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        
        if (password) user.password = password;
        if (addDays && parseInt(addDays) > 0) {
            let currentEnd = (user.subscriptionEndsAt && user.subscriptionEndsAt > new Date()) ? user.subscriptionEndsAt : new Date();
            currentEnd.setDate(currentEnd.getDate() + parseInt(addDays));
            user.subscriptionEndsAt = currentEnd;
        }
        await user.save(); res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});

// ===== تعطيل / تفعيل عميل =====
router.post('/admin/toggle-user/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        user.isActive = !user.isActive;
        await user.save();
        res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});

// ===== الدخول كعميل =====
router.get('/admin/login-as/:id', requireAdmin, async (req, res) => {
    req.session.originalAdminId = req.session.userId;
    req.session.userId = req.params.id;
    res.redirect('/dashboard');
});

// ===== حفظ الإعدادات =====
router.post('/admin/settings', requireAdmin, async (req, res) => {
    try {
        const { supportPhone, freeTrialDays } = req.body;
        let settings = await getSettings();
        settings.supportPhone = supportPhone;
        settings.freeTrialDays = freeTrialDays;
        await settings.save();
        invalidateCache(); // مسح الكاش بعد التحديث
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('حدث خطأ في حفظ الإعدادات');
    }
});

// ===== تغيير كلمة مرور الأدمن =====
router.post('/admin/change-password', requireAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).send('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
        }
        const admin = await User.findById(req.session.userId);
        admin.password = newPassword;
        await admin.save();
        res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});

// ===== فصل واتساب الإدارة =====
router.post('/admin/disconnect-system-whatsapp', requireAdmin, async (req, res) => {
    try {
        await disconnectSession(SYSTEM_ID);
        startWhatsAppSession(SYSTEM_ID, req.app.get('io'));
        res.redirect('back');
    } catch (e) {
        console.error('خطأ في فصل واتساب الإدارة:', e);
        res.redirect('back');
    }
});

router.post('/admin/request-pairing-code', requireAdmin, async (req, res) => {
    try {
        var phoneNumber = req.body.phoneNumber;
        if (!phoneNumber) return res.json({ success: false, error: 'أدخل رقم الهاتف' });
        var io = req.app.get('io');
        var code = await requestPairingCode(SYSTEM_ID, phoneNumber, io);
        res.json({ success: true, code: code });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

module.exports = router;
