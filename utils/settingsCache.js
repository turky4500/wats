/**
 * نظام تخزين مؤقت للإعدادات
 * بدلاً من الذهاب لقاعدة البيانات في كل طلب
 */
const Settings = require('../models/Settings');

let cachedSettings = null;
let cacheTimestamp = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 دقائق

async function getSettings() {
    const now = Date.now();
    
    // إذا الكاش صالح، ارجع القيمة المخزنة
    if (cachedSettings && (now - cacheTimestamp) < CACHE_TTL) {
        return cachedSettings;
    }

    // جلب من قاعدة البيانات
    let settings = await Settings.findOne();
    if (!settings) settings = await Settings.create({});

    cachedSettings = settings;
    cacheTimestamp = now;
    
    return settings;
}

// مسح الكاش عند تحديث الإعدادات
function invalidateCache() {
    cachedSettings = null;
    cacheTimestamp = 0;
}

module.exports = { getSettings, invalidateCache };
