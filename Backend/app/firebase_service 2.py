import json
import logging
import os

logger = logging.getLogger(__name__)

_initialized = False


def is_firebase_configured() -> bool:
    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    json_str = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
    return bool((path and os.path.exists(path)) or json_str)


def _init_firebase() -> bool:
    global _initialized
    if _initialized:
        return True
    if not is_firebase_configured():
        return False

    import firebase_admin
    from firebase_admin import credentials

    path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH", "")
    json_str = os.getenv("FIREBASE_CREDENTIALS_JSON", "")
    if path and os.path.exists(path):
        cred = credentials.Certificate(path)
    else:
        cred = credentials.Certificate(json.loads(json_str))

    firebase_admin.initialize_app(cred)
    _initialized = True
    return True


def verify_firebase_token(id_token: str) -> dict:
    if not _init_firebase():
        raise RuntimeError("Firebase is not configured")

    from firebase_admin import auth

    return auth.verify_id_token(id_token)
