"""Regenerate per-invention images using gpt-image-2, era-styled, 3:2 landscape.

By default the images come from Codex's built-in image generation, on Boris's ChatGPT
subscription (`--provider codex`): no API key, no per-image bill. `--provider openai` uses the
paid API with OPENAI_API_KEY instead, and `--provider gemini` uses Imagen.

See /Users/boris/.claude/plans/polymorphic-skipping-sifakis.md for the design.
Edit the prompts in scripts/prompts/ to iterate on style; no code changes needed.
"""
from __future__ import annotations

import argparse
import asyncio
import base64
import csv
import dataclasses
import datetime
import functools
import hashlib
import io
import json
import os
import random
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import APITimeoutError, AsyncOpenAI, RateLimitError
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
TSV_PATH = ROOT / "static" / "asimov.tsv"
PROMPTS_DIR = Path(__file__).resolve().parent / "prompts"
DEFAULT_OUT_DIR = ROOT / "static" / "images" / "entries-v2"

OPENAI_MODEL = "gpt-image-2"
OPENAI_SIZE = "1536x1024"   # 3:2 landscape native
GEMINI_MODEL = "imagen-4.0-generate-001"
GEMINI_ASPECT = "3:2"
SAVE_W, SAVE_H = 720, 480
JPG_QUALITY = 88
CONCURRENCY = 4
CODEX_TIMEOUT_S = 6 * 60   # about a minute an image; generous for busy hours
CODEX_IMAGES = Path.home() / ".codex" / "generated_images"

# USD per generated image. Calibrated from real billing where possible.
COST_PER_IMAGE: dict[tuple[str, str], float] = {
    ("codex", "chatgpt-subscription"): 0.0,     # counts against the ChatGPT plan's usage limits
    ("openai", "gpt-image-2"): 0.0479,          # observed: $6.18 / 129 images at 1536x1024
    ("openai", "gpt-image-1"): 0.04,
    ("gemini", "imagen-4.0-generate-001"): 0.04,
    ("gemini", "imagen-4.0-fast-generate-001"): 0.02,
}

ERAS: list[tuple[str, int]] = [
    # (key, exclusive upper-bound year). Years are CE; BCE is negative.
    ("ancient", 500),
    ("medieval", 1450),
    ("renaissance", 1700),
    ("enlightenment_industrial", 1900),
    ("early_20c", 1945),
    ("modern", 1994),          # mid-century editorial gouache, up to the end of Asimov's chronology
    ("contemporary", 10_000),  # flat vector: everything after 1993, including the Future Technologies
]


@dataclasses.dataclass(frozen=True)
class Invention:
    id: str
    year_raw: str
    year: int
    title: str
    summary: str
    inventor: str
    location: str
    field: str


def parse_year(raw: str) -> int:
    """4000000 BCE -> -4000000; 1543 -> 1543; 1700 BCE -> -1700; 1985 CE -> 1985."""
    s = raw.strip().replace(",", "")
    m = re.match(r"^(-?\d+)\s*(BCE|CE)?$", s, flags=re.IGNORECASE)
    if not m:
        raise ValueError(f"unparseable year: {raw!r}")
    n = int(m.group(1))
    suffix = (m.group(2) or "").upper()
    return -n if suffix == "BCE" else n


def classify_era(year: int) -> str:
    for key, upper in ERAS:
        if year < upper:
            return key
    return ERAS[-1][0]


def load_inventions(tsv: Path) -> list[Invention]:
    out: list[Invention] = []
    with tsv.open(newline="", encoding="utf-8") as f:
        reader = csv.DictReader(
            f,
            delimiter="\t",
            quoting=csv.QUOTE_NONE,
            escapechar="\\",
        )
        for row in reader:
            iid = (row.get("ID") or "").strip()
            if not iid:
                continue
            year_raw = (row.get("Year") or "").strip()
            try:
                year = parse_year(year_raw)
            except ValueError as e:
                print(f"  skipping {iid}: {e}", file=sys.stderr)
                continue
            out.append(Invention(
                id=iid,
                year_raw=year_raw,
                year=year,
                title=(row.get("Title") or "").strip(),
                summary=(row.get("Description") or "").strip(),
                inventor=(row.get("Inventor") or "").strip(),
                location=(row.get("Location") or "").strip(),
                field=(row.get("Field") or "").strip(),
            ))
    return out


def load_cards_json(path: Path) -> list[Invention]:
    """Cards that aren't in the deck TSV (the assembly prototype's supporting and phenomenon
    cards), in the same shape, so they get the same prompt as a deck card. An optional `draw`
    says exactly what to picture (geometry illustrators get wrong); it's added after the summary."""
    out: list[Invention] = []
    for c in json.loads(path.read_text(encoding="utf-8")):
        year_raw = str(c["year"]).strip()
        summary = (c.get("summary") or c.get("description") or "").strip()
        if c.get("draw"):
            summary = f"{summary} Draw it like this: {c['draw'].strip()}"
        out.append(Invention(
            id=c["id"],
            year_raw=year_raw,
            year=parse_year(year_raw),
            title=c["title"].strip(),
            summary=summary,
            inventor=c.get("inventor", "").strip(),
            location=c.get("location", "").strip(),
            field=c.get("field", "").strip(),
        ))
    return out


@functools.cache
def _read_prompt(name: str) -> str:
    return (PROMPTS_DIR / f"{name}.md").read_text(encoding="utf-8").strip()


def build_prompt(inv: Invention) -> tuple[str, str]:
    era = classify_era(inv.year)
    parts = [
        _read_prompt("shared"),
        "STYLE:",
        _read_prompt(era),
        "SUBJECT:",
        f"{inv.title} ({inv.year_raw}). {inv.summary}",
    ]
    meta = [f"Field: {inv.field}." if inv.field else ""]
    if inv.inventor:
        meta.append(f"Associated with {inv.inventor}.")
    if inv.location:
        meta.append(f"Originating in {inv.location}.")
    meta_line = " ".join(p for p in meta if p)
    if meta_line:
        parts.append(meta_line)
    return era, "\n\n".join(parts)


def output_path(out_dir: Path, iid: str, variant: int) -> Path:
    if variant <= 1:
        return out_dir / f"{iid}.jpg"
    return out_dir / f"{iid}-{variant}.jpg"


def already_exists(out_dir: Path, iid: str) -> bool:
    return output_path(out_dir, iid, 1).exists()


def save_outputs(raw: bytes, jpg_dest: Path, original_dest_stem: Path) -> None:
    """Save the API-native original alongside a 720x480 downscaled JPG."""
    img = Image.open(io.BytesIO(raw))
    ext = (img.format or "PNG").lower().replace("jpeg", "jpg")
    original_dest = original_dest_stem.with_suffix(f".{ext}")
    original_dest.parent.mkdir(parents=True, exist_ok=True)
    original_dest.write_bytes(raw)

    rgb = img.convert("RGB")
    if rgb.size != (SAVE_W, SAVE_H):
        rgb = rgb.resize((SAVE_W, SAVE_H), Image.Resampling.LANCZOS)
    jpg_dest.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(jpg_dest, "JPEG", quality=JPG_QUALITY, optimize=True)


def cost_for(provider_name: str, model: str, n: int) -> float:
    per = COST_PER_IMAGE.get((provider_name, model), 0.0)
    return per * n


def append_log(
    out_dir: Path, iid: str, era: str, status: str, prompt_hash: str, cost_usd: float
) -> None:
    log = out_dir / "_log.tsv"
    new = not log.exists()
    out_dir.mkdir(parents=True, exist_ok=True)
    with log.open("a", encoding="utf-8") as f:
        if new:
            f.write("ts\tid\tera\tstatus\tprompt_hash\tcost_usd\n")
        f.write(f"{int(time.time())}\t{iid}\t{era}\t{status}\t{prompt_hash}\t{cost_usd:.4f}\n")


def save_provenance(
    out_dir: Path,
    inv: Invention,
    era: str,
    prompt: str,
    prompt_hash: str,
    provider_name: str,
    model: str,
    n: int,
    variant_files: list[str],
) -> None:
    record = {
        "id": inv.id,
        "title": inv.title,
        "year": inv.year_raw,
        "era": era,
        "field": inv.field,
        "inventor": inv.inventor,
        "location": inv.location,
        "provider": provider_name,
        "model": model,
        "n": n,
        "variants": variant_files,
        "prompt_hash": prompt_hash,
        "prompt": prompt,
        "cost_usd": cost_for(provider_name, model, n),
        "generated_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    }
    dest = out_dir / "originals" / f"{inv.id}.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")


# --- Providers ---------------------------------------------------------------
# Each provider exposes async generate(prompt, n) -> list[bytes] of image bytes.

class OpenAIProvider:
    name = "openai"
    model = OPENAI_MODEL

    def __init__(self) -> None:
        self.client = AsyncOpenAI()

    async def generate(self, prompt: str, n: int) -> list[bytes]:
        resp = await self.client.images.generate(
            model=OPENAI_MODEL,
            prompt=prompt,
            size=OPENAI_SIZE,
            n=n,
        )
        out: list[bytes] = []
        for d in resp.data:
            if not d.b64_json:
                raise RuntimeError("openai: response missing b64_json")
            out.append(base64.b64decode(d.b64_json))
        return out


class GeminiProvider:
    name = "gemini"
    model = GEMINI_MODEL

    def __init__(self) -> None:
        from google import genai
        self.genai = genai
        self.client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

    async def generate(self, prompt: str, n: int) -> list[bytes]:
        from google.genai import types

        def _sync():
            return self.client.models.generate_images(
                model=GEMINI_MODEL,
                prompt=prompt,
                config=types.GenerateImagesConfig(
                    number_of_images=n,
                    aspect_ratio=GEMINI_ASPECT,
                    output_mime_type="image/jpeg",
                ),
            )

        resp = await asyncio.to_thread(_sync)
        if not resp.generated_images:
            raise RuntimeError("gemini: no images returned (likely safety-blocked)")
        return [g.image.image_bytes for g in resp.generated_images]


class CodexFailed(RuntimeError):
    pass


class CodexProvider:
    """Codex's built-in image tool, signed in with ChatGPT, so it runs on the subscription.

    Each image is one `codex exec` in an empty temp folder, asked to draw the prompt and save it
    there as picture.png. OPENAI_API_KEY and friends are removed from its environment so it can
    never fall back to API billing. Codex also keeps a copy under
    ~/.codex/generated_images/<thread id>/, used if nothing was saved in the folder; the thread id
    comes from its --json events, so parallel runs can't pick up each other's images.
    Ported from zwicky's CodexImageBackend (app/pictures.ts).
    """
    name = "codex"
    model = "chatgpt-subscription"

    def __init__(self) -> None:
        if not shutil.which("codex"):
            raise RuntimeError("codex CLI not found (brew install codex, then `codex login`)")
        try:
            mode = json.loads((Path.home() / ".codex" / "auth.json").read_text()).get("auth_mode")
        except (OSError, ValueError):
            mode = None
        if mode != "chatgpt":
            raise RuntimeError(f"codex isn't signed in with ChatGPT (auth_mode={mode!r}); run `codex login`")

    async def generate(self, prompt: str, n: int) -> list[bytes]:
        return [await asyncio.to_thread(self._one, prompt) for _ in range(n)]

    def _one(self, prompt: str) -> bytes:
        ask = (
            "Use your built-in image generation tool to make exactly one image from the description "
            "below, as a 3:2 landscape image (1536x1024), then save the image file in the current "
            "folder as picture.png. Don't write any code, and don't draw it yourself any other way."
            f"\n\nDescription:\n{prompt}"
        )
        env = {k: v for k, v in os.environ.items() if not re.match(r"^(OPENAI_|AZURE_OPENAI|CODEX_API_KEY)", k)}
        with tempfile.TemporaryDirectory(prefix="codex-image-") as cwd:
            try:
                out = subprocess.run(
                    ["codex", "exec", "--skip-git-repo-check", "--sandbox", "workspace-write",
                     "--ephemeral", "--json", "-C", cwd, "-"],
                    input=ask, cwd=cwd, env=env, capture_output=True, text=True, timeout=CODEX_TIMEOUT_S,
                )
            except subprocess.TimeoutExpired:
                raise CodexFailed(f"codex timed out after {CODEX_TIMEOUT_S}s")
            thread = None
            for line in out.stdout.splitlines():
                try:
                    ev = json.loads(line)
                except ValueError:
                    continue
                if ev.get("type") == "thread.started":
                    thread = ev.get("thread_id")
            found = Path(cwd) / "picture.png"
            if not found.exists():
                pics = sorted(Path(cwd).glob("*.png")) + sorted(Path(cwd).glob("*.jp*g")) + sorted(Path(cwd).glob("*.webp"))
                if not pics and thread and (CODEX_IMAGES / thread).is_dir():
                    pics = sorted((CODEX_IMAGES / thread).iterdir(), key=lambda f: f.stat().st_mtime)
                if not pics:
                    tail = (out.stderr or out.stdout)[-400:].strip()
                    raise CodexFailed(f"codex made no image (exit {out.returncode}): {tail}")
                found = pics[-1]
            return found.read_bytes()


def build_provider(name: str):
    if name == "codex":
        return CodexProvider()
    if name == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            raise RuntimeError("OPENAI_API_KEY not set")
        return OpenAIProvider()
    if name == "gemini":
        if not os.getenv("GEMINI_API_KEY"):
            raise RuntimeError("GEMINI_API_KEY not set")
        return GeminiProvider()
    raise ValueError(f"unknown provider: {name}")


async def _generate_with_retry(provider, prompt: str, n: int) -> list[bytes]:
    backoff = 2.0
    for attempt in range(3):
        try:
            return await provider.generate(prompt, n)
        except (RateLimitError, APITimeoutError, asyncio.TimeoutError, CodexFailed) as e:
            if attempt == 2:
                raise
            await asyncio.sleep(backoff)
            backoff *= 2
    raise RuntimeError("unreachable")


async def generate_one(
    provider,
    sem: asyncio.Semaphore,
    inv: Invention,
    out_dir: Path,
    n: int,
) -> tuple[str, str, float]:
    era, prompt = build_prompt(inv)
    prompt_hash = hashlib.sha256(prompt.encode()).hexdigest()[:12]

    async with sem:
        try:
            images = await _generate_with_retry(provider, prompt, n)
        except Exception as e:
            append_log(out_dir, inv.id, era, f"error:{type(e).__name__}", prompt_hash, 0.0)
            return inv.id, f"error: {type(e).__name__}: {e}", 0.0

    originals_dir = out_dir / "originals"
    variant_files: list[str] = []
    for i, raw in enumerate(images, start=1):
        jpg_dest = output_path(out_dir, inv.id, i)
        save_outputs(
            raw,
            jpg_dest=jpg_dest,
            original_dest_stem=originals_dir / jpg_dest.stem,
        )
        variant_files.append(jpg_dest.name)

    cost = cost_for(provider.name, provider.model, len(images))
    save_provenance(
        out_dir, inv, era, prompt, prompt_hash,
        provider_name=provider.name, model=provider.model,
        n=n, variant_files=variant_files,
    )
    append_log(
        out_dir, inv.id, era,
        f"ok:via={provider.name}:model={provider.model}:n={n}",
        prompt_hash, cost,
    )
    return inv.id, f"ok ({era}, via={provider.name}, n={n}, ${cost:.4f})", cost


async def run(
    inventions: list[Invention],
    out_dir: Path,
    n: int,
    dry_run: bool,
    provider_name: str,
) -> None:
    if dry_run:
        for inv in inventions:
            era, prompt = build_prompt(inv)
            print(f"--- {inv.id}  era={era}  year={inv.year_raw}")
            print(prompt)
            print()
        return

    load_dotenv(ROOT / ".env")
    provider = build_provider(provider_name)
    per_image = COST_PER_IMAGE.get((provider.name, provider.model), 0.0)
    if (provider.name, provider.model) not in COST_PER_IMAGE:
        print(f"warning: no cost entry for ({provider.name}, {provider.model}); cost will report $0.00", file=sys.stderr)
    estimated = per_image * len(inventions) * n
    print(f"provider={provider.name} model={provider.model} per-image=${per_image:.4f} estimated_total=${estimated:.2f}")

    out_dir.mkdir(parents=True, exist_ok=True)
    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = [generate_one(provider, sem, inv, out_dir, n) for inv in inventions]
    total_cost = 0.0
    ok_count = err_count = 0
    for fut in asyncio.as_completed(tasks):
        iid, status, cost = await fut
        total_cost += cost
        if status.startswith("ok"):
            ok_count += 1
        else:
            err_count += 1
        print(f"  {iid}: {status}  [running total ${total_cost:.4f}]")
    print(f"done. {ok_count} ok, {err_count} errors. total cost: ${total_cost:.4f}")


def select_inventions(
    all_inv: list[Invention],
    ids: list[str] | None,
    sample: int | None,
    out_dir: Path,
    force: bool,
) -> list[Invention]:
    if ids and sample is not None:
        print("--ids and --sample are mutually exclusive.", file=sys.stderr)
        sys.exit(2)

    if ids:
        by_id = {inv.id: inv for inv in all_inv}
        missing = [i for i in ids if i not in by_id]
        if missing:
            print(f"unknown ids: {', '.join(missing)}", file=sys.stderr)
            sys.exit(2)
        picked = [by_id[i] for i in ids]
    elif sample is not None:
        pool = all_inv if force else [i for i in all_inv if not already_exists(out_dir, i.id)]
        if sample > len(pool):
            print(f"--sample {sample} but only {len(pool)} candidates available.", file=sys.stderr)
            sys.exit(2)
        picked = random.sample(pool, sample)
    else:
        picked = all_inv

    if not force:
        before = len(picked)
        picked = [i for i in picked if not already_exists(out_dir, i.id)]
        skipped = before - len(picked)
        if skipped:
            print(f"skipping {skipped} existing (use --force to overwrite)")

    return picked


def confirm_full_run(picked: list[Invention], force: bool) -> None:
    if force and len(picked) >= 50:
        print(f"about to (re)generate {len(picked)} images. continue? [y/N] ", end="", flush=True)
        if input().strip().lower() != "y":
            print("aborted.")
            sys.exit(0)


def main() -> None:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--sample", type=int, help="generate N random inventions")
    p.add_argument("--ids", help="comma-separated invention ids")
    p.add_argument("--n", type=int, default=1, help="variants per invention (default 1)")
    p.add_argument("--force", action="store_true", help="overwrite existing output")
    p.add_argument("--dry-run", action="store_true", help="print prompts, generate nothing")
    p.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    p.add_argument("--provider", choices=("codex", "openai", "gemini"), default="codex",
                   help="image provider: codex (default; ChatGPT subscription, no API key), "
                        "openai (paid API, OPENAI_API_KEY) or gemini")
    p.add_argument("--cards-json", type=Path,
                   help="also load cards not in the deck TSV from a JSON list of "
                        "{id, year, title, summary, inventor, location, field} "
                        "(e.g. prototypes/assembly-cards/art_cards.py writes one)")
    args = p.parse_args()
    args.out_dir = args.out_dir.resolve()  # a relative --out-dir works too

    ids = [s.strip() for s in args.ids.split(",")] if args.ids else None

    all_inv = load_inventions(TSV_PATH)
    print(f"loaded {len(all_inv)} inventions from {TSV_PATH.relative_to(ROOT)}")
    if args.cards_json:
        extra = load_cards_json(args.cards_json)
        known = {inv.id for inv in all_inv}
        clash = [inv.id for inv in extra if inv.id in known]
        if clash:
            print(f"--cards-json ids already in the deck: {', '.join(clash)}", file=sys.stderr)
            sys.exit(2)
        all_inv += extra
        print(f"loaded {len(extra)} more from {args.cards_json}")
        if not ids:
            # Only the JSON's cards, never the whole deck, unless --ids says otherwise.
            ids = [inv.id for inv in extra]

    picked = select_inventions(all_inv, ids, args.sample, args.out_dir, args.force)
    if not picked:
        print("nothing to do.")
        return

    print(f"target: {len(picked)} inventions, n={args.n} each, out={args.out_dir.relative_to(ROOT) if args.out_dir.is_relative_to(ROOT) else args.out_dir}")
    confirm_full_run(picked, args.force)

    asyncio.run(run(picked, args.out_dir, args.n, args.dry_run, args.provider))


if __name__ == "__main__":
    main()
