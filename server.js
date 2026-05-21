const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

let clientReady = false;
let currentQR = null;

// إعداد عميل واتساب مع إعدادات مناسبة لـ Render
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
        headless: true
    }
});

client.on('qr', async (qr) => {
    console.log('✅ تم استلام QR من المكتبة');
    currentQR = qr;
    try {
        const qrImage = await qrcode.toDataURL(qr);
        io.emit('qr', qrImage);
        console.log('📱 تم إرسال QR إلى المتصفح');
    } catch (err) {
        console.error('خطأ بتحويل QR:', err);
    }
});

client.on('ready', () => {
    clientReady = true;
    currentQR = null;
    console.log('🎉 واتساب جاهز!');
    io.emit('ready', 'WhatsApp ready');
});

client.on('message', async (message) => {
    if (!message.fromMe) {
        io.emit('message', {
            from: message.from,
            body: message.body,
            timestamp: message.timestamp
        });
    }
});

client.initialize();

// نقطة نهاية إضافية لجلب QR يدوياً
app.get('/api/qr-status', (req, res) => {
    if (clientReady) {
        return res.json({ ready: true });
    }
    if (currentQR) {
        return res.json({ ready: false, qr: currentQR });
    }
    res.json({ ready: false, qr: null });
});

io.on('connection', (socket) => {
    console.log('متصفح متصل');
    if (clientReady) {
        socket.emit('ready', 'WhatsApp ready');
    } else if (currentQR) {
        (async () => {
            const qrImage = await qrcode.toDataURL(currentQR);
            socket.emit('qr', qrImage);
        })();
    }

    socket.on('send-message', async ({ to, body }) => {
        if (!clientReady) {
            socket.emit('error', 'العميل ليس جاهزاً');
            return;
        }
        try {
            const chatId = `${to}@c.us`;
            await client.sendMessage(chatId, body);
            socket.emit('message-sent', { to, body });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
