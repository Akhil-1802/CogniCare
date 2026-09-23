"""High-speed Hybrid OCR Service.

Handles:
- PDFs: Instant digital text extraction via PyMuPDF (< 5ms).
        Falls back to page rendering + RapidOCR for scanned/image PDFs (~300ms).
- Images: Fast local ONNX-accelerated inference via RapidOCR + Pillow (~100-300ms).
- Multi-page limit and DPI optimization to keep latency strictly under ~1-1.5s.
"""

import io
import time
import logging
from typing import Tuple, List, Dict, Any, Optional
from PIL import Image
import numpy as np

logger = logging.getLogger("cognicare.ocr")

# Lazy-loaded singleton for RapidOCR engine
_ocr_engine = None


def get_ocr_engine():
    global _ocr_engine
    if _ocr_engine is None:
        try:
            from rapidocr_onnxruntime import RapidOCR
            _ocr_engine = RapidOCR()
            logger.info("RapidOCR ONNX engine initialized successfully.")
        except Exception as e:
            logger.error(f"Failed to initialize RapidOCR engine: {e}")
            raise RuntimeError(f"OCR engine could not be initialized: {e}")
    return _ocr_engine


def extract_text_from_image_bytes(image_bytes: bytes) -> Tuple[str, float]:
    """Runs RapidOCR on raw image bytes. Returns (extracted_text, average_confidence)."""
    try:
        pil_image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        raise ValueError(f"Invalid image format: {e}")

    # Resize if image is excessively large to keep OCR ultra fast (<300ms)
    max_dim = 1600
    if max(pil_image.width, pil_image.height) > max_dim:
        pil_image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)

    img_arr = np.array(pil_image)
    engine = get_ocr_engine()
    results, _ = engine(img_arr)

    if not results:
        return "", 0.0

    lines: List[str] = []
    confs: List[float] = []
    for item in results:
        # RapidOCR format: [box, text, confidence]
        if len(item) >= 3:
            lines.append(item[1])
            confs.append(float(item[2]))

    full_text = "\n".join(lines).strip()
    avg_conf = sum(confs) / len(confs) if confs else 0.0
    return full_text, avg_conf


def extract_text_from_pdf_bytes(pdf_bytes: bytes, max_pages: int = 5) -> Tuple[str, int, float]:
    """Fast PDF extraction.

    1. Attempts direct digital text extraction via PyMuPDF.
    2. If text is empty or too short (scanned PDF), renders pages and runs RapidOCR.
    Returns (extracted_text, num_pages, confidence).
    """
    import pymupdf

    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as e:
        raise ValueError(f"Invalid PDF file: {e}")

    num_pages = min(len(doc), max_pages)
    direct_texts: List[str] = []

    for i in range(num_pages):
        page = doc[i]
        text = page.get_text().strip()
        if text:
            direct_texts.append(f"--- Page {i + 1} ---\n{text}")

    combined_direct = "\n\n".join(direct_texts).strip()

    # If digital text exists and is substantive, return immediately (<5ms)
    if len(combined_direct) >= 40:
        return combined_direct, num_pages, 0.98

    # Scanned PDF: Render pages to images and run RapidOCR
    scanned_lines: List[str] = []
    conf_scores: List[float] = []

    engine = get_ocr_engine()
    for i in range(num_pages):
        page = doc[i]
        # 150 DPI provides optimal speed vs OCR clarity tradeoff (~150ms per page)
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        results, _ = engine(np.array(img))
        if results:
            page_text = " ".join([r[1] for r in results if len(r) >= 2])
            scanned_lines.append(f"--- Page {i + 1} ---\n{page_text}")
            for r in results:
                if len(r) >= 3:
                    conf_scores.append(float(r[2]))

    combined_scanned = "\n\n".join(scanned_lines).strip()
    avg_conf = sum(conf_scores) / len(conf_scores) if conf_scores else 0.8
    return combined_scanned or combined_direct, num_pages, avg_conf


def process_document_ocr(file_bytes: bytes, filename: str, content_type: Optional[str] = None) -> Dict[str, Any]:
    """Unified entry point for OCR processing.

    Returns:
    {
        "text": str,
        "pages": int,
        "confidence": float,
        "duration_ms": int,
        "file_type": str,
        "filename": str
    }
    """
    t0 = time.perf_counter()
    fname = (filename or "document").lower()
    ctype = (content_type or "").lower()

    is_pdf = fname.endswith(".pdf") or "pdf" in ctype

    if is_pdf:
        text, pages, confidence = extract_text_from_pdf_bytes(file_bytes)
        file_type = "pdf"
    else:
        text, confidence = extract_text_from_image_bytes(file_bytes)
        pages = 1
        file_type = "image"

    duration_ms = int((time.perf_counter() - t0) * 1000)
    logger.info(f"Processed OCR for {filename} ({file_type}) in {duration_ms}ms with {len(text)} chars extracted.")

    return {
        "text": text,
        "pages": pages,
        "confidence": round(confidence, 3),
        "duration_ms": duration_ms,
        "file_type": file_type,
        "filename": filename,
    }
