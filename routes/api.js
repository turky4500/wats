const express = require('express');
const router = express.Router();
const multer = require('multer');
const User = require('../models/User');
const MessageLog = require('../models/MessageLog');
const { getSettings } = require('../utils/settingsCache');
const { sendWhatsAppMessage } = require('../utils/helpers');
const { apiSendLimiter } = require('../middleware/rateLimiter');
const { startWhatsAppSession, getSession } = require('../whatsappManager');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// ===== نقاط API للإرسال (بدون تغيير على التوكن) =====
router.post(['/api/v1/send', '/api/send-message'], upload.single('media'), apiSendLimiter, async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    const user = await User.findOne({ apiToken: token, isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const settings = await getSettings();
    if (user.role !== 'admin') {
        if (!user.subscriptionEndsAt || new Date(user.subscriptionEndsAt) < new Date()) {
            return res.status(403).json({ success: false, error: `اشتراكك منتهي، تواصل مع الدعم الفني ${settings.supportPhone}` });
        }
    }

    const io = req.app.get('io');
    let sock = getSession(user._id.toString());
    if (!sock) {
        startWhatsAppSession(user._id.toString(), io);
        return res.status(503).json({ error: 'الواتساب غير متصل. افتح لوحة التحكم لربط الرقم.' });
    }
    if (!sock.user) return res.status(503).json({ error: 'WhatsApp is reconnecting. Try again.' });

    const to = req.body.to;
    const body = req.body.message || req.body.body;
    const numbers = Array.isArray(to) ? to : [to];
    if (!to || (!body && !req.file && (!req.body.media || req.body.media.length === 0))) return res.status(400).json({ error: 'Missing Data' });

    let mediaArray = [];
    if (req.file) {
        mediaArray.push({ mimetype: req.file.mimetype, filename: req.file.originalname || 'file', data: req.file.buffer.toString('base64') });
    } else if (req.body.media && Array.isArray(req.body.media)) {
        mediaArray = req.body.media;
    }

    res.json({ success: true, message: "تم استلام طلب الإرسال وسيتم المعالجة فوراً." });

    // تشغيل الإرسال في الخلفية
    (async () => {
        for (let num of numbers) {
            try {
                const jid = `${num}@s.whatsapp.net`;
                const wpCheck = await sock.onWhatsApp(jid);
                if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم غير مسجل بالواتساب');

                await sendWhatsAppMessage(sock, jid, body, mediaArray);

                if (io) io.to(user._id.toString()).emit('message-sent', { to: num, body: body || '(مرفق)' });
                await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'success' });
            } catch (e) {
                if (io) io.to(user._id.toString()).emit('error', `خطأ مع ${num}: ${e.message}`);
                await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'failed', errorDetails: e.message });
            }
            await new Promise(r => setTimeout(r, 2000));
        }
    })();
});

// ===== نقطة فحص =====
router.get('/ping', (req, res) => res.send('pong'));

module.exports = router;
