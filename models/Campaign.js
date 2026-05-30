const mongoose = require('mongoose');

const campaignMediaSchema = new mongoose.Schema({
    mimetype: { type: String, required: true },
    filename: { type: String, default: 'file' },
    data: { type: String, required: true }
}, { _id: false });

const campaignSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    body: { type: String, default: '' },
    media: { type: [campaignMediaSchema], default: [] },
    totalNumbers: { type: Number, default: 0 },
    sentCount: { type: Number, default: 0 },
    failedCount: { type: Number, default: 0 },
    currentIndex: { type: Number, default: 0 },
    currentPhone: { type: String, default: null },
    status: {
        type: String,
        enum: ['pending', 'processing', 'paused', 'waiting_window', 'completed', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    controlStatus: {
        type: String,
        enum: ['active', 'paused', 'cancelled'],
        default: 'active',
        index: true
    },
    useTimeWindow: { type: Boolean, default: false },
    windowStart: { type: String, default: null },
    windowEnd: { type: String, default: null },
    lastError: { type: String, default: null },
    completedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now }
});

campaignSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Campaign', campaignSchema);
