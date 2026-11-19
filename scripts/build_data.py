"""Merge raw wordlist & book data into data/vocab.json, data/exercises.json, and data/corrections.md."""

from __future__ import annotations

import csv
import json
import re
import unicodedata
from pathlib import Path

from vi_meanings import MEANINGS_VI

ROOT_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT_DIR / "data" / "raw"
DATA_DIR = ROOT_DIR / "data"

PDF_WORDLIST_PATH = RAW_DIR / "pdf_wordlist.json"
BOOK_UNITS_PATH = RAW_DIR / "book_units.json"
BOOK_EXERCISES_PATH = RAW_DIR / "book_exercises.json"

OUT_VOCAB_PATH = DATA_DIR / "vocab.json"
OUT_EXERCISES_PATH = DATA_DIR / "exercises.json"
OUT_CORRECTIONS_PATH = DATA_DIR / "corrections.md"
OUT_REVIEW_CSV_PATH = DATA_DIR / "vocab_vi_review.csv"

CORRECTIONS: list[tuple[str, str, str, str]] = [
    ("Brazilian", "example", "I chatting online to a Brazilian girl.", "I'm chatting online to a Brazilian girl."),
    ("Japanese", "example", "I meeting a Japanese man.", "I'm meeting a Japanese man."),
    ("visitor", "definition_en", "somone who visits a person or place", "someone who visits a person or place"),
    ("Australia", "example", "I spend three years in Australia.", "I spent three years in Australia."),
    ("Chinese", "example", "My brothers partner is Chinese.", "My brother's partner is Chinese."),
    ("Colombian", "example", "I'm met a Columbian man at the library.", "I met a Colombian man at the library."),
    ("Mexican", "example", "My sisiter is married to a Mexican man.", "My sister is married to a Mexican man."),
    ("New Zealand", "example", "My sisiter lives in New Zealand.", "My sister lives in New Zealand."),
    ("Pakistani", "example", "By best friend is Pakastani.", "My best friend is Pakistani."),
    ("grill", "example", "Grill the chicken for 10 minutes untiI it’s brown.", "Grill the chicken for 10 minutes until it’s brown."),
    ("waiter", "definition_en", "a person whose job is to bring the food to customers at their tables in a resturant", "a person whose job is to bring the food to customers at their tables in a restaurant"),
    ("main course", "definition_en", "the largest or most important part of a meal in which there are different parts served seperately", "the largest or most important part of a meal in which there are different parts served separately"),
    ("order", "definition_en", "order a meal at a resturant", "order a meal at a restaurant"),
    ("crisps", "example", "Would you like a packet of crips?", "Would you like a packet of crisps?"),
    ("salad", "example", "We need a onion for the salad.", "We need an onion for the salad."),
    ("directions", "example", "They drove away in oposite directions.", "They drove away in opposite directions."),
    ("found out", "definition_en", "past simple and and past participle of find out", "past simple and past participle of find out"),
]

WORDLIST_TOPICS: dict[int, str] = {
    1: "Quốc gia & tính cách",
    2: "Nghề nghiệp & học tập",
    3: "Tần suất & công nghệ",
    4: "Thực phẩm & nấu ăn",
    5: "Nhà cửa & địa điểm",
    6: "Gia đình & quá khứ",
    7: "Phương tiện di chuyển",
}

BOOK_TOPICS: dict[tuple[str, int], str] = {
    ("A1", 1): "Chào hỏi & con người",
    ("A1", 2): "Gia đình",
    ("A1", 3): "Đồ ăn & thức uống",
    ("A1", 4): "Nhà cửa & phòng ốc",
    ("A1", 5): "Thói quen hằng ngày",
    ("A1", 6): "Thời gian & ngày tháng",
    ("A2", 7): "Quần áo & mua sắm",
    ("A2", 8): "Du lịch & giao thông",
    ("A2", 9): "Thời tiết & các mùa",
    ("A2", 10): "Cơ thể & sức khỏe",
    ("A2", 11): "Sở thích & thời gian rảnh",
    ("A2", 12): "Phố xá & chỉ đường",
}


def slugify(text: str) -> str:
    """Create a URL-safe lowercase ASCII slug from an English word or phrase."""
    norm_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    slug = norm_text.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")


def make_unique_id(base_id: str, pos: str, seen_ids: set[str]) -> str:
    """Ensure vocabulary record id is unique."""
    rec_id = base_id
    if rec_id in seen_ids:
        pos_slug = slugify(pos) or "alt"
        rec_id = f"{base_id}-{pos_slug}"
        counter = 2
        while rec_id in seen_ids:
            rec_id = f"{base_id}-{pos_slug}-{counter}"
            counter += 1
    seen_ids.add(rec_id)
    return rec_id


def apply_corrections(records: list[dict]) -> list[dict[str, str]]:
    """Apply spelling/grammar fixes to wordlist records and return a log of changes."""
    applied: list[dict[str, str]] = []
    for word, field, before, after in CORRECTIONS:
        matched = False
        for rec in records:
            if rec["word"] == word and rec.get(field) == before:
                rec[field] = after
                applied.append(
                    {
                        "id": rec["id"],
                        "word": word,
                        "field": field,
                        "before": before,
                        "after": after,
                    }
                )
                matched = True
        if not matched:
            raise RuntimeError(
                f"Correction did not match any record: word={word!r}, field={field!r}, before={before!r}"
            )
    return applied


def build_vocab(pdf_records: list[dict], book_units: list[dict]) -> tuple[list[dict], dict[str, str]]:
    """Merge wordlist and book units into normalized vocab records plus book-word->id map."""
    vocab: list[dict] = []
    seen_ids: set[str] = set()
    by_word_pos: dict[tuple[str, str], dict] = {}
    book_word_to_id: dict[str, str] = {}

    for raw in pdf_records:
        unit = int(raw["unit"])
        level = raw["level"]
        topic = WORDLIST_TOPICS[unit]
        base_id = f"{level.lower()}-u{unit}-{slugify(raw['word'])}"
        rec_id = make_unique_id(base_id, raw["pos"], seen_ids)

        rec = {
            "id": rec_id,
            "word": raw["word"],
            "pos": raw["pos"],
            "ipa": raw["ipa"],
            "definition_en": raw["definition_en"],
            "meaning_vi": MEANINGS_VI.get(rec_id, raw.get("meaning_vi", "")),
            "example": raw["example"],
            "examples": [raw["example"]] if raw["example"] else [],
            "level": level,
            "source": "wordlist",
            "sources": ["wordlist"],
            "unit": unit,
            "page": int(raw["page"]),
            "topic": topic,
            "tags": [topic],
        }
        vocab.append(rec)
        by_word_pos[(raw["word"].lower(), raw["pos"].lower())] = rec

    for unit_obj in book_units:
        level = unit_obj["level"]
        unit = int(unit_obj["unit"])
        page = int(unit_obj["page"])
        book_topic = BOOK_TOPICS[(level, unit)]

        for w in unit_obj["words"]:
            key = (w["word"].lower(), w["pos"].lower())
            existing = by_word_pos.get(key)
            if existing is not None:
                if "book" not in existing["sources"]:
                    existing["sources"].append("book")
                if w["example"] and w["example"] not in existing["examples"]:
                    existing["examples"].append(w["example"])
                existing["book_level"] = level
                existing["book_unit"] = unit
                existing["book_page"] = page
                existing["book_topic"] = book_topic
                existing["book_definition_en"] = w["definition_en"]
                book_word_to_id[w["word"].lower()] = existing["id"]
            else:
                base_id = f"{level.lower()}-u{unit}-{slugify(w['word'])}"
                rec_id = make_unique_id(base_id, w["pos"], seen_ids)
                rec = {
                    "id": rec_id,
                    "word": w["word"],
                    "pos": w["pos"],
                    "ipa": "",
                    "definition_en": w["definition_en"],
                    "meaning_vi": MEANINGS_VI.get(rec_id, ""),
                    "example": w["example"],
                    "examples": [w["example"]] if w["example"] else [],
                    "level": level,
                    "source": "book",
                    "sources": ["book"],
                    "unit": unit,
                    "page": page,
                    "topic": book_topic,
                    "tags": [book_topic],
                    "book_level": level,
                    "book_unit": unit,
                    "book_page": page,
                    "book_topic": book_topic,
                }
                vocab.append(rec)
                by_word_pos[key] = rec
                book_word_to_id[w["word"].lower()] = rec_id

    return vocab, book_word_to_id


def resolve_word_id(word: str, book_word_to_id: dict[str, str]) -> str:
    """Resolve an exercise word to its vocabulary id."""
    wid = book_word_to_id.get(word.lower().strip())
    if not wid:
        raise RuntimeError(f"Could not resolve word_id for exercise word: {word!r}")
    return wid


def build_exercises(
    raw_exercises: dict,
    book_units: list[dict],
    book_word_to_id: dict[str, str],
) -> dict:
    """Enrich book exercises and reviews with unique IDs, word_ids, and unit_meta."""
    unit_info_by_num = {int(u["unit"]): u for u in book_units}
    units_out: list[dict] = []

    for u_ex in raw_exercises["units"]:
        unit_num = int(u_ex["unit"])
        level = u_ex["level"]
        u_info = unit_info_by_num[unit_num]
        topic = BOOK_TOPICS[(level, unit_num)]

        unit_meta = {
            "level": level,
            "unit": unit_num,
            "title": u_info["title"],
            "topic": topic,
            "study_tip": u_info["study_tip"],
            "page": int(u_info["page"]),
        }

        sec_a = {
            "instruction": u_ex["A"]["instruction"],
            "items": [
                {
                    "id": f"ex-u{unit_num}-a-{it['num']}",
                    "word_id": resolve_word_id(it["word"], book_word_to_id),
                    **it,
                }
                for it in u_ex["A"]["items"]
            ],
        }

        sec_b = {
            "instruction": u_ex["B"]["instruction"],
            "word_bank": u_ex["B"]["word_bank"],
            "items": [
                {
                    "id": f"ex-u{unit_num}-b-{it['num']}",
                    "word_id": resolve_word_id(it["answer"], book_word_to_id),
                    **it,
                }
                for it in u_ex["B"]["items"]
            ],
        }

        sec_c = {
            "instruction": u_ex["C"]["instruction"],
            "items": [
                {
                    "id": f"ex-u{unit_num}-c-{it['num']}",
                    "word_id": resolve_word_id(it["answer_word"], book_word_to_id),
                    **it,
                }
                for it in u_ex["C"]["items"]
            ],
        }

        sec_d = {
            "instruction": u_ex["D"]["instruction"],
            "items": [
                {
                    "id": f"ex-u{unit_num}-d-{it['num']}",
                    "word_id": resolve_word_id(it["answer"], book_word_to_id),
                    **it,
                }
                for it in u_ex["D"]["items"]
            ],
        }

        sec_e = {
            "id": f"ex-u{unit_num}-e-1",
            "instruction": u_ex["E"]["instruction"],
            "prompts": u_ex["E"]["prompts"],
        }

        units_out.append(
            {
                "level": level,
                "unit": unit_num,
                "pages": u_ex["pages"],
                "unit_meta": unit_meta,
                "A": sec_a,
                "B": sec_b,
                "C": sec_c,
                "D": sec_d,
                "E": sec_e,
            }
        )

    reviews_out: list[dict] = []
    for rev in raw_exercises["reviews"]:
        level = rev["level"]
        items_out = [
            {
                "id": f"ex-rev-{level.lower()}-{it['num']}",
                "word_id": resolve_word_id(it["answer"], book_word_to_id),
                **it,
            }
            for it in rev["items"]
        ]
        reviews_out.append(
            {
                "level": level,
                "page": rev["page"],
                "title": rev["title"],
                "word_bank": rev["word_bank"],
                "items": items_out,
            }
        )

    return {"units": units_out, "reviews": reviews_out}


def write_corrections_md(applied: list[dict[str, str]], out_path: Path) -> None:
    """Write human-readable Markdown log of all spelling/grammar corrections."""
    lines = [
        "# Nhật ký sửa lỗi chính tả & ngữ pháp dữ liệu gốc",
        "",
        f"Tổng số bản ghi đã sửa: **{len(applied)}** (từ `data/raw/pdf_wordlist.json`).",
        "",
        "| ID | Từ | Trường | Trước | Sau |",
        "|---|---|---|---|---|",
    ]
    for item in applied:
        before = item["before"].replace("|", "\\|")
        after = item["after"].replace("|", "\\|")
        lines.append(
            f"| `{item['id']}` | {item['word']} | `{item['field']}` | {before} | {after} |"
        )
    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def write_review_csv(vocab: list[dict], out_path: Path) -> None:
    """Export UTF-8-BOM CSV (word, pos, example, meaning_vi) for Excel review."""
    with out_path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(["word", "pos", "example", "meaning_vi"])
        for rec in vocab:
            writer.writerow([rec["word"], rec["pos"], rec["example"], rec["meaning_vi"]])


def main() -> None:
    pdf_records = json.loads(PDF_WORDLIST_PATH.read_text(encoding="utf-8"))
    book_units = json.loads(BOOK_UNITS_PATH.read_text(encoding="utf-8"))
    raw_exercises = json.loads(BOOK_EXERCISES_PATH.read_text(encoding="utf-8"))

    applied_corrections = apply_corrections(pdf_records)
    vocab, book_word_to_id = build_vocab(pdf_records, book_units)
    exercises = build_exercises(raw_exercises, book_units, book_word_to_id)

    OUT_VOCAB_PATH.write_text(
        json.dumps(vocab, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    OUT_EXERCISES_PATH.write_text(
        json.dumps(exercises, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    write_corrections_md(applied_corrections, OUT_CORRECTIONS_PATH)
    write_review_csv(vocab, OUT_REVIEW_CSV_PATH)

    merged_count = sum(1 for r in vocab if len(r["sources"]) > 1)
    print(f"Applied {len(applied_corrections)} corrections -> {OUT_CORRECTIONS_PATH}")
    print(f"Wrote {len(vocab)} vocab records ({merged_count} merged) -> {OUT_VOCAB_PATH}")
    print(
        f"Wrote {len(exercises['units'])} exercise units + {len(exercises['reviews'])} reviews -> {OUT_EXERCISES_PATH}"
    )
    print(f"Wrote {len(vocab)} review rows -> {OUT_REVIEW_CSV_PATH}")


if __name__ == "__main__":
    main()
