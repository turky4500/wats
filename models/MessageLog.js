const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    errorDetails: { type: String },
    // 🔥 أي رسالة يمر عليها 30 يوم (2592000 ثانية) تُمسح تلقائياً
    createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

// ===== فهارس لتسريع البحث =====
messageLogSchema.index({ userId: 1, createdAt: -1 });
messageLogSchema.index({ userId: 1, status: 1 });

module.exports = mongoose.model('MessageLog', messageLogSchema);
