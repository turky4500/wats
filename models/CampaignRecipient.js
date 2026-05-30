const mongoose = require('mongoose');

const campaignRecipientSchema = new mongoose.Schema({
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    phoneNumber: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'pending_retry', 'sent', 'failed'],
        default: 'pending',
        index: true
    },
    retryCount: { type: Number, default: 0 },
    errorMessage: { type: String, default: null },
    lastAttemptAt: { type: Date, default: null },
    sentAt: { type: Date, default: null },
    failedAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

campaignRecipientSchema.index({ campaignId: 1, status: 1, createdAt: 1 });

campaignRecipientSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('CampaignRecipient', campaignRecipientSchema);
