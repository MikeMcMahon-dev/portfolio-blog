---
title: "Session: Ingestion Efficiency — From Flat Text to Structured Markdown"
description: "How a Nate B. Jones video on token burn sent me down the rabbit hole of fixing OpenBrain's ingest pipeline — PDF classification, vision OCR, structured chunking, and a 5-model eval."
pubDate: 2026-04-02
category: sessions
draft: false
---

**If you aren't following [Nate B. Jones](https://www.youtube.com/@natebjonestech) on YouTube and are trying to expand your understanding of AI and how best to work with it — stop right now and go watch a couple of his videos.** They're feature-rich, the information is actionable, and [this video on token burn from naive PDF ingestion](https://youtu.be/5ztI_dbj6ek?si=SvPXNUxZ9ITg4GbY) is exactly what sent me back to the OpenBrain codebase with a fresh set of eyes.

Nate's video specifically touches on maximizing your token usage. The changes documented here reflect that effort — and then some.

---

## What We Found When We Actually Looked

OpenBrain had been ingesting documents for months. Study notes, PDFs, web pages, Word docs — all going into Supabase pgvector, all queryable. The retrieval eval was running at 96.9%. From the outside, it worked.

Then I actually read the ingest code.

Every non-markdown ingestor was doing the same thing:

```python
# DOCX: throwing structure away before touching a token
text = "\n".join(para.text for para in doc.paragraphs if para.text.strip())

# URL: same
text = soup.get_text("\n", strip=True)
```

Then everything — regardless of source type — went into `chunk_text_by_tokens()`: 500 tokens per chunk, 100 token overlap. Sliding window. No structure. Every chunk labeled `heading: "root"`.

The structure was sitting right there. `python-docx` exposes heading styles. `BeautifulSoup` sees `<h1>` through `<h6>`. And we were discarding all of it before the first token counted.

The overlap alone was a 20% token tax on every document we'd ever ingested. A 20-page study guide created 20% more chunks than it needed to, each one sharing context already stored in its neighbor.

---

## The PDF Problem Was Actually Three Problems

PDFs are not one thing. After looking at what Beth was actually uploading — and what Annie's school was generating — three categories emerged clearly:

| Type | Signal | What it needs |
|---|---|---|
| **text_dominant** | ≥200 avg chars/page | `pymupdf4llm` → structured markdown |
| **mixed** | 50–199 avg chars/page | Same — enough text to extract with structure |
| **image_dominant** | <50 avg chars/page | Vision OCR — these are scans |

The thresholds aren't theoretical — they're anchored to real data. Annie's handwritten biology notes and a 40-page geometry practice test both measured at 0 chars/page in pypdf. Hard image_dominant. The prior code would have returned `status: "failed"` and silently dropped them.

That's the content Beth was uploading. That's the content the system was supposed to be ingesting for Annie's tutoring. It was being dropped.

---

## The Vision OCR Path

For `image_dominant` PDFs, the new pipeline is:

```
pymupdf page render (150 DPI)
    → Pillow: grayscale + contrast(2.0x) + sharpen(1.5x)
    → Claude Haiku (vision): transcribe as markdown
    → chunk_markdown() for storage
```

The unified OCR prompt handles both handwritten notes and geometric figures:

> *"For any geometric diagrams, figures, or drawings, provide a brief description of what is shown (e.g., 'Circle with center O, radius labeled 5, chord AB drawn from A to B')."*

One prompt, two content types. No content-type detection needed.

The preprocessing (contrast/sharpen) helps poor-quality scans — the geometry test's source was described charitably as "bad source material" — without degrading clean handwriting.

---

## chunk_markdown(): Eliminating the Redundancy Tax

The chunker was replaced entirely for structured content:

```python
def chunk_markdown(text, max_tokens=600):
    # Split on heading boundaries first
    # Sub-chunk oversized sections with parent heading inherited
    # No overlap — zero redundancy
```

Before: 1 chunk (7,285 avg tokens). After: 13 chunks (560 avg tokens). Sub-chunks carry the parent heading so retrieval context is preserved even when a section exceeds the ceiling.

---

## The Beth UX Problem

After implementing OCR, there was an obvious gap: how does Beth validate that a 20-page scan actually imported correctly? The previous GPT instructions said "confirm total pages and calls when done" — which tells you nothing about content quality.

The fix was simpler than it looked. The GPT already has the transcribed content in its context window after ingest. It doesn't need to query the database to show you what was imported:

> *Show Beth 3 sample items from the ingested content — one from the beginning, one from the middle, and one from the end. Ask her to confirm the content looks right.*

A 20-page import, surfaced as 3 representative samples, presented in plain language. Beth confirms quality without navigating hidden folders or interpreting raw JSON.

---

## OCR Eval: 5 Models, Real Data

The multi-agent lab's eval harness was extended with a new scenario type (`type: ocr`) that runs the same pipeline across any vision model and scores against ground-truth phrase recovery.

Two real fixtures — Annie's actual study materials:

- **Biology notes** (1 page, handwritten): 13 scoring phrases, pass threshold 0.80
- **Geometry practice test** (40 pages, degraded scan): content-presence test, pass threshold 0.50

Results across all 5 models:

| Model | Biology Recovery | Biology Cost | Geometry Cost | Total Cost |
|---|---|---|---|---|
| `claude-haiku-4-5-20251001` | 0.62 (8/13) | $0.00066 | $0.027 | $0.027 |
| `claude-sonnet-4-6` | **0.77 (10/13)** | $0.009 | $0.349 | $0.359 |
| `claude-opus-4-6` | 0.69 (9/13) | $0.041 | $1.704 | **$1.745** |
| `gpt-4o` | 0.69 (9/13) | $0.007 | $0.266 | $0.273 |
| `gpt-4o-mini` | 0.69 (9/13) | $0.004 | $0.067* | $0.071* |

*GPT-4o-mini hit rate limits on 25 of 40 pages at concurrent eval volume.*

**Key findings:**

No model cleared the 0.80 biology pass threshold — Sonnet came closest at 10/13. The threshold may be tight for handwritten single-page content; 0.70 with fuzzy matching is worth evaluating.

Opus delivered 9/13 — *worse* than Sonnet — at 5x the cost. $1.74 vs $0.36 for the same content. Opus is not justified for OCR workloads.

**Default recommendation: `claude-sonnet-4-6`** — best biology recovery, reasonable per-page cost (~$0.009/page for handwriting), already integrated in the Anthropic stack.

**Secondary: tiered strategy** — printed/structured content (textbooks, typed notes) routes to Haiku at $0.027 for 40 pages. Handwritten/difficult scans route to Sonnet. Text-layer PDFs use direct extraction at $0.00.

---

## What Changed

| Component | Before | After |
|---|---|---|
| PDF ingestion | pypdf flat text → sliding window | 3-way classify → pymupdf4llm or vision OCR |
| DOCX ingestion | flat paragraph join | Heading styles → `#/##/###` hierarchy |
| URL ingestion | `get_text()` on full DOM | markdownify on main content; nav/footer stripped |
| Chunking (structured) | 500 token sliding window, 20% overlap | 600 token ceiling, heading-split, no overlap |
| Scanned PDFs | `status: "failed"` | Vision OCR → markdown |
| Beth validation | page count confirmation | 3 sample items, start/middle/end |

All changes are live on `openbrain-rouge.vercel.app`. Smoke tests: 26/26 green.

The 20% redundancy tax: eliminated. The scanned study materials that were being silently dropped: now ingesting. The eval data to back the model choice: measured, not assumed.

That's what one Nate Jones video turned into.
