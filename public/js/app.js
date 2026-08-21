/* =====================================================================
   واتساب تكوين — سكربتات مشتركة
   ===================================================================== */
(function () {
    'use strict';

    // ===== Toast (إشعارات) =====
    function showToast(message, type = 'success') {
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            document.body.appendChild(container);
        }
        const toast = document.createElement('div');
        toast.className = 'toast ' + type;
        toast.innerHTML = (type === 'error' ? '❌ ' : '✅ ') + message;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity .3s';
            setTimeout(() => toast.remove(), 320);
        }, 4000);
    }

    // ===== الساعة الحية =====
    function startClock(elId) {
        const el = document.getElementById(elId);
        if (!el) return;
        const tick = () => {
            const now = new Date();
            el.innerText = now.toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
        };
        tick();
        setInterval(tick, 1000);
    }

    // ===== قائمة الجوال =====
    function toggleMobileSidebar() {
        const sidebar = document.querySelector('.sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.toggle('open');
        if (overlay) overlay.classList.toggle('active');
    }

    // ===== إضافة خاصية سمة نشطة للروابط حسب المسار =====
    function highlightActiveNav() {
        const path = window.location.pathname;
        document.querySelectorAll('.sidebar-nav a').forEach(a => {
            const href = a.getAttribute('href') || '';
            if (path === href || (href !== '/' && path.startsWith(href))) {
                a.classList.add('active');
            }
        });
    }

    // تعريض عام
    window.App = {
        showToast,
        startClock,
        toggleMobileSidebar,
        highlightActiveNav
    };

    document.addEventListener('DOMContentLoaded', () => {
        highlightActiveNav();
        // تغيير default لروابط بهياكل توست داخل الصفحة (اختياري)
    });
})();
