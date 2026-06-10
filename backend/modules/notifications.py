"""
modules/notifications.py
Dispatches alert notifications via Email (SMTP) and/or Webhook.

Both channels are opt-in via environment variables:
  - Email:   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, ALERT_EMAIL_TO
  - Webhook: WEBHOOK_URL (Slack/Teams/Discord incoming webhook compatible)

If env vars are not set, the dispatcher silently skips.
"""

import os
import json
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timezone

try:
    from loguru import logger
except ImportError:
    import logging
    logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Configuration (read from environment)
# ─────────────────────────────────────────────────────────────────────────────

SMTP_HOST     = os.getenv("SMTP_HOST", "")
SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER     = os.getenv("SMTP_USER", "")
SMTP_PASS     = os.getenv("SMTP_PASS", "")
SMTP_FROM     = os.getenv("SMTP_FROM", "")
ALERT_EMAIL_TO = os.getenv("ALERT_EMAIL_TO", "")   # comma-separated

WEBHOOK_URL   = os.getenv("WEBHOOK_URL", "")


def get_notification_status() -> dict:
    """Returns which notification channels are configured (no secrets exposed)."""
    return {
        "email": {
            "configured": bool(SMTP_HOST and SMTP_FROM and ALERT_EMAIL_TO),
            "host": SMTP_HOST or None,
            "from": SMTP_FROM or None,
            "recipients": ALERT_EMAIL_TO.split(",") if ALERT_EMAIL_TO else [],
        },
        "webhook": {
            "configured": bool(WEBHOOK_URL),
            "url_set": bool(WEBHOOK_URL),  # don't expose actual URL
        },
    }


# ─────────────────────────────────────────────────────────────────────────────
# Email dispatcher
# ─────────────────────────────────────────────────────────────────────────────

def _send_email(subject: str, body_html: str) -> bool:
    """Send an email via SMTP. Returns True on success."""
    if not (SMTP_HOST and SMTP_FROM and ALERT_EMAIL_TO):
        return False

    recipients = [r.strip() for r in ALERT_EMAIL_TO.split(",") if r.strip()]
    if not recipients:
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_FROM
    msg["To"] = ", ".join(recipients)
    msg.attach(MIMEText(body_html, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            if SMTP_PORT != 25:
                server.starttls()
                server.ehlo()
            if SMTP_USER and SMTP_PASS:
                server.login(SMTP_USER, SMTP_PASS)
            server.sendmail(SMTP_FROM, recipients, msg.as_string())
        logger.info(f"[Notifications] Email sent to {recipients}: {subject}")
        return True
    except Exception as e:
        logger.error(f"[Notifications] Email send failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Webhook dispatcher (Slack / Teams / Discord compatible)
# ─────────────────────────────────────────────────────────────────────────────

def _send_webhook(payload: dict) -> bool:
    """POST a JSON payload to the configured webhook URL."""
    if not WEBHOOK_URL:
        return False

    try:
        import urllib.request
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            WEBHOOK_URL,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            logger.info(f"[Notifications] Webhook sent ({resp.status})")
            return resp.status < 300
    except Exception as e:
        logger.error(f"[Notifications] Webhook failed: {e}")
        return False


# ─────────────────────────────────────────────────────────────────────────────
# Public API — send notification for an alert
# ─────────────────────────────────────────────────────────────────────────────

_SEVERITY_EMOJI = {"critical": "🔴", "high": "🟠", "medium": "🟡"}
_SEVERITY_COLOR = {"critical": "#f87171", "high": "#fbbf24", "medium": "#60a5fa"}


def send_alert_notification(alert: dict) -> dict:
    """
    Dispatch a notification for a fired alert.
    
    Args:
        alert: dict with keys: employee_id, type/alert_type, severity, message
    
    Returns:
        dict with send status for each channel.
    """
    employee_id = alert.get("employee_id", "Unknown")
    severity    = alert.get("severity", "high")
    message     = alert.get("message", "Alert triggered")
    alert_type  = alert.get("type") or alert.get("alert_type", "alert")
    emoji       = _SEVERITY_EMOJI.get(severity, "⚪")
    timestamp   = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    results = {"email": False, "webhook": False}

    # ── Email ──
    subject = f"{emoji} EWS Alert [{severity.upper()}] — {employee_id}"
    body_html = f"""
    <div style="font-family: monospace; padding: 20px; background: #0f172a; color: #e2e8f0; border-radius: 8px;">
        <h2 style="color: {_SEVERITY_COLOR.get(severity, '#e2e8f0')};">
            {emoji} {severity.upper()} Alert
        </h2>
        <table style="margin: 16px 0; font-size: 14px;">
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Employee</td><td><strong>{employee_id}</strong></td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Type</td><td>{alert_type}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Message</td><td>{message}</td></tr>
            <tr><td style="padding: 4px 12px 4px 0; color: #64748b;">Time</td><td>{timestamp}</td></tr>
        </table>
        <p style="font-size: 12px; color: #64748b;">— EWS Platform</p>
    </div>
    """
    results["email"] = _send_email(subject, body_html)

    # ── Webhook (Slack-compatible format) ──
    webhook_payload = {
        "text": f"{emoji} *EWS Alert [{severity.upper()}]*\n*Employee:* {employee_id}\n*Type:* {alert_type}\n*Message:* {message}\n*Time:* {timestamp}",
        # Slack blocks format for richer display
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": f"{emoji} *EWS Alert [{severity.upper()}]*\n\n*Employee:* `{employee_id}`\n*Type:* {alert_type}\n*Message:* {message}\n*Time:* {timestamp}"
                }
            }
        ]
    }
    results["webhook"] = _send_webhook(webhook_payload)

    return results
