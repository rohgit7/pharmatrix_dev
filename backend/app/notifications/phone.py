import re


def normalize_phone_number(phone: str) -> str:
    """
    Normalize a phone number into digits suitable for
    WhatsApp provider integration.

    For India, numbers stored as:
        9876543210
        +919876543210
        919876543210

    become:
        919876543210
    """

    value = phone.strip()

    digits = re.sub(r"\D", "", value)

    if digits.startswith("0"):
        digits = digits[1:]

    if len(digits) == 10:
        digits = f"91{digits}"

    if not digits:
        raise ValueError("Phone number is empty")

    if len(digits) < 10:
        raise ValueError("Invalid phone number")

    return digits