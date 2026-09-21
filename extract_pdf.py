import json
import re
from pathlib import Path

from pypdf import PdfReader


PDF_PATH = Path(r"C:\Users\hellp\OneDrive\文档\OneNote 笔记本\xwechat_files\wxid_9nd8h0k8cxwl32_e564\temp\RWTemp\2026-09\032a4ba95cb9db11cbfb212a7c2040d3\2026改革后阅读填空题常考500词(分学科+音标+记忆法+例句).pdf")
OUT_PATH = Path(__file__).with_name("word-bank.js")

ENTRY_RE = re.compile(r"^([A-Za-z][A-Za-z -]+?)\s+英\s+/(.+?)/\s+美\s+/(.+?)/\s+(.+?)\s*$")
MAJOR_RE = re.compile(r"^[一二三四五]、(.+?)（(\d+)词）$")
SUB_RE = re.compile(r"^（[一二三四]）(.+?)（(\d+)词）$")
NOISE_RE = re.compile(r"^(?:托\s*福|🌙|\d+/\d+|陈\s*老\s*师|第\s*\d+\s*页)")


def clean_text(value):
    value = re.sub(r"\s+", " ", value or "").strip()
    return value


def join_continuation(lines):
    return clean_text(" ".join(line for line in lines if line and not NOISE_RE.match(line)))


def make_builtin_content(word, example, translation):
    example = example or f'The word "{word}" appears in a practical study context.'
    translation = translation or "请结合中文释义理解这个词在语境中的用法。"
    cloze = re.sub(re.escape(word), "_____", example, flags=re.IGNORECASE)
    if cloze == example:
        cloze = f'This sentence uses _____ as the target vocabulary word.'
    return example, translation, cloze


def read_lines():
    reader = PdfReader(str(PDF_PATH))
    lines = []
    for page_number, page in enumerate(reader.pages, 1):
        text = page.extract_text() or ""
        for raw in text.splitlines():
            line = clean_text(raw)
            if line:
                lines.append((page_number, line))
    return lines


def extract_records(lines):
    records = []
    current_major = ""
    current_sub = ""
    expected = None
    accepted_in_sub = 0
    pending = None

    def finish_pending():
        nonlocal pending, accepted_in_sub
        if pending is None:
            return
        header, body, _page = pending
        zh = ""
        memory = ""
        example = ""
        translation = ""
        for label, target in (("记忆法：", "memory"), ("记忆法:", "memory"), ("托福例句：", "example"), ("托福例句:", "example"), ("译文：", "translation"), ("译文:", "translation")):
            for index, item in enumerate(body):
                if item.startswith(label):
                    value = item[len(label):].strip()
                    tail = body[index + 1:]
                    if target == "memory":
                        memory = join_continuation([value])
                    elif target == "example":
                        example = join_continuation([value] + [x for x in tail if not x.startswith(("译文：", "译文:"))])
                    else:
                        translation = join_continuation([value] + [x for x in tail if not x.startswith(("记忆法：", "记忆法:", "托福例句：", "托福例句:"))])
                    break
        for item in body:
            if not zh and not item.startswith(("记忆法：", "记忆法:", "托福例句：", "托福例句:", "译文：", "译文:")) and not NOISE_RE.match(item) and not MAJOR_RE.match(item) and not SUB_RE.match(item):
                if re.search(r"[\u4e00-\u9fff]", item):
                    zh = item
        if expected is not None and accepted_in_sub < expected:
            records.append({
                "word": header[0],
                "ipaUk": header[1],
                "ipaUs": header[2],
                "pos": re.sub(r"\s+", "", header[3]),
                "zh": zh,
                "memory": memory,
                "example": example,
                "translation": translation,
                "category": current_major,
                "subcategory": current_sub,
                "page": pending[2],
            })
            accepted_in_sub += 1
        pending = None

    for page_number, line in lines:
        major = MAJOR_RE.match(line)
        sub = SUB_RE.match(line)
        if major:
            finish_pending()
            current_major = major.group(1)
            current_sub = ""
            expected = int(major.group(2))
            accepted_in_sub = 0
            continue
        if sub:
            finish_pending()
            current_sub = sub.group(1)
            expected = int(sub.group(2))
            accepted_in_sub = 0
            continue
        match = ENTRY_RE.match(line)
        if match:
            finish_pending()
            pending = (match.groups(), [], page_number)
            continue
        if pending is not None:
            pending[1].append(line)
    finish_pending()
    return records


def main():
    raw_records = extract_records(read_lines())
    # The PDF title says 500, while its section totals produce a few extra
    # repeated entries. Keep the first occurrence of repeated words until the
    # app has exactly 500 source items, preserving the original reading order.
    duplicate_budget = max(0, len(raw_records) - 500)
    records = []
    seen_words = set()
    removed = []
    for record in raw_records:
        key = record["word"].lower()
        if key in seen_words and duplicate_budget:
            duplicate_budget -= 1
            removed.append(record["word"])
            continue
        seen_words.add(key)
        records.append(record)
    print(f"Extracted {len(raw_records)} usable source entries; normalized to {len(records)} app words")
    print(f"Removed repeated entries: {', '.join(removed)}")
    print("Subcategory counts:")
    counts = {}
    for record in records:
        key = (record["category"], record["subcategory"])
        counts[key] = counts.get(key, 0) + 1
    for key, value in counts.items():
        print(f"  {key[0]} / {key[1]}: {value}")
    print("First 5:")
    for record in records[:5]:
        print(record["word"], record["zh"], record["subcategory"])
    print("Last 5:")
    for record in records[-5:]:
        print(record["word"], record["zh"], record["subcategory"])
    if len(records) != 500:
        raise SystemExit("Expected exactly 500 records")
    payload = []
    for index, record in enumerate(records, 1):
        example, translation, cloze = make_builtin_content(record["word"], record["example"], record["translation"])
        payload.append({
            "id": f"pdf-{index:03d}",
            "word": record["word"],
            "zh": record["zh"],
                "en": "",
                "definition": "",
            "ipaUk": record["ipaUk"],
            "ipaUs": record["ipaUs"],
            "pos": record["pos"],
            "memory": record["memory"],
            "example": example,
            "translation": translation,
            "builtinExample": example,
            "builtinExampleTranslation": translation,
            "builtinCloze": cloze,
            "builtinClozeTranslation": translation,
            "category": record["category"],
            "subcategory": record["subcategory"],
            "group": (index - 1) // 20 + 1,
        })
    OUT_PATH.write_text("window.HALO_PDF_WORDS = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH}")


if __name__ == "__main__":
    main()
