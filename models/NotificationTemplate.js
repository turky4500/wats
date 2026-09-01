const mongoose = require('mongoose');

// 📨 قوالب رسائل الإشعارات — يتحكم فيها الأدمن من تبويب (رسائل الإشعارات) في لوحة الإدارة
// target: 'admin' = تصل لجوال إشعارات الأدمن | 'user' = تصل للعميل نفسه | 'both' = للاثنين
const notificationTemplateSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true },
    title: { type: String, required: true },          // عنوان عربي يظهر في لوحة الإدارة
    description: { type: String, default: '' },       // شرح متى تُرسل هذه الرسالة
    text: { type: String, required: true },           // نص الرسالة (يدعم {placeholders})
    target: { type: String, enum: ['admin', 'user', 'both'], default: 'admin' },
    enabled: { type: Boolean, default: true },
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('NotificationTemplate', notificationTemplateSchema);
