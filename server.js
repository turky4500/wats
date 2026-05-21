const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

// إعداد عميل واتساب ليعمل على Render
const whatsappClient = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        puppeteer: {
            launch: async () => {
                const browser = await puppeteer.launch({
                    args: chromium.args,
                    defaultViewport: chromium.defaultViewport,
                    executablePath: await chromium.executablePath(),
                    headless: chromium.headless,
                });
                return browser;
            },
        },
    },
});

let isClientReady = false;

whatsappClient.on('qr', async (qr) => {
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
    io.emit('message', {
        from: message.from,
        body: message.body,
        timestamp: message.timestamp
    });
});

whatsappClient.initialize();

io.on('connection', (socket) => {
    console.log('Frontend connected');

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) {
            socket.emit('error', 'Client not ready');
            return;
        }
        try {
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
