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

let clientReady = false;
let currentQR = null;
let whatsappClient = null;

// دالة لبدء تشغيل عميل واتساب
async function initWhatsApp() {
    console.log("🚀 جاري تشغيل واتساب...");
    try {
        const executablePath = await chromium.executablePath();
        console.log("✅ مسار Chromium:", executablePath);

        const client = new Client({
            authStrategy: new LocalAuth(),
            puppeteer: {
                headless: true,
                args: chromium.args,
                executablePath: executablePath,
                ignoreDefaultArgs: ['--disable-extensions']
            }
        });

        client.on('qr', async (qr) => {
            console.log("📱 تم استلام QR Code");
            currentQR = qr;
            try {
                const qrImage = await qrcode.toDataURL(qr);
                io.emit('qr', qrImage);
            } catch (err) {
                console.error("❌ خطأ في تحويل QR:", err);
            }
        });

        client.on('ready', () => {
            console.log("🎉 واتساب جاهز للاستخدام!");
            clientReady = true;
            currentQR = null;
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

        await client.initialize();
        whatsappClient = client;
        console.log("✅ تم تهيئة العميل بنجاح");
    } catch (err) {
        console.error("❌ فشل في تهيئة واتساب:", err);
    }
}

// تشغيل العميل
initWhatsApp();

// نقطة نهاية احتياطية لجلب QR
app.get('/api/qr-status', (req, res) => {
    if (clientReady) return res.json({ ready: true });
    if (currentQR) return res.json({ ready: false, qr: currentQR });
    res.json({ ready: false, qr: null });
});

io.on('connection', (socket) => {
    console.log("🌐 متصفح متصل");
    if (clientReady) {
        socket.emit('ready', 'WhatsApp ready');
    } else if (currentQR) {
        (async () => {
            const qrImage = await qrcode.toDataURL(currentQR);
            socket.emit('qr', qrImage);
        })();
    }

    socket.on('send-message', async ({ to, body }) => {
        if (!clientReady || !whatsappClient) {
            return socket.emit('error', 'العميل ليس جاهزاً بعد');
        }
        try {
            await whatsappClient.sendMessage(`${to}@c.us`, body);
            socket.emit('message-sent', { to, body });
            console.log(`📨 تم إرسال رسالة إلى ${to}`);
        } catch (err) {
            console.error("❌ فشل الإرسال:", err);
            socket.emit('error', err.message);
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`✅ الخادم يعمل على المنفذ ${PORT}`);
});
