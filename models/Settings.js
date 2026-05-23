const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    supportPhone: { type: String, default: '966598686902' },
    freeTrialDays: { type: Number, default: 2 },
    isSafeMode: { type: Boolean, default: false },
    isQuietHours: { type: Boolean, default: false }
});

module.exports = mongoose.model('Settings', settingsSchema);
