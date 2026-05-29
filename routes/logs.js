const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MessageLog = require('../models/MessageLog');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ===== سجلات الأدمن لعميل محدد =====
router.get('/admin/logs/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).render('error', { title: 'غير موجود', message: 'المستخدم غير موجود', code: 404 });
        
        let query = { userId: user._id };
        if (req.query.dateFrom && req.query.dateTo) {
            let endDate = new Date(req.query.dateTo);
            endDate.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: new Date(req.query.dateFrom), $lte: endDate };
        }
        const logs = await MessageLog.find(query).sort({ createdAt: -1 }).limit(200);
        res.render('logs', { user, logs, isAdminView: true, query: req.query });
    } catch (e) {
        console.error('خطأ في سجلات الأدمن:', e);
        res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ في تحميل السجلات', code: 500 });
    }
});

// ===== سجلات المستخدم =====
router.get('/logs', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.role === 'admin') return res.redirect('/admin');
        
        let query = { userId: user._id };
        if (req.query.dateFrom && req.query.dateTo) {
            let endDate = new Date(req.query.dateTo);
            endDate.setHours(23, 59, 59, 999);
            query.createdAt = { $gte: new Date(req.query.dateFrom), $lte: endDate };
        }
        const logs = await MessageLog.find(query).sort({ createdAt: -1 }).limit(100);
        res.render('logs', { user, logs, isAdminView: false, query: req.query });
    } catch (e) {
        console.error('خطأ في سجلات المستخدم:', e);
        res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ في تحميل السجلات', code: 500 });
    }
});

// ===== حذف السجلات =====
router.post('/logs/delete', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        let targetId = user._id;
        if (user.role === 'admin' && req.body.targetUserId) targetId = req.body.targetUserId;
        await MessageLog.deleteMany({ userId: targetId });
        res.redirect('back');
    } catch (e) {
        console.error('خطأ في حذف السجلات:', e);
        res.redirect('back');
    }
});

module.exports = router;
