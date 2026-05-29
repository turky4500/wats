const User = require('../models/User');

// التحقق من تسجيل الدخول
const requireAuth = (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    next();
};

// التحقق من صلاحيات الأدمن
const requireAdmin = async (req, res, next) => {
    try {
        if (!req.session.userId) return res.redirect('/login');
        const user = await User.findById(req.session.userId);
        if (user && user.role === 'admin') return next();
        res.status(403).render('error', { 
            title: 'غير مصرح', 
            message: 'غير مصرح لك بالدخول لهذه الصفحة',
            code: 403 
        });
    } catch (e) {
        res.status(500).render('error', { 
            title: 'خطأ في الخادم', 
            message: 'حدث خطأ غير متوقع',
            code: 500 
        });
    }
};

module.exports = { requireAuth, requireAdmin };
