/**
 * دوال مساعدة مشتركة
 */

/**
 * إرسال رسالة واتساب مع دعم الوسائط المتعددة
 */
async function sendWhatsAppMessage(sock, jid, body, mediaArray) {
    if (mediaArray && mediaArray.length > 0) {
        for (let i = 0; i < mediaArray.length; i++) {
            const m = mediaArray[i];
            const base64Data = m.data.includes(',') ? m.data.split(',')[1] : m.data;
            const buffer = Buffer.from(base64Data, 'base64');
            let content = {};
            if (m.mimetype.startsWith('image/')) content = { image: buffer };
            else if (m.mimetype.startsWith('video/')) content = { video: buffer };
            else if (m.mimetype.startsWith('audio/')) content = { audio: buffer, mimetype: 'audio/mp4' };
            else content = { document: buffer, mimetype: m.mimetype, fileName: m.filename || 'file' };
            if (i === 0 && body && !m.mimetype.startsWith('audio/')) content.caption = body;
            await sock.sendMessage(jid, content);
            await new Promise(r => setTimeout(r, 1500));
        }
        if (mediaArray[0].mimetype.startsWith('audio/') && body) {
            await sock.sendMessage(jid, { text: body });
        }
    } else if (body) {
        await sock.sendMessage(jid, { text: body });
    }
}

/**
 * تنظيف رقم الهاتف
 */
function cleanPhone(phone) {
    return phone.replace(/\D/g, '');
}

/**
 * توليد رمز OTP من 4 أرقام
 */
function generateOTP() {
    return Math.floor(1000 + Math.random() * 9000).toString();
}

/**
 * الحصول على تاريخ انتهاء OTP (10 دقائق)
 */
function getOTPExpiry(minutes = 10) {
    const exp = new Date();
    exp.setMinutes(exp.getMinutes() + minutes);
    return exp;
}

/**
 * حساب تاريخ الاشتراك
 */
function calculateSubscriptionDate(days) {
    const subDate = new Date();
    subDate.setDate(subDate.getDate() + days);
    return subDate;
}

module.exports = {
    sendWhatsAppMessage,
    cleanPhone,
    generateOTP,
    getOTPExpiry,
    calculateSubscriptionDate
};
