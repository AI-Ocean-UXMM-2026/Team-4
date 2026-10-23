"""Validate and normalize small, private profile photos before storing them."""
import base64
import binascii
from io import BytesIO
import warnings

from PIL import Image, ImageOps, UnidentifiedImageError

from .errors import APIError

MAX_PHOTO_BYTES = 2 * 1024 * 1024
MAX_PHOTO_DATA_URL = ((MAX_PHOTO_BYTES + 2) // 3) * 4 + 64
PHOTO_TYPES = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


def normalize_photo(value: str | None) -> str | None:
    if value is None:
        return None
    invalid = APIError(400, "PROFILE_PHOTO_INVALID", "Choose a valid JPG, PNG or WebP photo up to 2 MB.")
    if len(value) > MAX_PHOTO_DATA_URL:
        raise invalid
    try:
        header, encoded = value.split(",", 1)
        media_type = header.removeprefix("data:").removesuffix(";base64")
        if header != f"data:{media_type};base64" or media_type not in PHOTO_TYPES:
            raise ValueError("Unsupported image type")
        content = base64.b64decode(encoded, validate=True)
        if not content or len(content) > MAX_PHOTO_BYTES:
            raise ValueError("Invalid image size")
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format != PHOTO_TYPES[media_type]:
                    raise ValueError("Image type mismatch")
                if max(image.size) > 8192 or image.width * image.height > 16_000_000:
                    raise ValueError("Image dimensions too large")
                image.verify()
            with Image.open(BytesIO(content)) as image:
                # Decode/re-encode the first frame, apply orientation, and discard metadata.
                oriented = ImageOps.exif_transpose(image)
                square = ImageOps.fit(oriented.convert("RGBA"), (256, 256), method=Image.Resampling.LANCZOS)
                flattened = Image.new("RGB", square.size, "white")
                flattened.paste(square, mask=square.getchannel("A"))
                output = BytesIO()
                flattened.save(output, format="JPEG", quality=85, optimize=True)
        return "data:image/jpeg;base64," + base64.b64encode(output.getvalue()).decode("ascii")
    except (ValueError, binascii.Error, OSError, UnidentifiedImageError,
            Image.DecompressionBombWarning, Image.DecompressionBombError):
        raise invalid from None
