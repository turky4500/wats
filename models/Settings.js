const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    supportPhone: { type: String, default: '966598686902' },
    freeTrialDays: { type: Number, default: 2 },
    isSafeMode: { type: Boolean, default: false },
    isQuietHours: { type: Boolean, default: false },

    safeModeEnabled: { type: Boolean, default: true },
    safeDelayMinMinutes: { type: Number, default: 3 },
    safeDelayMaxMinutes: { type: Number, default: 13 },

    fastModeEnabled: { type: Boolean, default: true },
    fastDelayMinSeconds: { type: Number, default: 5 },
    fastDelayMaxSeconds: { type: Number, default: 20 },

    // توافق مع النسخة السابقة
    campaignRandomDelayEnabled: { type: Boolean, default: true },
    campaignDelayMinMinutes: { type: Number, default: 3 },
    campaignDelayMaxMinutes: { type: Number, default: 13 }
});

module.exports = mongoose.model('Settings', settingsSchema);
