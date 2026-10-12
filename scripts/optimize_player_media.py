"""Shrink player portraits for the app: PNG/JPG -> WebP, longest side capped at 512px, transparency kept.

The app never shows a portrait larger than ~260px, so 512px stays sharp on 2x screens while cutting the
media folder from ~24 MB to a few MB. Updates `photo` paths in app/public/data/player-media.json.

Runs automatically at the end of sync_player_media.py; run it on its own after replacing images by hand:
    python3 -I scripts/optimize_player_media.py
"""
import json
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "app/public"
MEDIA_JSON = PUBLIC / "data/player-media.json"
MAX_SIDE = 512
QUALITY = 82


def to_webp(src: Path) -> Path:
    dst = src.with_suffix(".webp")
    with Image.open(src) as im:
        im = im.convert("RGBA") if im.mode in ("P", "LA", "RGBA") or "transparency" in im.info else im.convert("RGB")
        im.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
        im.save(dst, "WEBP", quality=QUALITY, method=6)
    src.unlink()
    return dst


def main():
    meta = json.loads(MEDIA_JSON.read_text())
    before = after = 0
    for profile in meta["players"].values():
        rel = Path(profile["photo"])
        src = PUBLIC / rel
        webp = src.with_suffix(".webp")
        if src.suffix != ".webp" and src.exists():
            before += src.stat().st_size
            webp = to_webp(src)
        if webp.exists():
            after += webp.stat().st_size
            profile["photo"] = str(rel.with_suffix(".webp"))
    MEDIA_JSON.write_text(json.dumps(meta, indent=2) + "\n")
    if before:
        print(f"Portraits: {before / 1e6:.1f} MB -> {after / 1e6:.1f} MB (WebP, max {MAX_SIDE}px)")


if __name__ == "__main__":
    main()
