const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    phone: { type: String, sparse: true }, // رقم الجوال (مطلوب للـ OTP)
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    apiToken: { type: String, unique: true },
    subscriptionEndsAt: { type: Date },
    
    // نظام الـ OTP والتفعيل
    isVerified: { type: Boolean, default: true }, // افتراضي true للقدامى، والجدد سيكون false حتى يفعلوا
    otpCode: { type: String },
    otpExpires: { type: Date },

    createdAt: { type: Date, default: Date.now }
});

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
