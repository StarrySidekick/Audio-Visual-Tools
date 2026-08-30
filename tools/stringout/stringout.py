#!/usr/bin/env python3
"""
stringout — an "assistant editor" for the terminal.

Point it at a drive (or folder) of footage and it will:

  1. scan    — walk the folder, probe every media file with ffprobe, and save
               a manifest (JSON) of everything it found: duration, codec,
               resolution, frame rate, audio channels, timecode, shoot date.
  2. report  — flatten that manifest into a CSV you can open in any
               spreadsheet (your "media log").
  3. build   — generate a Final Cut Pro 7 XML (xmeml) stringout sequence —
               every clip laid end-to-end in shoot order with a marker at the
               head of each clip — which Premiere Pro imports directly via
               File > Import. Resolve and other NLEs read it too.
  4. all     — do all three in one shot.

Requirements: Python 3.9+ and ffprobe (ships with ffmpeg) on your PATH.
No pip installs needed — standard library only.

Typical use:

    python3 stringout.py all /Volumes/FOOTAGE_DRIVE -o ~/Desktop/MyFilm_ingest

Then in Premiere: File > Import > MyFilm_ingest/stringout.xml
"""

from __future__ import annotations

import argparse
import csv
import datetime as dt
import json
import os
import re
import subprocess
import sys
import xml.sax.saxutils as saxutils
from concurrent.futures import ThreadPoolExecutor, as_completed
from fractions import Fraction
from pathlib import Path

# ---------------------------------------------------------------------------
# What counts as media
# ---------------------------------------------------------------------------

VIDEO_EXTS = {
    ".mov", ".mp4", ".mxf", ".avi", ".mkv", ".m4v", ".mts", ".m2ts",
    ".r3d", ".braw", ".ari", ".dng", ".webm", ".mpg", ".mpeg", ".3gp",
}
AUDIO_EXTS = {
    ".wav", ".bwf", ".aif", ".aiff", ".mp3", ".m4a", ".flac", ".caf", ".ogg",
}
IGNORE_DIRS = {
    ".git", "__pycache__", "$RECYCLE.BIN", "System Volume Information",
    ".Trashes", ".Spotlight-V100", ".fseventsd", "node_modules",
}
IGNORE_FILE_PREFIXES = ("._",)  # macOS resource forks on exFAT drives


def is_media(path: Path) -> bool:
    if path.name.startswith(IGNORE_FILE_PREFIXES):
        return False
    return path.suffix.lower() in VIDEO_EXTS | AUDIO_EXTS


# ---------------------------------------------------------------------------
# Probing
# ---------------------------------------------------------------------------

def ffprobe(path: Path) -> dict | None:
    """Run ffprobe and return parsed JSON, or None if the file is unreadable."""
    cmd = [
        "ffprobe", "-v", "error", "-print_format", "json",
        "-show_format", "-show_streams", str(path),
    ]
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        if isinstance(e, FileNotFoundError):
            sys.exit("ERROR: ffprobe not found. Install ffmpeg (https://ffmpeg.org) "
                     "and make sure ffprobe is on your PATH.")
        return None
    if out.returncode != 0:
        return None
    try:
        return json.loads(out.stdout)
    except json.JSONDecodeError:
        return None


def parse_fps(stream: dict) -> float | None:
    for key in ("avg_frame_rate", "r_frame_rate"):
        raw = stream.get(key)
        if raw and raw not in ("0/0", "0"):
            try:
                val = float(Fraction(raw))
                if val > 0:
                    return round(val, 3)
            except (ValueError, ZeroDivisionError):
                continue
    return None


def find_timecode(probe: dict) -> str | None:
    fmt_tags = probe.get("format", {}).get("tags", {}) or {}
    for k, v in fmt_tags.items():
        if k.lower() == "timecode":
            return v
    for stream in probe.get("streams", []):
        tags = stream.get("tags", {}) or {}
        for k, v in tags.items():
            if k.lower() == "timecode":
                return v
    return None


def find_creation_time(probe: dict, path: Path) -> str:
    """Prefer embedded creation_time (what the camera wrote); fall back to
    filesystem mtime. Returned as ISO 8601."""
    fmt_tags = probe.get("format", {}).get("tags", {}) or {}
    for k, v in fmt_tags.items():
        if k.lower() == "creation_time":
            return v
    for stream in probe.get("streams", []):
        tags = stream.get("tags", {}) or {}
        for k, v in tags.items():
            if k.lower() == "creation_time":
                return v
    try:
        mtime = path.stat().st_mtime
        return dt.datetime.fromtimestamp(mtime).isoformat()
    except OSError:
        return ""


def guess_card(path: Path, root: Path) -> str:
    """Guess which camera card / roll a clip came from: the first meaningful
    directory under the scan root (skipping generic vendor folder names)."""
    generic = {"private", "clip", "clips", "video", "audio", "dcim", "avchd",
               "bdmv", "stream", "xdroot", "contents", "m4root", "mp_root",
               "sub", "cliproot", "footage", "media"}
    try:
        rel = path.relative_to(root)
    except ValueError:
        return ""
    for part in rel.parts[:-1]:
        if part.lower() not in generic:
            return part
    return rel.parts[0] if len(rel.parts) > 1 else ""


def probe_file(path: Path, root: Path) -> dict:
    entry: dict = {
        "path": str(path),
        "name": path.name,
        "card": guess_card(path, root),
        "size_bytes": None,
        "ok": False,
    }
    try:
        entry["size_bytes"] = path.stat().st_size
    except OSError:
        pass

    probe = ffprobe(path)
    if probe is None:
        entry["error"] = "unreadable (ffprobe failed)"
        return entry

    fmt = probe.get("format", {})
    streams = probe.get("streams", [])
    vstreams = [s for s in streams if s.get("codec_type") == "video"
                and s.get("disposition", {}).get("attached_pic", 0) != 1]
    astreams = [s for s in streams if s.get("codec_type") == "audio"]

    try:
        duration = float(fmt.get("duration", 0.0))
    except (TypeError, ValueError):
        duration = 0.0
    if duration <= 0:
        for s in vstreams + astreams:
            try:
                duration = max(duration, float(s.get("duration", 0.0)))
            except (TypeError, ValueError):
                pass
    if duration <= 0:
        entry["error"] = "zero duration"
        return entry

    entry.update({
        "ok": True,
        "duration_s": round(duration, 6),
        "container": fmt.get("format_name", ""),
        "creation_time": find_creation_time(probe, path),
        "timecode": find_timecode(probe),
    })

    if vstreams:
        v = vstreams[0]
        entry.update({
            "kind": "video",
            "video_codec": v.get("codec_name", ""),
            "width": v.get("width"),
            "height": v.get("height"),
            "fps": parse_fps(v),
        })
    else:
        entry["kind"] = "audio"

    if astreams:
        a = astreams[0]
        entry.update({
            "audio_codec": a.get("codec_name", ""),
            "audio_channels": sum(int(s.get("channels", 0) or 0) for s in astreams),
            "sample_rate": int(a.get("sample_rate", 0) or 0),
        })
    else:
        entry["audio_channels"] = 0

    return entry


# ---------------------------------------------------------------------------
# scan
# ---------------------------------------------------------------------------

def cmd_scan(root: Path, out_path: Path, workers: int = 8) -> dict:
    root = root.resolve()
    if not root.exists():
        sys.exit(f"ERROR: {root} does not exist")

    candidates: list[Path] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        for fn in filenames:
            p = Path(dirpath) / fn
            if is_media(p):
                candidates.append(p)

    print(f"Found {len(candidates)} media files under {root}. Probing…")
    entries: list[dict] = []
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(probe_file, p, root): p for p in candidates}
        done = 0
        for fut in as_completed(futures):
            entries.append(fut.result())
            done += 1
            if done % 25 == 0 or done == len(candidates):
                print(f"  probed {done}/{len(candidates)}")

    entries.sort(key=lambda e: e["path"])
    ok = [e for e in entries if e.get("ok")]
    bad = [e for e in entries if not e.get("ok")]

    manifest = {
        "schema": "stringout-manifest/1",
        "scanned_root": str(root),
        "scanned_at": dt.datetime.now().isoformat(timespec="seconds"),
        "file_count": len(entries),
        "ok_count": len(ok),
        "error_count": len(bad),
        "total_duration_s": round(sum(e["duration_s"] for e in ok), 3),
        "entries": entries,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(manifest, indent=2))
    hours = manifest["total_duration_s"] / 3600
    print(f"Wrote {out_path}  ({len(ok)} readable clips, "
          f"{len(bad)} problems, {hours:.2f} h of media)")
    if bad:
        print("Problem files:")
        for e in bad:
            print(f"  ! {e['path']}  ({e.get('error', 'unknown')})")
    return manifest


# ---------------------------------------------------------------------------
# report
# ---------------------------------------------------------------------------

REPORT_COLUMNS = [
    "name", "card", "kind", "duration_s", "timecode", "creation_time",
    "video_codec", "width", "height", "fps",
    "audio_codec", "audio_channels", "sample_rate",
    "size_bytes", "path", "error",
]


def cmd_report(manifest: dict, out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=REPORT_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for e in sorted(manifest["entries"], key=sort_key):
            writer.writerow(e)
    print(f"Wrote {out_path}  ({manifest['file_count']} rows)")


# ---------------------------------------------------------------------------
# build (xmeml stringout)
# ---------------------------------------------------------------------------

def sort_key(e: dict):
    """Shoot order: creation time, then embedded timecode, then filename."""
    return (
        e.get("creation_time") or "9999",
        e.get("timecode") or "99:99:99:99",
        e.get("name", ""),
    )


def pick_sequence_format(clips: list[dict]) -> tuple[int, bool, int, int]:
    """Choose the dominant frame rate and resolution among video clips.
    Returns (timebase, ntsc, width, height)."""
    fps_votes: dict[float, float] = {}
    res_votes: dict[tuple[int, int], float] = {}
    for c in clips:
        if c.get("kind") != "video":
            continue
        d = c.get("duration_s", 0.0)
        if c.get("fps"):
            fps_votes[c["fps"]] = fps_votes.get(c["fps"], 0.0) + d
        if c.get("width") and c.get("height"):
            key = (c["width"], c["height"])
            res_votes[key] = res_votes.get(key, 0.0) + d

    fps = max(fps_votes, key=fps_votes.get) if fps_votes else 23.976
    width, height = max(res_votes, key=res_votes.get) if res_votes else (1920, 1080)

    # xmeml expresses rate as an integer timebase + an NTSC flag
    # (ntsc TRUE means the real rate is timebase * 1000/1001).
    ntsc_rates = {23.976: 24, 29.97: 30, 59.94: 60, 47.952: 48, 119.88: 120}
    for real, base in ntsc_rates.items():
        if abs(fps - real) < 0.01:
            return base, True, width, height
    return int(round(fps)), False, width, height


def esc(text: str) -> str:
    return saxutils.escape(str(text))


def pathurl(path: str) -> str:
    """file:// URL the way NLEs expect it (percent-encode spaces etc.)."""
    from urllib.request import pathname2url
    return "file://localhost" + pathname2url(os.path.abspath(path))


def rate_xml(timebase: int, ntsc: bool, indent: str) -> str:
    n = "TRUE" if ntsc else "FALSE"
    return (f"{indent}<rate>\n"
            f"{indent}\t<timebase>{timebase}</timebase>\n"
            f"{indent}\t<ntsc>{n}</ntsc>\n"
            f"{indent}</rate>\n")


def build_xmeml(manifest: dict, seq_name: str) -> str:
    clips = sorted((e for e in manifest["entries"] if e.get("ok")), key=sort_key)
    if not clips:
        sys.exit("ERROR: no readable clips in manifest; nothing to build.")

    timebase, ntsc, seq_w, seq_h = pick_sequence_format(clips)
    real_fps = timebase * (1000 / 1001) if ntsc else float(timebase)

    max_audio = min(2, max((c.get("audio_channels", 0) for c in clips), default=0))
    max_audio = max(max_audio, 1)

    video_items: list[str] = []
    audio_tracks: list[list[str]] = [[] for _ in range(max_audio)]
    markers: list[str] = []

    playhead = 0  # sequence frames
    item_id = 0
    for i, c in enumerate(clips):
        frames = max(1, int(round(c["duration_s"] * real_fps)))
        start, end = playhead, playhead + frames

        file_id = f"file-{i + 1}"
        is_video = c.get("kind") == "video"

        # <file> definition — full on first (video) use, reference afterwards
        file_def = (
            f"\t\t\t\t\t\t<file id=\"{file_id}\">\n"
            f"\t\t\t\t\t\t\t<name>{esc(c['name'])}</name>\n"
            f"\t\t\t\t\t\t\t<pathurl>{esc(pathurl(c['path']))}</pathurl>\n"
            + rate_xml(timebase, ntsc, "\t\t\t\t\t\t\t")
            + f"\t\t\t\t\t\t\t<duration>{frames}</duration>\n"
            f"\t\t\t\t\t\t\t<media>\n"
            + (
                "\t\t\t\t\t\t\t\t<video>\n"
                "\t\t\t\t\t\t\t\t\t<samplecharacteristics>\n"
                f"\t\t\t\t\t\t\t\t\t\t<width>{c.get('width') or seq_w}</width>\n"
                f"\t\t\t\t\t\t\t\t\t\t<height>{c.get('height') or seq_h}</height>\n"
                "\t\t\t\t\t\t\t\t\t</samplecharacteristics>\n"
                "\t\t\t\t\t\t\t\t</video>\n"
                if is_video else ""
            )
            + (
                "\t\t\t\t\t\t\t\t<audio>\n"
                f"\t\t\t\t\t\t\t\t\t<channelcount>{c.get('audio_channels', 0)}</channelcount>\n"
                "\t\t\t\t\t\t\t\t</audio>\n"
                if c.get("audio_channels", 0) > 0 else ""
            )
            + "\t\t\t\t\t\t\t</media>\n"
            "\t\t\t\t\t\t</file>\n"
        )
        file_ref = f"\t\t\t\t\t\t<file id=\"{file_id}\"/>\n"
        file_used = False

        def clipitem(track_kind: str, channel_index: int = 1) -> str:
            nonlocal item_id, file_used
            item_id += 1
            body = file_def if not file_used else file_ref
            file_used = True
            source = ""
            if track_kind == "audio":
                source = (
                    "\t\t\t\t\t\t<sourcetrack>\n"
                    "\t\t\t\t\t\t\t<mediatype>audio</mediatype>\n"
                    f"\t\t\t\t\t\t\t<trackindex>{channel_index}</trackindex>\n"
                    "\t\t\t\t\t\t</sourcetrack>\n"
                )
            return (
                f"\t\t\t\t\t<clipitem id=\"clipitem-{item_id}\">\n"
                f"\t\t\t\t\t\t<name>{esc(c['name'])}</name>\n"
                f"\t\t\t\t\t\t<duration>{frames}</duration>\n"
                + rate_xml(timebase, ntsc, "\t\t\t\t\t\t")
                + f"\t\t\t\t\t\t<start>{start}</start>\n"
                f"\t\t\t\t\t\t<end>{end}</end>\n"
                f"\t\t\t\t\t\t<in>0</in>\n"
                f"\t\t\t\t\t\t<out>{frames}</out>\n"
                + body + source +
                "\t\t\t\t\t</clipitem>\n"
            )

        if is_video:
            video_items.append(clipitem("video"))
        channels = min(c.get("audio_channels", 0), max_audio)
        for ch in range(channels):
            audio_tracks[ch].append(clipitem("audio", ch + 1))

        label = c["name"] + (f"  [{c['card']}]" if c.get("card") else "")
        markers.append(
            "\t\t<marker>\n"
            f"\t\t\t<name>{esc(label)}</name>\n"
            f"\t\t\t<comment>{esc(c.get('creation_time') or '')}</comment>\n"
            f"\t\t\t<in>{start}</in>\n"
            "\t\t\t<out>-1</out>\n"
            "\t\t</marker>\n"
        )
        playhead = end

    audio_tracks_xml = ""
    for track_items in audio_tracks:
        audio_tracks_xml += "\t\t\t\t<track>\n" + "".join(track_items) + "\t\t\t\t</track>\n"

    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<!DOCTYPE xmeml>\n"
        '<xmeml version="4">\n'
        '\t<sequence id="sequence-1">\n'
        f"\t\t<name>{esc(seq_name)}</name>\n"
        f"\t\t<duration>{playhead}</duration>\n"
        + rate_xml(timebase, ntsc, "\t\t")
        + "\t\t<media>\n"
        "\t\t\t<video>\n"
        "\t\t\t\t<format>\n"
        "\t\t\t\t\t<samplecharacteristics>\n"
        f"\t\t\t\t\t\t<width>{seq_w}</width>\n"
        f"\t\t\t\t\t\t<height>{seq_h}</height>\n"
        "\t\t\t\t\t\t<pixelaspectratio>square</pixelaspectratio>\n"
        + rate_xml(timebase, ntsc, "\t\t\t\t\t\t")
        + "\t\t\t\t\t</samplecharacteristics>\n"
        "\t\t\t\t</format>\n"
        "\t\t\t\t<track>\n"
        + "".join(video_items)
        + "\t\t\t\t</track>\n"
        "\t\t\t</video>\n"
        "\t\t\t<audio>\n"
        + audio_tracks_xml
        + "\t\t\t</audio>\n"
        "\t\t</media>\n"
        "\t\t<timecode>\n"
        + rate_xml(timebase, ntsc, "\t\t\t")
        + "\t\t\t<frame>0</frame>\n"
        "\t\t\t<displayformat>" + ("DF" if ntsc else "NDF") + "</displayformat>\n"
        "\t\t</timecode>\n"
        + "".join(markers)
        + "\t</sequence>\n"
        "</xmeml>\n"
    )


def cmd_build(manifest: dict, out_path: Path, seq_name: str) -> None:
    xml = build_xmeml(manifest, seq_name)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(xml)
    ok = manifest.get("ok_count", "?")
    print(f"Wrote {out_path}  (stringout of {ok} clips — "
          f"import into Premiere via File > Import)")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def load_manifest(path: Path) -> dict:
    try:
        manifest = json.loads(path.read_text())
    except (OSError, json.JSONDecodeError) as e:
        sys.exit(f"ERROR: cannot read manifest {path}: {e}")
    if manifest.get("schema") != "stringout-manifest/1":
        sys.exit(f"ERROR: {path} is not a stringout manifest")
    return manifest


def default_name(root: Path) -> str:
    stamp = dt.date.today().isoformat()
    return f"{root.name}_stringout_{stamp}"


def main(argv: list[str] | None = None) -> None:
    ap = argparse.ArgumentParser(
        prog="stringout",
        description="Assistant-editor toolkit: scan footage, log it, and build "
                    "a stringout timeline for Premiere Pro.")
    sub = ap.add_subparsers(dest="command", required=True)

    p_scan = sub.add_parser("scan", help="probe all media under a folder into a manifest.json")
    p_scan.add_argument("root", type=Path, help="footage folder / drive to scan")
    p_scan.add_argument("-o", "--output", type=Path, default=Path("manifest.json"))
    p_scan.add_argument("--workers", type=int, default=8)

    p_rep = sub.add_parser("report", help="write a CSV media log from a manifest")
    p_rep.add_argument("manifest", type=Path)
    p_rep.add_argument("-o", "--output", type=Path, default=Path("media_log.csv"))

    p_build = sub.add_parser("build", help="write a stringout .xml from a manifest")
    p_build.add_argument("manifest", type=Path)
    p_build.add_argument("-o", "--output", type=Path, default=Path("stringout.xml"))
    p_build.add_argument("--name", help="sequence name (default: folder + date)")

    p_all = sub.add_parser("all", help="scan + report + build in one shot")
    p_all.add_argument("root", type=Path)
    p_all.add_argument("-o", "--output-dir", type=Path, default=None,
                       help="output folder (default: <root name>_ingest next to cwd)")
    p_all.add_argument("--name", help="sequence name (default: folder + date)")
    p_all.add_argument("--workers", type=int, default=8)

    args = ap.parse_args(argv)

    if args.command == "scan":
        cmd_scan(args.root, args.output, args.workers)
    elif args.command == "report":
        cmd_report(load_manifest(args.manifest), args.output)
    elif args.command == "build":
        manifest = load_manifest(args.manifest)
        name = args.name or default_name(Path(manifest["scanned_root"]))
        cmd_build(manifest, args.output, name)
    elif args.command == "all":
        out_dir = args.output_dir or Path(f"{args.root.resolve().name}_ingest")
        manifest = cmd_scan(args.root, out_dir / "manifest.json", args.workers)
        cmd_report(manifest, out_dir / "media_log.csv")
        name = args.name or default_name(args.root.resolve())
        cmd_build(manifest, out_dir / "stringout.xml", name)
        print(f"\nDone. Import {out_dir / 'stringout.xml'} into Premiere "
              "(File > Import) and you have a watch-everything timeline.")


if __name__ == "__main__":
    main()
