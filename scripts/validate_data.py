"""Validate data/vocab.json, data/exercises.json, and data/corrections.md."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT_DIR / "data"

VOCAB_PATH = DATA_DIR / "vocab.json"
EXERCISES_PATH = DATA_DIR / "exercises.json"
CORRECTIONS_PATH = DATA_DIR / "corrections.md"

REQUIRED_VOCAB_KEYS = {
    "id",
    "word",
    "pos",
    "ipa",
    "definition_en",
    "meaning_vi",
    "example",
    "examples",
    "level",
    "source",
    "sources",
    "unit",
    "page",
    "topic",
    "tags",
}

ID_RE = re.compile(r"^(a1|a2)-u\d+-[a-z0-9-]+$")


def normalize_letters(text: str) -> list[str]:
    """Return sorted lowercase ASCII letters for anagram verification."""
    return sorted(re.sub(r"[^a-z]", "", text.lower()))


def validate_vocab(errors: list[str]) -> set[str]:
    """Validate data/vocab.json and return set of valid vocabulary IDs."""
    if not VOCAB_PATH.exists():
        errors.append(f"Missing {VOCAB_PATH}")
        return set()

    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    if not isinstance(vocab, list) or not vocab:
        errors.append("vocab.json must be a non-empty JSON array")
        return set()

    seen_ids: set[str] = set()
    for idx, rec in enumerate(vocab):
        missing_keys = REQUIRED_VOCAB_KEYS - set(rec.keys())
        if missing_keys:
            errors.append(f"vocab[{idx}] ({rec.get('id')}): missing keys {sorted(missing_keys)}")
            continue

        rec_id = rec["id"]
        if not isinstance(rec_id, str) or not ID_RE.match(rec_id):
            errors.append(f"vocab[{idx}]: invalid id format {rec_id!r}")
        if rec_id in seen_ids:
            errors.append(f"vocab[{idx}]: duplicate id {rec_id!r}")
        seen_ids.add(rec_id)

        for str_field in ("word", "pos", "definition_en", "meaning_vi", "example", "topic"):
            if not isinstance(rec[str_field], str) or not rec[str_field].strip():
                errors.append(f"{rec_id}: empty or invalid {str_field!r}")

        if rec["level"] not in {"A1", "A2"}:
            errors.append(f"{rec_id}: invalid level {rec['level']!r}")
        if not isinstance(rec["unit"], int) or rec["unit"] <= 0:
            errors.append(f"{rec_id}: invalid unit {rec['unit']!r}")
        if not isinstance(rec["page"], int) or rec["page"] <= 0:
            errors.append(f"{rec_id}: invalid page {rec['page']!r}")

        if not isinstance(rec["examples"], list) or not rec["examples"]:
            errors.append(f"{rec_id}: examples must be a non-empty list")
        elif any(not isinstance(ex, str) or not ex.strip() for ex in rec["examples"]):
            errors.append(f"{rec_id}: examples contains empty/non-string item")

        sources = rec["sources"]
        if not isinstance(sources, list) or not sources:
            errors.append(f"{rec_id}: sources must be a non-empty list")
        else:
            if "wordlist" in sources and (not isinstance(rec["ipa"], str) or not rec["ipa"].strip()):
                errors.append(f"{rec_id}: missing ipa for wordlist entry")
            if sources == ["wordlist", "book"] and len(rec["examples"]) != 2:
                errors.append(f"{rec_id}: merged entry expected 2 examples, got {len(rec['examples'])}")

        if not isinstance(rec["tags"], list) or not rec["tags"]:
            errors.append(f"{rec_id}: tags must be a non-empty list")

    return seen_ids


def validate_exercises(vocab_ids: set[str], errors: list[str]) -> None:
    """Validate data/exercises.json against schema, choices, permutations, and vocab_ids."""
    if not EXERCISES_PATH.exists():
        errors.append(f"Missing {EXERCISES_PATH}")
        return

    data = json.loads(EXERCISES_PATH.read_text(encoding="utf-8"))
    units = data.get("units", [])
    reviews = data.get("reviews", [])

    if len(units) != 12:
        errors.append(f"Expected 12 exercise units, got {len(units)}")
    if len(reviews) != 2:
        errors.append(f"Expected 2 reviews, got {len(reviews)}")

    seen_ex_ids: set[str] = set()

    def check_ex_id(ex_id: str, ctx: str) -> None:
        if not ex_id or not isinstance(ex_id, str):
            errors.append(f"{ctx}: missing exercise id")
            return
        if ex_id in seen_ex_ids:
            errors.append(f"{ctx}: duplicate exercise id {ex_id!r}")
        seen_ex_ids.add(ex_id)

    def check_word_id(word_id: str, ctx: str) -> None:
        if word_id not in vocab_ids:
            errors.append(f"{ctx}: unknown word_id {word_id!r}")

    expected_letters = list("abcdefghij")

    for u in units:
        unum = u.get("unit")
        ctx_u = f"unit-{unum}"

        meta = u.get("unit_meta", {})
        for k in ("level", "unit", "title", "topic", "study_tip", "page"):
            if not meta.get(k):
                errors.append(f"{ctx_u}: missing unit_meta.{k}")

        # Section A (matching)
        sec_a = u.get("A", {})
        items_a = sec_a.get("items", [])
        if len(items_a) != 10:
            errors.append(f"{ctx_u}.A: expected 10 items, got {len(items_a)}")
        def_pool = {it.get("definition") for it in items_a}
        letters_found: list[str] = []
        for it in items_a:
            ctx = f"{ctx_u}.A#{it.get('num')}"
            check_ex_id(it.get("id", ""), ctx)
            check_word_id(it.get("word_id", ""), ctx)
            if it.get("answer") not in def_pool:
                errors.append(f"{ctx}: answer {it.get('answer')!r} not in unit definitions")
            letters_found.append(it.get("answer_letter", ""))
        if sorted(letters_found) != expected_letters:
            errors.append(f"{ctx_u}.A: answer_letters {letters_found} is not a permutation of a..j")

        # Section B (fill-in)
        sec_b = u.get("B", {})
        bank_b = sec_b.get("word_bank", [])
        items_b = sec_b.get("items", [])
        if len(items_b) != 10:
            errors.append(f"{ctx_u}.B: expected 10 items, got {len(items_b)}")
        ans_b: list[str] = []
        for it in items_b:
            ctx = f"{ctx_u}.B#{it.get('num')}"
            check_ex_id(it.get("id", ""), ctx)
            check_word_id(it.get("word_id", ""), ctx)
            if "____" not in it.get("sentence", ""):
                errors.append(f"{ctx}: sentence missing '____'")
            ans = it.get("answer", "")
            if ans not in bank_b:
                errors.append(f"{ctx}: answer {ans!r} not in word_bank")
            ans_b.append(ans)
        if sorted(ans_b) != sorted(bank_b):
            errors.append(f"{ctx_u}.B: answers do not match word_bank permutation")

        # Section C (multiple choice)
        sec_c = u.get("C", {})
        items_c = sec_c.get("items", [])
        if len(items_c) != 10:
            errors.append(f"{ctx_u}.C: expected 10 items, got {len(items_c)}")
        for it in items_c:
            ctx = f"{ctx_u}.C#{it.get('num')}"
            check_ex_id(it.get("id", ""), ctx)
            check_word_id(it.get("word_id", ""), ctx)
            opts = it.get("options", [])
            if len(opts) != 4:
                errors.append(f"{ctx}: expected 4 options, got {len(opts)}")
            ans = it.get("answer", "")
            if ans not in opts:
                errors.append(f"{ctx}: answer {ans!r} not in options {opts}")
            stripped = re.sub(r"^[a-d]\)\s*", "", ans).strip()
            if stripped != it.get("answer_word"):
                errors.append(f"{ctx}: stripped answer {stripped!r} != answer_word {it.get('answer_word')!r}")

        # Section D (unscramble)
        sec_d = u.get("D", {})
        items_d = sec_d.get("items", [])
        if len(items_d) != 6:
            errors.append(f"{ctx_u}.D: expected 6 items, got {len(items_d)}")
        for it in items_d:
            ctx = f"{ctx_u}.D#{it.get('num')}"
            check_ex_id(it.get("id", ""), ctx)
            check_word_id(it.get("word_id", ""), ctx)
            sc = it.get("scrambled", "")
            ans = it.get("answer", "")
            if not sc or not ans or normalize_letters(sc) != normalize_letters(ans):
                errors.append(f"{ctx}: scrambled {sc!r} is not a letter permutation of {ans!r}")

        # Section E (free writing)
        sec_e = u.get("E", {})
        check_ex_id(sec_e.get("id", ""), f"{ctx_u}.E")
        if not sec_e.get("instruction", "").strip():
            errors.append(f"{ctx_u}.E: empty instruction")
        prompts = sec_e.get("prompts", [])
        if not isinstance(prompts, list) or not prompts or any(not p.strip() for p in prompts):
            errors.append(f"{ctx_u}.E: prompts must be non-empty list of strings")

    # Reviews
    for rev in reviews:
        ctx_r = f"review-{rev.get('level')}"
        bank = rev.get("word_bank", [])
        items = rev.get("items", [])
        if len(items) != 12:
            errors.append(f"{ctx_r}: expected 12 items, got {len(items)}")
        ans_r: list[str] = []
        for it in items:
            ctx = f"{ctx_r}#{it.get('num')}"
            check_ex_id(it.get("id", ""), ctx)
            check_word_id(it.get("word_id", ""), ctx)
            if "____" not in it.get("sentence", ""):
                errors.append(f"{ctx}: sentence missing '____'")
            ans = it.get("answer", "")
            if ans not in bank:
                errors.append(f"{ctx}: answer {ans!r} not in word_bank")
            ans_r.append(ans)
        if sorted(ans_r) != sorted(bank):
            errors.append(f"{ctx_r}: answers do not match word_bank permutation")


def validate_corrections(errors: list[str]) -> None:
    """Validate data/corrections.md exists and records all 17 fixes."""
    if not CORRECTIONS_PATH.exists():
        errors.append(f"Missing {CORRECTIONS_PATH}")
        return
    text = CORRECTIONS_PATH.read_text(encoding="utf-8")
    table_rows = [ln for ln in text.splitlines() if ln.startswith("| `a2-")]
    if len(table_rows) != 17:
        errors.append(f"Expected 17 correction rows in corrections.md, found {len(table_rows)}")


def main() -> None:
    errors: list[str] = []
    vocab_ids = validate_vocab(errors)
    validate_exercises(vocab_ids, errors)
    validate_corrections(errors)

    if errors:
        print(f"VALIDATION FAILED ({len(errors)} errors):")
        for err in errors:
            print(f"  - {err}")
        sys.exit(1)

    vocab = json.loads(VOCAB_PATH.read_text(encoding="utf-8"))
    ex = json.loads(EXERCISES_PATH.read_text(encoding="utf-8"))
    total_ex = sum(
        len(u["A"]["items"]) + len(u["B"]["items"]) + len(u["C"]["items"]) + len(u["D"]["items"]) + len(u["E"]["prompts"])
        for u in ex["units"]
    ) + sum(len(r["items"]) for r in ex["reviews"])
    print(f"VALIDATION PASSED: 0 errors ({len(vocab)} vocab records, {total_ex} exercise/review items)")


if __name__ == "__main__":
    main()
