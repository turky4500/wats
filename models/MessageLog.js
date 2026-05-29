const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    errorDetails: { type: String },
    // 🔥 السحر هنا: أي رسالة يمر عليها 30 يوم (2592000 ثانية) تُمسح تلقائياً من القاعدة لتوفير المساحة!
    createdAt: { type: Date, default: Date.now, expires: 2592000 }
});

module.exports = mongoose.model('MessageLog', messageLogSchema);
