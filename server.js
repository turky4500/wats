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
const XLSX = require('xlsx');
const rateLimit = require('express-rate-limit');
const MongoStore = require('connect-mongo');
const User = require('./models/User');
const MessageLog = require('./models/MessageLog');
const Settings = require('./models/Settings');
const Campaign = require('./models/Campaign');
const CampaignRecipient = require('./models/CampaignRecipient');
const Group = require('./models/Group');
const { startWhatsAppSession, getSession, disconnectSession, requestPairingCode, waitForReadySession, isSessionReady } = require('./whatsappManager');

const app = express();
const server = http.createServer(app);

const io = socketIo(server, { maxHttpBufferSize: 5 * 1024 * 1024 });
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

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { error: 'تم حظرك مؤقتاً بسبب محاولات كثيرة. حاول بعد 15 دقيقة' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    message: { error: 'تم حظرك مؤقتاً. حاول بعد 10 دقائق' },
    standardHeaders: true,
    legacyHeaders: false,
});

const apiSendLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { error: 'تم تجاوز الحد المسموح. حاول بعد دقيقة' },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpAttempts = new Map();
const OTP_MAX_ATTEMPTS = 5;
const OTP_LOCKOUT_MS = 15 * 60 * 1000;

function checkOtpAttempts(identifier) {
    const data = otpAttempts.get(identifier);
    if (!data) return { blocked: false, attempts: 0 };
    if (Date.now() > data.lockedUntil) { otpAttempts.delete(identifier); return { blocked: false, attempts: 0 }; }
    return { blocked: true, attempts: data.attempts, remainingMs: data.lockedUntil - Date.now() };
}

function recordOtpAttempt(identifier) {
    const data = otpAttempts.get(identifier) || { attempts: 0, lockedUntil: 0 };
    data.attempts++;
    if (data.attempts >= OTP_MAX_ATTEMPTS) data.lockedUntil = Date.now() + OTP_LOCKOUT_MS;
    otpAttempts.set(identifier, data);
    return data;
}

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

function extractMediaFromRequest(req, persist = false) {
    let mediaArray = [];

    if (req.files && req.files.length > 0) {
        mediaArray = req.files.map(file => ({
            mimetype: file.mimetype,
            filename: decodeFileName(file.originalname),
            ...(persist ? { data: file.buffer.toString('base64') } : { buffer: file.buffer })
        }));
    } else if (req.body.media) {
        let bodyMedia = req.body.media;
        if (typeof bodyMedia === 'string') {
            bodyMedia = safeJsonParse(bodyMedia, []);
        }
        if (Array.isArray(bodyMedia)) {
            mediaArray = bodyMedia.map(item => ({
                mimetype: item.mimetype,
                filename: item.filename || 'file',
                data: item.data,
                ...(item.buffer ? { buffer: item.buffer } : {})
            }));
        }
    }

    return mediaArray.filter(item => item && item.mimetype && (item.buffer || item.data));
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

        await sendWhatsAppMessage(currentSock, jid, campaign.body, campaign.media || [], { name: recipient.recipientName || '' });

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

            const userDoc = await User.findById(campaign.userId).select('cautiousMode');
            if (userDoc && userDoc.cautiousMode) {
                const delayMs = 3 * 60 * 1000 + Math.floor(Math.random() * 12 * 60 * 1000);
                const delayMin = Math.floor(delayMs / 60000);
                console.log(`🛡️ إرسال حذر: انتظار ${delayMin} دقيقة قبل الرقم التالي`);
                io.to(campaign.userId.toString()).emit('cautious-delay', {
                    campaignId: campaign._id.toString(),
                    delayMin,
                    nextPhone: (await getNextCampaignRecipient(campaignId))?.phoneNumber || ''
                });
                const keepWaiting = await waitWithCampaignControl(campaignId, delayMs, 'cautious');
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
            }


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
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
        console.warn('⚠️ ADMIN_PASSWORD غير معرّف، لن يتم إنشاء حساب الأدمن تلقائياً');
        return;
    }
    const admin = await User.findOne({ username: adminUsername });
    if (!admin) {
        await User.create({ username: adminUsername, password: adminPassword, role: 'admin' });
        console.log('✅ تم إنشاء حساب الأدمن:', adminUsername);
    }
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
            else if (m.data) {
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

const MONGO_URI = process.env.MONGODB_URI;
if (!MONGO_URI) {
    console.error('❌ MONGODB_URI غير معرّف في ملف .env');
    process.exit(1);
}
mongoose.connect(MONGO_URI)
    .then(async () => {
        console.log('✅ متصل بقاعدة بيانات MongoDB');
        try {
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
            }, 12000);
        } catch (e) {
            console.error('خطأ:', e);
        }
    }).catch(err => console.error('❌ خطأ في الاتصال:', err));

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ limit: '5mb', extended: true }));
app.use(session({
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
        mongoUrl: MONGO_URI,
        ttl: 24 * 60 * 60,
        autoRemove: 'native'
    }),
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000
    }
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
app.post('/register', otpLimiter, async (req, res) => {
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
            apiToken: crypto.randomBytes(32).toString('hex'),
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

app.post('/verify', otpLimiter, async (req, res) => {
    try {
        const user = await User.findById(req.session.verifyUserId);
        if (!user) return res.redirect('/register');

        const lockCheck = checkOtpAttempts('verify_' + user._id);
        if (lockCheck.blocked) {
            const mins = Math.ceil(lockCheck.remainingMs / 60000);
            return res.render('verify', { error: `تم حظرك مؤقتاً. حاول بعد ${mins} دقيقة`, success: null });
        }

        if (user.otpCode !== req.body.otp || new Date() > user.otpExpires) {
            recordOtpAttempt('verify_' + user._id);
            return res.render('verify', { error: 'الرمز غير صحيح أو منتهي الصلاحية', success: null });
        }

        otpAttempts.delete('verify_' + user._id);
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

app.post('/resend-otp', otpLimiter, async (req, res) => {
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
app.post('/forgot-password', otpLimiter, async (req, res) => {
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

app.post('/reset-password', otpLimiter, async (req, res) => {
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
app.post('/login', loginLimiter, async (req, res) => {
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
    user.apiToken = crypto.randomBytes(32).toString('hex');
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
        status: { $in: ['pending', 'processing', 'paused', 'waiting_window'] }
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
        if (req.body.name !== undefined) contact.name = req.body.name;
        if (req.body.phone !== undefined) contact.phone = req.body.phone;
        await group.save();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});

function normalizePhoneServer(raw) {
    const clean = raw.replace(/\D/g, '');
    if (/^966\d{9,11}$/.test(clean)) return clean;
    if (/^971\d{8,10}$/.test(clean)) return clean;
    if (/^965\d{7,9}$/.test(clean)) return clean;
    if (/^973\d{7,9}$/.test(clean)) return clean;
    if (/^974\d{7,9}$/.test(clean)) return clean;
    if (/^968\d{7,9}$/.test(clean)) return clean;
    if (/^967\d{7,9}$/.test(clean)) return clean;
    if (/^20\d{9,10}$/.test(clean)) return clean;
    if (/^962\d{7,9}$/.test(clean)) return clean;
    if (/^963\d{7,9}$/.test(clean)) return clean;
    if (/^964\d{7,9}$/.test(clean)) return clean;
    if (/^961\d{6,8}$/.test(clean)) return clean;
    if (/^212\d{8,9}$/.test(clean)) return clean;
    if (/^216\d{7,9}$/.test(clean)) return clean;
    if (/^213\d{8,10}$/.test(clean)) return clean;
    if (/^5\d{8}$/.test(clean)) return '966' + clean;
    if (/^05\d{8}$/.test(clean)) return '966' + clean.substring(1);
    return null;
}

app.post('/api/groups/import-excel', requireAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ success: false, error: 'لم يتم رفع ملف' });
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
        if (rows.length === 0) return res.status(400).json({ success: false, error: 'الملف فارغ' });

        const contacts = [];
        let skipped = 0;
        for (const row of rows) {
            const phoneKey = Object.keys(row).find(k => /phone|جوال|رقم|mobile|number/i.test(k));
            const nameKey = Object.keys(row).find(k => /name|اسم|اسم العميل|customer/i.test(k));
            const rawPhone = String(row[phoneKey] || '');
            const name = nameKey ? String(row[nameKey] || '') : '';
            const normalized = normalizePhoneServer(rawPhone);
            if (normalized) {
                contacts.push({ name, phone: normalized });
            } else {
                skipped++;
            }
        }
        if (contacts.length === 0) return res.status(400).json({ success: false, error: 'لم يتم العثور على أرقام صحيحة في الملف' });
        let msg = 'تم استخراج ' + contacts.length + ' جهة اتصال';
        if (skipped > 0) msg += ' (تم تخطي ' + skipped + ' رقم غير صحيح)';
        res.json({ success: true, contacts, total: contacts.length, skipped });
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
        const apiToken = crypto.randomBytes(32).toString('hex');
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

app.post('/admin/cautious-toggle/:id', requireAdmin, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send('المستخدم غير موجود');
        user.cautiousMode = !user.cautiousMode;
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

app.post('/api/change-phone', requireAuth, otpLimiter, async (req, res) => {
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

app.post('/api/verify-phone-change', requireAuth, otpLimiter, async (req, res) => {
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

        const contactNames = {};
        if (Array.isArray(numbers)) {
            numbers.forEach(item => {
                if (item && typeof item === 'object' && item.phone) {
                    const normalized = normalizeSaudiPhoneNumber(item.phone);
                    if (normalized && item.name) contactNames[normalized] = item.name;
                }
            });
            numbers = numbers.map(item => (item && typeof item === 'object') ? item.phone : item);
        }

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

        const existingCampaign = await Campaign.findOne({
            userId: user._id,
            status: { $in: ['pending', 'processing', 'paused', 'waiting_window'] }
        }).sort({ createdAt: -1 });
        if (existingCampaign) {
            return res.status(409).json({
                success: false,
                error: 'لديك حملة مفتوحة حالياً. أكملها أو ألغها قبل إنشاء حملة جديدة.',
                campaignId: existingCampaign._id
            });
        }

        const sock = getSession(user._id.toString());
        if (!sock || !sock.user) {
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
            status: 'pending',
            controlStatus: 'active'
        });

        await CampaignRecipient.insertMany(normalizedNumbers.map(phoneNumber => ({
            campaignId: campaign._id,
            userId: user._id,
            phoneNumber,
            recipientName: contactNames[phoneNumber] || '',
            status: 'pending',
            retryCount: 0
        })));

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

app.post(['/api/v1/send', '/api/send-message'], apiSendLimiter, upload.array('media', 10), async (req, res) => {
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
            if (user && user.cautiousMode) {
                const delayMs = 3 * 60 * 1000 + Math.floor(Math.random() * 12 * 60 * 1000);
                const delayMin = Math.floor(delayMs / 60000);
                console.log(`🛡️ [API] إرسال حذر: انتظار ${delayMin} دقيقة قبل الرقم التالي`);
                await sleep(delayMs);
            } else {
                await sleep(bodyMedia.length > 0 ? 4000 : 2000);
            }
        }
    })();
});

app.get('/ping', (req, res) => res.send('pong'));

io.on('connection', (socket) => {
    const sessionUserId = socket.handshake.query.userId;
    if (!sessionUserId) { socket.disconnect(); return; }

    const isValid = sessionUserId === SYSTEM_ID || mongoose.Types.ObjectId.isValid(sessionUserId);
    if (!isValid) { socket.disconnect(); return; }

    socket.join(sessionUserId);

    const sock = getSession(sessionUserId);
    if (sock && sock.user) {
        socket.emit('ready', 'WhatsApp is connected');
    } else if (!sock) {
        startWhatsAppSession(sessionUserId, io).then(s => {
            if (s && s.user) socket.emit('ready', 'WhatsApp is connected');
        }).catch(err => console.error('❌ فشل بدء جلسة واتساب:', err.message));
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
