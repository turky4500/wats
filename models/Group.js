const mongoose = require('mongoose');

const contactSchema = new mongoose.Schema({
    name: { type: String, default: '' },
    phone: { type: String, required: true }
}, { _id: true });

const groupSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true },
    contacts: [contactSchema],
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Group', groupSchema);
