require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const User = require('./models/User');
const MessageLog = require('./models/MessageLog');
const { startWhatsAppSession, getSession } = require('./whatsappManager');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ متصل بقاعدة بيانات MongoDB'))
    .catch(err => console.error('❌ خطأ في الاتصال:', err));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'wats_secret_123',
    resave: false,
    saveUninitialized: false
}));

async function createDefaultAdmin() {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) {
        await User.create({ username: 'admin', password: 'password', role: 'admin' });
        console.log('✅ تم إنشاء حساب الأدمن الافتراضي');
    }
}
createDefaultAdmin();

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

app.get('/', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    // توجيه الأدمن مباشرة للوحة التحكم الخاصة به
    if (user.role === 'admin') return res.redirect('/admin');
    
    const host = req.protocol + '://' + req.get('host');
    res.render('dashboard', { user, host });
});

app.get('/login', (req, res) => res.render('login', { error: null }));

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && user.isActive && await user.comparePassword(password)) {
        req.session.userId = user._id;
        return res.redirect('/');
    }
    res.render('login', { error: 'بيانات غير صحيحة.' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.post('/refresh-token', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    await user.save();
    res.redirect('/');
});

app.get('/admin', requireAdmin, async (req, res) => {
    const users = await User.find();
    res.render('admin', { users });
});

app.post('/admin/add-user', requireAdmin, async (req, res) => {
    try {
        const { username, password } = req.body;
        const apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        await User.create({ username, password, apiToken });
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('خطأ: المستخدم موجود.');
    }
});

// صفحة سجل الرسائل (الأرشيف)
app.get('/logs', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');
    const logs = await MessageLog.find({ userId: user._id }).sort({ createdAt: -1 }).limit(100);
    res.render('logs', { user, logs });
});

app.post('/api/send-message', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    
    const token = authHeader.split(' ')[1];
    const user = await User.findOne({ apiToken: token, isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const sock = getSession(user._id.toString());
    if (!sock) return res.status(503).json({ error: 'WhatsApp not connected.' });

    const { to, body } = req.body;
    const numbers = Array.isArray(to) ? to : [to];
    const results = [];

    for (const num of numbers) {
        const jid = `${num}@s.whatsapp.net`;
        try {
            await sock.sendMessage(jid, { text: body });
            results.push({ number: num, status: 'success' });
            await MessageLog.create({ userId: user._id, to: num, body, status: 'success' });
            await new Promise(r => setTimeout(r, 3000));
        } catch (e) {
            results.push({ number: num, status: 'error', error: e.message });
            await MessageLog.create({ userId: user._id, to: num, body, status: 'failed', errorDetails: e.message });
        }
    }
    res.json({ success: true, results });
});

app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => {
    const sessionUserId = socket.handshake.query.userId;
    if (sessionUserId) {
        socket.join(sessionUserId);
        startWhatsAppSession(sessionUserId, io).then(sock => {
            if (sock && sock.user) socket.emit('ready', 'WhatsApp is connected');
        });
        
        socket.on('send-message', async ({ to, body }) => {
            const sock = getSession(sessionUserId);
            if (!sock || !sock.user) return socket.emit('error', 'واتساب غير متصل');
            
            const numbers = to.split(',').map(n => n.trim()).filter(n => n);
            for (const num of numbers) {
                const jid = `${num}@s.whatsapp.net`;
                try {
                    await sock.sendMessage(jid, { text: body });
                    socket.emit('message-sent', { to: num, body });
                    await MessageLog.create({ userId: sessionUserId, to: num, body, status: 'success' });
                    await new Promise(r => setTimeout(r, 3000));
                } catch (e) {
                    socket.emit('error', `خطأ في إرسال رسالة لـ ${num}`);
                    await MessageLog.create({ userId: sessionUserId, to: num, body, status: 'failed', errorDetails: e.message });
                }
            }
        });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
