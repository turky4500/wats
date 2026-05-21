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

const whatsappClient = new Client({
    authStrategy: new LocalAuth(), // يحافظ على الجلسة
    puppeteer: { headless: true }
});

let isClientReady = false;

whatsappClient.on('qr', async (qr) => {
    // تحويل الـ QR إلى صورة base64 لإرسالها للواجهة
    const qrImage = await qrcode.toDataURL(qr);
    io.emit('qr', qrImage);
    console.log('QR code generated');
});

whatsappClient.on('ready', () => {
    isClientReady = true;
    io.emit('ready', 'WhatsApp is ready!');
    console.log('WhatsApp client is ready');
});

whatsappClient.on('message', async (message) => {
    // إرسال الرسائل المستقبلة للواجهة
    io.emit('message', {
        from: message.from,
        body: message.body,
        timestamp: message.timestamp
    });
});

whatsappClient.initialize();

// استقبال طلب إرسال رسالة من الواجهة
io.on('connection', (socket) => {
    console.log('Frontend connected');

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) {
            socket.emit('error', 'Client not ready');
            return;
        }
        try {
            // to يجب أن يكون رقم الهاتف مع كود الدولة بدون +
            const chatId = `${to}@c.us`;
            await whatsappClient.sendMessage(chatId, body);
            socket.emit('message-sent', { to, body, status: 'sent' });
        } catch (err) {
            socket.emit('error', err.message);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
