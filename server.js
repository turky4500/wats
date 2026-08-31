require('dotenv').config();
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ Unhandled Rejection:', reason instanceof Error ? reason.message : reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception:', err.message);
});
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const session = require('express-session');
const cors = require('cors');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const User = require('./models/User');
const MessageLog = require('./models/MessageLog');
const Settings = require('./models/Settings');
const Campaign = require('./models/Campaign');
const CampaignRecipient = require('./models/CampaignRecipient');
const Group = require('./models/Group');
const Payment = require('./models/Payment');
const { startWhatsAppSession, getSession, disconnectSession, requestPairingCode, waitForReadySession, isSessionReady } = require('./whatsappManager');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, { maxHttpBufferSize: 50 * 1024 * 1024 });
app.use(cors());

app.use((req, res, next) => {
    if (req.headers.host && req.headers.host.includes('onrender.com')) {
        return res.redirect(301, 'http://95.217.133.90:3000' + req.originalUrl);
    }
    next();
});


const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

const SYSTEM_ID = '111111111111111111111111';
const MAX_CAMPAIGN_RETRIES = 3;
const runningCampaigns = new Set();
const countdownTimers = new Map();

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function getSettings() {
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    let shouldSave = false;
    if (settings.campaignRandomDelayEnabled === undefined || settings.campaignRandomDelayEnabled === null) {
        settings.campaignRandomDelayEnabled = true;
        shouldSave = true;
    }
    if (settings.campaignDelayMinMinutes === undefined || settings.campaignDelayMinMinutes === null) {
        settings.campaignDelayMinMinutes = 3;
        shouldSave = true;
    }
    if (settings.campaignDelayMaxMinutes === undefined || settings.campaignDelayMaxMinutes === null) {
        settings.campaignDelayMaxMinutes = 13;
        shouldSave = true;
    }
    // 💳 حقول الدفع الإلكتروني
    if (settings.paymentsEnabled === undefined || settings.paymentsEnabled === null) {
        settings.paymentsEnabled = false;
        shouldSave = true;
    }
    if (settings.myfatoorahMode === undefined || settings.myfatoorahMode === null) {
        settings.myfatoorahMode = 'test';
        shouldSave = true;
    }
    if (settings.myfatoorahToken === undefined || settings.myfatoorahToken === null) {
        settings.myfatoorahToken = '';
        shouldSave = true;
    }
    if (settings.planPrice === undefined || settings.planPrice === null) {
        settings.planPrice = 100;
        shouldSave = true;
    }
    if (settings.planDays === undefined || settings.planDays === null) {
        settings.planDays = 30;
        shouldSave = true;
    }
    if (settings.planName === undefined || settings.planName === null) {
        settings.planName = 'الباقة الشهرية';
        shouldSave = true;
    }
    if (shouldSave) await settings.save();
    return settings;
}

function normalizePhoneNumber(value) {
    if (value === undefined || value === null) return null;
    const cleaned = String(value).trim().replace(/\D/g, '');
    return cleaned || null;
}

function normalizeSaudiPhoneNumber(value) {
    let digits = normalizePhoneNumber(value);
    if (!digits) return null;

    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.startsWith('966')) digits = digits.slice(3);
    if (digits.startsWith('0')) digits = digits.slice(1);

    if (!digits.startsWith('5') || digits.length !== 9) return null;

    const normalized = `966${digits}`;
    if (normalized.length !== 12 || !normalized.startsWith('9665')) return null;
    return normalized;
}

function normalizeNumbersDetailed(input) {
    const rawItems = Array.isArray(input) ? input : [input];
    const unique = new Set();
    const numbers = [];
    const invalidNumbers = [];
    const normalizedMap = [];

    for (const item of rawItems) {
        if (item === undefined || item === null) continue;
        const parts = String(item).split(/[\n,;\r\t ]+/);
        for (const part of parts) {
            const raw = String(part || '').trim();
            if (!raw) continue;
            const normalized = normalizeSaudiPhoneNumber(raw);
            if (!normalized) {
                invalidNumbers.push(raw);
                continue;
            }
            if (!unique.has(normalized)) {
                unique.add(normalized);
                numbers.push(normalized);
                normalizedMap.push({ input: raw, normalized });
            }
        }
    }

    return { numbers, invalidNumbers, normalizedMap };
}

function normalizeNumbers(input) {
    return normalizeNumbersDetailed(input).numbers;
}

function safeJsonParse(value, fallback = null) {
    try {
        return JSON.parse(value);
    } catch (_) {
        return fallback;
    }
}

function decodeFileName(name) {
    let fname = name || 'file';
    try { fname = Buffer.from(fname, 'latin1').toString('utf8'); } catch (_) {}
    return fname;
}

const UPLOADS_DIR = path.join(__dirname, 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

function sanitizeFilename(name) {
    return String(name || 'file').replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

function extractMediaFromRequest(req, persist = false) {
    let mediaArray = [];

    if (req.files && req.files.length > 0) {
        mediaArray = req.files.map(file => {
            const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + sanitizeFilename(file.originalname);
            if (persist) {
                const fullPath = path.join(UPLOADS_DIR, safeName);
                fs.writeFileSync(fullPath, file.buffer);
                return {
                    mimetype: file.mimetype,
                    filename: decodeFileName(file.originalname),
                    path: path.join('uploads', safeName)
                };
            }
            return {
                mimetype: file.mimetype,
                filename: decodeFileName(file.originalname),
                buffer: file.buffer
            };
        });
    } else if (req.body.media) {
        let bodyMedia = req.body.media;
        if (typeof bodyMedia === 'string') {
            bodyMedia = safeJsonParse(bodyMedia, []);
        }
        if (Array.isArray(bodyMedia)) {
            mediaArray = bodyMedia.map(item => {
                if (persist && item.data) {
                    const base64Data = String(item.data).includes(',') ? String(item.data).split(',')[1] : item.data;
                    const safeName = Date.now() + '-' + Math.round(Math.random() * 1e9) + '-' + sanitizeFilename(item.filename);
                    const fullPath = path.join(UPLOADS_DIR, safeName);
                    fs.writeFileSync(fullPath, Buffer.from(base64Data, 'base64'));
                    return {
                        mimetype: item.mimetype,
                        filename: item.filename || 'file',
                        path: path.join('uploads', safeName)
                    };
                }
                return {
                    mimetype: item.mimetype,
                    filename: item.filename || 'file',
                    data: item.data,
                    ...(item.buffer ? { buffer: item.buffer } : {})
                };
            });
        }
    }

    return mediaArray.filter(item => item && item.mimetype && (item.buffer || item.data || item.path));
}

function getCurrentKsaTimeParts() {
    const formatter = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Riyadh',
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const parts = formatter.formatToParts(new Date());
    const data = {};
    for (const part of parts) {
        if (part.type !== 'literal') data[part.type] = part.value;
    }
    return {
        hour: Number(data.hour || 0),
        minute: Number(data.minute || 0),
        second: Number(data.second || 0)
    };
}

function parseTimeString(value) {
    if (!value || typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null;
    const [hour, minute] = value.split(':').map(Number);
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
    return { hour, minute, totalMinutes: (hour * 60) + minute };
}

function isWithinTimeWindow(startStr, endStr) {
    if (!startStr || !endStr) return true;
    const start = parseTimeString(startStr);
    const end = parseTimeString(endStr);
    if (!start || !end) return true;

    const now = getCurrentKsaTimeParts();
    const currentMinutes = (now.hour * 60) + now.minute;

    if (start.totalMinutes === end.totalMinutes) return true;
    if (end.totalMinutes > start.totalMinutes) {
        return currentMinutes >= start.totalMinutes && currentMinutes < end.totalMinutes;
    }
    return currentMinutes >= start.totalMinutes || currentMinutes < end.totalMinutes;
}

function getMillisecondsUntilNextStart(startStr) {
    const start = parseTimeString(startStr);
    if (!start) return 0;

    const now = getCurrentKsaTimeParts();
    const currentMinutes = (now.hour * 60) + now.minute;
    let minutesUntil = 0;

    if (currentMinutes < start.totalMinutes) minutesUntil = start.totalMinutes - currentMinutes;
    else minutesUntil = (24 * 60) - currentMinutes + start.totalMinutes;

    const ms = (minutesUntil * 60 * 1000) - (now.second * 1000);
    return Math.max(ms, 1000);
}

function getCountdownData(campaignId) {
    const timer = countdownTimers.get(campaignId.toString());
    if (!timer) return null;
    const remainingMs = timer.endTime - Date.now();
    if (remainingMs <= 0) return null;
    return {
        type: timer.type,
        totalSeconds: Math.floor(remainingMs / 1000),
        minutes: Math.floor(remainingMs / 60000),
        seconds: Math.floor((remainingMs % 60000) / 1000),
        endsAt: new Date(timer.endTime)
    };
}

async function emitCampaignUpdate(campaignId, includeRecipients = false) {
    const campaign = await Campaign.findById(campaignId).lean();
    if (!campaign) return;

    const payload = {
        ...campaign,
        countdown: getCountdownData(campaignId)
    };

    if (includeRecipients) {
        payload.recipients = await CampaignRecipient.find({ campaignId: campaign._id }).sort({ createdAt: 1, _id: 1 }).lean();
    }

    io.to(campaign.userId.toString()).emit('campaign-update', payload);
}

function buildPermanentError(message) {
    const err = new Error(message);
    err.noRetry = true;
    return err;
}

function isRetryableError(error, attemptNumber) {
    if (!error || error.noRetry || attemptNumber >= MAX_CAMPAIGN_RETRIES) return false;

    const message = String(error.message || '').toLowerCase();
    const retryableTerms = [
        'socket', 'stream', 'connection', 'network', 'reconnect', 'closed', 'reset',
        'disconnect', 'unavailable', 'econnreset', 'econnaborted', '503', '502',
        'gateway', 'service unavailable', 'not connected', 'connection lost',
        'غير متصل', 'انقطع', 'إعادة الاتصال'
    ];

    return retryableTerms.some(term => message.includes(term));
}

function getRandomDelayMs(settings) {
    if (!settings || !settings.campaignRandomDelayEnabled) return 0;

    let minMinutes = Number(settings.campaignDelayMinMinutes || 0);
    let maxMinutes = Number(settings.campaignDelayMaxMinutes || 0);

    if (Number.isNaN(minMinutes) || minMinutes < 0) minMinutes = 0;
    if (Number.isNaN(maxMinutes) || maxMinutes < 0) maxMinutes = minMinutes;
    if (maxMinutes < minMinutes) [minMinutes, maxMinutes] = [maxMinutes, minMinutes];

    const minMs = Math.round(minMinutes * 60 * 1000);
    const maxMs = Math.round(maxMinutes * 60 * 1000);
    if (maxMs <= 0) return 0;
    if (maxMs === minMs) return maxMs;
    return Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
}

async function waitWithCampaignControl(campaignId, delayMs, type = 'delay') {
    const key = campaignId.toString();
    const endTime = Date.now() + delayMs;
    countdownTimers.set(key, { endTime, type });

    let remaining = delayMs;
    while (remaining > 0) {
        const campaign = await Campaign.findById(campaignId).select('controlStatus');
        if (!campaign) {
            countdownTimers.delete(key);
            return false;
        }
        if (campaign.controlStatus === 'paused' || campaign.controlStatus === 'cancelled') {
            countdownTimers.delete(key);
            return false;
        }
        const chunk = Math.min(1000, remaining);
        await sleep(chunk);
        remaining -= chunk;
    }

    countdownTimers.delete(key);
    return true;
}

async function ensureWhatsAppReady(userId, waitMs = 25000) {
    const key = userId.toString();
    let sock = getSession(key);
    if (!sock) startWhatsAppSession(key, io);

    const expiresAt = Date.now() + waitMs;
    while (Date.now() < expiresAt) {
        sock = getSession(key);
        if (sock && sock.user) return sock;
        await sleep(2000);
    }

    throw new Error('الواتساب غير متصل حالياً');
}

async function getNextCampaignRecipient(campaignId) {
    let recipient = await CampaignRecipient.findOne({ campaignId, status: 'pending' }).sort({ createdAt: 1, _id: 1 });
    if (!recipient) {
        recipient = await CampaignRecipient.findOne({ campaignId, status: 'pending_retry', retryCount: { $lt: MAX_CAMPAIGN_RETRIES } }).sort({ createdAt: 1, _id: 1 });
    }
    return recipient;
}

async function hasRemainingCampaignRecipients(campaignId) {
    const exists = await CampaignRecipient.exists({
        campaignId,
        $or: [
            { status: 'pending' },
            { status: 'pending_retry', retryCount: { $lt: MAX_CAMPAIGN_RETRIES } }
        ]
    });
    return !!exists;
}

async function handleCampaignRecipient(campaign, recipient) {
    const attemptNumber = (recipient.retryCount || 0) + 1;
    const messageBody = campaign.body || '(مرفق)';
    const userRoom = campaign.userId.toString();

    try {
        const currentSock = await ensureWhatsAppReady(campaign.userId, 20000);
        const jid = `${recipient.phoneNumber}@s.whatsapp.net`;
        const wpCheck = await currentSock.onWhatsApp(jid);
        if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) {
            throw buildPermanentError('الرقم غير مسجل في واتساب');
        }

        await sendWhatsAppMessage(currentSock, jid, campaign.body, campaign.media || []);

        await CampaignRecipient.findByIdAndUpdate(recipient._id, {
            status: 'sent',
            retryCount: attemptNumber,
            errorMessage: null,
            sentAt: new Date(),
            lastAttemptAt: new Date(),
            updatedAt: new Date()
        });
        await Campaign.findByIdAndUpdate(campaign._id, {
            $inc: { sentCount: 1 },
            $set: { lastError: null, updatedAt: new Date() }
        });
        await MessageLog.create({ userId: campaign.userId, to: recipient.phoneNumber, body: messageBody, status: 'success' });

        io.to(userRoom).emit('message-sent', {
            campaignId: campaign._id.toString(),
            to: recipient.phoneNumber,
            body: messageBody,
            attempt: attemptNumber
        });

        return { success: true };
    } catch (error) {
        const errorMessage = error.message || 'فشل غير معروف';
        const shouldRetry = isRetryableError(error, attemptNumber);

        await CampaignRecipient.findByIdAndUpdate(recipient._id, {
            status: shouldRetry ? 'pending_retry' : 'failed',
            retryCount: attemptNumber,
            errorMessage: errorMessage,
            lastAttemptAt: new Date(),
            failedAt: shouldRetry ? null : new Date(),
            updatedAt: new Date(),
            sentAt: shouldRetry ? null : recipient.sentAt
        });

        if (shouldRetry) {
            io.to(userRoom).emit('campaign-recipient-update', {
                campaignId: campaign._id.toString(),
                to: recipient.phoneNumber,
                status: 'pending_retry',
                attempt: attemptNumber,
                error: errorMessage
            });
            return { success: false, retryScheduled: true };
        }

        await Campaign.findByIdAndUpdate(campaign._id, {
            $inc: { failedCount: 1 },
            $set: { lastError: errorMessage, updatedAt: new Date() }
        });
        await MessageLog.create({ userId: campaign.userId, to: recipient.phoneNumber, body: messageBody, status: 'failed', errorDetails: errorMessage });
        io.to(userRoom).emit('error', `خطأ مع ${recipient.phoneNumber}: ${errorMessage}`);

        return { success: false, retryScheduled: false };
    }
}

async function finalizeCampaign(campaignId) {
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return;
    if (campaign.controlStatus === 'cancelled') {
        campaign.status = 'cancelled';
        campaign.completedAt = new Date();
        await campaign.save();
        await emitCampaignUpdate(campaignId, false);
        io.to(campaign.userId.toString()).emit('campaign-completed', {
            campaignId: campaign._id.toString(),
            status: campaign.status,
            sentCount: campaign.sentCount,
            failedCount: campaign.failedCount,
            totalNumbers: campaign.totalNumbers
        });
        return;
    }

    campaign.currentPhone = null;
    campaign.completedAt = new Date();
    campaign.status = campaign.failedCount === campaign.totalNumbers ? 'failed' : 'completed';
    await campaign.save();

    await emitCampaignUpdate(campaignId, false);
    io.to(campaign.userId.toString()).emit('campaign-completed', {
        campaignId: campaign._id.toString(),
        status: campaign.status,
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        totalNumbers: campaign.totalNumbers
    });
}

async function startCampaignWorker(campaignId) {
    const key = campaignId.toString();
    if (runningCampaigns.has(key)) return;
    runningCampaigns.add(key);

    try {
        while (true) {
            let campaign = await Campaign.findById(campaignId);
            if (!campaign) return;

            if (campaign.controlStatus === 'cancelled') {
                await finalizeCampaign(campaignId);
                return;
            }

            if (campaign.controlStatus === 'paused') {
                if (campaign.status !== 'paused') {
                    campaign.status = 'paused';
                    campaign.updatedAt = new Date();
                    await campaign.save();
                }
                await emitCampaignUpdate(campaignId, false);
                return;
            }

            if (campaign.useTimeWindow && campaign.windowStart && campaign.windowEnd && !isWithinTimeWindow(campaign.windowStart, campaign.windowEnd)) {
                campaign.status = 'waiting_window';
                campaign.updatedAt = new Date();
                await campaign.save();
                await emitCampaignUpdate(campaignId, false);

                const waitMs = getMillisecondsUntilNextStart(campaign.windowStart);
                const keepWaiting = await waitWithCampaignControl(campaignId, waitMs, 'window');
                if (!keepWaiting) {
                    campaign = await Campaign.findById(campaignId);
                    if (campaign && campaign.controlStatus === 'cancelled') {
                        await finalizeCampaign(campaignId);
                    } else if (campaign && campaign.controlStatus === 'paused') {
                        campaign.status = 'paused';
                        await campaign.save();
                        await emitCampaignUpdate(campaignId, false);
                    }
                    return;
                }
                continue;
            }

            const recipient = await getNextCampaignRecipient(campaignId);
            if (!recipient) break;

            campaign.currentIndex = (campaign.sentCount || 0) + (campaign.failedCount || 0) + 1;
            campaign.currentPhone = recipient.phoneNumber;
            campaign.status = 'processing';
            campaign.updatedAt = new Date();
            await campaign.save();
            await emitCampaignUpdate(campaignId, false);

            await handleCampaignRecipient(campaign, recipient);
            await emitCampaignUpdate(campaignId, false);

            const hasRemaining = await hasRemainingCampaignRecipients(campaignId);
            if (!hasRemaining) break;


        }

        await finalizeCampaign(campaignId);
    } catch (error) {
        console.error('❌ خطأ في عامل الحملة:', error);
        const campaign = await Campaign.findById(campaignId);
        if (campaign) {
            campaign.lastError = error.message;
            campaign.updatedAt = new Date();
            await campaign.save();
            await emitCampaignUpdate(campaignId, false);
        }
    } finally {
        countdownTimers.delete(key);
        runningCampaigns.delete(key);
    }
}

async function resumeActiveCampaigns() {
    const campaigns = await Campaign.find({
        controlStatus: 'active',
        status: { $in: ['pending', 'processing', 'waiting_window'] }
    }).select('_id');

    for (const campaign of campaigns) {
        startCampaignWorker(campaign._id).catch(err => console.error('خطأ في استئناف الحملة:', err));
    }
}

// ⏰ مشغّل الحملات المجدولة — يفحص كل 30 ثانية ويطلق الحملات عند حلول موعدها
const SCHEDULED_CAMPAIGN_CHECK_MS = 30 * 1000;

async function processScheduledCampaigns() {
    const now = new Date();
    const campaigns = await Campaign.find({ status: 'scheduled', scheduledAt: { $lte: now } }).select('_id');
    for (const campaign of campaigns) {
        const res = await Campaign.updateOne(
            { _id: campaign._id, status: 'scheduled' },
            { $set: { status: 'pending', updatedAt: new Date() } }
        );
        if (res.modifiedCount > 0) {
            console.log('⏰ إطلاق حملة مجدولة:', campaign._id.toString());
            startCampaignWorker(campaign._id).catch(err => console.error('خطأ تشغيل حملة مجدولة:', err));
        }
    }
}

async function sendSystemOTP(phone, message) {
    console.log('📤 محاولة إرسال OTP إلى:', phone);
    let sock = getSession(SYSTEM_ID);
    if (!sock || !sock.user) {
        console.log('❌ رقم الإدارة غير متصل');
        throw new Error('رقم الإدارة غير متصل! تواصل مع الدعم الفني.');
    }
    const jid = `${phone}@s.whatsapp.net`;
    const wpCheck = await sock.onWhatsApp(jid);
    if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم الذي أدخلته غير موجود في الواتساب.');
    await sock.sendMessage(jid, { text: message });
    console.log('✅ تم إرسال OTP بنجاح إلى:', phone);
}

async function createDefaultAdmin() {
    const admin = await User.findOne({ username: 'admin' });
    if (!admin) await User.create({ username: 'admin', password: 'password', role: 'admin' });
}
createDefaultAdmin();

function formatMessagePlaceholders(text, phone = '', extraData = {}) {
    if (!text || typeof text !== 'string') return text;

    // توقيت السعودية (KSA UTC+3)
    const now = new Date();
    const ksaOffset = 3 * 60; // offset in minutes
    const utcMinutes = now.getTime() + (now.getTimezoneOffset() * 60000);
    const ksaTime = new Date(utcMinutes + (ksaOffset * 60000));

    // تنسيق التاريخ والوقت
    const year = ksaTime.getFullYear();
    const month = String(ksaTime.getMonth() + 1).padStart(2, '0');
    const day = String(ksaTime.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    let hours = ksaTime.getHours();
    const minutes = String(ksaTime.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12 || 12;
    const timeStr = `${String(hours).padStart(2, '0')}:${minutes} ${ampm}`;

    // تنظيف رقم الجوال للعرض
    let cleanPhone = String(phone || '').replace(/\D/g, '');
    let displayPhone = cleanPhone;
    if (displayPhone.startsWith('9665')) {
        displayPhone = '05' + displayPhone.substring(4);
    } else if (displayPhone.startsWith('966')) {
        displayPhone = '0' + displayPhone.substring(3);
    }

    const nameStr = extraData.name || extraData.username || extraData.recipientName || 'العميل العزيز';

    let result = text;

    // 1. استبدال التاريخ
    result = result.replace(/\{التاريخ\}|\{تاريخ\}|\{DATE\}|\{date\}/gi, dateStr);

    // 2. استبدال الوقت
    result = result.replace(/\{الوقت\}|\{وقت\}|\{TIME\}|\{time\}/gi, timeStr);

    // 3. استبدال الاسم
    result = result.replace(/\{الاسم\}|\{اسم\}|\{NAME\}|\{name\}/gi, nameStr);

    // 4. استبدال الرقم
    result = result.replace(/\{الرقم\}|\{رقم\}|\{PHONE\}|\{phone\}/gi, displayPhone);

    return result;
}

async function sendWhatsAppMessage(sock, jid, body, mediaArray, extraData = {}) {
    const rawPhone = jid ? jid.split('@')[0] : '';
    const finalBody = formatMessagePlaceholders(body, rawPhone, extraData);

    if (mediaArray && mediaArray.length > 0) {
        for (let i = 0; i < mediaArray.length; i++) {
            const m = mediaArray[i];
            let buffer;
            if (m.buffer) buffer = m.buffer;
            else if (m.path) {
                buffer = fs.readFileSync(path.join(__dirname, m.path));
            } else if (m.data) {
                const base64Data = m.data.includes(',') ? m.data.split(',')[1] : m.data;
                buffer = Buffer.from(base64Data, 'base64');
            }

            let content = {};
            if (m.mimetype.startsWith('image/')) content = { image: buffer };
            else if (m.mimetype.startsWith('video/')) content = { video: buffer };
            else if (m.mimetype.startsWith('audio/')) content = { audio: buffer, mimetype: 'audio/mp4' };
            else content = { document: buffer, mimetype: m.mimetype, fileName: m.filename || 'file' };
            if (i === 0 && finalBody && !m.mimetype.startsWith('audio/')) content.caption = finalBody;

            try {
                await sock.sendMessage(jid, content);
            } catch (sendErr) {
                console.error('❌ خطأ إرسال ملف:', sendErr.message);
                throw sendErr;
            }
            await sleep(2000);
        }
        if (mediaArray[0].mimetype.startsWith('audio/') && finalBody) await sock.sendMessage(jid, { text: finalBody });
    } else if (finalBody) {
        await sock.sendMessage(jid, { text: finalBody });
    }
}

async function getUserCanSendState(user) {
    const settings = await getSettings();
    if (!user || !user.isActive) return { allowed: false, settings, error: 'الحساب غير نشط' };
    if (user.role !== 'admin') {
        if (!user.subscriptionEndsAt || new Date(user.subscriptionEndsAt) < new Date()) {
            return { allowed: false, settings, error: `اشتراكك منتهي، تواصل مع الدعم الفني ${settings.supportPhone}` };
        }
    }
    return { allowed: true, settings, error: null };
}

async function getOwnedCampaign(userId, campaignId) {
    if (!mongoose.Types.ObjectId.isValid(campaignId)) return null;
    return Campaign.findOne({ _id: campaignId, userId });
}

// =====================================================================
// 🗄️ نظام قاعدة البيانات الذكي — MongoDB على السيرفر تلقائياً
// =====================================================================
const { ensureLocalMongo } = require('./scripts/ensure-local-mongodb');
const { migrate } = require('./scripts/migrate-atlas-to-local');

const LOCAL_MONGO_URI = 'mongodb://127.0.0.1:27017/wats';
const LEGACY_ATLAS_URI = 'mongodb+srv://tur100:Sa123456@cluster0.asfixge.mongodb.net/test?appName=Cluster0';

function isLocalUri(uri) {
    return !uri || uri.includes('127.0.0.1') || uri.includes('localhost');
}

function getRemoteConfiguredUri() {
    const envUri = process.env.MONGODB_URI;
    if (envUri && !isLocalUri(envUri)) return envUri;
    return null;
}

async function updateEnvToLocal() {
    try {
        const envFile = path.join(__dirname, '.env');
        if (!fs.existsSync(envFile)) return false;
        let content = fs.readFileSync(envFile, 'utf8');
        const hasKey = /^MONGODB_URI=/m.test(content);
        if (hasKey) {
            content = content.replace(/^MONGODB_URI=.*$/m, 'MONGODB_URI=mongodb://127.0.0.1:27017/wats');
        } else {
            content += '\nMONGODB_URI=mongodb://127.0.0.1:27017/wats\n';
        }
        fs.writeFileSync(envFile, content);
        console.log('📝 [DB] تم تحديث .env لاستخدام قاعدة البيانات المحلية');
        return true;
    } catch (e) {
        console.error('⚠️ [DB] فشل تحديث .env:', e.message);
        return false;
    }
}

async function isLocalDbEmpty() {
    try {
        const count = await mongoose.connection.db.collection('users').countDocuments();
        return count === 0;
    } catch (e) {
        return true;
    }
}

/**
 * الإقلاع الذكي:
 *  1) يضمن تشغيل MongoDB المحلي على السيرفر (تثبيت/تشغيل تلقائي)
 *  2) إن كانت القاعدة المحلية فارغة ويوجد مصدر بعيد (أطلس) → ترحيل تلقائي كامل
 *  3) يحدّث .env لاستخدام المحلي نهائياً
 *  4) عند أي فشل → يتراجع للقاعدة البعيدة (بدون انقطاع الخدمة)
 */
async function initDatabase() {
    const remoteUri = getRemoteConfiguredUri();

    console.log('🗄️ [DB] بدء نظام قاعدة البيانات الذكي...');
    const localReady = await ensureLocalMongo();

    if (localReady) {
        try {
            await mongoose.connect(LOCAL_MONGO_URI, { serverSelectionTimeoutMS: 10000 });
            console.log('✅ متصل بقاعدة البيانات المحلية: ' + LOCAL_MONGO_URI);

            // هل يوجد مصدر بعيد يجب ترحيله؟
            if (remoteUri) {
                const empty = await isLocalDbEmpty();
                if (empty) {
                    console.log('🔄 [DB] القاعدة المحلية فارغة — بدء الترحيل من: ' + remoteUri.replace(/\/\/[^@]+@/, '//***@'));
                    try {
                        await migrate(remoteUri, LOCAL_MONGO_URI, { dryRun: false });
                        console.log('🎉 [DB] تم الترحيل بنجاح — التبديل للمحلي نهائياً');
                        await updateEnvToLocal();
                    } catch (migErr) {
                        console.error('⚠️ [DB] فشل الترحيل، سنعود للمصدر البعيد مؤقتاً:', migErr.message);
                        await mongoose.disconnect();
                        await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 20000 });
                        console.log('✅ متصل بالمصدر البعيد (احتياط): ' + remoteUri.replace(/\/\/[^@]+@/, '//***@'));
                    }
                } else {
                    console.log('ℹ️ [DB] القاعدة المحلية تحتوي بيانات — لا حاجة للترحيل');
                    await updateEnvToLocal();
                }
            }
            return LOCAL_MONGO_URI;
        } catch (e) {
            console.error('⚠️ [DB] تعذر الاتصال بالمحلي:', e.message);
            if (remoteUri) {
                await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 20000 });
                console.log('✅ متصل بالمصدر البعيد (احتياط): ' + remoteUri.replace(/\/\/[^@]+@/, '//***@'));
                return remoteUri;
            }
            throw e;
        }
    } else {
        // MongoDB المحلي غير متاح — هل نعود للمصدر البعيد؟
        if (remoteUri) {
            await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 20000 });
            console.log('⚠️ [DB] MongoDB المحلي غير متاح — استخدمنا المصدر البعيد مؤقتاً: ' + remoteUri.replace(/\/\/[^@]+@/, '//***@'));
            console.log('   💡 لحل دائم: تأكد من تثبيت MongoDB على السيرفر (scripts/setup-mongodb.sh)');
            return remoteUri;
        }
        // المحاولة الأخيرة: الاتصال بأطلس الافتراضي (للتراجع الآمن فقط)
        await mongoose.connect(LEGACY_ATLAS_URI, { serverSelectionTimeoutMS: 20000 });
        console.log('⚠️ [DB] متصل بأطلس (ملاذ أخير): ' + LEGACY_ATLAS_URI.replace(/\/\/[^@]+@/, '//***@'));
        return LEGACY_ATLAS_URI;
    }
}

initDatabase()
    .then(() => {
        console.log('✅ قاعدة البيانات جاهزة');
        try {
            (async () => {
                await getSettings();

                let sysSock = getSession(SYSTEM_ID);
                if (!sysSock) startWhatsAppSession(SYSTEM_ID, io).catch(err => console.error('❌ فشل بدء جلسة النظام:', err.message));

                const users = await User.find({ role: 'user', isActive: true });
                for (const user of users) {
                    const userSock = getSession(user._id.toString());
                    if (!userSock) startWhatsAppSession(user._id.toString(), io).catch(err => console.error('❌ فشل بدء جلسة المستخدم:', err.message));
                }

                setTimeout(() => {
                    resumeActiveCampaigns().catch(err => console.error('خطأ في استئناف الحملات:', err));
                    processScheduledCampaigns().catch(err => console.error('خطأ في تشغيل الحملات المجدولة:', err));
                }, 12000);
            })().catch(e => console.error('خطأ:', e));
        } catch (e) {
            console.error('خطأ:', e);
        }
    }).catch(err => console.error('❌ خطأ في الاتصال بقاعدة البيانات:', err));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use('/uploads', express.static(UPLOADS_DIR));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || 'wats_secret_123',
    resave: false,
    saveUninitialized: false
}));

const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

const requireAdmin = async (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    const user = await User.findById(req.session.userId);
    if (user && user.role === 'admin') return next();
    res.status(403).send('غير مصرح لك بالدخول');
};

app.get('/', async (req, res) => {
    const loggedIn = !!req.session.userId;
    res.render('landing', { loggedIn });
});

app.get('/register', (req, res) => res.render('register', { error: null }));
app.post('/register', async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        const cleanPhone = phone.replace(/\D/g, '');

        const validPrefixes = ['966', '971', '965', '973', '974', '968', '967', '20', '962', '963', '964', '961', '212', '216', '213'];
        const startsWithValidPrefix = validPrefixes.some(p => cleanPhone.startsWith(p));
        const startsWith5 = cleanPhone.startsWith('5') && cleanPhone.length >= 9;

        if (!startsWithValidPrefix && !startsWith5) {
            return res.render('register', { error: 'رقم الجوال يجب أن يكون بالصيغة الدولية مثل 9665xxxxxxxx (مع رمز الدولة).' });
        }
        if (cleanPhone.length < 9 || cleanPhone.length > 15) {
            return res.render('register', { error: 'رقم الجوال غير صحيح. تأكد من إدخال الرقم مع رمز الدولة بالصيغة الدولية.' });
        }

        let user = await User.findOne({ $or: [{ username }, { phone: cleanPhone }] });
        if (user) return res.render('register', { error: 'اسم المستخدم أو رقم الجوال مستخدم مسبقاً.' });

        const settings = await getSettings();
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date();
        otpExp.setMinutes(otpExp.getMinutes() + 10);
        const subDate = new Date();
        subDate.setDate(subDate.getDate() + settings.freeTrialDays);

        user = await User.create({
            username,
            phone: cleanPhone,
            password,
            apiToken: Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2),
            subscriptionEndsAt: subDate,
            isVerified: false,
            otpCode: otp,
            otpExpires: otpExp
        });

        req.session.verifyUserId = user._id;

        try {
            await sendSystemOTP(cleanPhone, `أهلاً بك في منصتنا 🚀\nرمز التفعيل الخاص بك هو: *${otp}*\n(صالح لمدة 10 دقائق)`);
            res.redirect('/verify');
        } catch (otpErr) {
            console.error('⚠️ فشل إرسال OTP لكن الحساب تم إنشاؤه:', otpErr.message);
            res.render('verify', { error: 'تم إنشاء حسابك لكن فشل إرسال الرمز. اضغط إعادة الإرسال.', success: null });
        }
    } catch (e) {
        console.error('❌ خطأ في التسجيل:', e.message);
        res.render('register', { error: e.message });
    }
});

app.get('/verify', (req, res) => {
    if (!req.session.verifyUserId) return res.redirect('/register');
    res.render('verify', { error: null, success: null });
});

app.post('/verify', async (req, res) => {
    try {
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');
        if (user.otpCode !== req.body.otp || new Date() > user.otpExpires) return res.render('verify', { error: 'الرمز غير صحيح أو منتهي الصلاحية', success: null });

        user.isVerified = true;
        user.otpCode = null;
        user.otpExpires = null;
        await user.save();
        req.session.userId = user._id;
        req.session.verifyUserId = null;
        res.redirect('/dashboard');
    } catch (e) {
        res.render('verify', { error: 'حدث خطأ', success: null });
    }
});

app.post('/resend-otp', async (req, res) => {
    try {
        if (!req.session.verifyUserId) return res.redirect('/register');
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date();
        otpExp.setMinutes(otpExp.getMinutes() + 10);
        user.otpCode = otp;
        user.otpExpires = otpExp;
        await user.save();

        await sendSystemOTP(user.phone, `رمز التفعيل الجديد: *${otp}*\n(صالح لمدة 10 دقائق)`);
        res.render('verify', { error: null, success: 'تم إعادة إرسال الرمز بنجاح ✅' });
    } catch (e) {
        console.error('❌ خطأ إعادة إرسال OTP:', e.message);
        res.render('verify', { error: 'فشل إعادة الإرسال: ' + e.message, success: null });
    }
});

app.get('/forgot-password', (req, res) => res.render('forgot-password', { error: null }));
app.post('/forgot-password', async (req, res) => {
    try {
        const cleanPhone = req.body.phone.replace(/\D/g, '');
        if (cleanPhone.length < 9 || cleanPhone.length > 15) {
            return res.render('forgot-password', { error: 'رقم الجوال غير صحيح. أدخل الرقم بالصيغة الدولية مثل 9665xxxxxxxx' });
        }
        const user = await User.findOne({ phone: cleanPhone });
        if (!user) return res.render('forgot-password', { error: 'رقم الجوال غير مسجل لدينا' });

        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date();
        otpExp.setMinutes(otpExp.getMinutes() + 10);
        user.otpCode = otp;
        user.otpExpires = otpExp;
        await user.save();

        await sendSystemOTP(cleanPhone, `مرحباً 👋\nرمز التحقق لاستعادة المرور هو: *${otp}*`);
        req.session.resetUserId = user._id;
        res.redirect('/reset-password');
    } catch (e) {
        res.render('forgot-password', { error: e.message });
    }
});

app.get('/reset-password', (req, res) => {
    if (!req.session.resetUserId) return res.redirect('/forgot-password');
    res.render('reset-password', { error: null });
});

app.post('/reset-password', async (req, res) => {
    try {
        const { otp, newPassword } = req.body;
        const user = await User.findById(req.session.resetUserId);
        if (user.otpCode !== otp || new Date() > user.otpExpires) return res.render('reset-password', { error: 'الرمز غير صحيح أو منتهي' });

        user.password = newPassword;
        user.otpCode = null;
        user.otpExpires = null;
        await user.save();
        req.session.resetUserId = null;
        res.redirect('/login');
    } catch (e) {
        res.render('reset-password', { error: 'حدث خطأ' });
    }
});

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });
    if (user && user.isActive && await user.comparePassword(password)) {
        if (!user.isVerified) {
            req.session.verifyUserId = user._id;
            return res.redirect('/verify');
        }
        req.session.userId = user._id;
        return res.redirect('/dashboard');
    }
    res.render('login', { error: 'بيانات غير صحيحة.' });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

app.get('/return-to-admin', (req, res) => {
    if (req.session.originalAdminId) {
        req.session.userId = req.session.originalAdminId;
        req.session.originalAdminId = null;
        res.redirect('/admin');
    } else {
        res.redirect('/dashboard');
    }
});

app.post('/refresh-token', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    user.apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
    await user.save();
    res.redirect('/api-guide');
});

app.post('/disconnect-whatsapp', requireAuth, async (req, res) => {
    let targetId = req.session.userId;
    if (req.session.originalAdminId) targetId = req.session.userId;
    await disconnectSession(targetId.toString());
    res.redirect('back');
});

app.post('/request-pairing-code', requireAuth, async (req, res) => {
    try {
        const phoneNumber = req.body.phoneNumber;
        if (!phoneNumber) return res.json({ success: false, error: 'يرجى إدخال رقم الجوال' });
        const code = await requestPairingCode(req.session.userId.toString(), phoneNumber, io);
        res.json({ success: true, code });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.post('/admin/disconnect-system-whatsapp', requireAdmin, async (req, res) => {
    await disconnectSession(SYSTEM_ID);
    res.redirect('back');
});

app.post('/admin/request-pairing-code', requireAdmin, async (req, res) => {
    try {
        const phoneNumber = req.body.phoneNumber;
        if (!phoneNumber) return res.json({ success: false, error: 'يرجى إدخال رقم الجوال' });
        const code = await requestPairingCode(SYSTEM_ID, phoneNumber, io);
        res.json({ success: true, code });
    } catch (e) {
        res.json({ success: false, error: e.message });
    }
});

app.get('/dashboard', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');
    const isImpersonating = !!req.session.originalAdminId;
    const settings = await getSettings();

    const totalMessages = await MessageLog.countDocuments({ userId: user._id });
    const successMessages = await MessageLog.countDocuments({ userId: user._id, status: 'success' });
    const failedMessages = totalMessages - successMessages;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyStats = await MessageLog.aggregate([
        { $match: { userId: user._id, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const recentCampaigns = await Campaign.find({ userId: user._id }).sort({ createdAt: -1 }).limit(8).lean();
    const activeCampaign = await Campaign.findOne({
        userId: user._id,
        status: { $in: ['pending', 'processing', 'paused', 'waiting_window', 'scheduled'] }
    }).sort({ createdAt: -1 }).lean();

    res.render('dashboard', {
        user,
        isImpersonating,
        totalMessages,
        successMessages,
        failedMessages,
        dailyStats,
        settings,
        recentCampaigns,
        activeCampaign
    });
});

app.get('/profile', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');
    res.render('profile', { user });
});

app.get('/groups', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');
    const groups = await Group.find({ userId: user._id }).sort({ createdAt: -1 }).lean();
    res.render('groups', { user, groups });
});

app.post('/api/groups', requireAuth, async (req, res) => {
    try {
        const { name } = req.body;
        if (!name || name.trim() === '') return res.status(400).json({ success: false, error: 'يرجى إدخال اسم المجموعة' });
        const group = await Group.create({ userId: req.session.userId, name: name.trim(), contacts: [] });
        res.json({ success: true, group });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/groups', requireAuth, async (req, res) => {
    try {
        const groups = await Group.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
        res.json({ success: true, groups });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/groups/list', requireAuth, async (req, res) => {
    try {
        const groups = await Group.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
        const result = groups.map(g => ({ _id: g._id, name: g.name, contactsCount: g.contacts ? g.contacts.length : 0, createdAt: g.createdAt }));
        res.json({ success: true, groups: result });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/groups/:id', requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!group) return res.status(404).json({ success: false, error: 'المجموعة غير موجودة' });
        await Group.findByIdAndDelete(req.params.id);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.get('/api/groups/:id', requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.id, userId: req.session.userId }).lean();
        if (!group) return res.status(404).json({ success: false, error: 'المجموعة غير موجودة' });
        res.json({ success: true, group });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.post('/api/groups/:id/contacts', requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!group) return res.status(404).json({ success: false, error: 'المجموعة غير موجودة' });
        let contacts = req.body.contacts;
        if (typeof contacts === 'string') {
            try { contacts = JSON.parse(contacts); } catch (_) { contacts = []; }
        }
        if (!Array.isArray(contacts) || contacts.length === 0) return res.status(400).json({ success: false, error: 'لا توجد جهات اتصال' });

        let added = 0;
        for (const c of contacts) {
            const phone = String(c.phone || '').replace(/\D/g, '');
            if (phone.length < 9 || phone.length > 15) continue;
            const exists = group.contacts.some(ec => ec.phone === phone);
            if (!exists) {
                group.contacts.push({ name: c.name || '', phone });
                added++;
            }
        }
        await group.save();
        res.json({ success: true, added, total: group.contacts.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.delete('/api/groups/:id/contacts', requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.id, userId: req.session.userId });
        if (!group) return res.status(404).json({ success: false, error: 'المجموعة غير موجودة' });
        const { contactIds } = req.body;
        if (!Array.isArray(contactIds)) return res.status(400).json({ success: false, error: 'لم يتم تحديد جهات اتصال' });
        group.contacts = group.contacts.filter(c => !contactIds.includes(c._id.toString()));
        await group.save();
        res.json({ success: true, total: group.contacts.length });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

app.put('/api/groups/:groupId/contacts/:contactId', requireAuth, async (req, res) => {
    try {
        const group = await Group.findOne({ _id: req.params.groupId, userId: req.session.userId });
        if (!group) return res.status(404).json({ success: false, error: 'المجموعة غير موجودة' });

        const contact = group.contacts.id(req.params.contactId);
        if (!contact) return res.status(404).json({ success: false, error: 'جهة الاتصال غير موجودة' });

        const phone = String(req.body.phone || '').replace(/\D/g, '');
        const name = String(req.body.name || '').trim();

        if (!phone) return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الجوال' });
        if (phone.length < 9 || phone.length > 15) {
            return res.status(400).json({ success: false, error: 'رقم الجوال غير صحيح' });
        }

        const duplicate = group.contacts.some(c => c._id.toString() !== req.params.contactId && c.phone === phone);
        if (duplicate) {
            return res.status(400).json({ success: false, error: 'هذا الرقم موجود مسبقاً داخل المجموعة' });
        }

        contact.phone = phone;
        contact.name = name;
        await group.save();
        res.json({ success: true, contact });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

// 📄 قراءة أوراق عمل ملف Excel وعرضها (لاختيار الورقة قبل الاستيراد)
app.post('/api/groups/import-excel/sheets', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم رفع ملف' });
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
            return res.status(400).json({ success: false, error: 'الملف لا يحتوي على أوراق عمل' });
        }
        const sheets = workbook.SheetNames.map(name => ({
            name,
            rows: XLSX.utils.sheet_to_json(workbook.Sheets[name]).length
        }));
        res.json({ success: true, sheets, defaultSheet: sheets[0].name });
    } catch (e) {
        res.status(500).json({ success: false, error: 'خطأ في قراءة الملف: ' + e.message });
    }
});

// 🔍 كشف تلقائي ذكي: يفحص كل الأعمدة ويحدد عمود الأرقام وعمود الأسماء
// (يبحث عن أي عمود قيمه أرقام تشبه هواتف — تبدأ بـ 966 أو 05 أو 5 — ويعرض النتيجة)
function detectExcelColumns(workbook, sheetName) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const numCols = rawRows.reduce((m, r) => Math.max(m, Array.isArray(r) ? r.length : 0), 0);

    const PHONE_HEADER = /phone|mobile|tel|whats|رقم|جوال|هاتف|واتس|contact/i;
    const NAME_HEADER = /name|اسم|عميل|customer|client/i;

    const columns = [];
    for (let c = 0; c < numCols; c++) {
        let phoneLike = 0, textLike = 0, total = 0, samplePhone = '', sampleText = '';
        for (const row of rawRows) {
            const v = row && row[c];
            if (v === undefined || v === null || String(v).trim() === '') continue;
            total++;
            const sv = String(v).trim();
            const digits = sv.replace(/\D/g, '');
            if (digits.length >= 9 && digits.length <= 15) { phoneLike++; if (!samplePhone) samplePhone = sv; }
            else if (/[a-zA-Z\u0600-\u06FF]/.test(sv)) { textLike++; if (!sampleText) sampleText = sv; }
        }
        const header = String((rawRows[0] && rawRows[0][c]) || '').trim();
        // العدد الفعلي للأرقام/النصوص هو العامل الحاسم — عنوان العمود مجرد كسر تعادل
        const phoneScore = phoneLike * 1000 + (PHONE_HEADER.test(header) ? 500 : 0);
        const nameScore = textLike * 10 + (NAME_HEADER.test(header) ? 100 : 0);
        columns.push({
            key: XLSX.utils.encode_col(c),
            header: header || null,
            phoneLike,
            textLike,
            total,
            samplePhone: samplePhone || null,
            sampleText: sampleText || null,
            phoneScore,
            nameScore
        });
    }

    const phoneSorted = [...columns].sort((a, b) => b.phoneScore - a.phoneScore);
    const phoneCol = phoneSorted[0] && phoneSorted[0].phoneLike > 0 ? phoneSorted[0].key : null;
    const others = columns.filter(c => c.key !== phoneCol).sort((a, b) => b.nameScore - a.nameScore);
    const nameCol = others[0] && others[0].textLike > 0 ? others[0].key : null;
    return { columns, phoneCol, nameCol };
}

// استخراج جهات الاتصال من ورقة محددة باستخدام الأعمدة المكتشفة أو المحددة يدوياً
function extractContactsFromSheet(workbook, sheetName, phoneCol, nameCol) {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    const pIdx = phoneCol ? XLSX.utils.decode_col(phoneCol) : -1;
    const nIdx = nameCol ? XLSX.utils.decode_col(nameCol) : -1;
    const seen = new Set();
    const contacts = [];

    for (const row of rawRows) {
        if (!Array.isArray(row)) continue;
        const pv = pIdx >= 0 ? row[pIdx] : '';
        const digits = String(pv ?? '').replace(/\D/g, '');
        if (digits.length < 9 || digits.length > 15) continue;

        let normalized = digits;
        if (normalized.startsWith('00')) normalized = normalized.slice(2);
        if (normalized.startsWith('0')) normalized = '966' + normalized.slice(1);
        else if (normalized.length === 9 && normalized.startsWith('5')) normalized = '966' + normalized;
        if (normalized.length < 9 || normalized.length > 15) continue;
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const nv = nIdx >= 0 ? row[nIdx] : '';
        const name = String(nv ?? '').trim();
        contacts.push({
            name: name && /[a-zA-Z\u0600-\u06FF]/.test(name) ? name : '',
            phone: normalized
        });
    }
    return contacts;
}

// 🔍 نقطة كشف الأعمدة (تُظهر للمستخدم الأعمدة المكتشفة + معاينة قبل الحفظ)
app.post('/api/groups/import-excel/detect', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم رفع ملف' });
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const requestedSheet = req.body.sheetName;
        const sheetName = requestedSheet && workbook.SheetNames.includes(requestedSheet) ? requestedSheet : workbook.SheetNames[0];
        if (!sheetName) return res.status(400).json({ success: false, error: 'لا توجد أوراق عمل في الملف' });

        const detection = detectExcelColumns(workbook, sheetName);
        const contacts = extractContactsFromSheet(workbook, sheetName, detection.phoneCol, detection.nameCol);
        res.json({
            success: true,
            sheetName,
            columns: detection.columns,
            phoneCol: detection.phoneCol,
            nameCol: detection.nameCol,
            total: contacts.length,
            contacts: contacts.slice(0, 30)
        });
    } catch (e) {
        res.status(500).json({ success: false, error: 'خطأ في قراءة الملف: ' + e.message });
    }
});

app.post('/api/groups/import-excel', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم رفع ملف' });
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        // اختيار الورقة: إن حدد المستخدم ورقة موجودة نستخدمها، وإلا الورقة الأولى افتراضياً
        const requestedSheet = req.body.sheetName;
        const sheetName = requestedSheet && workbook.SheetNames.includes(requestedSheet)
            ? requestedSheet
            : workbook.SheetNames[0];

        // تحديد الأعمدة: إما يدوياً من المستخدم، أو كشف تلقائي ذكي
        let phoneCol = req.body.phoneCol;
        let nameCol = req.body.nameCol || null;
        let validCol = false;
        try { if (phoneCol) XLSX.utils.decode_col(phoneCol); validCol = !!phoneCol; } catch (e) { validCol = false; }
        if (!validCol) {
            const det = detectExcelColumns(workbook, sheetName);
            phoneCol = det.phoneCol;
            if (!nameCol) nameCol = det.nameCol;
        }
        if (!phoneCol) {
            return res.status(400).json({ success: false, error: 'لم يتم العثور على عمود يحتوي أرقام هواتف — اختر العمود يدوياً من القائمة' });
        }

        const contacts = extractContactsFromSheet(workbook, sheetName, phoneCol, nameCol);
        if (contacts.length === 0) {
            return res.status(400).json({ success: false, error: 'لم يتم العثور على أرقام صحيحة في الورقة المحددة' });
        }
        res.json({ success: true, contacts, total: contacts.length, sheetName, phoneCol, nameCol });
    } catch (e) {
        res.status(500).json({ success: false, error: 'خطأ في قراءة الملف: ' + e.message });
    }
});

app.get('/campaigns/:id', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');

    const campaign = await getOwnedCampaign(user._id, req.params.id);
    if (!campaign) return res.status(404).render('error', { code: 404, title: 'الحملة غير موجودة', message: 'الحملة غير موجودة أو لا تملك صلاحية الوصول لها' });

    res.render('campaign-report', { user, campaign });
});

app.get('/api-guide', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    res.render('api-guide', { user, host: req.protocol + '://' + req.get('host') });
});

app.get('/admin', requireAdmin, async (req, res) => {
    const users = await User.find({ role: 'user' }).sort({ createdAt: -1 });
    const totalSystemMessages = await MessageLog.countDocuments();
    const settings = await getSettings();

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyStats = await MessageLog.aggregate([
        { $match: { createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
    ]);

    const topUsers = await MessageLog.aggregate([
        { $group: { _id: '$userId', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 }
    ]);
    for (const item of topUsers) {
        const foundUser = await User.findById(item._id);
        item.username = foundUser ? foundUser.username : 'عميل محذوف';
    }

    res.render('admin', { users, totalSystemMessages, dailyStats, topUsers, settings });
});

app.post('/admin/add-user', requireAdmin, async (req, res) => {
    try {
        const { username, password, phone } = req.body;
        const apiToken = Math.random().toString(36).substr(2) + Math.random().toString(36).substr(2);
        const settings = await getSettings();
        const subDate = new Date();
        subDate.setDate(subDate.getDate() + settings.freeTrialDays);
        await User.create({ username, phone, password, apiToken, subscriptionEndsAt: subDate, isVerified: true });
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('خطأ: المستخدم أو الجوال موجود.');
    }
});

app.post('/admin/edit-user/:id', requireAdmin, async (req, res) => {
    try {
        const { password, addDays, setDays, expiryDate, phone } = req.body;
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');

        if (phone && phone.trim() !== '') {
            const cleanPhone = phone.replace(/\D/g, '');
            if (cleanPhone.length >= 9 && cleanPhone.length <= 15) {
                const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: req.params.id } });
                if (!existing) {
                    user.phone = cleanPhone;
                }
            }
        }

        if (password && password.trim() !== '') {
            user.password = password.trim();
        }

        if (expiryDate && expiryDate.trim() !== '') {
            user.subscriptionEndsAt = new Date(expiryDate + 'T23:59:59');
            user.markModified('subscriptionEndsAt');
        } else if (setDays && setDays.trim() !== '' && parseInt(setDays) >= 0) {
            let newEnd = new Date();
            newEnd.setDate(newEnd.getDate() + parseInt(setDays));
            user.subscriptionEndsAt = newEnd;
            user.markModified('subscriptionEndsAt');
        } else if (addDays && addDays.trim() !== '' && parseInt(addDays) > 0) {
            let currentEnd = (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > new Date())
                ? new Date(user.subscriptionEndsAt)
                : new Date();
            currentEnd.setDate(currentEnd.getDate() + parseInt(addDays));
            user.subscriptionEndsAt = currentEnd;
            user.markModified('subscriptionEndsAt');
        }

        await user.save();
        res.redirect('/admin');
    } catch (e) {
        console.error('Error in edit-user:', e);
        res.status(400).send('حدث خطأ أثناء تعديل المستخدم: ' + e.message);
    }
});

app.get('/admin/login-as/:id', requireAdmin, async (req, res) => {
    req.session.originalAdminId = req.session.userId;
    req.session.userId = req.params.id;
    res.redirect('/dashboard');
});

app.post('/admin/toggle-user/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        user.isActive = !user.isActive;
        await user.save();
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('حدث خطأ');
    }
});

app.post('/admin/delete-user/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        if (user.role === 'admin') return res.status(403).send('لا يمكن حذف الأدمن');
        await MessageLog.deleteMany({ userId: user._id });
        const campaigns = await Campaign.find({ userId: user._id }).select('_id');
        await CampaignRecipient.deleteMany({ userId: user._id });
        await Campaign.deleteMany({ userId: user._id });
        if (campaigns.length) {
            campaigns.forEach(campaign => countdownTimers.delete(campaign._id.toString()));
        }
        await User.findByIdAndDelete(req.params.id);
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('حدث خطأ');
    }
});

app.post('/admin/settings', requireAdmin, async (req, res) => {
    const { supportPhone, freeTrialDays } = req.body;

    const settings = await getSettings();
    settings.supportPhone = supportPhone;
    settings.freeTrialDays = freeTrialDays;
    await settings.save();
    res.redirect('/admin');
});

app.post('/admin/change-password', requireAdmin, async (req, res) => {
    const { newPassword } = req.body;
    const admin = await User.findById(req.session.userId);
    admin.password = newPassword;
    await admin.save();
    res.redirect('/admin');
});

app.post('/admin/change-phone/:id', requireAdmin, async (req, res) => {
    try {
        const { phone } = req.body;
        if (!phone || phone.trim() === '') return res.status(400).send('يرجى إدخال رقم الجوال');
        const cleanPhone = phone.replace(/\D/g, '');
        if (cleanPhone.length < 9 || cleanPhone.length > 15) return res.status(400).send('رقم الجوال غير صحيح');
        const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: req.params.id } });
        if (existing) return res.status(400).send('رقم الجوال مستخدم من قبل مستخدم آخر');
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        user.phone = cleanPhone;
        await user.save();
        res.redirect('/admin');
    } catch (e) {
        res.status(400).send('حدث خطأ: ' + e.message);
    }
});

app.post('/api/change-phone', requireAuth, async (req, res) => {
    try {
        const { newPhone } = req.body;
        if (!newPhone) return res.status(400).json({ success: false, error: 'يرجى إدخال رقم الجوال الجديد' });
        const cleanPhone = newPhone.replace(/\D/g, '');

        const validPrefixes = ['966', '971', '965', '973', '974', '968', '967', '20', '962', '963', '964', '961', '212', '216', '213'];
        const startsWithValidPrefix = validPrefixes.some(p => cleanPhone.startsWith(p));
        if (!startsWithValidPrefix) {
            return res.status(400).json({ success: false, error: 'الرقم يجب أن يكون بالصيغة الدولية مثل 9665xxxxxxxx (مع رمز الدولة)' });
        }
        if (cleanPhone.length < 9 || cleanPhone.length > 15) {
            return res.status(400).json({ success: false, error: 'رقم الجوال غير صحيح. تأكد من الصيغة الدولية' });
        }

        const existing = await User.findOne({ phone: cleanPhone, _id: { $ne: req.session.userId } });
        if (existing) return res.status(400).json({ success: false, error: 'رقم الجوال مستخدم من قبل مستخدم آخر' });

        const user = await User.findById(req.session.userId);
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const otpExp = new Date();
        otpExp.setMinutes(otpExp.getMinutes() + 10);

        user.pendingPhone = cleanPhone;
        user.phoneOtpCode = otp;
        user.phoneOtpExpires = otpExp;
        await user.save();

        await sendSystemOTP(cleanPhone, `رمز تغيير رقم الجوال هو: *${otp}*\n(صالح لمدة 10 دقائق)`);
        res.json({ success: true, message: 'تم إرسال رمز التحقق إلى الرقم الجديد' });
    } catch (e) {
        console.error('❌ خطأ في طلب تغيير الجوال:', e.message);
        res.status(500).json({ success: false, error: e.message || 'حدث خطأ' });
    }
});

app.post('/api/verify-phone-change', requireAuth, async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ success: false, error: 'يرجى إدخال رمز التحقق' });

        const user = await User.findById(req.session.userId);
        if (!user || !user.pendingPhone) return res.status(400).json({ success: false, error: 'لا يوجد طلب تغيير رقم معلق' });
        if (user.phoneOtpCode !== otp || new Date() > user.phoneOtpExpires) return res.status(400).json({ success: false, error: 'الرمز غير صحيح أو منتهي الصلاحية' });

        user.phone = user.pendingPhone;
        user.pendingPhone = null;
        user.phoneOtpCode = null;
        user.phoneOtpExpires = null;
        await user.save();

        res.json({ success: true, message: 'تم تغيير رقم الجوال بنجاح' });
    } catch (e) {
        console.error('❌ خطأ في تأكيد تغيير الجوال:', e.message);
        res.status(500).json({ success: false, error: e.message || 'حدث خطأ' });
    }
});

app.get('/admin/logs/:id', requireAdmin, async (req, res) => {
    const user = await User.findById(req.params.id);
    let query = { userId: user._id };
    if (req.query.dateFrom && req.query.dateTo) {
        const endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: new Date(req.query.dateFrom), $lte: endDate };
    }
    const logs = await MessageLog.find(query).sort({ createdAt: -1 }).limit(200);
    res.render('logs', { user, logs, isAdminView: true, query: req.query });
});

app.get('/logs', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    if (user.role === 'admin') return res.redirect('/admin');
    let query = { userId: user._id };
    if (req.query.dateFrom && req.query.dateTo) {
        const endDate = new Date(req.query.dateTo);
        endDate.setHours(23, 59, 59, 999);
        query.createdAt = { $gte: new Date(req.query.dateFrom), $lte: endDate };
    }
    const logs = await MessageLog.find(query).sort({ createdAt: -1 }).limit(100);
    res.render('logs', { user, logs, isAdminView: false, query: req.query });
});

app.post('/logs/delete', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    let targetId = user._id;
    if (user.role === 'admin' && req.body.targetUserId) targetId = req.body.targetUserId;
    await MessageLog.deleteMany({ userId: targetId });
    res.redirect('back');
});

// 🔄 إعادة إرسال رسائل من الأرشيف (واحدة أو دفعة، مع إمكانية تعديل الرقم/النص)
app.post('/logs/resend', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user) return res.status(401).json({ success: false, error: 'غير مصرح' });

        // الصلاحية: تأكد أن المستخدم يستطيع الإرسال (اشتراك فعّال... إلخ)
        const sendState = await getUserCanSendState(user);
        if (!sendState.allowed) {
            return res.status(403).json({ success: false, error: sendState.error });
        }

        // ✅ انتظار جلسة جاهزة (إعادة الاتصال تلقائياً إن لزم)
        let sock = await waitForReadySession(user._id.toString(), io, 15000);
        if (!sock) {
            return res.status(503).json({ success: false, error: 'الواتساب غير متصل أو في طور إعادة الاتصال. حاول بعد قليل أو افتح لوحة التحكم لربط الرقم.' });
        }

        // استلام المدخلات: items = [{ logId, to, body }, ...]
        let items = req.body.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (_) { items = null; }
        }
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ success: false, error: 'لم يتم تحديد أي رسائل لإعادة الإرسال' });
        }
        if (items.length > 50) {
            return res.status(400).json({ success: false, error: 'الحد الأقصى 50 رسالة في المرة الواحدة' });
        }

        // إرسال متسلسل بدون تأخير (إعادة إرسال يدوية)
        const results = [];
        for (const item of items) {
            const normalizedTo = normalizePhoneNumber(item.to);
            const body = (item.body || '').toString().trim();

            if (!normalizedTo || normalizedTo.length < 10) {
                results.push({ logId: item.logId, to: item.to, success: false, error: 'رقم غير صالح' });
                continue;
            }
            if (!body) {
                results.push({ logId: item.logId, to: normalizedTo, success: false, error: 'نص الرسالة فارغ' });
                continue;
            }

            const jid = normalizedTo + '@s.whatsapp.net';
            let lastErr = null;
            let sentOk = false;
            const MAX_RESEND_ATTEMPTS = 3;
            for (let attempt = 1; attempt <= MAX_RESEND_ATTEMPTS; attempt++) {
                try {
                    let currentSock = getSession(user._id.toString());
                    if (!currentSock || !currentSock.user) {
                        currentSock = await waitForReadySession(user._id.toString(), io, 10000);
                        if (!currentSock) throw new Error('انقطع الاتصال بالواتساب');
                    }
                    await currentSock.sendMessage(jid, { text: body });
                    sentOk = true;
                    break;
                } catch (err) {
                    lastErr = err;
                    const msg = String(err && err.message ? err.message : '').toLowerCase();
                    const permanent = msg.includes('not authorized') || msg.includes('not-authorized') || msg.includes('forbidden');
                    if (permanent || attempt >= MAX_RESEND_ATTEMPTS) break;
                    await sleep(2000 + attempt * 1500); // 3.5s, 5s
                }
            }

            if (sentOk) {
                await MessageLog.create({
                    userId: user._id,
                    to: normalizedTo,
                    body: body,
                    status: 'success'
                });
                results.push({ logId: item.logId, to: normalizedTo, success: true });
            } else {
                const errMsg = lastErr && lastErr.message ? lastErr.message : 'خطأ غير معروف';
                await MessageLog.create({
                    userId: user._id,
                    to: normalizedTo,
                    body: body,
                    status: 'failed',
                    errorDetails: errMsg
                });
                results.push({ logId: item.logId, to: normalizedTo, success: false, error: errMsg });
            }
        }

        const successCount = results.filter(r => r.success).length;
        const failedCount = results.length - successCount;
        return res.json({
            success: true,
            total: results.length,
            successCount,
            failedCount,
            results
        });
    } catch (e) {
        return res.status(500).json({ success: false, error: e.message || 'خطأ داخلي' });
    }
});

app.get('/api/campaigns', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const campaigns = await Campaign.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20).lean();
    res.json({ success: true, campaigns: campaigns.map(c => ({ ...c, countdown: getCountdownData(c._id) })) });
});

app.post('/api/campaigns', requireAuth, upload.array('media', 10), async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (!user || user.role === 'admin') return res.status(403).json({ success: false, error: 'غير مسموح' });

        const sendState = await getUserCanSendState(user);
        if (!sendState.allowed) return res.status(403).json({ success: false, error: sendState.error });

        let numbers = req.body.numbers;
        if (typeof numbers === 'string' && numbers.trim().startsWith('[')) numbers = safeJsonParse(numbers, []);
        const normalization = normalizeNumbersDetailed(numbers);
        const normalizedNumbers = normalization.numbers;
        const body = (req.body.message || req.body.body || '').trim();
        const media = extractMediaFromRequest(req, true);

        if (normalizedNumbers.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'لم يتم العثور على أرقام سعودية صحيحة. يجب أن تكون الأرقام بصيغة 9665XXXXXXXX أو قابلة للتحويل من 05XXXXXXXX / 009665XXXXXXXX.'
            });
        }
        if (normalization.invalidNumbers.length > 0) {
            return res.status(400).json({
                success: false,
                error: `يوجد ${normalization.invalidNumbers.length} رقم غير صالح. يجب أن تكون جميع الأرقام 12 خانة وتبدأ بـ 9665.`,
                invalidNumbers: normalization.invalidNumbers.slice(0, 20)
            });
        }
        if (!body && media.length === 0) return res.status(400).json({ success: false, error: 'اكتب رسالة أو أضف مرفقاً' });

        const useTimeWindow = req.body.useTimeWindow === true || req.body.useTimeWindow === 'true' || req.body.useTimeWindow === 'on' || req.body.useTimeWindow === 1 || req.body.useTimeWindow === '1';
        const windowStart = useTimeWindow ? req.body.windowStart : null;
        const windowEnd = useTimeWindow ? req.body.windowEnd : null;
        if (useTimeWindow && (!parseTimeString(windowStart) || !parseTimeString(windowEnd))) {
            return res.status(400).json({ success: false, error: 'النافذة الزمنية غير صحيحة' });
        }

        // ⏰ الإرسال المجدول: قبول تاريخ/وقت مستقبلي لجدولة الحملة
        let scheduledAt = null;
        if (req.body.scheduledAt) {
            scheduledAt = new Date(req.body.scheduledAt);
            if (isNaN(scheduledAt.getTime())) {
                return res.status(400).json({ success: false, error: 'تاريخ الجدولة غير صالح' });
            }
            if (scheduledAt.getTime() <= Date.now()) {
                return res.status(400).json({ success: false, error: 'يرجى اختيار وقت مستقبلي للجدولة' });
            }
        }

        const existingCampaign = await Campaign.findOne({
            userId: user._id,
            status: { $in: ['pending', 'processing', 'paused', 'waiting_window', 'scheduled'] }
        }).sort({ createdAt: -1 });
        if (existingCampaign) {
            return res.status(409).json({
                success: false,
                error: 'لديك حملة مفتوحة حالياً. أكملها أو ألغها قبل إنشاء حملة جديدة.',
                campaignId: existingCampaign._id
            });
        }

        const sock = getSession(user._id.toString());
        if (!scheduledAt && (!sock || !sock.user)) {
            return res.status(503).json({ success: false, error: 'الواتساب غير متصل. افتح لوحة التحكم لربط الرقم أولاً.' });
        }

        const campaign = await Campaign.create({
            userId: user._id,
            body,
            media,
            totalNumbers: normalizedNumbers.length,
            useTimeWindow,
            windowStart: useTimeWindow ? windowStart : null,
            windowEnd: useTimeWindow ? windowEnd : null,
            scheduledAt,
            status: scheduledAt ? 'scheduled' : 'pending',
            controlStatus: 'active'
        });

        await CampaignRecipient.insertMany(normalizedNumbers.map(phoneNumber => ({
            campaignId: campaign._id,
            userId: user._id,
            phoneNumber,
            status: 'pending',
            retryCount: 0
        })));

        if (scheduledAt) {
            res.status(201).json({ success: true, campaignId: campaign._id, scheduledAt: scheduledAt.toISOString(), message: 'تمت جدولة الحملة بنجاح ⏰ وسيتم الإرسال تلقائياً في الوقت المحدد' });
            return;
        }

        startCampaignWorker(campaign._id).catch(err => console.error('خطأ تشغيل الحملة:', err));

        res.status(201).json({ success: true, campaignId: campaign._id, message: 'تم إنشاء الحملة وبدء معالجتها' });
    } catch (error) {
        console.error('❌ خطأ إنشاء الحملة:', error);
        res.status(500).json({ success: false, error: error.message || 'فشل إنشاء الحملة' });
    }
});

app.get('/api/campaigns/:id', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const campaign = await getOwnedCampaign(user._id, req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'الحملة غير موجودة' });

    const recipients = await CampaignRecipient.find({ campaignId: campaign._id }).sort({ createdAt: 1, _id: 1 }).lean();
    res.json({
        success: true,
        campaign: {
            ...campaign.toObject(),
            countdown: getCountdownData(campaign._id),
            recipients
        }
    });
});

app.post('/api/campaigns/:id/pause', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const campaign = await getOwnedCampaign(user._id, req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'الحملة غير موجودة' });
    if (['completed', 'failed', 'cancelled'].includes(campaign.status)) {
        return res.status(400).json({ success: false, error: 'لا يمكن إيقاف حملة منتهية' });
    }

    campaign.controlStatus = 'paused';
    campaign.status = 'paused';
    await campaign.save();
    countdownTimers.delete(campaign._id.toString());
    await emitCampaignUpdate(campaign._id, false);
    res.json({ success: true });
});

app.post('/api/campaigns/:id/resume', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const campaign = await getOwnedCampaign(user._id, req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'الحملة غير موجودة' });
    if (['completed', 'failed', 'cancelled'].includes(campaign.status)) {
        return res.status(400).json({ success: false, error: 'لا يمكن استئناف حملة منتهية' });
    }

    const sendState = await getUserCanSendState(user);
    if (!sendState.allowed) return res.status(403).json({ success: false, error: sendState.error });

    const sock = getSession(user._id.toString());
    if (!sock || !sock.user) {
        return res.status(503).json({ success: false, error: 'الواتساب غير متصل حالياً' });
    }

    campaign.controlStatus = 'active';
    campaign.status = 'processing';
    await campaign.save();
    countdownTimers.delete(campaign._id.toString());
    startCampaignWorker(campaign._id).catch(err => console.error('خطأ استئناف الحملة:', err));
    res.json({ success: true });
});

app.post('/api/campaigns/:id/cancel', requireAuth, async (req, res) => {
    const user = await User.findById(req.session.userId);
    const campaign = await getOwnedCampaign(user._id, req.params.id);
    if (!campaign) return res.status(404).json({ success: false, error: 'الحملة غير موجودة' });
    if (['completed', 'failed', 'cancelled'].includes(campaign.status)) {
        return res.status(400).json({ success: false, error: 'الحملة منتهية بالفعل' });
    }

    campaign.controlStatus = 'cancelled';
    campaign.status = 'cancelled';
    campaign.completedAt = new Date();
    await campaign.save();
    countdownTimers.delete(campaign._id.toString());
    await emitCampaignUpdate(campaign._id, false);
    io.to(campaign.userId.toString()).emit('campaign-completed', {
        campaignId: campaign._id.toString(),
        status: 'cancelled',
        sentCount: campaign.sentCount,
        failedCount: campaign.failedCount,
        totalNumbers: campaign.totalNumbers
    });
    res.json({ success: true });
});

app.post(['/api/v1/send', '/api/send-message'], upload.array('media', 10), async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ error: 'Missing token' });
    const token = authHeader.split(' ')[1];
    const user = await User.findOne({ apiToken: token, isActive: true });
    if (!user) return res.status(401).json({ error: 'Invalid token' });

    const sendState = await getUserCanSendState(user);
    if (!sendState.allowed) {
        return res.status(403).json({ success: false, error: sendState.error });
    }

    // ✅ انتظار جلسة جاهزة بدلاً من الرفض الفوري
    let sock = await waitForReadySession(user._id.toString(), io, 15000);
    if (!sock) {
        return res.status(503).json({ error: 'الواتساب غير متصل أو في طور إعادة الاتصال. حاول بعد قليل أو افتح لوحة التحكم لربط الرقم.' });
    }

    const to = req.body.to;
    const body = req.body.message || req.body.body;
    const bodyMedia = extractMediaFromRequest(req, false);
    if (!to || (!body && bodyMedia.length === 0)) return res.status(400).json({ error: 'Missing Data' });

    let parsedTo = to;
    try {
        if (typeof to === 'string' && to.startsWith('[')) parsedTo = JSON.parse(to);
    } catch (_) {}
    const normalization = normalizeNumbersDetailed(Array.isArray(parsedTo) ? parsedTo : [parsedTo]);
    const numbers = normalization.numbers;
    if (numbers.length === 0) return res.status(400).json({ error: 'لم يتم العثور على أرقام صحيحة. يجب أن تكون بصيغة 9665XXXXXXXX أو قابلة للتحويل من 05XXXXXXXX / 009665XXXXXXXX' });
    if (normalization.invalidNumbers.length > 0) {
        return res.status(400).json({
            error: `يوجد ${normalization.invalidNumbers.length} رقم غير صالح. يجب أن تكون جميع الأرقام 12 خانة وتبدأ بـ 9665.`,
            invalidNumbers: normalization.invalidNumbers.slice(0, 20)
        });
    }

    res.json({ success: true, message: 'تم استلام طلب الإرسال وسيتم المعالجة فوراً.' });

    (async () => {
        for (const num of numbers) {
            try {
                let currentSock = getSession(user._id.toString());
                if (!currentSock || !currentSock.user) throw new Error('الواتساب غير متصل');

                const jid = `${num}@s.whatsapp.net`;
                const wpCheck = await currentSock.onWhatsApp(jid);
                if (!wpCheck || wpCheck.length === 0 || !wpCheck[0].exists) throw new Error('الرقم غير مسجل بالواتساب');

                let sent = false;
                const MAX_API_ATTEMPTS = 5;
                for (let attempt = 1; attempt <= MAX_API_ATTEMPTS; attempt++) {
                    try {
                        await sendWhatsAppMessage(currentSock, jid, body, bodyMedia);
                        sent = true;
                        break;
                    } catch (retryErr) {
                        console.error('⚠️ محاولة ' + attempt + '/' + MAX_API_ATTEMPTS + ' فشلت لـ ' + num + ': ' + retryErr.message);
                        // لو الخطأ غير قابل للإعادة (مثل رقم غير صالح)، اخرج فوراً
                        const msg = String(retryErr.message || '').toLowerCase();
                        const isPermanent = msg.includes('not authorized') || msg.includes('not-authorized') || msg.includes('forbidden');
                        if (isPermanent || attempt >= MAX_API_ATTEMPTS) throw retryErr;

                        // backoff تصاعدي: 3, 6, 10, 15 ثانية
                        const waitTime = Math.min(3000 + (attempt - 1) * 3000, 15000);
                        await sleep(waitTime);

                        // ✅ انتظار جلسة جاهزة (مع إعادة بدء إن لزم) بدل الرمي الفوري
                        currentSock = await waitForReadySession(user._id.toString(), io, 12000);
                        if (!currentSock) throw new Error('الواتساب انقطع ولم يعد للاتصال');
                    }
                }

                if (sent) {
                    if (io) io.to(user._id.toString()).emit('message-sent', { to: num, body: body || '(مرفق)' });
                    await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'success' });
                }
            } catch (e) {
                if (io) io.to(user._id.toString()).emit('error', `خطأ مع ${num}: ${e.message}`);
                await MessageLog.create({ userId: user._id, to: num, body: body || '(مرفق)', status: 'failed', errorDetails: e.message });
            }
            await sleep(bodyMedia.length > 0 ? 4000 : 2000);
        }
    })();
});

// =====================================================================
// 💳 الدفع الإلكتروني — ماي فاتورة (MyFatoorah) + تجديد الاشتراك التلقائي
// =====================================================================

// 🆓 توكن تجريبي عام توفره ماي فاتورة للجميع (يعمل في بيئة apitest فقط)
// المرجع: docs.myfatoorah.com/docs/api-key — قسم Test (Demo) Token
const MYFATOORAH_PUBLIC_TEST_TOKEN = 'SK_KWT_vVZlnnAqu8jRByOWaRPNId4ShzEDNt256dvnjebuyzo52dXjAfRx2ixW5umjWSUx';

function getMyFatoorahConfig(settings) {
    const mode = settings.myfatoorahMode === 'live' ? 'live' : 'test';

    // 🧪 الوضع التجريبي: يستخدم دائماً التوكن التجريبي العام.
    // توكنات الإنتاج (الحقيقية) لا تعمل أبداً في بيئة الاختبار — لذلك نتجاهلها في هذا الوضع
    // حتى لو خزنها المشرف في الإعدادات (سبب خطأ "An error has occurred.").
    if (mode === 'test') {
        return { token: MYFATOORAH_PUBLIC_TEST_TOKEN, mode, baseUrl: 'https://apitest.myfatoorah.com' };
    }

    // 🔴 الوضع الحقيقي: التوكن من متغير البيئة أو من إعدادات الإدارة
    const token = (process.env.MYFATOORAH_TOKEN || settings.myfatoorahToken || '').trim();
    return { token, mode, baseUrl: 'https://api-sa.myfatoorah.com' };
}

// ترجمة رسائل أخطاء ماي فاتورة الشائعة لرسائل واضحة بالعربية
function translateMyFatoorahError(msg) {
    if (!msg) return '';
    const m = String(msg);
    if (/invalid login token|unauthorized|authentication/i.test(m)) return 'رمز API غير صالح للبيئة المحددة — تأكد من استخدام التوكن الصحيح (تجريبي/حقيقي)';
    if (/required permissions/i.test(m)) return 'التوكن لا يملك صلاحيات الدفع المطلوبة — فعّلها من لوحة ماي فاتورة ثم أعد المحاولة';
    if (/error has occurred/i.test(m)) return 'خطأ من بوابة الدفع — يُستخدم توكن التجربة تلقائياً في الوضع التجريبي، وتوكنك الحقيقي يعمل فقط في الوضع الحقيقي';
    return m;
}

async function myfatoorahRequest(path, body, token) {
    const config = getMyFatoorahConfig(await getSettings());
    if (!token) token = config.token;
    const res = await fetch(config.baseUrl + path, {
        method: 'POST',
        headers: {
            'Authorization': 'Bearer ' + token,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    // ماي فاتورة قد يرجع HTTP 200 مع IsSuccess=false — نعالج الحالتين
    if (!res.ok || data.IsSuccess === false) {
        const msg = translateMyFatoorahError(data && data.Message);
        throw new Error(msg || ('خطأ في بوابة الدفع (HTTP ' + res.status + ')'));
    }
    return data;
}

// تطبيع رقم الجوال لتنسيق ماي فاتورة: بدون رمز الدولة، بحد أقصى 11 خانة
// (مثال: 966500000000 أو 0500000000 ← 500000000)
function normalizeMobileForMyFatoorah(mobile) {
    let m = String(mobile || '').replace(/[^\d]/g, '');
    if (m.startsWith('966')) m = m.slice(3);
    if (m.startsWith('0')) m = m.slice(1);
    m = m.slice(0, 11);
    return m || '50000000';
}

// جلب وسائل الدفع الفعلية من البوابة (v3) — التوكن العام للتجربة لا يملك صلاحيتها،
// فعند فشل الجلب نستخدم فيزا/ماستر (2) كخيار افتراضي يعمل مع التوكن التجريبي.
async function getMyFatoorahPaymentMethods(token, baseUrl) {
    try {
        const res = await fetch(baseUrl + '/v3/payment-methods', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' }
        });
        const data = await res.json();
        const list = data.data || data.Data || data.result || data.Result;
        if (Array.isArray(list) && list.length) {
            const name = m => String(m.paymentMethodEn || m.PaymentMethodEn || m.paymentMethodAr || m.PaymentMethodAr || '').toLowerCase();
            // نفضّل وسيلة بطاقة (فيزا/ماستر/مدى/أبل باي/إس تي سي) وإلا أول وسيلة متاحة
            const preferred = list.find(m => /visa|master|mada|apple|stc|card/i.test(name(m))) || list[0];
            const id = preferred.paymentMethodId ?? preferred.PaymentMethodId;
            if (id !== undefined && id !== null) return Number(id);
        }
    } catch (e) { /* تجاهل — سنستخدم الخيار الافتراضي */ }
    return null;
}


function reqBaseHost() {
    return 'http://127.0.0.1:' + (process.env.PORT || 3000);
}

// إنشاء فاتورة دفع لدى ماي فاتورة وإرجاع رابط الدفع
async function createMyFatoorahInvoice(user, settings, payment) {
    const config = getMyFatoorahConfig(settings);
    if (!config.token) throw new Error('لم تُدخل التوكن الحقيقي بعد — افتح إعدادات الدفع في لوحة الإدارة وأدخل التوكن وبدّل الوضع إلى حقيقي');

    const host = (process.env.PUBLIC_BASE_URL || reqBaseHost()).replace(/\/$/, '');
    const callbackUrl = host + '/api/payments/callback?userId=' + user._id + '&ref=' + payment._id;
    const errorUrl = host + '/api/payments/callback?userId=' + user._id + '&ref=' + payment._id + '&error=1';

    // اختيار وسيلة الدفع: من قائمة البوابة الفعلية إن أمكن، وإلا فيزا/ماستر (2) — يعمل مع التوكن التجريبي
    const methodsId = await getMyFatoorahPaymentMethods(config.token, config.baseUrl);
    const paymentMethodId = methodsId !== null ? methodsId : 2;

    const data = await myfatoorahRequest('/v2/ExecutePayment', {
        CustomerName: user.username || 'عميل',
        InvoiceValue: settings.planPrice,
        DisplayCurrencyIso: 'SAR',
        CallbackUrl: callbackUrl,
        ErrorUrl: errorUrl,
        CustomerEmail: user.email || 'noreply@example.com',
        CustomerMobile: normalizeMobileForMyFatoorah(user.phoneNumber),
        MobileCountryCode: '+966',
        Language: 'ar',
        PaymentMethodId: paymentMethodId
    }, config.token);

    if (!data.Data || !data.Data.PaymentURL) throw new Error('لم يتم استلام رابط الدفع من البوابة');

    payment.myfatoorahPaymentId = data.Data.PaymentId || null;
    payment.myfatoorahInvoiceId = data.Data.InvoiceId || null;
    await payment.save();

    return data.Data.PaymentURL;
}

// الاستعلام عن حالة دفع لدى ماي فاتورة
// يستخدم PaymentId إن وُجد، وإلا يتحول إلى InvoiceId (الموجود دائماً في الرد)
// الحالة عند النجاح قد تأتي في TransactionStatus مباشرة أو داخل InvoiceTransactions[0]
async function getMyFatoorahPaymentStatus(payment, token) {
    const key = payment.myfatoorahPaymentId || payment.myfatoorahInvoiceId;
    if (!key) throw new Error('لا يوجد معرّف دفع للاستعلام عنه');
    const data = await myfatoorahRequest('/v2/GetPaymentStatus', {
        KeyType: payment.myfatoorahPaymentId ? 'PaymentId' : 'InvoiceId',
        Key: key
    }, token);
    const d = data.Data || {};
    const tx = (Array.isArray(d.InvoiceTransactions) && d.InvoiceTransactions.length) ? d.InvoiceTransactions[0] : {};
    return {
        InvoiceId: d.InvoiceId || null,
        InvoiceStatus: d.InvoiceStatus || null,
        TransactionStatus: d.TransactionStatus || tx.TransactionStatus || null,
        PaymentId: d.PaymentId || tx.PaymentId || null,
        TransactionId: d.TransactionId || tx.TransactionId || null,
        PaymentMethod: d.PaymentMethod || tx.PaymentMethod || null
    };
}

// هل عملية الدفع ناجحة؟ (بيئة الاختبار ترجع Succss بخطأ إملائي معروف في نظامهم)
function isMyFatoorahSuccess(status) {
    return status.TransactionStatus === 'Success' || status.TransactionStatus === 'Succss';
}

// تمديد اشتراك المستخدم بعد الدفع الناجح
async function extendSubscriptionAfterPayment(user, payment) {
    const settings = await getSettings();
    const now = new Date();
    let base = user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) > now
        ? new Date(user.subscriptionEndsAt)
        : now;
    base.setDate(base.getDate() + (payment.planDays || settings.planDays || 30));
    user.subscriptionEndsAt = base;
    user.isActive = true;
    await user.save();
    payment.status = 'paid';
    await payment.save();
    return base;
}

// ✅ صفحة الاشتراك والدفع
app.get('/subscribe', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.role === 'admin') return res.redirect('/admin');
        const settings = await getSettings();
        const payments = await Payment.find({ userId: user._id }).sort({ createdAt: -1 }).limit(10).lean();

        let daysRemaining = 0, isExpired = true, expDateFormatted = 'غير محدد';
        if (user.subscriptionEndsAt) {
            const d = new Date(user.subscriptionEndsAt);
            expDateFormatted = d.toISOString().split('T')[0];
            daysRemaining = Math.ceil((d - new Date()) / 86400000);
            if (daysRemaining > 0) isExpired = false; else daysRemaining = 0;
        }

        res.render('subscribe', {
            user, settings, payments,
            daysRemaining, isExpired, expDateFormatted,
            result: req.query.result || null,
            msg: req.query.msg || ''
        });
    } catch (e) {
        res.status(500).render('error', { code: 500, title: 'خطأ', message: e.message });
    }
});

// ✅ إنشاء عملية دفع جديدة
app.post('/api/payments/create', requireAuth, async (req, res) => {
    try {
        const user = await User.findById(req.session.userId);
        if (user.role === 'admin') return res.status(403).json({ success: false, error: 'غير مسموح' });
        const settings = await getSettings();
        if (!settings.paymentsEnabled) {
            return res.status(403).json({ success: false, error: 'الدفع الإلكتروني غير مفعل بعد' });
        }

        // إلغاء أي عمليات معلقة سابقة للمستخدم
        await Payment.updateMany(
            { userId: user._id, status: 'pending' },
            { $set: { status: 'cancelled' } }
        );

        const payment = await Payment.create({
            userId: user._id,
            amount: settings.planPrice,
            currency: 'SAR',
            planDays: settings.planDays,
            status: 'pending'
        });

        const paymentUrl = await createMyFatoorahInvoice(user, settings, payment);
        res.json({ success: true, paymentUrl });
    } catch (e) {
        console.error('❌ خطأ إنشاء دفع:', e.message);
        res.status(500).json({ success: false, error: e.message || 'فشل إنشاء الدفع' });
    }
});

// ✅ إشعار البوابة (Webhook) — يجدد الاشتراك تلقائياً
app.post('/api/payments/webhook', async (req, res) => {
    try {
        const body = req.body || {};
        const data = body.Data || {};
        const paymentId = body.PaymentId || data.PaymentId || null;
        const invoiceId = body.InvoiceId || data.InvoiceId || null;
        if (!paymentId && !invoiceId) return res.status(400).json({ success: false, error: 'missing payment id' });

        const settings = await getSettings();
        const config = getMyFatoorahConfig(settings);
        if (!config.token) return res.status(400).json({ success: false, error: 'payment not configured' });

        // البحث عن العملية بالـ PaymentId أو بالـ InvoiceId (أيهما ورد في الإشعار)
        const payment = await Payment.findOne({
            $or: [
                ...(paymentId ? [{ myfatoorahPaymentId: paymentId }] : []),
                ...(invoiceId ? [{ myfatoorahInvoiceId: invoiceId }] : [])
            ]
        });
        if (!payment) return res.status(404).json({ success: false, error: 'payment not found' });
        if (payment.status === 'paid') return res.json({ success: true, alreadyProcessed: true });

        // تأكيد الحالة من البوابة مباشرة (أمان — لا نثق بالإشعار وحده)
        const status = await getMyFatoorahPaymentStatus(payment, config.token);

        if (isMyFatoorahSuccess(status)) {
            const user = await User.findById(payment.userId);
            if (user) {
                if (!payment.myfatoorahPaymentId && status.PaymentId) payment.myfatoorahPaymentId = status.PaymentId;
                payment.paymentMethod = status.PaymentMethod || null;
                payment.transactionId = status.TransactionId || null;
                await extendSubscriptionAfterPayment(user, payment);
                console.log('✅ [دفع] تم تجديد اشتراك ' + user.username + ' (' + payment.amount + ' ر.س)');
                if (io) io.to(payment.userId.toString()).emit('subscription-updated', { message: 'تم تجديد اشتراكك بنجاح 🎉' });
            }
        } else {
            payment.status = 'failed';
            payment.errorMessage = status.TransactionStatus || 'لم ينجح الدفع';
            await payment.save();
        }
        res.json({ success: true });
    } catch (e) {
        console.error('❌ خطأ Webhook دفع:', e.message);
        res.status(500).json({ success: false, error: e.message });
    }
});

// ✅ عودة المستخدم من صفحة الدفع
app.get('/api/payments/callback', requireAuth, async (req, res) => {
    try {
        const refId = req.query.ref;
        const paymentId = req.query.paymentId;
        const settings = await getSettings();
        let success = false, message = '';

        // نجد العملية إما بمعرّفنا الداخلي (ref) أو بالمعرّف الذي ترجعه البوابة (paymentId)
        let payment = null;
        if (refId) payment = await Payment.findOne({ _id: refId, userId: req.user._id });
        else if (paymentId) payment = await Payment.findOne({ myfatoorahPaymentId: paymentId, userId: req.user._id });

        if (payment) {
            const config = getMyFatoorahConfig(settings);
            try {
                const status = await getMyFatoorahPaymentStatus(payment, config.token);
                success = isMyFatoorahSuccess(status);
                if (success) {
                    message = 'تم الدفع بنجاح وتم تجديد اشتراكك 🎉';
                    if (payment.status !== 'paid') {
                        const user = await User.findById(payment.userId);
                        if (user) {
                            if (!payment.myfatoorahPaymentId && status.PaymentId) payment.myfatoorahPaymentId = status.PaymentId;
                            payment.paymentMethod = status.PaymentMethod || payment.paymentMethod;
                            payment.transactionId = status.TransactionId || payment.transactionId;
                            await extendSubscriptionAfterPayment(user, payment);
                            if (io) io.to(payment.userId.toString()).emit('subscription-updated', { message: 'تم تجديد اشتراكك بنجاح 🎉' });
                        }
                    }
                } else {
                    message = 'لم يتم تأكيد الدفع بعد — حاول مرة أخرى أو تواصل مع الدعم';
                }
            } catch (e) {
                message = 'تعذر التحقق من الدفع: ' + e.message;
            }
        } else {
            message = req.query.error ? 'تم إلغاء الدفع أو فشل — يمكنك المحاولة مرة أخرى' : 'لم نستلم تأكيد الدفع';
        }

        res.redirect('/subscribe?result=' + (success ? 'success' : 'error') + '&msg=' + encodeURIComponent(message));
    } catch (e) {
        res.redirect('/subscribe');
    }
});

// ✅ حفظ إعدادات الدفع من لوحة الإدارة
app.post('/admin/payments-settings', requireAdmin, async (req, res) => {
    try {
        const settings = await getSettings();
        settings.paymentsEnabled = req.body.paymentsEnabled === 'on' || req.body.paymentsEnabled === 'true';
        settings.myfatoorahMode = req.body.myfatoorahMode === 'live' ? 'live' : 'test';
        if (req.body.myfatoorahToken) settings.myfatoorahToken = req.body.myfatoorahToken.trim();
        settings.planPrice = Math.max(1, Number(req.body.planPrice) || 100);
        settings.planDays = Math.max(1, Number(req.body.planDays) || 30);
        settings.planName = (req.body.planName || 'الباقة الشهرية').toString().slice(0, 50);
        await settings.save();
        res.redirect('/admin#settings');
    } catch (e) {
        res.status(500).send('خطأ في حفظ الإعدادات: ' + e.message);
    }
});

app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => {
    const sessionUserId = socket.handshake.query.userId;
    if (sessionUserId) {
        socket.join(sessionUserId);

        const sock = getSession(sessionUserId);
        if (sock && sock.user) {
            socket.emit('ready', 'WhatsApp is connected');
        } else if (!sock) {
            startWhatsAppSession(sessionUserId, io).then(s => {
                if (s && s.user) socket.emit('ready', 'WhatsApp is connected');
            }).catch(err => console.error('❌ فشل بدء جلسة واتساب:', err.message));
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));

// ⏰ حلقة فحص الحملات المجدولة (كل 30 ثانية)
setInterval(() => {
    processScheduledCampaigns().catch(err => console.error('خطأ في حلقة الحملات المجدولة:', err));
}, SCHEDULED_CAMPAIGN_CHECK_MS);
