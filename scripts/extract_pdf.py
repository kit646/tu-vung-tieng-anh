"""Extract A2 wordlist table from PDF into data/raw/pdf_wordlist.json."""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

import pdfplumber

_ROOT_PDF = Path(r"D:\downloads\Tổng Hợp Từ Vựng\TỔNG HỢP TỪ VỰNG A2 - UNIT 1-6.pdf")
_SUB_PDF = Path(r"D:\downloads\Tổng Hợp Từ Vựng\Từ Vựng\TỔNG HỢP TỪ VỰNG A2 - UNIT 1-6.pdf")
PDF_PATH = _ROOT_PDF if _ROOT_PDF.exists() else _SUB_PDF
OUT_PATH = Path(__file__).resolve().parent.parent / "data" / "raw" / "pdf_wordlist.json"

# Column x-boundaries derived from the PDF table gridlines:
# Unit: ~95-134, Page: ~134-169, ENGLISH: ~169-240, PoS: ~240-282,
# Definition: ~282-445, Pronunciation: ~445-502, Example: ~502-693
IPA_FONTS = {"CIDFont+F2", "CIDFont+F5"}
EXAMPLE_FONT = "CIDFont+F4"


def slugify(text: str) -> str:
    """Create a URL-safe lowercase slug from an English word or phrase."""
    norm_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = norm_text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def chars_to_text(chars: list[dict]) -> str:
    """Reconstruct multi-line text from pdfplumber char dicts, preserving spaces."""
    if not chars:
        return ""

    # Group characters into visual lines by y-position (top)
    lines: list[list[dict]] = []
    for ch in sorted(chars, key=lambda c: (round(c["top"], 1), c["x0"])):
        if not lines or abs(ch["top"] - lines[-1][0]["top"]) > 4.0:
            lines.append([ch])
        else:
            lines[-1].append(ch)

    line_strings: list[str] = []
    for line in lines:
        line_sorted = sorted(line, key=lambda c: c["x0"])
        parts: list[str] = []
        prev_x1: float | None = None
        for ch in line_sorted:
            if prev_x1 is not None and (ch["x0"] - prev_x1) > 1.5:
                # Insert space if gap is larger than normal kerning and neither is already space
                if not (parts and parts[-1] == " ") and ch["text"] != " ":
                    parts.append(" ")
            parts.append(ch["text"])
            prev_x1 = ch["x1"]
        line_str = "".join(parts).strip()
        if line_str:
            line_strings.append(line_str)

    # Join wrapped lines with a single space and normalize whitespace
    joined = " ".join(line_strings)
    return re.sub(r"\s+", " ", joined).strip()


def extract_row_from_chars(
    page_chars: list[dict],
    cells: list[tuple[float, float, float, float] | None],
) -> tuple[str, str, str, str, str, str, str]:
    """Extract 7 columns for a table row using cell bounds and font separation for IPA/Example."""
    row_top = min(c[1] for c in cells if c is not None)
    row_bottom = max(c[3] for c in cells if c is not None)

    row_chars = [
        c
        for c in page_chars
        if row_top <= (c["top"] + c["bottom"]) / 2 <= row_bottom
    ]

    col_bounds = [
        (cells[i][0], cells[i][2]) if cells[i] is not None else (0.0, 0.0)
        for i in range(7)
    ]

    def in_col(ch: dict, idx: int) -> bool:
        x0, x1 = col_bounds[idx]
        cx = (ch["x0"] + ch["x1"]) / 2
        return x0 <= cx <= x1

    unit_text = chars_to_text([c for c in row_chars if in_col(c, 0)])
    page_text = chars_to_text([c for c in row_chars if in_col(c, 1)])
    word_text = chars_to_text([c for c in row_chars if in_col(c, 2)])
    pos_text = chars_to_text([c for c in row_chars if in_col(c, 3)])
    def_text = chars_to_text([c for c in row_chars if in_col(c, 4)])

    # IPA can overflow slightly past col 5's right border (x1 ~ 502) into col 6.
    # Only apply font-based separation in the boundary zone when IPA actually
    # reaches the right edge of col 5, so normal Example rows in CIDFont+F2 (e.g. Thailand)
    # are not dropped.
    ipa_x0, ipa_x1 = col_bounds[5]
    ex_x0, ex_x1 = col_bounds[6]
    ipa_in_col = [c for c in row_chars if in_col(c, 5)]
    ipa_overflows = any(c["x1"] >= ipa_x1 - 2.0 for c in ipa_in_col)

    if ipa_overflows:
        overflow_chars = [
            c
            for c in row_chars
            if ex_x0 <= (c["x0"] + c["x1"]) / 2 <= ex_x1
            and c.get("fontname") in IPA_FONTS
        ]
        overflow_ids = {id(c) for c in overflow_chars}
        ipa_chars = ipa_in_col + overflow_chars
        ex_chars = [c for c in row_chars if in_col(c, 6) and id(c) not in overflow_ids]
    else:
        ipa_chars = ipa_in_col
        ex_chars = [c for c in row_chars if in_col(c, 6)]

    ipa_text = chars_to_text(ipa_chars)
    ex_text = chars_to_text(ex_chars)

    return unit_text, page_text, word_text, pos_text, def_text, ipa_text, ex_text


def extract_wordlist(pdf_path: Path) -> list[dict]:
    """Extract all vocabulary entries from the PDF wordlist."""
    records: list[dict] = []
    seen_ids: set[str] = set()

    with pdfplumber.open(pdf_path) as pdf:
        for p_idx, page in enumerate(pdf.pages):
            tables = page.find_tables()
            if not tables:
                continue
            table = tables[0]
            page_chars = page.chars

            for r_idx, row in enumerate(table.rows):
                if p_idx == 0 and r_idx == 0:
                    # Skip table header row on page 1
                    continue

                unit_s, page_s, word, pos, defn, ipa, ex = extract_row_from_chars(
                    page_chars, row.cells
                )

                if not word:
                    continue

                unit_num = int(unit_s) if unit_s.isdigit() else 0
                page_num = int(page_s) if page_s.isdigit() else 0

                base_id = f"a2-u{unit_num}-{slugify(word)}"
                rec_id = base_id
                if rec_id in seen_ids:
                    pos_slug = slugify(pos) or "alt"
                    rec_id = f"{base_id}-{pos_slug}"
                    counter = 2
                    while rec_id in seen_ids:
                        rec_id = f"{base_id}-{pos_slug}-{counter}"
                        counter += 1
                seen_ids.add(rec_id)

                records.append(
                    {
                        "id": rec_id,
                        "word": word,
                        "pos": pos,
                        "ipa": ipa,
                        "definition_en": defn,
                        "meaning_vi": "",
                        "example": ex,
                        "level": "A2",
                        "source": "wordlist",
                        "unit": unit_num,
                        "page": page_num,
                    }
                )

    return records


def main() -> None:
    records = extract_wordlist(PDF_PATH)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(
        json.dumps(records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    unit_counts = Counter(r["unit"] for r in records)
    missing = [
        r
        for r in records
        if not r["ipa"] or not r["example"] or not r["definition_en"]
    ]

    print(f"Output: {OUT_PATH}")
    print(f"Tong so tu: {len(records)}")
    print("So tu theo tung unit:")
    for u in sorted(unit_counts):
        print(f"  Unit {u}: {unit_counts[u]}")
    print(f"Ban ghi thieu truong (ipa/example/definition_en): {len(missing)}")
    for r in missing:
        print(
            f"  - {r['id']}: ipa={bool(r['ipa'])}, "
            f"example={bool(r['example'])}, definition_en={bool(r['definition_en'])}"
        )


if __name__ == "__main__":
    main()
