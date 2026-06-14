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


async def send_match_notification_email(
    researcher,
    challenge,
    match_rank: int,
    reasoning: str,
    clinician_name: str,
) -> None:
    body = f"""
    <p>Hi {researcher.name},</p>
    <p>Dr. {clinician_name} posted a clinical challenge: <strong>{challenge.title}</strong>.</p>
    <p>Qwen ranked you #{match_rank} because: <em>{reasoning}</em></p>
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
    body = f"""
    <p>Hi {receiver.name},</p>
    <p><strong>{initiator.name}</strong> wants to connect with you on RHIP Connect.</p>
    <p>Re: <strong>{challenge.title}</strong></p>
    <p><em>"{opening_message}"</em></p>
    <p><a href="{FRONTEND_URL}/messages">Log in to accept or decline</a>.</p>
    """
    await _send_email(
        receiver.email,
        f"{initiator.name} wants to connect with you on RHIP Connect",
        body,
    )


async def send_new_message_email(recipient, sender, thread_id: str) -> None:
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
