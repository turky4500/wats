const socket = io();

const qrContainer = document.getElementById('qr-container');
const chatContainer = document.getElementById('chat-container');
const qrDiv = document.getElementById('qr-code');
const statusP = document.getElementById('status');
const messagesDiv = document.getElementById('messages');
const phoneInput = document.getElementById('phone');
const msgInput = document.getElementById('message');
const sendBtn = document.getElementById('send-btn');

socket.on('qr', (qrImageData) => {
    qrContainer.style.display = 'block';
    chatContainer.style.display = 'none';
    qrDiv.innerHTML = `<img src="${qrImageData}" alt="QR Code">`;
    statusP.innerText = 'امسح الباركود من تطبيق واتساب (الإعدادات > الأجهزة المرتبطة)';
});

socket.on('ready', () => {
    qrContainer.style.display = 'none';
    chatContainer.style.display = 'block';
    statusP.innerText = 'متصل وجاهز للإرسال';
});

socket.on('message', (msg) => {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');
    msgElement.innerText = `${msg.from.split('@')[0]}: ${msg.body}`;
    messagesDiv.appendChild(msgElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
});

socket.on('message-sent', (data) => {
    const msgElement = document.createElement('div');
    msgElement.classList.add('message');
    msgElement.style.background = '#dcf8c5';
    msgElement.style.alignSelf = 'flex-end';
    msgElement.innerText = `أنت → ${data.to}: ${data.body}`;
    messagesDiv.appendChild(msgElement);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    msgInput.value = '';
});

socket.on('error', (err) => {
    alert('خطأ: ' + err);
});

sendBtn.addEventListener('click', () => {
    const to = phoneInput.value.trim();
    const body = msgInput.value.trim();
    if (!to || !body) {
        alert('يرجى إدخال رقم الهاتف والرسالة');
        return;
    }
    socket.emit('send-message', { to, body });
});
