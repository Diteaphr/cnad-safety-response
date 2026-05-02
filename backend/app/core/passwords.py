"""Password hashing for local registration / login (PBKDF2, stdlib only)."""

from __future__ import annotations

import hashlib
import secrets


def hash_password(plain: str) -> str:
    salt = secrets.token_hex(16)
    iterations = 100_000
    dk = hashlib.pbkdf2_hmac(
        "sha256",
        plain.encode("utf-8"),
        bytes.fromhex(salt),
        iterations,
    )
    return f"pbkdf2_sha256${iterations}${salt}${dk.hex()}"


def verify_password(plain: str, stored: str | None) -> bool:
    if not stored:
        return False
    parts = stored.split("$")
    if len(parts) != 4 or parts[0] != "pbkdf2_sha256":
        return False
    try:
        iterations = int(parts[1])
        salt_hex = parts[2]
        want = parts[3]
    except (ValueError, IndexError):
        return False
    try:
        salt = bytes.fromhex(salt_hex)
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", plain.encode("utf-8"), salt, iterations)
    return dk.hex() == want
