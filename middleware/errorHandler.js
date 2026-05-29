/**
 * معالج الأخطاء العام
 * يلتقط جميع الأخطاء غير المعالجة ويعرض صفحة خطأ مناسبة
 */

// معالجة الصفحات غير الموجودة (404)
const notFoundHandler = (req, res, next) => {
    res.status(404).render('error', {
        title: 'الصفحة غير موجودة',
        message: 'عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.',
        code: 404
    });
};

// معالجة الأخطاء العامة
const errorHandler = (err, req, res, next) => {
    console.error('❌ خطأ غير متوقع:', err.stack || err.message || err);

    const statusCode = err.statusCode || 500;
    
    // إذا كان طلب API يرجع JSON
    if (req.path.startsWith('/api/')) {
        return res.status(statusCode).json({
            success: false,
            error: statusCode === 500 ? 'حدث خطأ في الخادم' : err.message
        });
    }

    res.status(statusCode).render('error', {
        title: statusCode === 500 ? 'خطأ في الخادم' : 'خطأ',
        message: statusCode === 500 
            ? 'حدث خطأ غير متوقع في الخادم. يرجى المحاولة لاحقاً.' 
            : err.message,
        code: statusCode
    });
};

module.exports = { notFoundHandler, errorHandler };
