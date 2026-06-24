from datetime import datetime, timedelta
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import email_service
from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_token,
    hash_password,
    is_blocked_email,
    verify_password,
)
from app.database import get_db
from app.models import EmailToken, EmailTokenType, Institution, InstitutionType, Role, User
from app.firebase_service import is_firebase_configured, verify_firebase_token
from app.schemas import (
    FirebaseLoginRequest,
    FirebaseSignupRequest,
    ForgotPasswordRequest,
    LoginRequest,
    MessageResponse,
    RefreshRequest,
    RefreshResponse,
    ResetPasswordRequest,
    SignupRequest,
    TokenResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])
logger = logging.getLogger(__name__)


def _get_or_create_institution(db: Session, name: str) -> Institution:
    inst = db.query(Institution).filter(Institution.name == name).first()
    if inst:
        return inst
    inst = Institution(name=name, type=InstitutionType.UNIVERSITY, partner_pct=None)
    db.add(inst)
    db.flush()
    return inst


@router.post("/signup", response_model=MessageResponse)
async def signup(body: SignupRequest, db: Session = Depends(get_db)):
    if is_blocked_email(body.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personal email addresses are not accepted. Please use your institutional email.",
        )
    if db.query(User).filter(User.email == body.email.lower()).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")

    if body.role in (Role.CLINICIAN, Role.RESEARCHER) and not body.specialty_area:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specialty area required")

    institution = _get_or_create_institution(db, body.institution_name)
    user = User(
        name=body.name,
        email=body.email.lower(),
        password_hash=hash_password(body.password),
        role=body.role,
        institution_id=institution.id,
        specialty_area=body.specialty_area,
        is_verified=False,
        is_active=False,
    )
    db.add(user)
    db.flush()

    token = generate_token()
    email_token = EmailToken(
        user_id=user.id,
        token=token,
        type=EmailTokenType.VERIFY,
        expires_at=datetime.utcnow() + timedelta(hours=24),
    )
    db.add(email_token)
    db.commit()

    await email_service.send_verification_email(user.name, user.email, token)
    return MessageResponse(message="Verification email sent. Check your inbox.")


@router.get("/verify/{token}", response_model=MessageResponse)
def verify_email(token: str, db: Session = Depends(get_db)):
    email_token = (
        db.query(EmailToken)
        .filter(
            EmailToken.token == token,
            EmailToken.type == EmailTokenType.VERIFY,
            EmailToken.used == False,  # noqa: E712
            EmailToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not email_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == email_token.user_id).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User not found")

    user.is_verified = True
    user.is_active = True
    email_token.used = True
    db.commit()
    return MessageResponse(message="Email verified. You can now log in.")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_verified or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please verify your email first")

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
        user_id=user.id,
        name=user.name,
    )


@router.post("/refresh", response_model=RefreshResponse)
def refresh(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
        user_id = payload.get("sub")
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()  # noqa: E712
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    return RefreshResponse(access_token=create_access_token(user.id, user.role))


@router.post("/resend-verification", response_model=MessageResponse)
async def resend_verification(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user and not user.is_verified:
        token = generate_token()
        email_token = EmailToken(
            user_id=user.id,
            token=token,
            type=EmailTokenType.VERIFY,
            expires_at=datetime.utcnow() + timedelta(hours=24),
        )
        db.add(email_token)
        db.commit()
        await email_service.send_verification_email(user.name, user.email, token)
    return MessageResponse(
        message="If that email is registered and unverified, a verification link has been sent."
    )


@router.post("/forgot-password", response_model=MessageResponse)
async def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if user:
        token = generate_token()
        email_token = EmailToken(
            user_id=user.id,
            token=token,
            type=EmailTokenType.RESET,
            expires_at=datetime.utcnow() + timedelta(hours=1),
        )
        db.add(email_token)
        db.commit()
        await email_service.send_password_reset_email(user.name, user.email, token)
    return MessageResponse(message="If that email is registered, a reset link has been sent.")


@router.post("/firebase/signup", response_model=MessageResponse)
async def firebase_signup(body: FirebaseSignupRequest, db: Session = Depends(get_db)):
    if not is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured on the server.",
        )
    try:
        decoded = verify_firebase_token(body.id_token)
    except Exception as exc:
        logger.warning("Firebase token verification failed on signup: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    email = decoded.get("email", "").lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Firebase account has no email")
    if is_blocked_email(email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Personal email addresses are not accepted. Please use your institutional email.",
        )
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Email already registered")
    if body.role in (Role.CLINICIAN, Role.RESEARCHER) and not body.specialty_area:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Specialty area required")

    institution = _get_or_create_institution(db, body.institution_name)
    email_verified = decoded.get("email_verified", False)
    user = User(
        name=body.name,
        email=email,
        password_hash=hash_password(generate_token()),
        role=body.role,
        institution_id=institution.id,
        specialty_area=body.specialty_area,
        is_verified=email_verified,
        is_active=email_verified,
    )
    db.add(user)
    db.commit()
    return MessageResponse(
        message="Account created. Check your inbox to verify your email, then log in."
    )


@router.post("/firebase/login", response_model=TokenResponse)
def firebase_login(body: FirebaseLoginRequest, db: Session = Depends(get_db)):
    if not is_firebase_configured():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Firebase authentication is not configured on the server.",
        )
    try:
        decoded = verify_firebase_token(body.id_token)
    except Exception as exc:
        logger.warning("Firebase token verification failed on login: %s", exc)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid Firebase token")

    email = decoded.get("email", "").lower()
    if not decoded.get("email_verified"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Please verify your email first")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No platform profile found. Sign up again with the same email to restore your account.",
        )

    user.is_verified = True
    user.is_active = True
    db.commit()

    return TokenResponse(
        access_token=create_access_token(user.id, user.role),
        refresh_token=create_refresh_token(user.id),
        role=user.role,
        user_id=user.id,
        name=user.name,
    )


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)):
    email_token = (
        db.query(EmailToken)
        .filter(
            EmailToken.token == body.token,
            EmailToken.type == EmailTokenType.RESET,
            EmailToken.used == False,  # noqa: E712
            EmailToken.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if not email_token:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == email_token.user_id).first()
    user.password_hash = hash_password(body.new_password)
    email_token.used = True
    db.commit()
    return MessageResponse(message="Password updated. You can now log in.")
