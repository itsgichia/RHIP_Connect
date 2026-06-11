import logging
import os

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "admin@rhip.edu.au")
MAIL_USERNAME = os.getenv("MAIL_USERNAME", "")
MAIL_PASSWORD = os.getenv("MAIL_PASSWORD", "")


def _mail_configured() -> bool:
    return bool(MAIL_USERNAME and MAIL_PASSWORD and MAIL_USERNAME != "your-mailtrap-username")


async def _send_email(to: str, subject: str, body: str) -> None:
    if not _mail_configured():
        logger.info("=== EMAIL (console fallback) ===")
        logger.info("To: %s", to)
        logger.info("Subject: %s", subject)
        logger.info("Body:\n%s", body)
        logger.info("================================")
        return

    try:
        from fastapi_mail import ConnectionConfig, FastMail, MessageSchema, MessageType

        conf = ConnectionConfig(
            MAIL_USERNAME=MAIL_USERNAME,
            MAIL_PASSWORD=MAIL_PASSWORD,
            MAIL_FROM=os.getenv("MAIL_FROM", "noreply@rhipnexus.edu.au"),
            MAIL_FROM_NAME=os.getenv("MAIL_FROM_NAME", "RHIP Connect"),
            MAIL_SERVER=os.getenv("MAIL_SERVER", "smtp.mailtrap.io"),
            MAIL_PORT=int(os.getenv("MAIL_PORT", "587")),
            MAIL_STARTTLS=os.getenv("MAIL_STARTTLS", "True").lower() == "true",
            MAIL_SSL_TLS=os.getenv("MAIL_SSL_TLS", "False").lower() == "true",
            USE_CREDENTIALS=True,
        )
        message = MessageSchema(
            subject=subject,
            recipients=[to],
            body=body,
            subtype=MessageType.html,
        )
        fm = FastMail(conf)
        await fm.send_message(message)
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
