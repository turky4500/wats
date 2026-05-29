const express = require('express');
const router = express.Router();
const User = require('../models/User');
const MessageLog = require('../models/MessageLog');
const { requireAuth } = require('../middleware/auth');
const { getSettings } = require('../utils/settingsCache');
const { startWhatsAppSession, getSession, disconnectSession } = require('../whatsappManager');

router.get('/dashboard', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) { req.session.destroy(); return res.redirect('/login'); }
        if (user.role === 'admin') return res.redirect('/admin');
        const isImpersonating = !!req.session.originalAdminId;
        const settings = await getSettings();
        const totalMessages = await MessageLog.countDocuments({ userId: user._id });
        const successMessages = await MessageLog.countDocuments({ userId: user._id, status: 'success' });
        const failedMessages = totalMessages - successMessages;
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const dailyStats = await MessageLog.aggregate([
            { $match: { userId: user._id, createdAt: { $gte: sevenDaysAgo } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        res.render('dashboard', { user, isImpersonating, totalMessages, successMessages, failedMessages, dailyStats, settings });
    } catch (e) {
        console.error('خطأ:', e);
        res.status(500).render('error', { title: 'خطأ', message: 'حدث خطأ', code: 500 });
    }
});

router.get('/api-guide', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('api-guide', { user, host: req.protocol + '://' + req.get('host') });
});

router.post('/disconnect-whatsapp', requireAuth, async (req, res) => {
    try {
        let targetId = req.session.userId;
        await disconnectSession(targetId.toString());
        startWhatsAppSession(targetId.toString(), req.app.get('io'));
        res.redirect('back');
    } catch (e) { res.redirect('back'); }
});

module.exports = router;
