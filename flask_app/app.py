import os
import json
import time
import random
import threading
import logging
import hashlib
from datetime import datetime, timedelta
from functools import wraps

from flask import (
    Flask, render_template, request, redirect, url_for,
    flash, session, jsonify, send_from_directory, abort
)
from flask_sqlalchemy import SQLAlchemy
from flask_login import (
    LoginManager, UserMixin, login_user, logout_user,
    login_required, current_user
)
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename

import requests
import cloudscraper
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup

# ─────────────────────────── App Setup ───────────────────────────
app = Flask(__name__)
app.secret_key = os.environ.get("SECRET_KEY", "haraj-radar-secret-2024-xK9mP3qR")

# ─────────────────────────── Database ───────────────────────────
DATABASE_URL = os.environ.get("DATABASE_URL", "")
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

if DATABASE_URL:
    app.config["SQLALCHEMY_DATABASE_URI"] = DATABASE_URL
else:
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(basedir, 'haraj_radar.db')}"

app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["SQLALCHEMY_ENGINE_OPTIONS"] = {
    "pool_pre_ping": True,
    "pool_recycle": 300,
}

db = SQLAlchemy(app)

# ─────────────────────────── File Upload ───────────────────────────
IS_RENDER = os.environ.get("RENDER", "") != ""
if IS_RENDER:
    UPLOAD_FOLDER = "/tmp/uploads/renewal_proofs"
else:
    UPLOAD_FOLDER = os.path.join(os.path.dirname(__file__), "uploads", "renewal_proofs")

os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024 * 1024

ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "pdf"}

# ─────────────────────────── Subs folder ───────────────────────────
SUBS_FOLDER = "/tmp/subs" if IS_RENDER else os.path.join(os.path.dirname(__file__), "subs")
os.makedirs(SUBS_FOLDER, exist_ok=True)

LOGS_FOLDER = "/tmp/logs" if IS_RENDER else os.path.join(os.path.dirname(__file__), "logs")
os.makedirs(LOGS_FOLDER, exist_ok=True)

WHATSAPP_LOG_FILE = os.path.join(LOGS_FOLDER, "whatsapp_logs.json")

# ─────────────────────────── Flask-Login ───────────────────────────
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = "login"
login_manager.login_message = "يرجى تسجيل الدخول أولاً"

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─────────────────────────── Global State ───────────────────────────
monitor_threads = {}
seen_ids_lock = threading.Lock()
seen_data = {}

# ═══════════════════════════════════════════════════════════════════
#                         DATABASE MODELS
# ═══════════════════════════════════════════════════════════════════

class SystemSettings(db.Model):
    __tablename__ = "system_settings"
    id = db.Column(db.Integer, primary_key=True)
    whatsapp_token = db.Column(db.String(200), default="7a203d6ba6f4325ed3261ea87f6b2e751250ad97")
    trial_days = db.Column(db.Integer, default=2)
    bank_account_number = db.Column(db.String(100), default="")
    bank_account_name = db.Column(db.String(200), default="")
    bank_qr_text = db.Column(db.Text, default="")
    subscription_week_price = db.Column(db.Float, default=5.0)
    messaging_method = db.Column(db.String(20), default="whatsapp")
    telegram_bot_token = db.Column(db.String(200), default="")
    telegram_chat_id = db.Column(db.String(100), default="")


class AdminNotifySettings(db.Model):
    __tablename__ = "admin_notify_settings"
    id = db.Column(db.Integer, primary_key=True)
    admin_phone = db.Column(db.String(20), default="")
    daily_visitors = db.Column(db.Integer, default=0)
    last_report_date = db.Column(db.Date, nullable=True)


class User(UserMixin, db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    phone = db.Column(db.String(20), nullable=False)
    password = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), default="user")
    is_active_account = db.Column(db.Boolean, default=True)
    account_expiration = db.Column(db.DateTime, nullable=True)
    telegram_chat_id = db.Column(db.String(100), nullable=True)

    subscription = db.relationship("Subscription", backref="user", uselist=False, cascade="all, delete-orphan")
    logs = db.relationship("AdLog", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    renewal_requests = db.relationship("RenewalRequest", backref="user", lazy="dynamic", cascade="all, delete-orphan")
    audit_logs = db.relationship("AuditLog", backref="user", lazy="dynamic", cascade="all, delete-orphan")

    def is_expired(self):
        if self.account_expiration is None:
            return False
        return datetime.utcnow() > self.account_expiration

    def is_admin(self):
        return self.role == "admin"


class Subscription(db.Model):
    __tablename__ = "subscriptions"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    name = db.Column(db.String(200), default="رادار جديد")
    keywords = db.Column(db.Text, default="")
    recipients = db.Column(db.String(20), default="")
    status = db.Column(db.String(20), default="paused")
    sent_count = db.Column(db.Integer, default=0)
    cities = db.Column(db.Text, default="")
    city_filter_enabled = db.Column(db.Boolean, default=False)
    excluded_words = db.Column(db.Text, default="")
    exclude_enabled = db.Column(db.Boolean, default=False)
    quiet_enabled = db.Column(db.Boolean, default=False)
    quiet_start_hour = db.Column(db.Integer, default=23)
    quiet_start_minute = db.Column(db.Integer, default=0)
    quiet_end_hour = db.Column(db.Integer, default=7)
    quiet_end_minute = db.Column(db.Integer, default=0)
    sleep_minutes = db.Column(db.Integer, default=15)
    end_ts = db.Column(db.DateTime, nullable=True)


class AdLog(db.Model):
    __tablename__ = "ad_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(500), default="")
    url = db.Column(db.String(500), default="")
    keyword_matched = db.Column(db.String(200), default="")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class RenewalRequest(db.Model):
    __tablename__ = "renewal_requests"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    weeks = db.Column(db.Integer, default=1)
    amount = db.Column(db.Float, default=0.0)
    status = db.Column(db.String(20), default="pending")
    proof_filename = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    processed_at = db.Column(db.DateTime, nullable=True)


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(200), default="")
    details = db.Column(db.Text, default="{}")
    ip_address = db.Column(db.String(50), default="")
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)


class OTPStore(db.Model):
    __tablename__ = "otp_store"
    id = db.Column(db.Integer, primary_key=True)
    phone = db.Column(db.String(20), nullable=False)
    otp = db.Column(db.String(10), nullable=False)
    purpose = db.Column(db.String(50), default="register")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime)


# ═══════════════════════════════════════════════════════════════════
#                         SCHEMA MIGRATION
# ═══════════════════════════════════════════════════════════════════

def migrate_schema():
    """Add missing columns without dropping existing data."""
    is_pg = "postgresql" in app.config["SQLALCHEMY_DATABASE_URI"]
    with app.app_context():
        conn = db.engine.raw_connection()
        cursor = conn.cursor()

        migrations = [
            ("system_settings", "messaging_method", "VARCHAR(20) DEFAULT 'whatsapp'"),
            ("system_settings", "telegram_bot_token", "VARCHAR(200) DEFAULT ''"),
            ("system_settings", "telegram_chat_id", "VARCHAR(100) DEFAULT ''"),
            ("users", "telegram_chat_id", "VARCHAR(100)"),
            ("subscriptions", "sleep_minutes", "INTEGER DEFAULT 15"),
            ("subscriptions", "city_filter_enabled", "BOOLEAN DEFAULT FALSE"),
            ("subscriptions", "exclude_enabled", "BOOLEAN DEFAULT FALSE"),
            ("subscriptions", "quiet_enabled", "BOOLEAN DEFAULT FALSE"),
            ("subscriptions", "quiet_start_hour", "INTEGER DEFAULT 23"),
            ("subscriptions", "quiet_start_minute", "INTEGER DEFAULT 0"),
            ("subscriptions", "quiet_end_hour", "INTEGER DEFAULT 7"),
            ("subscriptions", "quiet_end_minute", "INTEGER DEFAULT 0"),
        ]

        for table, col, col_def in migrations:
            try:
                if is_pg:
                    cursor.execute(f"""
                        SELECT column_name FROM information_schema.columns
                        WHERE table_name='{table}' AND column_name='{col}'
                    """)
                    exists = cursor.fetchone()
                    if not exists:
                        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
                        conn.commit()
                        logger.info(f"Added column {col} to {table}")
                else:
                    cursor.execute(f"PRAGMA table_info({table})")
                    cols = [row[1] for row in cursor.fetchall()]
                    if col not in cols:
                        cursor.execute(f"ALTER TABLE {table} ADD COLUMN {col} {col_def}")
                        conn.commit()
                        logger.info(f"Added column {col} to {table}")
            except Exception as e:
                conn.rollback()
                logger.warning(f"Migration note ({table}.{col}): {e}")

        cursor.close()
        conn.close()


# ═══════════════════════════════════════════════════════════════════
#                         HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def get_settings():
    s = SystemSettings.query.first()
    if not s:
        s = SystemSettings()
        db.session.add(s)
        db.session.commit()
    return s


def format_time_ksa(dt, format_type="full"):
    if dt is None:
        return "—"
    ksa = dt + timedelta(hours=3)
    if format_type == "full":
        return ksa.strftime("%Y-%m-%d %H:%M:%S")
    elif format_type == "short":
        return ksa.strftime("%H:%M")
    elif format_type == "date":
        return ksa.strftime("%Y-%m-%d")
    return ksa.strftime("%Y-%m-%d %H:%M:%S")


def normalize_text(text):
    """Arabic text normalization."""
    if not text:
        return ""
    import re
    text = text.strip()
    text = re.sub(r'[أإآا]', 'ا', text)
    text = re.sub(r'[ىي]', 'ي', text)
    text = re.sub(r'ة', 'ه', text)
    text = re.sub(r'\s+', ' ', text)
    return text.lower()


def matches_keyword_precise(text, keyword):
    norm_text = normalize_text(text)
    norm_kw = normalize_text(keyword)
    return norm_kw in norm_text


def is_target_city(text, cities_list):
    if not cities_list:
        return True
    norm_text = normalize_text(text)
    for city in cities_list:
        if normalize_text(city) in norm_text:
            return True
    return False


def is_quiet_now(sub):
    if not sub.quiet_enabled:
        return False
    ksa_now = datetime.utcnow() + timedelta(hours=3)
    current_minutes = ksa_now.hour * 60 + ksa_now.minute
    start_minutes = sub.quiet_start_hour * 60 + sub.quiet_start_minute
    end_minutes = sub.quiet_end_hour * 60 + sub.quiet_end_minute

    if start_minutes <= end_minutes:
        return start_minutes <= current_minutes <= end_minutes
    else:
        return current_minutes >= start_minutes or current_minutes <= end_minutes


def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


def create_session():
    scraper = cloudscraper.create_scraper(
        browser={"browser": "chrome", "platform": "windows", "mobile": False}
    )
    retry = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    adapter = HTTPAdapter(max_retries=retry)
    scraper.mount("http://", adapter)
    scraper.mount("https://", adapter)
    return scraper


def extract_ads(html, base_url="https://haraj.com.sa"):
    ads = []
    try:
        soup = BeautifulSoup(html, "html.parser")
        for a in soup.find_all("a", href=True):
            href = a["href"]
            if not href.startswith("http"):
                href = base_url.rstrip("/") + "/" + href.lstrip("/")
            title_tag = a.find(["h2", "h3", "h4", "div", "span"])
            title = title_tag.get_text(strip=True) if title_tag else a.get_text(strip=True)
            ad_id = None
            import re
            m = re.search(r'/(\d{6,})', href)
            if m:
                ad_id = m.group(1)
            if ad_id and title and len(title) > 5:
                ads.append({"id": ad_id, "title": title, "url": href})
    except Exception as e:
        logger.error(f"extract_ads error: {e}")
    return ads


def log_whatsapp(to, message, status, response_text=""):
    entry = {
        "timestamp": format_time_ksa(datetime.utcnow()),
        "to": to,
        "message": message[:100],
        "status": status,
        "response": response_text[:200]
    }
    try:
        logs = []
        if os.path.exists(WHATSAPP_LOG_FILE):
            with open(WHATSAPP_LOG_FILE, "r", encoding="utf-8") as f:
                try:
                    logs = json.load(f)
                except:
                    logs = []
        logs.insert(0, entry)
        logs = logs[:1000]
        with open(WHATSAPP_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump(logs, f, ensure_ascii=False, indent=2)
    except Exception as e:
        logger.error(f"log_whatsapp error: {e}")


def send_whatsapp(sess, token, to, text):
    url = "https://whatsapp.tkwin.com.sa/api/v1/send"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {"to": to, "message": text}
    last_err = ""
    for attempt in range(3):
        try:
            resp = sess.post(url, json=payload, headers=headers, timeout=30)
            if resp.status_code == 200:
                log_whatsapp(to, text, "success", resp.text)
                return True
            else:
                last_err = f"HTTP {resp.status_code}: {resp.text[:100]}"
                log_whatsapp(to, text, f"failed_{attempt+1}", resp.text)
        except Exception as e:
            last_err = str(e)
            log_whatsapp(to, text, f"error_{attempt+1}", str(e))
        time.sleep(2 ** attempt)
    logger.error(f"send_whatsapp failed after 3 attempts: {last_err}")
    return False


def send_telegram(bot_token, chat_id, text):
    if not bot_token or not chat_id:
        logger.warning("Telegram token or chat_id missing")
        return False
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {"chat_id": chat_id, "text": text, "parse_mode": "HTML"}
    try:
        resp = requests.post(url, json=payload, timeout=30)
        if resp.status_code == 200:
            return True
        logger.error(f"Telegram error: {resp.status_code} {resp.text[:100]}")
        return False
    except Exception as e:
        logger.error(f"send_telegram error: {e}")
        return False


def send_user_message(destination, message, user_id=None, is_admin=False):
    with app.app_context():
        settings = get_settings()
        method = settings.messaging_method or "whatsapp"

        if method == "telegram":
            bot_token = settings.telegram_bot_token or ""
            chat_id = settings.telegram_chat_id or ""
            if user_id and not is_admin:
                u = User.query.get(user_id)
                if u and u.telegram_chat_id:
                    chat_id = u.telegram_chat_id
            return send_telegram(bot_token, chat_id, message)
        else:
            sess = create_session()
            return send_whatsapp(sess, settings.whatsapp_token, destination, message)


def log_audit_async(user_id, action, details, ip):
    def _log():
        with app.app_context():
            try:
                details_str = json.dumps(details, ensure_ascii=False) if isinstance(details, dict) else str(details)
                entry = AuditLog(
                    user_id=user_id,
                    action=action,
                    details=details_str,
                    ip_address=ip,
                    timestamp=datetime.utcnow()
                )
                db.session.add(entry)
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                logger.error(f"log_audit_async error: {e}")
    t = threading.Thread(target=_log, daemon=True)
    t.start()


def generate_otp():
    return str(random.randint(100000, 999999))


# ═══════════════════════════════════════════════════════════════════
#                         MONITOR THREAD
# ═══════════════════════════════════════════════════════════════════

class MonitorThread(threading.Thread):
    def __init__(self, sub_id, user_id):
        super().__init__(daemon=True, name=f"Monitor-{sub_id}")
        self.sub_id = sub_id
        self.user_id = user_id
        self.running = True
        self._load_seen()

    def _seen_file(self):
        return os.path.join(SUBS_FOLDER, f"seen_{self.sub_id}.json")

    def _queue_file(self):
        return os.path.join(SUBS_FOLDER, f"queue_{self.sub_id}.json")

    def _load_seen(self):
        with seen_ids_lock:
            if self.sub_id not in seen_data:
                fp = self._seen_file()
                if os.path.exists(fp):
                    try:
                        with open(fp, "r", encoding="utf-8") as f:
                            seen_data[self.sub_id] = set(json.load(f))
                    except:
                        seen_data[self.sub_id] = set()
                else:
                    seen_data[self.sub_id] = set()

    def _save_seen(self):
        with seen_ids_lock:
            fp = self._seen_file()
            try:
                data = list(seen_data.get(self.sub_id, set()))[-3000:]
                with open(fp, "w", encoding="utf-8") as f:
                    json.dump(data, f)
            except Exception as e:
                logger.error(f"save_seen error: {e}")

    def _load_queue(self):
        fp = self._queue_file()
        if os.path.exists(fp):
            try:
                with open(fp, "r", encoding="utf-8") as f:
                    return json.load(f)
            except:
                return []
        return []

    def _save_queue(self, q):
        fp = self._queue_file()
        try:
            with open(fp, "w", encoding="utf-8") as f:
                json.dump(q, f, ensure_ascii=False)
        except Exception as e:
            logger.error(f"save_queue error: {e}")

    def _clear_queue(self):
        fp = self._queue_file()
        if os.path.exists(fp):
            os.remove(fp)

    def _log_ad(self, title, url, keyword):
        try:
            existing = AdLog.query.filter_by(url=url, user_id=self.user_id).first()
            if not existing:
                entry = AdLog(
                    user_id=self.user_id,
                    title=title,
                    url=url,
                    keyword_matched=keyword,
                    timestamp=datetime.utcnow()
                )
                db.session.add(entry)
                sub = Subscription.query.get(self.sub_id)
                if sub:
                    sub.sent_count = (sub.sent_count or 0) + 1
                db.session.commit()
        except Exception as e:
            db.session.rollback()
            logger.error(f"_log_ad error: {e}")

    def run(self):
        logger.info(f"MonitorThread started for sub {self.sub_id}")
        while self.running:
            try:
                with app.app_context():
                    sub = Subscription.query.get(self.sub_id)
                    if not sub:
                        logger.info(f"Subscription {self.sub_id} deleted, stopping thread")
                        break

                    user = User.query.get(self.user_id)
                    if not user or not user.is_active_account:
                        logger.info(f"User {self.user_id} inactive, pausing thread")
                        time.sleep(300)
                        continue

                    if user.is_expired():
                        logger.info(f"User {self.user_id} expired, pausing thread")
                        if sub.status == "active":
                            sub.status = "paused"
                            db.session.commit()
                        time.sleep(300)
                        continue

                    if sub.status != "active":
                        time.sleep(60)
                        continue

                    keywords = [k.strip() for k in (sub.keywords or "").split(",") if k.strip()]
                    cities_list = [c.strip() for c in (sub.cities or "").split(",") if c.strip()]
                    excl_list = [e.strip() for e in (sub.excluded_words or "").split(",") if e.strip()]
                    recipient = sub.recipients or user.phone
                    sleep_min = sub.sleep_minutes or 15

                    quiet = is_quiet_now(sub)

                    if not quiet:
                        queue = self._load_queue()
                        if queue:
                            sess = create_session()
                            settings = get_settings()
                            for item in queue:
                                msg = item.get("message", "")
                                send_user_message(recipient, msg, user_id=self.user_id)
                                time.sleep(random.uniform(10, 20))
                            self._clear_queue()

                    sess = create_session()
                    settings = get_settings()

                    for keyword in keywords:
                        for page in range(1, 4):
                            try:
                                search_url = f"https://haraj.com.sa/search/{requests.utils.quote(keyword)}?page={page}"
                                resp = sess.get(search_url, timeout=20)
                                ads = extract_ads(resp.text)

                                for ad in ads:
                                    ad_id = ad["id"]
                                    with seen_ids_lock:
                                        if ad_id in seen_data.get(self.sub_id, set()):
                                            continue

                                    try:
                                        ad_resp = sess.get(ad["url"], timeout=15)
                                        full_text = BeautifulSoup(ad_resp.text, "html.parser").get_text()
                                    except:
                                        full_text = ad["title"]

                                    if not matches_keyword_precise(full_text + " " + ad["title"], keyword):
                                        continue

                                    if sub.city_filter_enabled and cities_list:
                                        if not is_target_city(full_text + " " + ad["title"], cities_list):
                                            continue

                                    if sub.exclude_enabled and excl_list:
                                        skip = False
                                        for ew in excl_list:
                                            if matches_keyword_precise(full_text + " " + ad["title"], ew):
                                                skip = True
                                                break
                                        if skip:
                                            continue

                                    with seen_ids_lock:
                                        if self.sub_id not in seen_data:
                                            seen_data[self.sub_id] = set()
                                        seen_data[self.sub_id].add(ad_id)
                                    self._save_seen()

                                    msg = (
                                        f"🔔 *راصد حراج* - إعلان جديد!\n\n"
                                        f"📌 *الكلمة المفتاحية:* {keyword}\n"
                                        f"📝 *العنوان:* {ad['title'][:100]}\n"
                                        f"🔗 *الرابط:* {ad['url']}\n"
                                        f"⏰ *الوقت:* {format_time_ksa(datetime.utcnow(), 'full')}"
                                    )

                                    if quiet:
                                        queue = self._load_queue()
                                        queue.append({"message": msg, "url": ad["url"]})
                                        self._save_queue(queue)
                                    else:
                                        time.sleep(random.uniform(30, 60))
                                        send_user_message(recipient, msg, user_id=self.user_id)

                                    self._log_ad(ad["title"], ad["url"], keyword)

                                time.sleep(random.uniform(2, 5))
                            except Exception as e:
                                logger.error(f"Search error for keyword {keyword} page {page}: {e}")
                                time.sleep(10)

                    time.sleep(sleep_min * 60)

            except Exception as e:
                logger.error(f"MonitorThread {self.sub_id} major error: {e}")
                time.sleep(60)


# ═══════════════════════════════════════════════════════════════════
#                         BACKGROUND TASKS
# ═══════════════════════════════════════════════════════════════════

def cleanup_old_logs():
    def _run():
        while True:
            try:
                with app.app_context():
                    cutoff = datetime.utcnow() - timedelta(days=90)
                    AuditLog.query.filter(AuditLog.timestamp < cutoff).delete()
                    total = AdLog.query.count()
                    if total > 2000:
                        oldest = AdLog.query.order_by(AdLog.timestamp.asc()).limit(total - 2000).all()
                        for entry in oldest:
                            db.session.delete(entry)
                    db.session.commit()
                    logger.info("cleanup_old_logs: done")
            except Exception as e:
                logger.error(f"cleanup_old_logs error: {e}")
                try:
                    db.session.rollback()
                except:
                    pass
            time.sleep(3600)

    t = threading.Thread(target=_run, daemon=True, name="CleanupThread")
    t.start()


def monitor_threads_health():
    def _run():
        while True:
            time.sleep(600)
            try:
                with app.app_context():
                    subs = Subscription.query.filter_by(status="active").all()
                    for sub in subs:
                        user = User.query.get(sub.user_id)
                        if not user or user.is_expired() or not user.is_active_account:
                            continue
                        tid = sub.id
                        if tid not in monitor_threads or not monitor_threads[tid].is_alive():
                            logger.info(f"Restarting dead thread for sub {tid}")
                            t = MonitorThread(tid, sub.user_id)
                            t.start()
                            monitor_threads[tid] = t
            except Exception as e:
                logger.error(f"monitor_threads_health error: {e}")
    t = threading.Thread(target=_run, daemon=True, name="HealthThread")
    t.start()


def daily_background_tasks():
    def _run():
        while True:
            time.sleep(3600)
            try:
                with app.app_context():
                    ksa_now = datetime.utcnow() + timedelta(hours=3)
                    if ksa_now.hour == 23:
                        notify = AdminNotifySettings.query.first()
                        settings = get_settings()
                        if notify and notify.admin_phone:
                            today = ksa_now.date()
                            if notify.last_report_date != today:
                                msg = (
                                    f"📊 *تقرير يومي - راصد حراج*\n\n"
                                    f"📅 التاريخ: {today}\n"
                                    f"👥 إجمالي المستخدمين: {User.query.count()}\n"
                                    f"✅ المشتركين النشطين: {User.query.filter(User.account_expiration > datetime.utcnow()).count()}\n"
                                    f"📨 الإعلانات المرسلة اليوم: {AdLog.query.filter(AdLog.timestamp >= datetime.utcnow().replace(hour=0, minute=0, second=0)).count()}\n"
                                )
                                send_user_message(notify.admin_phone, msg, is_admin=True)
                                notify.last_report_date = today
                                db.session.commit()

                        soon = datetime.utcnow() + timedelta(days=2)
                        expiring_users = User.query.filter(
                            User.account_expiration != None,
                            User.account_expiration <= soon,
                            User.account_expiration > datetime.utcnow()
                        ).all()
                        for u in expiring_users:
                            exp_ksa = format_time_ksa(u.account_expiration, "date")
                            msg = (
                                f"⚠️ تنبيه: اشتراكك في راصد حراج سينتهي بتاريخ {exp_ksa}.\n"
                                f"يرجى التجديد للاستمرار في استلام الإشعارات."
                            )
                            send_user_message(u.phone, msg, user_id=u.id)
            except Exception as e:
                logger.error(f"daily_background_tasks error: {e}")
    t = threading.Thread(target=_run, daemon=True, name="DailyTasksThread")
    t.start()


def start_active_threads():
    """Start monitor threads for all active subscriptions on app boot."""
    try:
        with app.app_context():
            subs = Subscription.query.filter_by(status="active").all()
            for sub in subs:
                user = User.query.get(sub.user_id)
                if not user or user.is_expired() or not user.is_active_account:
                    continue
                t = MonitorThread(sub.id, sub.user_id)
                t.start()
                monitor_threads[sub.id] = t
                logger.info(f"Started thread for sub {sub.id}")
    except Exception as e:
        logger.error(f"start_active_threads error: {e}")


# ═══════════════════════════════════════════════════════════════════
#                         AUTH DECORATORS
# ═══════════════════════════════════════════════════════════════════

@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ─── Context Processors ───
@app.context_processor
def inject_globals():
    """Inject variables available in all templates."""
    total_users_count = 0
    pending_count = 0
    if current_user.is_authenticated and current_user.role == "admin":
        try:
            total_users_count = User.query.filter_by(role="user").count()
            pending_count = RenewalRequest.query.filter_by(status="pending").count()
        except:
            pass
    return dict(
        total_users_count=total_users_count,
        pending_count=pending_count,
        format_time_ksa=format_time_ksa
    )


@app.template_filter('enumerate')
def enumerate_filter(iterable, start=0):
    return enumerate(iterable, start)


def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if not current_user.is_authenticated or current_user.role != "admin":
            abort(403)
        return f(*args, **kwargs)
    return decorated


# ═══════════════════════════════════════════════════════════════════
#                         AUTH ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route("/")
def index():
    if current_user.is_authenticated:
        if current_user.role == "admin":
            return redirect(url_for("admin_home"))
        return redirect(url_for("user_dashboard"))
    return redirect(url_for("login"))


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")
        remember = request.form.get("remember") == "on"
        user = User.query.filter_by(username=username).first()
        if user and check_password_hash(user.password, password):
            if not user.is_active_account:
                flash("حسابك موقوف. تواصل مع الدعم.", "danger")
                return render_template("login.html")
            login_user(user, remember=remember)
            log_audit_async(user.id, "تسجيل الدخول", {"المستخدم": username}, request.remote_addr)
            if user.role == "admin":
                return redirect(url_for("admin_home"))
            if user.is_expired():
                return redirect(url_for("renewal_page"))
            return redirect(url_for("user_dashboard"))
        flash("اسم المستخدم أو كلمة المرور غير صحيحة", "danger")
    return render_template("login.html")


@app.route("/logout")
@login_required
def logout():
    uid = current_user.id
    uname = current_user.username
    if "impersonating" in session:
        original_id = session.pop("impersonating")
        session.pop("original_user_id", None)
        original_user = User.query.get(original_id)
        if original_user:
            logout_user()
            login_user(original_user)
            flash("تم الرجوع إلى حساب المدير", "info")
            return redirect(url_for("admin_home"))
    logout_user()
    log_audit_async(uid, "تسجيل الخروج", {"المستخدم": uname}, request.remote_addr)
    flash("تم تسجيل الخروج بنجاح", "success")
    return redirect(url_for("login"))


@app.route("/register", methods=["GET", "POST"])
def register():
    if current_user.is_authenticated:
        return redirect(url_for("index"))
    if request.method == "POST":
        step = request.form.get("step", "1")
        if step == "1":
            username = request.form.get("username", "").strip()
            phone = request.form.get("phone", "").strip()
            password = request.form.get("password", "")
            confirm = request.form.get("confirm_password", "")

            if not username or not phone or not password:
                flash("جميع الحقول مطلوبة", "danger")
                return render_template("register.html", step=1)
            if password != confirm:
                flash("كلمات المرور غير متطابقة", "danger")
                return render_template("register.html", step=1)
            if User.query.filter_by(username=username).first():
                flash("اسم المستخدم مستخدم بالفعل", "danger")
                return render_template("register.html", step=1)

            otp = generate_otp()
            expires = datetime.utcnow() + timedelta(minutes=10)
            OTPStore.query.filter_by(phone=phone, purpose="register").delete()
            otp_entry = OTPStore(phone=phone, otp=otp, purpose="register", expires_at=expires)
            db.session.add(otp_entry)
            db.session.commit()

            sess = create_session()
            settings = get_settings()
            msg = f"🔐 رمز التحقق لتسجيل حساب راصد حراج:\n\n*{otp}*\n\nصالح لمدة 10 دقائق."
            send_whatsapp(sess, settings.whatsapp_token, phone, msg)

            session["reg_username"] = username
            session["reg_phone"] = phone
            session["reg_password"] = generate_password_hash(password, method='pbkdf2:sha256')
            flash("تم إرسال رمز التحقق إلى واتساب", "info")
            return render_template("register.html", step=2, phone=phone)

        elif step == "2":
            otp_input = request.form.get("otp", "").strip()
            phone = session.get("reg_phone", "")
            username = session.get("reg_username", "")
            hashed_pw = session.get("reg_password", "")

            otp_entry = OTPStore.query.filter_by(phone=phone, purpose="register").order_by(OTPStore.created_at.desc()).first()
            if not otp_entry or otp_entry.otp != otp_input or datetime.utcnow() > otp_entry.expires_at:
                flash("رمز التحقق غير صحيح أو منتهي الصلاحية", "danger")
                return render_template("register.html", step=2, phone=phone)

            is_first = User.query.count() == 0
            settings = get_settings()
            expiry = None if is_first else datetime.utcnow() + timedelta(days=settings.trial_days)

            new_user = User(
                username=username,
                phone=phone,
                password=hashed_pw,
                role="admin" if is_first else "user",
                is_active_account=True,
                account_expiration=expiry
            )
            db.session.add(new_user)
            db.session.flush()

            sub = Subscription(user_id=new_user.id, status="paused")
            db.session.add(sub)
            db.session.commit()

            OTPStore.query.filter_by(phone=phone, purpose="register").delete()
            db.session.commit()

            log_audit_async(new_user.id, "تسجيل حساب جديد", {"المستخدم": username, "الهاتف": phone}, request.remote_addr)
            login_user(new_user)

            if is_first:
                flash("مرحباً بك! تم إنشاء حساب المدير", "success")
                return redirect(url_for("admin_home"))
            flash("تم إنشاء حسابك بنجاح! يمكنك الآن استخدام راصد حراج", "success")
            return redirect(url_for("user_dashboard"))

    return render_template("register.html", step=1)


@app.route("/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        step = request.form.get("step", "1")
        if step == "1":
            username = request.form.get("username", "").strip()
            user = User.query.filter_by(username=username).first()
            if not user:
                flash("اسم المستخدم غير موجود", "danger")
                return render_template("forgot_password.html", step=1)
            otp = generate_otp()
            expires = datetime.utcnow() + timedelta(minutes=10)
            OTPStore.query.filter_by(phone=user.phone, purpose="reset").delete()
            otp_entry = OTPStore(phone=user.phone, otp=otp, purpose="reset", expires_at=expires)
            db.session.add(otp_entry)
            db.session.commit()
            sess = create_session()
            settings = get_settings()
            msg = f"🔐 رمز إعادة تعيين كلمة المرور - راصد حراج:\n\n*{otp}*\n\nصالح لمدة 10 دقائق."
            send_whatsapp(sess, settings.whatsapp_token, user.phone, msg)
            session["reset_username"] = username
            flash(f"تم إرسال رمز التحقق إلى واتساب المرتبط بحسابك", "info")
            return render_template("forgot_password.html", step=2)

        elif step == "2":
            otp_input = request.form.get("otp", "").strip()
            username = session.get("reset_username", "")
            user = User.query.filter_by(username=username).first()
            if not user:
                flash("انتهت الجلسة", "danger")
                return redirect(url_for("forgot_password"))
            otp_entry = OTPStore.query.filter_by(phone=user.phone, purpose="reset").order_by(OTPStore.created_at.desc()).first()
            if not otp_entry or otp_entry.otp != otp_input or datetime.utcnow() > otp_entry.expires_at:
                flash("رمز التحقق غير صحيح أو منتهي الصلاحية", "danger")
                return render_template("forgot_password.html", step=2)
            session["reset_verified"] = True
            return render_template("forgot_password.html", step=3)

        elif step == "3":
            if not session.get("reset_verified"):
                flash("غير مصرح", "danger")
                return redirect(url_for("forgot_password"))
            username = session.get("reset_username", "")
            new_pass = request.form.get("new_password", "")
            confirm = request.form.get("confirm_password", "")
            if new_pass != confirm or len(new_pass) < 6:
                flash("كلمات المرور غير متطابقة أو قصيرة جداً", "danger")
                return render_template("forgot_password.html", step=3)
            user = User.query.filter_by(username=username).first()
            user.password = generate_password_hash(new_pass, method='pbkdf2:sha256')
            db.session.commit()
            session.pop("reset_username", None)
            session.pop("reset_verified", None)
            log_audit_async(user.id, "إعادة تعيين كلمة المرور", {"المستخدم": username}, request.remote_addr)
            flash("تم تغيير كلمة المرور بنجاح", "success")
            return redirect(url_for("login"))

    return render_template("forgot_password.html", step=1)


# ═══════════════════════════════════════════════════════════════════
#                         USER ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route("/dashboard")
@login_required
def user_dashboard():
    if current_user.role == "admin" and "impersonating" not in session:
        return redirect(url_for("admin_home"))
    if current_user.is_expired():
        return redirect(url_for("renewal_page"))
    sub = current_user.subscription
    if not sub:
        sub = Subscription(user_id=current_user.id, status="paused")
        db.session.add(sub)
        db.session.commit()
    recent_logs = AdLog.query.filter_by(user_id=current_user.id).order_by(AdLog.timestamp.desc()).limit(10).all()
    is_running = current_user.id in [t.user_id for t in monitor_threads.values() if t.is_alive()]
    return render_template("user.html", sub=sub, logs=recent_logs, is_running=is_running)


@app.route("/update-subscription", methods=["POST"])
@login_required
def update_subscription():
    sub = current_user.subscription
    if not sub:
        sub = Subscription(user_id=current_user.id)
        db.session.add(sub)

    old_data = {
        "الكلمات المفتاحية": sub.keywords,
        "المدن": sub.cities,
        "الكلمات المستثناة": sub.excluded_words,
    }

    sub.name = request.form.get("name", "رادار جديد")
    sub.keywords = request.form.get("keywords", "")
    sub.recipients = request.form.get("recipients", current_user.phone)
    sub.cities = request.form.get("cities", "")
    sub.city_filter_enabled = request.form.get("city_filter_enabled") == "on"
    sub.excluded_words = request.form.get("excluded_words", "")
    sub.exclude_enabled = request.form.get("exclude_enabled") == "on"
    sub.quiet_enabled = request.form.get("quiet_enabled") == "on"
    sub.quiet_start_hour = int(request.form.get("quiet_start_hour", 23))
    sub.quiet_start_minute = int(request.form.get("quiet_start_minute", 0))
    sub.quiet_end_hour = int(request.form.get("quiet_end_hour", 7))
    sub.quiet_end_minute = int(request.form.get("quiet_end_minute", 0))
    sub.sleep_minutes = int(request.form.get("sleep_minutes", 15))
    db.session.commit()

    log_audit_async(current_user.id, "تعديل إعدادات الرادار", {
        "قبل": old_data,
        "الكلمات الجديدة": sub.keywords,
        "المدن الجديدة": sub.cities,
    }, request.remote_addr)

    flash("تم حفظ الإعدادات بنجاح", "success")
    return redirect(url_for("user_dashboard"))


@app.route("/toggle-radar", methods=["POST"])
@login_required
def toggle_radar():
    if current_user.is_expired():
        flash("انتهت صلاحية اشتراكك", "danger")
        return redirect(url_for("renewal_page"))

    sub = current_user.subscription
    if not sub:
        flash("لا يوجد رادار مُعيَّن", "danger")
        return redirect(url_for("user_dashboard"))

    if not sub.keywords or not sub.keywords.strip():
        flash("يرجى إضافة كلمة مفتاحية واحدة على الأقل", "warning")
        return redirect(url_for("user_dashboard"))

    if sub.status == "active":
        sub.status = "paused"
        db.session.commit()
        if sub.id in monitor_threads:
            monitor_threads[sub.id].running = False
            monitor_threads.pop(sub.id, None)
        log_audit_async(current_user.id, "إيقاف الرادار", {"الرادار": sub.name}, request.remote_addr)
        flash("تم إيقاف الرادار", "warning")
    else:
        sub.status = "active"
        db.session.commit()
        t = MonitorThread(sub.id, current_user.id)
        t.start()
        monitor_threads[sub.id] = t
        log_audit_async(current_user.id, "تشغيل الرادار", {"الرادار": sub.name}, request.remote_addr)
        flash("تم تشغيل الرادار بنجاح!", "success")

    return redirect(url_for("user_dashboard"))


@app.route("/profile", methods=["GET", "POST"])
@login_required
def profile():
    if request.method == "POST":
        action = request.form.get("action")
        if action == "change_password":
            old_pw = request.form.get("old_password", "")
            new_pw = request.form.get("new_password", "")
            confirm_pw = request.form.get("confirm_password", "")
            if not check_password_hash(current_user.password, old_pw):
                flash("كلمة المرور الحالية غير صحيحة", "danger")
            elif new_pw != confirm_pw or len(new_pw) < 6:
                flash("كلمة المرور الجديدة غير متطابقة أو قصيرة جداً", "danger")
            else:
                current_user.password = generate_password_hash(new_pw, method='pbkdf2:sha256')
                db.session.commit()
                log_audit_async(current_user.id, "تغيير كلمة المرور", {}, request.remote_addr)
                flash("تم تغيير كلمة المرور", "success")
        elif action == "update_telegram":
            current_user.telegram_chat_id = request.form.get("telegram_chat_id", "").strip()
            db.session.commit()
            flash("تم تحديث Chat ID التيليجرام", "success")
        return redirect(url_for("profile"))
    return render_template("profile.html")


@app.route("/renewal", methods=["GET", "POST"])
@login_required
def renewal_page():
    settings = get_settings()
    if request.method == "POST":
        weeks = int(request.form.get("weeks", 1))
        amount = weeks * settings.subscription_week_price
        proof_filename = None

        if "proof" in request.files:
            file = request.files["proof"]
            if file and file.filename and allowed_file(file.filename):
                filename = secure_filename(f"{current_user.id}_{int(time.time())}_{file.filename}")
                file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
                proof_filename = filename

        rr = RenewalRequest(
            user_id=current_user.id,
            weeks=weeks,
            amount=amount,
            status="pending",
            proof_filename=proof_filename
        )
        db.session.add(rr)
        db.session.commit()

        log_audit_async(current_user.id, "طلب تجديد اشتراك", {
            "الأسابيع": weeks,
            "المبلغ": amount,
            "الحالة": "قيد المراجعة"
        }, request.remote_addr)

        flash("تم إرسال طلب التجديد. سيتم مراجعته من قبل الإدارة.", "success")
        return redirect(url_for("renewal_page"))

    pending = RenewalRequest.query.filter_by(user_id=current_user.id, status="pending").first()
    return render_template("renewal.html", settings=settings, pending=pending)


# ═══════════════════════════════════════════════════════════════════
#                         ADMIN ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route("/admin")
@login_required
@admin_required
def admin_home():
    total_users = User.query.filter_by(role="user").count()
    active_subs = Subscription.query.filter_by(status="active").count()
    total_ads = AdLog.query.count()
    pending_renewals = RenewalRequest.query.filter_by(status="pending").count()
    expired_users = User.query.filter(
        User.role == "user",
        User.account_expiration != None,
        User.account_expiration < datetime.utcnow()
    ).count()
    recent_users = User.query.filter_by(role="user").order_by(User.id.desc()).limit(5).all()
    recent_renewals = RenewalRequest.query.order_by(RenewalRequest.created_at.desc()).limit(5).all()

    chart_labels = []
    chart_data = []
    for i in range(7, 0, -1):
        day = datetime.utcnow() - timedelta(days=i)
        day_start = day.replace(hour=0, minute=0, second=0)
        day_end = day.replace(hour=23, minute=59, second=59)
        count = AdLog.query.filter(AdLog.timestamp.between(day_start, day_end)).count()
        chart_labels.append((day + timedelta(hours=3)).strftime("%m/%d"))
        chart_data.append(count)

    return render_template("admin/home.html",
        total_users=total_users,
        active_subs=active_subs,
        total_ads=total_ads,
        pending_renewals=pending_renewals,
        expired_users=expired_users,
        recent_users=recent_users,
        recent_renewals=recent_renewals,
        chart_labels=json.dumps(chart_labels),
        chart_data=json.dumps(chart_data),
        format_time_ksa=format_time_ksa
    )


@app.route("/admin/users")
@login_required
@admin_required
def admin_users():
    page = request.args.get("page", 1, type=int)
    search = request.args.get("search", "").strip()
    status_filter = request.args.get("status", "all")

    query = User.query.filter_by(role="user")
    if search:
        query = query.filter(
            (User.username.ilike(f"%{search}%")) |
            (User.phone.ilike(f"%{search}%"))
        )
    if status_filter == "active":
        query = query.filter(User.account_expiration > datetime.utcnow())
    elif status_filter == "expired":
        query = query.filter(
            (User.account_expiration == None) |
            (User.account_expiration < datetime.utcnow())
        )
    elif status_filter == "disabled":
        query = query.filter_by(is_active_account=False)

    pagination = query.order_by(User.id.desc()).paginate(page=page, per_page=20, error_out=False)
    return render_template("admin/users.html",
        users=pagination.items,
        pagination=pagination,
        search=search,
        status_filter=status_filter,
        format_time_ksa=format_time_ksa,
        now=datetime.utcnow()
    )


@app.route("/admin/user/<int:uid>/toggle-active", methods=["POST"])
@login_required
@admin_required
def admin_toggle_user_active(uid):
    user = User.query.get_or_404(uid)
    user.is_active_account = not user.is_active_account
    db.session.commit()
    if not user.is_active_account and user.subscription:
        user.subscription.status = "paused"
        if user.subscription.id in monitor_threads:
            monitor_threads[user.subscription.id].running = False
            monitor_threads.pop(user.subscription.id, None)
        db.session.commit()
    log_audit_async(current_user.id, "تغيير حالة المستخدم", {
        "المستخدم": user.username,
        "الحالة الجديدة": "مفعل" if user.is_active_account else "موقوف"
    }, request.remote_addr)
    flash(f"تم {'تفعيل' if user.is_active_account else 'إيقاف'} الحساب", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/user/<int:uid>/update-sleep", methods=["POST"])
@login_required
@admin_required
def admin_update_sleep(uid):
    user = User.query.get_or_404(uid)
    if user.subscription:
        minutes = int(request.form.get("sleep_minutes", 15))
        user.subscription.sleep_minutes = minutes
        db.session.commit()
        log_audit_async(current_user.id, "تعديل دقائق النوم", {
            "المستخدم": user.username,
            "الدقائق": minutes
        }, request.remote_addr)
        flash("تم تحديث دقائق التوقف", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/user/<int:uid>/impersonate")
@login_required
@admin_required
def impersonate_user(uid):
    user = User.query.get_or_404(uid)
    session["impersonating"] = current_user.id
    session["original_user_id"] = current_user.id
    logout_user()
    login_user(user)
    log_audit_async(current_user.id, "تسجيل دخول بهوية مستخدم", {
        "المدير": session.get("original_user_id"),
        "المستخدم": user.username
    }, request.remote_addr)
    flash(f"أنت الآن تتصفح كـ {user.username}", "warning")
    return redirect(url_for("user_dashboard"))


@app.route("/admin/user/<int:uid>/delete", methods=["POST"])
@login_required
@admin_required
def admin_delete_user(uid):
    user = User.query.get_or_404(uid)
    if user.subscription and user.subscription.id in monitor_threads:
        monitor_threads[user.subscription.id].running = False
        monitor_threads.pop(user.subscription.id, None)
    uname = user.username
    db.session.delete(user)
    db.session.commit()
    log_audit_async(current_user.id, "حذف مستخدم", {"المستخدم": uname}, request.remote_addr)
    flash("تم حذف المستخدم", "success")
    return redirect(url_for("admin_users"))


@app.route("/admin/renewals")
@login_required
@admin_required
def admin_renewals():
    page = request.args.get("page", 1, type=int)
    status_f = request.args.get("status", "pending")
    query = RenewalRequest.query
    if status_f != "all":
        query = query.filter_by(status=status_f)
    pagination = query.order_by(RenewalRequest.created_at.desc()).paginate(page=page, per_page=20, error_out=False)
    return render_template("admin/renewals.html",
        renewals=pagination.items,
        pagination=pagination,
        status_f=status_f,
        format_time_ksa=format_time_ksa
    )


@app.route("/admin/renewal/<int:rid>/approve", methods=["POST"])
@login_required
@admin_required
def approve_renewal(rid):
    rr = RenewalRequest.query.get_or_404(rid)
    user = User.query.get(rr.user_id)
    now = datetime.utcnow()
    base = max(user.account_expiration or now, now)
    user.account_expiration = base + timedelta(weeks=rr.weeks)
    rr.status = "approved"
    rr.processed_at = now
    db.session.commit()

    if user.subscription and user.subscription.status == "paused":
        sub = user.subscription
        if sub.keywords and sub.keywords.strip():
            sub.status = "active"
            db.session.commit()
            t = MonitorThread(sub.id, user.id)
            t.start()
            monitor_threads[sub.id] = t

    new_exp = format_time_ksa(user.account_expiration, "date")
    msg = (
        f"✅ تم تجديد اشتراكك في راصد حراج!\n\n"
        f"📅 تاريخ الانتهاء الجديد: {new_exp}\n"
        f"🎉 يمكنك الآن الاستمرار في استلام الإشعارات."
    )
    send_user_message(user.phone, msg, user_id=user.id)
    log_audit_async(current_user.id, "قبول طلب التجديد", {
        "المستخدم": user.username,
        "الأسابيع": rr.weeks,
        "تاريخ الانتهاء": new_exp
    }, request.remote_addr)
    flash("تم قبول طلب التجديد وإشعار المستخدم", "success")
    return redirect(url_for("admin_renewals"))


@app.route("/admin/renewal/<int:rid>/reject", methods=["POST"])
@login_required
@admin_required
def reject_renewal(rid):
    rr = RenewalRequest.query.get_or_404(rid)
    user = User.query.get(rr.user_id)
    rr.status = "rejected"
    rr.processed_at = datetime.utcnow()
    db.session.commit()
    msg = f"❌ تم رفض طلب تجديد اشتراكك في راصد حراج.\nيرجى التواصل مع الدعم لمزيد من المعلومات."
    send_user_message(user.phone, msg, user_id=user.id)
    log_audit_async(current_user.id, "رفض طلب التجديد", {"المستخدم": user.username}, request.remote_addr)
    flash("تم رفض الطلب", "warning")
    return redirect(url_for("admin_renewals"))


@app.route("/admin/renewal/proof/<filename>")
@login_required
@admin_required
def view_proof(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/admin/ad-log")
@login_required
@admin_required
def admin_ad_log():
    page = request.args.get("page", 1, type=int)
    search = request.args.get("search", "").strip()
    user_filter = request.args.get("user_id", "", type=str)

    query = AdLog.query
    if search:
        query = query.filter(
            (AdLog.title.ilike(f"%{search}%")) |
            (AdLog.keyword_matched.ilike(f"%{search}%"))
        )
    if user_filter:
        query = query.filter_by(user_id=int(user_filter))

    pagination = query.order_by(AdLog.timestamp.desc()).paginate(page=page, per_page=50, error_out=False)
    users_list = User.query.filter_by(role="user").all()
    return render_template("admin/ad_log.html",
        logs=pagination.items,
        pagination=pagination,
        search=search,
        user_filter=user_filter,
        users_list=users_list,
        format_time_ksa=format_time_ksa
    )


@app.route("/admin/audit-log")
@login_required
@admin_required
def admin_audit_log():
    page = request.args.get("page", 1, type=int)
    search = request.args.get("search", "").strip()
    user_filter = request.args.get("user_id", "", type=str)

    query = AuditLog.query
    if search:
        query = query.filter(
            (AuditLog.action.ilike(f"%{search}%")) |
            (AuditLog.details.ilike(f"%{search}%"))
        )
    if user_filter:
        query = query.filter_by(user_id=int(user_filter))

    pagination = query.order_by(AuditLog.timestamp.desc()).paginate(page=page, per_page=30, error_out=False)
    users_list = User.query.all()
    return render_template("admin/audit_log.html",
        logs=pagination.items,
        pagination=pagination,
        search=search,
        user_filter=user_filter,
        users_list=users_list,
        format_time_ksa=format_time_ksa
    )


@app.route("/admin/whatsapp-logs")
@login_required
@admin_required
def admin_whatsapp_logs():
    logs = []
    if os.path.exists(WHATSAPP_LOG_FILE):
        try:
            with open(WHATSAPP_LOG_FILE, "r", encoding="utf-8") as f:
                logs = json.load(f)
        except:
            logs = []
    page = request.args.get("page", 1, type=int)
    per_page = 50
    total = len(logs)
    start = (page - 1) * per_page
    end = start + per_page
    page_logs = logs[start:end]
    total_pages = (total + per_page - 1) // per_page
    return render_template("admin/whatsapp_logs.html",
        logs=page_logs,
        page=page,
        total_pages=total_pages,
        total=total
    )


@app.route("/admin/whatsapp-logs/clear", methods=["POST"])
@login_required
@admin_required
def clear_whatsapp_logs():
    if os.path.exists(WHATSAPP_LOG_FILE):
        with open(WHATSAPP_LOG_FILE, "w", encoding="utf-8") as f:
            json.dump([], f)
    log_audit_async(current_user.id, "مسح سجلات واتساب", {}, request.remote_addr)
    flash("تم مسح سجلات واتساب", "success")
    return redirect(url_for("admin_whatsapp_logs"))


@app.route("/admin/statistics")
@login_required
@admin_required
def admin_statistics():
    total_users = User.query.filter_by(role="user").count()
    active_subs = Subscription.query.filter_by(status="active").count()
    total_ads = AdLog.query.count()
    total_revenue = db.session.query(db.func.sum(RenewalRequest.amount)).filter_by(status="approved").scalar() or 0

    top_keywords = db.session.query(
        AdLog.keyword_matched,
        db.func.count(AdLog.id).label("cnt")
    ).group_by(AdLog.keyword_matched).order_by(db.text("cnt DESC")).limit(10).all()

    monthly_labels = []
    monthly_data = []
    for i in range(5, -1, -1):
        d = datetime.utcnow() - timedelta(days=30 * i)
        label = (d + timedelta(hours=3)).strftime("%Y/%m")
        start = d.replace(day=1, hour=0, minute=0, second=0)
        count = AdLog.query.filter(AdLog.timestamp >= start).count()
        monthly_labels.append(label)
        monthly_data.append(count)

    return render_template("admin/statistics.html",
        total_users=total_users,
        active_subs=active_subs,
        total_ads=total_ads,
        total_revenue=total_revenue,
        top_keywords=top_keywords,
        monthly_labels=json.dumps(monthly_labels),
        monthly_data=json.dumps(monthly_data)
    )


@app.route("/admin/settings", methods=["GET", "POST"])
@login_required
@admin_required
def admin_settings():
    settings = get_settings()
    notify = AdminNotifySettings.query.first()
    if not notify:
        notify = AdminNotifySettings()
        db.session.add(notify)
        db.session.commit()

    if request.method == "POST":
        settings.whatsapp_token = request.form.get("whatsapp_token", settings.whatsapp_token)
        settings.trial_days = int(request.form.get("trial_days", 2))
        settings.bank_account_number = request.form.get("bank_account_number", "")
        settings.bank_account_name = request.form.get("bank_account_name", "")
        settings.bank_qr_text = request.form.get("bank_qr_text", "")
        settings.subscription_week_price = float(request.form.get("subscription_week_price", 5))
        settings.messaging_method = request.form.get("messaging_method", "whatsapp")
        settings.telegram_bot_token = request.form.get("telegram_bot_token", "")
        settings.telegram_chat_id = request.form.get("telegram_chat_id", "")
        notify.admin_phone = request.form.get("admin_phone", "")
        db.session.commit()
        log_audit_async(current_user.id, "تحديث الإعدادات", {"المحدِّث": current_user.username}, request.remote_addr)
        flash("تم حفظ الإعدادات", "success")
        return redirect(url_for("admin_settings"))

    return render_template("admin/settings.html", settings=settings, notify=notify)


@app.route("/admin/clear-ad-log", methods=["POST"])
@login_required
@admin_required
def admin_clear_ad_log():
    AdLog.query.delete()
    db.session.commit()
    log_audit_async(current_user.id, "مسح سجل الإعلانات", {}, request.remote_addr)
    flash("تم مسح سجل الإعلانات", "success")
    return redirect(url_for("admin_ad_log"))


@app.route("/admin/user/<int:uid>/add-days", methods=["POST"])
@login_required
@admin_required
def admin_add_days(uid):
    user = User.query.get_or_404(uid)
    days = int(request.form.get("days", 7))
    now = datetime.utcnow()
    base = max(user.account_expiration or now, now)
    user.account_expiration = base + timedelta(days=days)
    db.session.commit()
    log_audit_async(current_user.id, "إضافة أيام للمستخدم", {
        "المستخدم": user.username,
        "الأيام": days,
        "تاريخ الانتهاء": format_time_ksa(user.account_expiration, "date")
    }, request.remote_addr)
    flash(f"تمت إضافة {days} يوم للمستخدم {user.username}", "success")
    return redirect(url_for("admin_users"))


# ═══════════════════════════════════════════════════════════════════
#                         API ROUTES
# ═══════════════════════════════════════════════════════════════════

@app.route("/api/thread-status")
@login_required
def api_thread_status():
    sub = current_user.subscription
    if not sub:
        return jsonify({"running": False, "status": "no_sub"})
    is_running = sub.id in monitor_threads and monitor_threads[sub.id].is_alive()
    return jsonify({
        "running": is_running,
        "status": sub.status,
        "sent_count": sub.sent_count or 0
    })


@app.route("/api/admin/stats")
@login_required
@admin_required
def api_admin_stats():
    return jsonify({
        "total_users": User.query.filter_by(role="user").count(),
        "active_subs": Subscription.query.filter_by(status="active").count(),
        "total_ads": AdLog.query.count(),
        "pending_renewals": RenewalRequest.query.filter_by(status="pending").count(),
        "live_threads": len([t for t in monitor_threads.values() if t.is_alive()])
    })


# ═══════════════════════════════════════════════════════════════════
#                         ERROR HANDLERS
# ═══════════════════════════════════════════════════════════════════

@app.errorhandler(403)
def forbidden(e):
    return render_template("error.html", code=403, message="غير مصرح لك بالوصول إلى هذه الصفحة"), 403


@app.errorhandler(404)
def not_found(e):
    return render_template("error.html", code=404, message="الصفحة غير موجودة"), 404


@app.errorhandler(500)
def server_error(e):
    return render_template("error.html", code=500, message="خطأ في الخادم"), 500


# ═══════════════════════════════════════════════════════════════════
#                         APP INITIALIZATION
# ═══════════════════════════════════════════════════════════════════

def initialize_app():
    with app.app_context():
        db.create_all()
        migrate_schema()
        settings = SystemSettings.query.first()
        if not settings:
            settings = SystemSettings(
                whatsapp_token="7a203d6ba6f4325ed3261ea87f6b2e751250ad97",
                trial_days=2,
                subscription_week_price=5.0,
                messaging_method="whatsapp"
            )
            db.session.add(settings)
            db.session.commit()
        notify = AdminNotifySettings.query.first()
        if not notify:
            notify = AdminNotifySettings()
            db.session.add(notify)
            db.session.commit()
        logger.info("Database initialized successfully")

    start_active_threads()
    cleanup_old_logs()
    monitor_threads_health()
    daily_background_tasks()
    logger.info("Background threads started")


initialize_app()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)), debug=False)
