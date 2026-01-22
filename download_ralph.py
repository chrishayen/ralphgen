#!/usr/bin/env python3
"""Download Ralph Wiggum images from Frinkiac."""

import argparse
import hashlib
import json
import sys
import time
from pathlib import Path
from urllib.parse import quote

import requests


FRINKIAC_API = "https://frinkiac.com/api"
FRINKIAC_IMG = "https://frinkiac.com/img"

# Ralph Wiggum quotes and phrases to search for
RALPH_SEARCHES = [
    "Ralph Wiggum",
    "I'm Idaho",
    "me fail English",
    "unpossible",
    "tastes like burning",
    "my cat's breath",
    "I bent my wookie",
    "I'm learnding",
    "Super Nintendo Chalmers",
    "that's where I saw the leprechaun",
    "my parents won't let me use scissors",
    "I glued my head",
    "I choo choo choose you",
    "sleep that's where I'm a viking",
    "when I grow up I want to be a principal or a caterpillar",
    "I found a moon rock in my nose",
    "the doctor said I wouldn't have so many nosebleeds",
    "that's my sandbox",
    "I'm a unitard",
    "my knob tastes funny",
    "daddy says I'm this close to sleeping in the yard",
    "what's a battle",
    "I heard your dad went into a restaurant",
    "Mrs Krabappel and Principal Skinner were in the closet",
    "Ralph please go",
    "I dress myself",
]


def search_frinkiac(query: str) -> list[dict]:
    """Search Frinkiac for screenshots matching a query."""
    url = f"{FRINKIAC_API}/search?q={quote(query)}"
    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        print(f"  Error searching for '{query}': {e}")
        return []


def download_image(episode: str, timestamp: int, output_dir: Path) -> bool:
    """Download a single image from Frinkiac."""
    url = f"{FRINKIAC_IMG}/{episode}/{timestamp}.jpg"

    # Use hash of url for unique filename
    filename = f"{episode}_{timestamp}.jpg"
    filepath = output_dir / filename

    if filepath.exists():
        return False  # Already downloaded

    try:
        resp = requests.get(url, timeout=10)
        resp.raise_for_status()
        filepath.write_bytes(resp.content)
        return True
    except requests.RequestException as e:
        print(f"  Error downloading {url}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(
        description="Download Ralph Wiggum images from Frinkiac"
    )
    parser.add_argument(
        "-o",
        "--output",
        type=Path,
        default=Path("data/ralph_wiggum"),
        help="Output directory (default: data/ralph_wiggum)",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=0.1,
        help="Delay between requests in seconds (default: 0.1)",
    )
    parser.add_argument(
        "--max-per-search",
        type=int,
        default=None,
        help="Max images to download per search term (default: all)",
    )
    args = parser.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)

    all_frames = {}  # episode_timestamp -> frame data, for deduplication

    print(f"Searching Frinkiac for Ralph Wiggum content...")
    for query in RALPH_SEARCHES:
        print(f"  Searching: {query}")
        results = search_frinkiac(query)

        for result in results:
            key = f"{result['Episode']}_{result['Timestamp']}"
            if key not in all_frames:
                all_frames[key] = result

        time.sleep(args.delay)

    print(f"\nFound {len(all_frames)} unique frames")

    downloaded = 0
    skipped = 0

    print("Downloading images...")
    for i, (key, frame) in enumerate(all_frames.items()):
        if args.max_per_search and downloaded >= args.max_per_search * len(RALPH_SEARCHES):
            break

        if download_image(frame["Episode"], frame["Timestamp"], args.output):
            downloaded += 1
        else:
            skipped += 1

        if (i + 1) % 50 == 0:
            print(f"  Progress: {i + 1}/{len(all_frames)}")

        time.sleep(args.delay)

    print(f"\nDone! Downloaded {downloaded} new images, skipped {skipped} existing")
    print(f"Total images in {args.output}: {len(list(args.output.glob('*.jpg')))}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
