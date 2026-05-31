const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    supportPhone: { type: String, default: '966598686902' },
    freeTrialDays: { type: Number, default: 2 },
    isSafeMode: { type: Boolean, default: false },
    isQuietHours: { type: Boolean, default: false },
    campaignRandomDelayEnabled: { type: Boolean, default: true },
    campaignDelayMinMinutes: { type: Number, default: 3 },
    campaignDelayMaxMinutes: { type: Number, default: 13 }
});

module.exports = mongoose.model('Settings', settingsSchema);
