"""Prepare tracked VFX source sheets as one aligned runtime atlas."""

import json
from math import ceil
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "effects" / "source"
PREPARED = ROOT / "assets" / "effects" / "prepared"
CELL = 128
SHEETS = (
    ("sonar-hit", "sonar-hit.png", 16),
    ("hull-hit", "hull-hit.png", 16),
    ("sonar-cast", "sonar-cast.png", 20),
)


def main():
    PREPARED.mkdir(parents=True, exist_ok=True)
    atlas = Image.new("RGBA", (CELL * 8, CELL * len(SHEETS)))
    manifest = {
        "version": 1,
        "atlases": {
            "effects": {
                "image": "effects.png",
                "width": atlas.width,
                "height": atlas.height,
                "cellWidth": CELL,
                "cellHeight": CELL,
            }
        },
        "frames": {},
        "animations": {},
    }

    for row, (effect, filename, fps) in enumerate(SHEETS):
        source = Image.open(SOURCE / filename).convert("RGBA")
        if source.getpixel((0, 0))[3] != 0:
            raise ValueError(f"{filename}: source background is not transparent")
        # Clear near-invisible generator speckles before locating frame bounds.
        source.putalpha(source.getchannel("A").point(lambda value: 0 if value < 24 else value))
        cell_width, cell_height = ceil(source.width / 4), ceil(source.height / 2)
        scale = min(CELL / cell_width, CELL / cell_height)
        width = round(cell_width * scale)
        height = round(cell_height * scale)
        names = []

        for index in range(8):
            column, source_row = index % 4, index // 4
            crop = (round(column * source.width / 4), round(source_row * source.height / 2),
                    round((column + 1) * source.width / 4), round((source_row + 1) * source.height / 2))
            image = source.crop(crop)
            bounds = image.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"{filename}: frame {index} is empty")
            if bounds[0] < 2 or bounds[1] < 2 or bounds[2] > image.width - 2 or bounds[3] > image.height - 2:
                raise ValueError(f"{filename}: frame {index} bounds {bounds} touch {image.size} cell boundary")
            resized = image.resize((width, height), Image.Resampling.NEAREST)
            x = index * CELL
            y = row * CELL
            atlas.alpha_composite(resized, (x + (CELL - width) // 2, y + (CELL - height) // 2))
            name = f"effects.{effect}.{index}"
            manifest["frames"][name] = {
                "atlas": "effects",
                "rect": {"x": x, "y": y, "width": CELL, "height": CELL},
                "anchor": {"x": CELL // 2, "y": CELL // 2},
                "kind": "effect",
                "source": {"image": filename, "x": crop[0], "y": crop[1],
                           "width": image.width, "height": image.height},
            }
            names.append(name)

        manifest["animations"][f"effects.{effect}"] = {
            "frames": names,
            "fps": fps,
            "loop": False,
        }
        print(f"{effect}: {source.width}x{source.height}, 8 prepared frames")

    atlas.save(PREPARED / "effects.png")
    (PREPARED / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {len(manifest['frames'])} frames in {atlas.width}x{atlas.height} atlas")


if __name__ == "__main__":
    main()
