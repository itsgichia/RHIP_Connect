import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

try:
    import certifi

    _CERT_BUNDLE = certifi.where()
except ImportError:
    _CERT_BUNDLE = None

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@rhip.edu.au")
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")
MAIL_FROM = os.getenv("MAIL_FROM", "noreply@rhipconnect.edu.au")
MAIL_FROM_NAME = os.getenv("MAIL_FROM_NAME", "RHIP Connect")
MAIL_SERVER = os.getenv("MAIL_SERVER", "live.smtp.mailtrap.io")
MAIL_PORT = int(os.getenv("MAIL_PORT", "587"))
MAIL_STARTTLS = os.getenv("MAIL_STARTTLS", "True").lower() == "true"
MAIL_SSL_TLS = os.getenv("MAIL_SSL_TLS", "False").lower() == "true"

# Live demo: skip all outbound email (avoids Mailtrap rate limits / SMTP load).
DISABLE_EMAILS = os.getenv("DISABLE_EMAILS", "false").lower() in ("1", "true", "yes")

# Mailtrap Email Sandbox (Testing) — preferred for demos when set.
# From Mailtrap → Email Sandboxes → My Sandbox → Integrations.
MAILTRAP_API_TOKEN = os.getenv("MAILTRAP_API_TOKEN", "").strip()
MAILTRAP_INBOX_ID = os.getenv("MAILTRAP_INBOX_ID", "").strip()
MAILTRAP_SANDBOX_API = os.getenv(
    "MAILTRAP_SANDBOX_API", "https://sandbox.api.mailtrap.io"
).rstrip("/")

# Demo-only: remap one seeded account's notification emails (login email unchanged).
DEMO_EMAIL_REMAP_FROM = os.getenv("DEMO_EMAIL_REMAP_FROM", "z5580775@ad.unsw.edu.au").strip().lower()
DEMO_EMAIL_REMAP_TO = os.getenv("DEMO_EMAIL_REMAP_TO", "").strip()
# Optional SMTP used only for remapped demo emails; leave blank to use MAIL_* above.
DEMO_MAIL_USERNAME = os.getenv("DEMO_MAIL_USERNAME", "").strip()
DEMO_MAIL_PASSWORD = os.getenv("DEMO_MAIL_PASSWORD", "").strip()
DEMO_MAIL_FROM = os.getenv("DEMO_MAIL_FROM", "").strip() or DEMO_MAIL_USERNAME
DEMO_MAIL_SERVER = os.getenv("DEMO_MAIL_SERVER", "smtp.office365.com").strip()
DEMO_MAIL_PORT = int(os.getenv("DEMO_MAIL_PORT", "587"))
DEMO_MAIL_STARTTLS = os.getenv("DEMO_MAIL_STARTTLS", "True").lower() == "true"
DEMO_MAIL_SSL_TLS = os.getenv("DEMO_MAIL_SSL_TLS", "False").lower() == "true"

_fastmail = None
_demo_fastmail = None


def _mailtrap_sandbox_configured() -> bool:
    return bool(MAILTRAP_API_TOKEN and MAILTRAP_INBOX_ID)


def _mail_configured() -> bool:
    return bool(MAIL_USERNAME and MAIL_PASSWORD and MAIL_USERNAME != "your-mailtrap-username")


def _demo_mail_configured() -> bool:
    return bool(DEMO_MAIL_USERNAME and DEMO_MAIL_PASSWORD)


def _connection_extras() -> dict:
    """macOS Python often lacks system CA certs — pin certifi bundle when available."""
    if _CERT_BUNDLE:
        return {"VALIDATE_CERTS": True, "CERT_BUNDLE": _CERT_BUNDLE}
    return {}


def _get_fastmail():
    global _fastmail
    if _fastmail is None:
        from fastapi_mail import ConnectionConfig, FastMail

        conf = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,
            MAIL_PASSWORD=MAIL_PASSWORD,
            MAIL_FROM=MAIL_FROM,
            MAIL_FROM_NAME=MAIL_FROM_NAME,
            MAIL_SERVER=MAIL_SERVER,
            MAIL_PORT=MAIL_PORT,
            MAIL_STARTTLS=MAIL_STARTTLS,
            MAIL_SSL_TLS=MAIL_SSL_TLS,
            USE_CREDENTIALS=True,
            **_connection_extras(),
        )
        _fastmail = FastMail(conf)
    return _fastmail


def _get_demo_fastmail():
    global _demo_fastmail
    if _demo_fastmail is None:
        from fastapi_mail import ConnectionConfig, FastMail

        conf = ConnectionConfig(
            MAIL_USERNAME=DEMO_MAIL_USERNAME,
            MAIL_PASSWORD=DEMO_MAIL_PASSWORD,
            MAIL_FROM=DEMO_MAIL_FROM or DEMO_MAIL_USERNAME,
            MAIL_FROM_NAME=MAIL_FROM_NAME,
            MAIL_SERVER=DEMO_MAIL_SERVER,
            MAIL_PORT=DEMO_MAIL_PORT,
            MAIL_STARTTLS=DEMO_MAIL_STARTTLS,
            MAIL_SSL_TLS=DEMO_MAIL_SSL_TLS,
            USE_CREDENTIALS=True,
            **_connection_extras(),
        )
        _demo_fastmail = FastMail(conf)
    return _demo_fastmail


def _apply_demo_remap(to: str) -> tuple[str, bool]:
    """If To matches the demo seed email, rewrite to DEMO_EMAIL_REMAP_TO."""
    if DEMO_EMAIL_REMAP_TO and to.strip().lower() == DEMO_EMAIL_REMAP_FROM:
        return DEMO_EMAIL_REMAP_TO, True
    return to, False


def is_demo_remap_recipient(email: str) -> bool:
    """True when this address uses the demo Outlook remap path."""
    return bool(DEMO_EMAIL_REMAP_TO and (email or "").strip().lower() == DEMO_EMAIL_REMAP_FROM)


async def _send_via_mailtrap_sandbox(to: str, subject: str, body: str) -> None:
    """Send into Mailtrap Email Testing sandbox (appears in My Sandbox inbox)."""
    import httpx

    url = f"{MAILTRAP_SANDBOX_API}/api/send/{MAILTRAP_INBOX_ID}"
    payload = {
        "from": {"email": MAIL_FROM or "hello@example.com", "name": MAIL_FROM_NAME},
        "to": [{"email": to}],
        "subject": subject,
        "html": body,
    }
    headers = {
        "Authorization": f"Bearer {MAILTRAP_API_TOKEN}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, headers=headers)
        resp.raise_for_status()
    logger.info("Email sent to %s via Mailtrap sandbox — %s", to, subject)


async def _send_email(to: str, subject: str, body: str) -> None:
    if DISABLE_EMAILS:
        logger.info("=== EMAIL (disabled for demo) ===")
        logger.info("To: %s | Subject: %s", to, subject)
        return

    to, is_demo_remap = _apply_demo_remap(to)

    # Prefer Mailtrap sandbox API when configured (matches Email Testing Integrations UI).
    if _mailtrap_sandbox_configured():
        try:
            await _send_via_mailtrap_sandbox(to, subject, body)
            return
        except Exception as e:
            logger.error("Mailtrap sandbox send failed: %s", e)
            logger.info("=== EMAIL (fallback after error) ===")
            logger.info("To: %s | Subject: %s", to, subject)
            logger.info("Body:\n%s", body)
            return

    use_demo_smtp = is_demo_remap and _demo_mail_configured()

    if use_demo_smtp:
        mailer = _get_demo_fastmail()
    elif _mail_configured():
        mailer = _get_fastmail()
    else:
        logger.info("=== EMAIL (console fallback) ===")
        logger.info("To: %s%s", to, " (demo remap)" if is_demo_remap else "")
        logger.info("Subject: %s", subject)
        logger.info("Body:\n%s", body)
        logger.info("================================")
        return

    try:
        from fastapi_mail import MessageSchema, MessageType

        message = MessageSchema(
            subject=subject,
            recipients=[to],
            body=body,
            subtype=MessageType.html,
        )
        await mailer.send_message(message)
        logger.info(
            "Email sent to %s — %s%s",
            to,
            subject,
            " (demo remap + demo SMTP)" if use_demo_smtp else (" (demo remap)" if is_demo_remap else ""),
        )
    except Exception as e:
        logger.error("Email send failed: %s", e)
        logger.info("=== EMAIL (fallback after error) ===")
        logger.info("To: %s | Subject: %s", to, subject)
        logger.info("Body:\n%s", body)


async def send_verification_email(name: str, email: str, token: str) -> None:
    verify_url = f"{FRONTEND_URL}/auth/verify/{token}"
    body = f"""
    <p>Hi {name},</p>
    <p>Welcome to RHIP Connect. Click the link below to verify your account:</p>
    <p><a href="{verify_url}">{verify_url}</a></p>
    <p>This link expires in 24 hours.</p>
    """
    await _send_email(email, "Verify your RHIP Connect account", body)


async def send_password_reset_email(name: str, email: str, token: str) -> None:
    reset_url = f"{FRONTEND_URL}/auth/reset-password/{token}"
    body = f"""
    <p>Hi {name},</p>
    <p>You requested a password reset. Click the link below:</p>
    <p><a href="{reset_url}">{reset_url}</a></p>
    <p>This link expires in 1 hour.</p>
    """
    await _send_email(email, "Reset your RHIP Connect password", body)


async def send_tenant_enquiry_confirmation(enquiry) -> None:
    body = f"""
    <h3>New HTH Tenant Enquiry — {enquiry.company_name}</h3>
    <p><strong>Contact:</strong> {enquiry.contact_name}</p>
    <p><strong>Email:</strong> {enquiry.email}</p>
    <p><strong>Phone:</strong> {enquiry.phone}</p>
    <p><strong>Company type:</strong> {enquiry.company_type}</p>
    <p><strong>Desks needed:</strong> {enquiry.desks_needed}</p>
    <p><strong>Preferred start:</strong> {enquiry.preferred_start or 'Not specified'}</p>
    <p><strong>Message:</strong> {enquiry.message}</p>
    """
    await _send_email(ADMIN_EMAIL, f"New HTH Tenant Enquiry — {enquiry.company_name}", body)


async def send_investor_enquiry_notification(enquiry) -> None:
    body = f"""
    <h3>New Investor Contact — {enquiry.name}</h3>
    <p><strong>Email:</strong> {enquiry.email}</p>
    <p><strong>Phone:</strong> {enquiry.phone}</p>
    <p><strong>Message:</strong> {enquiry.message}</p>
    """
    await _send_email(ADMIN_EMAIL, f"New Investor Contact — {enquiry.name}", body)


async def send_project_investment_notification(project, investor, investment) -> None:
    body = f"""
    <h3>New Project Investment Expression of Interest</h3>
    <p><strong>Project:</strong> {project.title}</p>
    <p><strong>Investor:</strong> {investor.name} ({investor.email})</p>
    <p><strong>Amount (AUD):</strong> {investment.amount:,.0f}</p>
    <p><strong>Message:</strong> {investment.message or "—"}</p>
    """
    await _send_email(
        ADMIN_EMAIL,
        f"Investment EOI — {project.title} — {investor.name}",
        body,
    )


async def send_government_briefing_notification(briefing) -> None:
    body = f"""
    <h3>New Government Briefing Request — {briefing.organisation}</h3>
    <p><strong>Contact:</strong> {briefing.contact_name} ({briefing.email})</p>
    <p><strong>Phone:</strong> {briefing.phone}</p>
    <p><strong>Purpose:</strong> {briefing.purpose}</p>
    <p><strong>Preferred format:</strong> {briefing.preferred_format}</p>
    <p><strong>Topics of interest:</strong> {briefing.topics or "—"}</p>
    <p><strong>Additional details:</strong> {briefing.message or "—"}</p>
    """
    await _send_email(
        ADMIN_EMAIL,
        f"Government Briefing Request — {briefing.organisation}",
        body,
    )


async def send_match_notification_email(
    researcher,
    challenge,
    match_rank: int,
    reasoning: str,
    clinician_name: str,
) -> None:
    if not getattr(researcher, "email_matches", True):
        return
    body = f"""
    <p>Hi {researcher.name},</p>
    <p>Dr. {clinician_name} posted a clinical challenge: <strong>{challenge.title}</strong>.</p>
    <p>Anthropic ranked you #{match_rank} because: <em>{reasoning}</em></p>
    <p><a href="{FRONTEND_URL}/challenges">Log in to RHIP Connect</a> to view and respond.</p>
    """
    await _send_email(
        researcher.email,
        "You've been matched to a clinical challenge on RHIP Connect",
        body,
    )


async def send_connection_request_email(
    receiver,
    initiator,
    challenge,
    opening_message: str,
) -> None:
    if not getattr(receiver, "email_connections", True):
        return
    context_line = (
        f'<p>Re: <strong>{challenge.title}</strong></p>'
        if challenge
        else "<p>Via the <strong>Expertise Directory</strong></p>"
    )
    body = f"""
    <p>Hi {receiver.name},</p>
    <p><strong>{initiator.name}</strong> wants to connect with you on RHIP Connect.</p>
    {context_line}
    <p><em>"{opening_message}"</em></p>
    <p><a href="{FRONTEND_URL}/messages">Log in to accept or decline</a>.</p>
    """
    await _send_email(
        receiver.email,
        f"{initiator.name} wants to connect with you on RHIP Connect",
        body,
    )


async def send_new_message_email(recipient, sender, thread_id: str) -> None:
    if not getattr(recipient, "email_messages", True):
        return
    body = f"""
    <p>Hi {recipient.name},</p>
    <p>You have a new message from <strong>{sender.name}</strong> on RHIP Connect.</p>
    <p><a href="{FRONTEND_URL}/messages/{thread_id}">Log in to reply</a>.</p>
    """
    await _send_email(
        recipient.email,
        f"New message from {sender.name} on RHIP Connect",
        body,
    )


async def send_passport_tier_upgrade_email(user, new_tier: str, events_attended: int) -> None:
    if not getattr(user, "email_passport", True):
        return
    tier_label = new_tier.capitalize()
    body = f"""
    <p>Hi {user.name},</p>
    <p>Congratulations! You've reached <strong>{tier_label}</strong> tier on the RHIP Precinct Passport.</p>
    <p>You've attended <strong>{events_attended}</strong> RHIP events this year.</p>
    <p><a href="{FRONTEND_URL}/passport">View your passport</a> to see your rewards.</p>
    """
    await _send_email(
        user.email,
        f"You've reached {tier_label} tier on the RHIP Precinct Passport!",
        body,
    )
