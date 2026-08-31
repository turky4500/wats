const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'SAR' },
    planDays: { type: Number, default: 30 },
    status: {
        type: String,
        enum: ['pending', 'paid', 'failed', 'cancelled'],
        default: 'pending',
        index: true
    },
    paymentMethod: { type: String, default: null },   // مثل: Card, ApplePay...
    myfatoorahPaymentId: { type: String, default: null, index: true },  // PaymentId من ماي فاتورة
    myfatoorahInvoiceId: { type: String, default: null },               // InvoiceId
    transactionId: { type: String, default: null },
    errorMessage: { type: String, default: null },
    createdAt: { type: Date, default: Date.now, index: true },
    updatedAt: { type: Date, default: Date.now }
});

paymentSchema.pre('save', function(next) {
    this.updatedAt = new Date();
    next();
});

module.exports = mongoose.model('Payment', paymentSchema);
