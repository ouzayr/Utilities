from __future__ import annotations

import base64
import hashlib
import os
from functools import lru_cache

from cryptography.fernet import Fernet

from .config import settings


def _coerce_fernet_key(raw: str) -> bytes:
    """Accept either a valid Fernet key or any passphrase and derive one.

    If the supplied env value is already a 32-byte urlsafe-b64 Fernet key, use
    it verbatim; otherwise SHA-256 it and urlsafe-b64 the digest to produce a
    deterministic, valid key. This keeps dev setup low-friction while letting
    production override with a real random key.
    """
    try:
        if len(base64.urlsafe_b64decode(raw.encode())) == 32:
            return raw.encode()
    except Exception:  # noqa: BLE001
        pass
    digest = hashlib.sha256(raw.encode()).digest()
    return base64.urlsafe_b64encode(digest)


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    """Return a Fernet instance, deriving a key from env or a local key file.

    The local key file lives at data_dir/secret.key and is generated on first
    use. In production, set SQLUTIL_ENCRYPTION_KEY to a base64-urlsafe 32-byte key
    (or any passphrase — it will be hashed to a valid key).
    """
    env_key = os.environ.get(settings.encryption_key_env)
    if env_key:
        return Fernet(_coerce_fernet_key(env_key))

    key_path = settings.data_dir / "secret.key"
    if not key_path.exists():
        key_path.parent.mkdir(parents=True, exist_ok=True)
        key_path.write_bytes(Fernet.generate_key())
        try:
            os.chmod(key_path, 0o600)
        except OSError:
            pass
    return Fernet(key_path.read_bytes())


def encrypt(plaintext: str) -> str:
    token = _fernet().encrypt(plaintext.encode())
    return base64.urlsafe_b64encode(token).decode()


def decrypt(ciphertext: str) -> str:
    token = base64.urlsafe_b64decode(ciphertext.encode())
    return _fernet().decrypt(token).decode()
