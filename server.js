require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const User = require('./models/User');
const MessageLog = require('./models/MessageLog');
const Settings = require('./models/Settings');
const { startWhatsAppSession, getSession, disconnectSession, requestPairingCode } = require('./whatsappManager');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, { maxHttpBufferSize: 50 * 1024 * 1024 });
app.use(cors());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const SYSTEM_ID = '111111111111111111111111';

async function getSettings() {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});
    return settings;
}

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ متصل بقاعدة بيانات MongoDB');
        try {
            await getSettings();
            
            let sysSock = getSession(SYSTEM_ID);
            if (!sysSock) startWhatsAppSession(SYSTEM_ID, io);
            
            const users = await User.find({ role: 'user', isActive: true });
            for (const user of users) {
                let uSock = getSession(user._id.toString());
                if (!uSock) startWhatsAppSession(user._id.toString(), io);
            }
        } catch (e) { console.error('خطأ:', e); }
    }).catch(err => console.error('❌ خطأ في الاتصال:', err));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'wats_secret_123',
    resave: false, saveUninitialized: false
}));

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') return next();
    res.status(403).send('غير مصرح لك بالدخول');
};

async function sendSystemOTP(phone, message) {
    console.log('📤 محاولة إرسال OTP إلى:', phone);
    let sock = getSession(SYSTEM_ID);
    if (!sock || !sock.user) {
        console.log('❌ رقم الإدارة غير متصل! sessions:', Object.keys(sessions));
        throw new Error('رقم الإدارة غير متصل! تواصل مع الدعم الفني.');
    }
    const jid = `${phone}@s.whatsapp.net`;
    const wpCheck = await sock.onWhatsApp(jid);
    if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم الذي أدخلته غير موجود في الواتساب.');
    await sock.sendMessage(jid, { text: message });
    console.log('✅ تم إرسال OTP بنجاح إلى:', phone);
}

async function createDefaultAdmin() {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) await User.create({ username: 'admin', password: 'password', role: 'admin' });
}
createDefaultAdmin();

async function sendWhatsAppMessage(sock, jid, body, mediaArray) {
    if (mediaArray && mediaArray.length > 0) {
        for (let i = 0; i < mediaArray.length; i++) {
            const m = mediaArray[i];
            // دعم buffer مباشرة أو base64
            let buffer;
            if (m.buffer) {
                buffer = m.buffer;
            } else if (m.data) {
                const base64Data = m.data.includes(',') ? m.data.split(',')[1] : m.data;
                buffer = Buffer.from(base64Data, 'base64');
            }
            let content = {};
            if (m.mimetype.startsWith('image/')) content = { image: buffer };
            else if (m.mimetype.startsWith('video/')) content = { video: buffer };
            else if (m.mimetype.startsWith('audio/')) content = { audio: buffer, mimetype: 'audio/mp4' };
            else content = { document: buffer, mimetype: m.mimetype, fileName: m.filename || 'file' };
            if (i === 0 && body && !m.mimetype.startsWith('audio/')) content.caption = body;
            try {
                await sock.sendMessage(jid, content);
            } catch (sendErr) {
                console.error('❌ خطأ إرسال ملف:', sendErr.message);
                throw sendErr;
            }
            await new Promise(r => setTimeout(r, 2000));
        }
        if (mediaArray[0].mimetype.startsWith('audio/') && body) await sock.sendMessage(jid, { text: body });
    } else if (body) {
        await sock.sendMessage(jid, { text: body });
    }
}

app.get('/', async (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('landing', { loggedIn });
});

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');
        let user = await User.findOne({ $or: [{ username }, { phone: cleanPhone }] });
        if (user) return res.render('register', { error: 'اسم المستخدم أو رقم الجوال مستخدم مسبقاً.' });

        const settings = await getSettings();
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date(); otpExp.setMinutes(otpExp.getMinutes() + 10);
        const subDate = new Date(); subDate.setDate(subDate.getDate() + settings.freeTrialDays);

        user = await User.create({
            username, phone: cleanPhone, password,
            apiToken: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2),
            subscriptionEndsAt: subDate, isVerified: false, otpCode: otp, otpExpires: otpExp
        });

        req.session.verifyUserId = user._id;

        // محاولة إرسال OTP - إذا فشل ننقله لصفحة التوثيق مع زر إعادة الإرسال
        try {
            await sendSystemOTP(cleanPhone, `أهلاً بك في منصتنا 🚀\nرمز التفعيل الخاص بك هو: *${otp}*\n(صالح لمدة 10 دقائق)`);
            res.redirect('/verify');
        } catch (otpErr) {
            console.error('⚠️ فشل إرسال OTP لكن الحساب تم إنشاؤه:', otpErr.message);
            res.render('verify', { error: 'تم إنشاء حسابك لكن فشل إرسال الرمز. اضغط إعادة الإرسال.', success: null });
        }
    } catch (e) {
        console.error('❌ خطأ في التسجيل:', e.message);
        res.render('register', { error: e.message });
    }
});

app.get('/verify', (req, res) => {
    if (!req.session.verifyUserId) return res.redirect('/register');
    res.render('verify', { error: null, success: null });
});
app.post('/verify', async (req, res) => {
    try {
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');
        if (user.otpCode !== req.body.otp || new Date() > user.otpExpires) return res.render('verify', { error: 'الرمز غير صحيح أو منتهي الصلاحية', success: null });

        user.isVerified = true; user.otpCode = null; user.otpExpires = null;
        await user.save();
        req.session.userId = user._id;
        req.session.verifyUserId = null;
        res.redirect('/dashboard');
    } catch (e) { res.render('verify', { error: 'حدث خطأ', success: null }); }
});


app.post('/resend-otp', async (req, res) => {
    try {
        if (!req.session.verifyUserId) return res.redirect('/register');
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date(); otpExp.setMinutes(otpExp.getMinutes() + 10);
        user.otpCode = otp; user.otpExpires = otpExp;
        await user.save();

        await sendSystemOTP(user.phone, `رمز التفعيل الجديد: *${otp}*\n(صالح لمدة 10 دقائق)`);
        res.render('verify', { error: null, success: 'تم إعادة إرسال الرمز بنجاح ✅' });
    } catch (e) {
        console.error('❌ خطأ إعادة إرسال OTP:', e.message);
        res.render('verify', { error: 'فشل إعادة الإرسال: ' + e.message, success: null });
    }
});

app.get('/forgot-password', (req, res) => res.render('forgot-password', { error: null }));
app.post('/forgot-password', async (req, res) => {
    try {
        const cleanPhone = req.body.phone.replace(/\D/g, '');
        const user = await User.findOne({ phone: cleanPhone });
        if (!user) return res.render('forgot-password', { error: 'رقم الجوال غير مسجل لدينا' });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date(); otpExp.setMinutes(otpExp.getMinutes() + 10);
        user.otpCode = otp; user.otpExpires = otpExp; await user.save();

        await sendSystemOTP(cleanPhone, `مرحباً 👋\nرمز التحقق لاستعادة المرور هو: *${otp}*`);
        req.session.resetUserId = user._id;
        res.redirect('/reset-password');
    } catch (e) { res.render('forgot-password', { error: e.message }); }
});

app.get('/reset-password', (req, res) => {
    if (!req.session.resetUserId) return res.redirect('/forgot-password');
    res.render('reset-password', { error: null });
});
app.post('/reset-password', async (req, res) => {
    try {
        const { otp, newPassword } = req.body;
        const user = await User.findById(req.session.resetUserId);
        if (user.otpCode !== otp || new Date() > user.otpExpires) return res.render('reset-password', { error: 'الرمز غير صحيح أو منتهي' });

        user.password = newPassword; user.otpCode = null; user.otpExpires = null; await user.save();
        req.session.resetUserId = null; res.redirect('/login');
    } catch (e) { res.render('reset-password', { error: 'حدث خطأ' }); }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && user.isActive && await user.comparePassword(password)) {
        if (!user.isVerified) { req.session.verifyUserId = user._id; return res.redirect('/verify'); }
        req.session.userId = user._id;
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'بيانات غير صحيحة.' });
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });
app.get('/return-to-admin', (req, res) => {
    if(req.session.originalAdminId) { req.session.userId = req.session.originalAdminId; req.session.originalAdminId = null; res.redirect('/admin'); }
    else res.redirect('/dashboard');
});
app.post('/refresh-token', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    await user.save(); res.redirect('/api-guide');
});

app.post('/disconnect-whatsapp', requireAuth, async (req, res) => {
    let targetId = req.session.userId;
    if (req.session.originalAdminId) targetId = req.session.userId;
    await disconnectSession(targetId.toString());
    startWhatsAppSession(targetId.toString(), io);
    res.redirect('back');
});

app.post('/request-pairing-code', requireAuth, async (req, res) => {
    try {
        const code = await requestPairingCode(req.session.userId.toString(), req.body.phoneNumber, io);
        res.json({ success: true, code });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});
app.post('/admin/disconnect-system-whatsapp', requireAdmin, async (req, res) => {
    await disconnectSession(SYSTEM_ID);
    startWhatsAppSession(SYSTEM_ID, io);
    res.redirect('back');
});


app.post('/admin/request-pairing-code', requireAdmin, async (req, res) => {
    try {
        const code = await requestPairingCode(SYSTEM_ID, req.body.phoneNumber, io);
        res.json({ success: true, code });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});
app.get('/dashboard', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
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
});

app.get('/api-guide', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('api-guide', { user, host: req.protocol + '://' + req.get('host') });
});

app.get('/admin', requireAdmin, async (req, res) => {
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
});

app.post('/admin/add-user', requireAdmin, async (req, res) => {
    try {
        const { username, password, phone } = req.body;
        const apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const settings = await getSettings();
        const subDate = new Date(); subDate.setDate(subDate.getDate() + settings.freeTrialDays);
        await User.create({ username, phone, password, apiToken, subscriptionEndsAt: subDate, isVerified: true });
        res.redirect('/admin');
    } catch (e) { res.status(400).send('خطأ: المستخدم أو الجوال موجود.'); }
});

app.post('/admin/edit-user/:id', requireAdmin, async (req, res) => {
    try {
        const { password, addDays } = req.body;
        const user = await User.findById(req.params.id);
        if (password) user.password = password;
        if (addDays && parseInt(addDays) > 0) {
            let currentEnd = (user.subscriptionEndsAt && user.subscriptionEndsAt > new Date()) ? user.subscriptionEndsAt : new Date();
            currentEnd.setDate(currentEnd.getDate() + parseInt(addDays));
            user.subscriptionEndsAt = currentEnd;
        }
        await user.save(); res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});

app.get('/admin/login-as/:id', requireAdmin, async (req, res) => {
    req.session.originalAdminId = req.session.userId; req.session.userId = req.params.id; res.redirect('/dashboard');
});
app.post('/admin/toggle-user/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        user.isActive = !user.isActive;
        await user.save();
        res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});

app.post('/admin/delete-user/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        if (user.role === 'admin') return res.status(403).send('لا يمكن حذف الأدمن');
        await MessageLog.deleteMany({ userId: user._id });
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (e) { res.status(400).send('حدث خطأ'); }
});


app.post('/admin/settings', requireAdmin, async (req, res) => {
    const { supportPhone, freeTrialDays } = req.body;
    let settings = await getSettings();
    settings.supportPhone = supportPhone;
    settings.freeTrialDays = freeTrialDays;
    await settings.save();
    res.redirect('/admin');
});

app.post('/admin/change-password', requireAdmin, async (req, res) => {
    const { newPassword } = req.body;
    const admin = await User.findById(req.session.userId);
    admin.password = newPassword;
    await admin.save();
    res.redirect('/admin');
});

app.get('/admin/logs/:id', requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    let query = { userId: user._id };
    if (req.query.dateFrom && req.query.dateTo) {
        let endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: new Date(req.query.dateFrom), $lte: endDate };
    }
    const logs = await MessageLog.find(query).sort({ createdAt: -1 }).limit(200);
    res.render('logs', { user, logs, isAdminView: true, query: req.query });
});

app.get('/logs', requireAuth, async (req, res) => {
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
});

app.post('/logs/delete', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    let targetId = user._id;
    if (user.role === 'admin' && req.body.targetUserId) targetId = req.body.targetUserId;
    await MessageLog.deleteMany({ userId: targetId });
    res.redirect('back');
});

app.post(['/api/v1/send', '/api/send-message'], upload.array('media', 10), async (req, res) => {
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

    let sock = getSession(user._id.toString());
    if (!sock) {
        startWhatsAppSession(user._id.toString(), io);
        return res.status(503).json({ error: 'الواتساب غير متصل. افتح لوحة التحكم لربط الرقم.' });
    }
    if (!sock.user) return res.status(503).json({ error: 'WhatsApp is reconnecting. Try again.' });

    const to = req.body.to;
    const body = req.body.message || req.body.body;
    if (!to || (!body && (!req.files || req.files.length === 0) && (!req.body.media || req.body.media.length === 0))) return res.status(400).json({ error: 'Missing Data' });

    // معالجة to - قد يكون JSON string من FormData
    let parsedTo = to;
    try { if (typeof to === 'string' && to.startsWith('[')) parsedTo = JSON.parse(to); } catch(e) {}
    const numbers = Array.isArray(parsedTo) ? parsedTo : [parsedTo];

    let mediaArray = [];
    if (req.files && req.files.length > 0) {
        // ملفات مرفوعة عبر FormData - نحفظ buffer مباشرة
        for (const f of req.files) {
            // فك ترميز اسم الملف (يأتي مشوّه من multer أحياناً)
            let fname = f.originalname || 'file';
            try { fname = Buffer.from(fname, 'latin1').toString('utf8'); } catch(e) {}
            mediaArray.push({ mimetype: f.mimetype, filename: fname, buffer: f.buffer });
        }
    } else if (req.body.media && Array.isArray(req.body.media)) {
        // ملفات مرسلة كـ base64 في JSON (API خارجي)
        mediaArray = req.body.media;
    }

    res.json({ success: true, message: "تم استلام طلب الإرسال وسيتم المعالجة فوراً." });

    // تشغيل الإرسال في الخلفية
    (async () => {
        for (let num of numbers) {
            try {
                // إعادة جلب الجلسة قبل كل رسالة (قد تتغير)
                let currentSock = getSession(user._id.toString());
                if (!currentSock || !currentSock.user) {
                    throw new Error('الواتساب غير متصل');
                }

                const jid = `${num}@s.whatsapp.net`;
                const wpCheck = await currentSock.onWhatsApp(jid);
                if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم غير مسجل بالواتساب');
                
                // محاولة الإرسال مع retry
                let sent = false;
                for (let attempt = 1; attempt <= 2; attempt++) {
                    try {
                        await sendWhatsAppMessage(currentSock, jid, body, mediaArray);
                        sent = true;
                        break;
                    } catch (retryErr) {
                        console.error('⚠️ محاولة ' + attempt + ' فشلت لـ ' + num + ': ' + retryErr.message);
                        if (attempt < 2) {
                            // انتظار وإعادة جلب الجلسة
                            await new Promise(r => setTimeout(r, 3000));
                            currentSock = getSession(user._id.toString());
                            if (!currentSock || !currentSock.user) throw new Error('الواتساب انقطع أثناء الإرسال');
                        } else {
                            throw retryErr;
                        }
                    }
                }
                
                if (sent) {
                    if (io) io.to(user._id.toString()).emit('message-sent', { to: num, body: body || '(مرفق)' });
                    await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'success' });
                }
            } catch (e) {
                if (io) io.to(user._id.toString()).emit('error', `خطأ مع ${num}: ${e.message}`);
                await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'failed', errorDetails: e.message });
            }
            // فاصل زمني 3 ثواني بين كل رسالة (أكثر للملفات)
            await new Promise(r => setTimeout(r, mediaArray.length > 0 ? 4000 : 2000));
        }
    })();
});

app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => {
    const sessionUserId = socket.handshake.query.userId;
    if (sessionUserId) {
        socket.join(sessionUserId);
        
        const sock = getSession(sessionUserId);
        if (sock && sock.user) {
            socket.emit('ready', 'WhatsApp is connected');
        } else if (!sock) {
            startWhatsAppSession(sessionUserId, io).then(s => { 
                if (s && s.user) socket.emit('ready', 'WhatsApp is connected'); 
            });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
