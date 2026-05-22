const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    supportPhone: { type: String, default: '966598686902' },
    freeTrialDays: { type: Number, default: 2 }
});

module.exports = mongoose.model('Settings', settingsSchema);
