const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
    supportPhone: { type: String, default: '966598686902' },
    freeTrialDays: { type: Number, default: 2 },
    isSafeMode: { type: Boolean, default: false },
    isQuietHours: { type: Boolean, default: false },
    campaignRandomDelayEnabled: { type: Boolean, default: true },
    campaignDelayMinMinutes: { type: Number, default: 3 },
    campaignDelayMaxMinutes: { type: Number, default: 13 },
    // 💳 إعدادات الدفع الإلكتروني (ماي فاتورة)
    paymentsEnabled: { type: Boolean, default: false },
    myfatoorahMode: { type: String, enum: ['test', 'live'], default: 'test' },
    myfatoorahToken: { type: String, default: '' },
    planPrice: { type: Number, default: 100 },
    planDays: { type: Number, default: 30 },
    planName: { type: String, default: 'الباقة الشهرية' },
    // 🔔 رقم استقبال إشعارات الإدارة (تسجيل عميل، دفع، أحداث) — يُرسل إليه من جوال الإدارة المسجل
    notificationPhone: { type: String, default: '' }
});

module.exports = mongoose.model('Settings', settingsSchema);
