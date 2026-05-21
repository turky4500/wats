const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const qrcode = require('qrcode');

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const Pino = require('pino');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static('public'));
app.use(express.json());

let sock;
let isClientReady = false;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    
    sock = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: Pino({ level: 'silent' }),
        browser: ['Ubuntu Chrome', 'Chrome', '110.0.5481.100']
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            const qrImage = await qrcode.toDataURL(qr);
            io.emit('qr', qrImage);
            console.log('QR code generated');
        }
        
        if (connection === 'open') {
            isClientReady = true;
            io.emit('ready', 'WhatsApp is ready!');
            console.log('WhatsApp client is ready');
        }
        
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            isClientReady = false;
            console.log('Connection closed. Reconnecting...');
            if (statusCode !== DisconnectReason.loggedOut) {
                connectToWhatsApp();
            } else {
                io.emit('error', 'Logged out. Please restart the app and scan QR again.');
            }
        }
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages }) => {
        const msg = messages[0];
        if (!msg.key.fromMe && msg.message) {
            const from = msg.key.remoteJid;
            const body = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
            io.emit('message', {
                from: from,
                body: body,
                timestamp: msg.messageTimestamp
            });
        }
    });
}

connectToWhatsApp();

io.on('connection', (socket) => {
    console.log('Frontend connected');

    socket.on('send-message', async ({ to, body }) => {
        if (!isClientReady) {
            socket.emit('error', 'Client not ready');
            return;
        }
        try {
            const jid = `${to}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: body });
            socket.emit('message-sent', { to, body, status: 'sent' });
        } catch (err) {
            console.error(err);
            socket.emit('error', err.message);
        }
    });
});

server.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
});
