const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true },
    phone: { type: String, sparse: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['admin', 'user'], default: 'user' },
    isActive: { type: Boolean, default: true },
    apiToken: { type: String, unique: true },
    subscriptionEndsAt: { type: Date },
    
    // نظام الـ OTP والتفعيل
    isVerified: { type: Boolean, default: true },
    otpCode: { type: String },
    otpExpires: { type: Date },

    // حقول جديدة
    lastLoginAt: { type: Date },

    createdAt: { type: Date, default: Date.now }
});

// فهارس
userSchema.index({ phone: 1 });
userSchema.index({ apiToken: 1 });
userSchema.index({ role: 1, isActive: 1 });

userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
    return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
