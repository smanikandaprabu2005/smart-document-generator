import io
from io import BytesIO
import os
import requests
import tempfile
import subprocess
import shlex
import logging
from dotenv import load_dotenv
load_dotenv()

# Pillow for image resizing
from PIL import Image

from docxtpl import DocxTemplate, InlineImage
from docx.shared import Inches
from utils.qr_generator import generate_qr
from llm_client import get_llm_client

logger = logging.getLogger(__name__)

# Centralized LLM client
llm_client = get_llm_client()

SDG_FOLDER = "sdg"   # relative path OR full absolute path

# ========================
# Image APIs
# ========================
UNSPLASH_ACCESS_KEY = os.getenv("UNSPLASH_ACCESS_KEY")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
GOOGLE_CX = os.getenv("GOOGLE_CX")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY")

# Main image sizing (in inches). Set via env to control output size.
def _get_env_float(*names, default=None):
    for n in names:
        v = os.getenv(n)
        if v is not None and v != "":
            try:
                return float(v)
            except ValueError:
                continue
    return default

# Support either MAIN_IMAGE_WIDTH or MAIN_IMAGE_WIDTH_IN in env files.
MAIN_IMAGE_WIDTH_IN = _get_env_float("MAIN_IMAGE_WIDTH_IN", "MAIN_IMAGE_WIDTH", default=4.0)
# Support either MAIN_IMAGE_HEIGHT or MAIN_IMAGE_HEIGHT_IN; None means "auto".
MAIN_IMAGE_HEIGHT_IN = _get_env_float("MAIN_IMAGE_HEIGHT_IN", "MAIN_IMAGE_HEIGHT", default=None)
# Optional cap in pixels for main image height. If not set, default to 150px.
try:
    MAIN_IMAGE_MAX_HEIGHT_PX = int(os.getenv("MAIN_IMAGE_MAX_HEIGHT_PX", "150"))
except ValueError:
    MAIN_IMAGE_MAX_HEIGHT_PX = 150

# Auto-crop portrait images before resizing when enabled
MAIN_IMAGE_AUTO_CROP = os.getenv("MAIN_IMAGE_AUTO_CROP", "false").lower() in ("1", "true", "yes")
# DPI used to convert inches -> pixels for cropping/resizing
try:
    MAIN_IMAGE_DPI = int(os.getenv("MAIN_IMAGE_DPI", "150"))
except ValueError:
    MAIN_IMAGE_DPI = 150




# ========================
# SAFE IMAGE VALIDATION
# ========================

def validate_image_bytes(img_bytes: BytesIO):
    """Returns True ONLY if image bytes represent a valid image file."""
    if not img_bytes:
        return False
    data = img_bytes.getvalue()
    if len(data) < 100:
        return False

    # Basic check for PNG/JPG
    header = data[:8]
    if header.startswith(b"\x89PNG") or header.startswith(b"\xFF\xD8\xFF"):
        return True

    return False


def generate_text(prompt, temperature=0.7, max_tokens=180):
    """
    Generate text using LLM client (Gemini → Groq fallback).
    Returns None if all LLMs fail.
    """
    result = llm_client.generate_text(prompt, temperature, max_tokens)
    if result is None:
        logger.warning(f"All LLMs failed for prompt: {prompt[:50]}...")
    return result


# ========================
# Gemini SDG Number Detection
# ========================

def gemini_get_sdg_no(topic):
    """
    Detect SDG number for a given topic using LLM.
    Uses centralized LLM client with Gemini → Groq fallback.
    Returns SDG number (1-17) or None if failed.
    """
    prompt = (
        "Given the following event topic or title, determine which UN Sustainable "
        "Development Goal (SDG) it best represents. Respond ONLY with a number 1–17.\n"
        f"Topic: {topic}"
    )

    try:
        result = llm_client.generate_text(prompt, temperature=0.3, max_tokens=5)
        if result:
            sdg_no = int(result.strip())
            if 1 <= sdg_no <= 17:
                logger.info(f"Detected SDG {sdg_no} for topic: {topic}")
                return sdg_no
    except (ValueError, TypeError) as e:
        logger.warning(f"Could not parse SDG number: {e}")
    
    logger.warning(f"Failed to detect SDG for topic: {topic}")
    return None




def fetch_sdg_icon(sdg_no):
    """
    Load SDG icon from local sdg folder.
    Expected filenames: 1.png, 2.png ... 17.png
    """
    filename = os.path.join(SDG_FOLDER, f"{sdg_no}.png")

    if not os.path.exists(filename):
        print(f"SDG icon not found: {filename}")
        return None

    try:
        with open(filename, "rb") as f:
            img_bytes = BytesIO(f.read())

        if validate_image_bytes(img_bytes):
            return img_bytes

    except Exception as e:
        print("Local SDG load error:", e)

    return None




# ========================
# Google & Unsplash Image Search
# ========================

def fetch_google_image(query):
    if not (GOOGLE_API_KEY and GOOGLE_CX):
        return None

    params = {
        "q": query,
        "cx": GOOGLE_CX,
        "key": GOOGLE_API_KEY,
        "searchType": "image",
        "num": 3
    }

    try:
        resp = requests.get("https://www.googleapis.com/customsearch/v1", params=params)
        data = resp.json()
        items = data.get("items")

        if items:
            img_url = items[2]["link"]
            img = requests.get(img_url)

            img_bytes = BytesIO(img.content)
            if validate_image_bytes(img_bytes):
                return img_bytes

    except Exception as e:
        print("Google Image API error:", e)

    return None



def fetch_unsplash_image(query):
    if not UNSPLASH_ACCESS_KEY:
        return None

    url = "https://api.unsplash.com/search/photos"
    params = {
        "query": query,
        "per_page": 1,
        "client_id": UNSPLASH_ACCESS_KEY
    }

    try:
        resp = requests.get(url, params=params)
        data = resp.json()

        if data.get("results"):
            img_url = data["results"][0]["urls"]["regular"]
            img = requests.get(img_url)

            img_bytes = BytesIO(img.content)
            if validate_image_bytes(img_bytes):
                return img_bytes

    except:
        pass

    return None


def fetch_pexels_image(query):
    """Fetch an image from Pexels using the PEXELS_API_KEY env var."""
    if not PEXELS_API_KEY:
        return None

    url = "https://api.pexels.com/v1/search"
    headers = {
        "Authorization": PEXELS_API_KEY
    }
    params = {
        "query": query,
        "per_page": 1
    }

    try:
        r = requests.get(url, headers=headers, params=params, timeout=10)
        r.raise_for_status()
        data = r.json()
        photos = data.get("photos")
        if photos:
            img_url = photos[0].get("src", {}).get("large")
            if img_url:
                img = requests.get(img_url, timeout=10)
                img_bytes = BytesIO(img.content)
                if validate_image_bytes(img_bytes):
                    return img_bytes
    except Exception as e:
        logger.warning(f"Pexels Image API error: {e}")

    return None


def get_best_image(query):
    """Return best available image from Unsplash -> Pexels -> Google."""
    img = None
    # Prefer Unsplash for modern images
    img = fetch_unsplash_image(query)
    if img:
        return img

    # Fallback to Pexels
    img = fetch_pexels_image(query)
    if img:
        return img

    # Final fallback to Google
    img = fetch_google_image(query)
    return img


def resize_image_max_height_bytes(img_bytes: BytesIO, max_height_px: int = 350) -> BytesIO:
    """Resize image (preserve aspect ratio) so its height does not exceed max_height_px.

    Returns a BytesIO containing the resized image in JPEG (or original) format.
    """

    if not img_bytes:
        return img_bytes
    try:
        img_bytes.seek(0)
        with Image.open(img_bytes) as im:
            orig_format = im.format or "JPEG"
            w, h = im.size

            if h > max_height_px:
                ratio = max_height_px / float(h)
                new_w = max(1, int(w * ratio))
                new_h = max(1, int(h * ratio))
                im = im.resize((new_w, new_h), Image.LANCZOS)

            out = BytesIO()
            save_format = "JPEG" if orig_format.upper() not in ["PNG", "GIF", "BMP", "TIFF"] else orig_format
            im.save(out, format=save_format, quality=85)
            out.seek(0)
            return out

    except Exception as e:
        logger.warning(f"Image resize failed: {e}")
        try:
            img_bytes.seek(0)
        except Exception:
            pass
        return img_bytes

def resize_and_crop_image_bytes(img_bytes: BytesIO, target_w_px: int = 600, target_h_px: int = 750) -> BytesIO:
    """Crop center (if portrait) then resize to exact target WxH preserving important center area.

    This will produce an image with exact dimensions (may crop edges), which is ideal
    for consistent layout without distortion.
    """
    if not img_bytes:
        return img_bytes

    try:
        img_bytes.seek(0)
        with Image.open(img_bytes) as im:
            w, h = im.size

            # If portrait (taller than wide), crop center vertically to match target aspect
            target_ratio = target_w_px / float(target_h_px)
            img_ratio = w / float(h)

            if img_ratio < target_ratio:
                # crop height
                new_h = int(w / target_ratio)
                top = max(0, (h - new_h) // 2)
                im = im.crop((0, top, w, top + new_h))
            elif img_ratio > target_ratio:
                # crop width
                new_w = int(h * target_ratio)
                left = max(0, (w - new_w) // 2)
                im = im.crop((left, 0, left + new_w, h))

            im = im.resize((max(1, int(target_w_px)), max(1, int(target_h_px))), Image.LANCZOS)

            out = BytesIO()
            im.save(out, format="JPEG", quality=90)
            out.seek(0)
            return out

    except Exception as e:
        logger.warning(f"Image crop+resize failed: {e}")
        try:
            img_bytes.seek(0)
        except Exception:
            pass
        return img_bytes

    try:
        img_bytes.seek(0)
        with Image.open(img_bytes) as im:
            orig_format = im.format or "JPEG"
            w, h = im.size

            if h > max_height_px:
                ratio = max_height_px / float(h)
                new_w = max(1, int(w * ratio))
                new_h = max(1, int(h * ratio))
                im = im.resize((new_w, new_h), Image.LANCZOS)

            out = BytesIO()
            save_format = "JPEG" if orig_format.upper() not in ["PNG", "GIF", "BMP", "TIFF"] else orig_format
            im.save(out, format=save_format, quality=85)
            out.seek(0)
            return out

    except Exception as e:
        logger.warning(f"Image resize failed: {e}")
        try:
            img_bytes.seek(0)
        except Exception:
            pass
        return img_bytes



# ========================
# Fill Word Template
# ========================
def fill_word(template_path, placeholders, doc_type, doc_id=None):
    doc = DocxTemplate(template_path)

    # QR for certificates
    if doc_type == "certificate" and doc_id:
        qr_buf = generate_qr(doc_id)
        placeholders["qr_code"] = InlineImage(doc, qr_buf, width=Inches(1.5))

    # NOTICE LOGIC
    if doc_type == "notice":

        topic = placeholders.get("title", "")

        # 1. Main Image (prefer Unsplash -> Pexels -> Google)
        img = get_best_image(topic)

        if validate_image_bytes(img):
            # Determine desired insertion dimensions (inches). Use sensible defaults
            # for the notice layout: width=2.2in, height=2.4in when not provided.
            insert_width_in = MAIN_IMAGE_WIDTH_IN or 2.2
            insert_height_in = MAIN_IMAGE_HEIGHT_IN or 2.4

            # Convert to pixels using configured DPI
            dpi = MAIN_IMAGE_DPI
            target_w_px = int(insert_width_in * dpi)
            target_h_px = int(insert_height_in * dpi)

            # Process image: either crop+resize to exact WxH (recommended) or
            # resize preserving aspect ratio with height cap.
            if MAIN_IMAGE_AUTO_CROP:
                processed_img = resize_and_crop_image_bytes(img, target_w_px, target_h_px)
            else:
                processed_img = resize_image_max_height_bytes(img, max_height_px=target_h_px)

            # Insert image forcing both width and height to avoid LibreOffice/Word
            # stretching portrait images after insertion.
            placeholders["main_image"] = InlineImage(
                doc,
                processed_img,
                width=Inches(insert_width_in),
                height=Inches(insert_height_in),
            )
        else:
            placeholders["main_image"] = ""

        # 2. SDG Number
        sdg_no = gemini_get_sdg_no(topic)
        placeholders["no"] = sdg_no or ""

        # 3. SDG Icon
        if sdg_no:
            sdg_img = fetch_sdg_icon(sdg_no)

            if validate_image_bytes(sdg_img):
                placeholders["sdg_image"] = InlineImage(doc, sdg_img, width=Inches(1))
            else:
                placeholders["sdg_image"] = ""
        else:
            placeholders["sdg_image"] = ""

    doc.render(placeholders)
    return doc



# ========================
# Convert DOCX → PDF (LibreOffice)
# ========================
import platform


def convert_docx_to_pdf_libreoffice(input_path, output_path):
    """Convert a .docx file to PDF using LibreOffice command-line.

    This helper is cross-platform. On Windows it points to the typical
    install location, while on Unix-like systems it assumes `soffice` is in
    the PATH. If the executable cannot be found or the conversion fails a
    ``RuntimeError`` is raised with a helpful message. When running on a
    container platform such as Render the executable is often missing; callers
    can catch the exception and fall back to a pure-Python converter.
    """

    output_dir = os.path.dirname(output_path)

    # determine the command to invoke
    if platform.system() == "Windows":
        soffice = r"C:\Program Files\LibreOffice\program\soffice.exe"
    else:
        soffice = "soffice"  # assume it's available on Linux/Unix

    command = f'{soffice} --headless --convert-to pdf "{input_path}" --outdir "{output_dir}"'

    try:
        subprocess.run(
            shlex.split(command),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            check=True,
        )
    except FileNotFoundError:
        raise RuntimeError(
            f"LibreOffice executable '{soffice}' not found. "
            "Install LibreOffice on the server or adjust the path."
        )
    except subprocess.CalledProcessError as e:
        stderr = e.stderr.decode(errors="ignore")
        raise RuntimeError(f"PDF conversion failed: {stderr}")

    generated_pdf = input_path.replace(".docx", ".pdf")

    if not os.path.exists(generated_pdf):
        raise RuntimeError("PDF conversion failed - output file missing")

    os.rename(generated_pdf, output_path)


def convert_docx_to_pdf_simple(input_path, output_path):
    """Minimal pure‑Python converter using python-docx + reportlab.

    This routine walks over paragraphs in the DOCX and places the text
    sequentially in a PDF. It does **not** preserve complex styling or
    images, but it allows the server to generate a file when LibreOffice
    isn't available.  The intent is to provide a safety net for deployment
    environments where installing LibreOffice is impractical.
    """
    try:
        from docx import Document
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas
    except ImportError as e:
        raise RuntimeError("Required libraries for simple PDF conversion are missing: "
                           f"{e}")

    doc = Document(input_path)
    c = canvas.Canvas(output_path, pagesize=letter)
    width, height = letter
    y = height - 72
    line_height = 14

    for para in doc.paragraphs:
        text = para.text
        if not text:
            y -= line_height
            continue
        c.drawString(72, y, text)
        y -= line_height
        if y < 72:
            c.showPage()
            y = height - 72
    c.save()



# ========================
# Create Document
# ========================
def create_document(doc_type, prompt=None, template_path=None, placeholders=None, doc_id=None):

    # Generate AI body text
    if doc_type in ["letter", "circular"] and prompt:
        placeholders["content"] = generate_text(prompt)

    with tempfile.TemporaryDirectory() as tmpdir:
        docx_path = os.path.join(tmpdir, "temp.docx")
        pdf_path = os.path.join(tmpdir, "temp.pdf")

        doc = fill_word(template_path, placeholders, doc_type, doc_id)
        doc.save(docx_path)

        # attempt to convert with LibreOffice; if it is unavailable fall back to
        # the simple Python implementation so that the service remains usable
        # on platforms like Render where installing LibreOffice is not
        # feasible.
        try:
            convert_docx_to_pdf_libreoffice(docx_path, pdf_path)
        except RuntimeError as e:
            logger.warning(
                "LibreOffice conversion failed (%s), falling back to simple PDF converter", e
            )
            convert_docx_to_pdf_simple(docx_path, pdf_path)

        buf = BytesIO()
        with open(pdf_path, "rb") as f:
            buf.write(f.read())

        buf.seek(0)
        return buf
