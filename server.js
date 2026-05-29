require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');

// ===== الإعدادات =====
const app = express();
const server = http.createServer(app);
const io = socketIo(server, { maxHttpBufferSize: 50 * 1024 * 1024 });

// حفظ io في التطبيق لاستخدامه في الـ routes
app.set('io', io);

const SYSTEM_ID = process.env.SYSTEM_ID || '111111111111111111111111';

// ===== CORS محدد =====
const corsOrigins = process.env.CORS_ORIGINS;
app.use(cors(corsOrigins ? {
    origin: corsOrigins.split(',').map(s => s.trim()),
    credentials: true
} : {}));

// ===== View Engine =====
app.set('view engine', 'ejs');
app.use(express.static('public'));

// ===== Body Parsers =====
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ===== الجلسات =====
app.use(session({
    secret: process.env.SESSION_SECRET || (() => {
        console.warn('⚠️ تحذير: SESSION_SECRET غير معيّن! استخدم متغير بيئة.');
        return 'temp_secret_' + Math.random().toString(36);
    })(),
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // يوم واحد
    }
}));

// ===== تحميل الـ Routes =====
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const logsRoutes = require('./routes/logs');
const apiRoutes = require('./routes/api');

app.use(authRoutes);
app.use(dashboardRoutes);
app.use(adminRoutes);
app.use(logsRoutes);
app.use(apiRoutes);

// ===== معالجة الأخطاء =====
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
app.use(notFoundHandler);
app.use(errorHandler);

// ===== الاتصال بقاعدة البيانات =====
const User = require('./models/User');
const { getSettings } = require('./utils/settingsCache');
const { startWhatsAppSession, getSession } = require('./whatsappManager');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('✅ متصل بقاعدة بيانات MongoDB');
        try {
            await getSettings();

            // إنشاء حساب أدمن افتراضي إذا لم يكن موجوداً
            const admin = await User.findOne({ username: 'admin' });
            if (!admin) {
                const defaultPass = process.env.ADMIN_DEFAULT_PASSWORD || 'ChangeMe@2026!';
                await User.create({ username: 'admin', password: defaultPass, role: 'admin' });
                console.log('✅ تم إنشاء حساب الأدمن الافتراضي (غيّر كلمة المرور فوراً!)');
            }

            // بدء جلسة رقم الإدارة
            let sysSock = getSession(SYSTEM_ID);
            if (!sysSock) startWhatsAppSession(SYSTEM_ID, io);

            // تحميل الجلسات النشطة فقط (Lazy Loading محسّن)
            const users = await User.find({ role: 'user', isActive: true });
            console.log(`📊 عدد المستخدمين النشطين: ${users.length}`);
            
            // تحميل الجلسات بشكل متدرج مع تأخير بين كل جلسة
            const MAX_STARTUP_SESSIONS = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 50;
            const usersToLoad = users.slice(0, MAX_STARTUP_SESSIONS);
            
            for (let i = 0; i < usersToLoad.length; i++) {
                const user = usersToLoad[i];
                let uSock = getSession(user._id.toString());
                if (!uSock) {
                    startWhatsAppSession(user._id.toString(), io);
                    // تأخير 2 ثانية بين كل جلسة لتخفيف الضغط
                    if (i < usersToLoad.length - 1) {
                        await new Promise(r => setTimeout(r, 2000));
                    }
                }
            }
            
            if (users.length > MAX_STARTUP_SESSIONS) {
                console.log(`⚠️ تم تحميل ${MAX_STARTUP_SESSIONS} جلسة فقط من ${users.length} (الباقي يتحمل عند الطلب)`);
            }
        } catch (e) { console.error('خطأ:', e); }
    }).catch(err => console.error('❌ خطأ في الاتصال:', err));

// ===== Socket.IO =====
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

// ===== معالجة الأخطاء غير الملتقطة =====
process.on('uncaughtException', (err) => {
    console.error('❌ خطأ غير ملتقط:', err.message);
});
process.on('unhandledRejection', (reason) => {
    console.error('❌ وعد مرفوض:', reason);
});

// ===== بدء الخادم =====
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
