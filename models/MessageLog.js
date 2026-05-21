const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    to: { type: String, required: true },
    body: { type: String, required: true },
    status: { type: String, enum: ['success', 'failed'], required: true },
    errorDetails: { type: String, default: '' },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('MessageLog', logSchema);
