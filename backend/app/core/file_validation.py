from fastapi import HTTPException


FILE_SIGNATURES = {
    "application/pdf": (
        b"%PDF-",
    ),
    "image/jpeg": (
        b"\xFF\xD8\xFF",
    ),
    "image/png": (
        b"\x89PNG\r\n\x1a\n",
    ),
}


def validate_file_signature(
    contents: bytes,
    content_type: str,
) -> None:
    signatures = FILE_SIGNATURES.get(content_type)

    if not signatures:
        raise HTTPException(
            status_code=400,
            detail="Unsupported file type",
        )

    if not any(
        contents.startswith(signature)
        for signature in signatures
    ):
        raise HTTPException(
            status_code=400,
            detail=(
                "File content does not match "
                "the declared file type"
            ),
        )