"""Read alpha bounds and emit atlas metadata. Never edits the source PNGs."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets' / 'prepared'
images = {}
frames = {}
animations = {}

for name in ['explorer', 'blobfish', 'creatures', 'water', 'buoy']:
    path = ASSETS / f'{name}.png'
    image = Image.open(path).convert('RGBA')
    images[name] = image


def frame(name, atlas, cell, anchor=None, kind='sprite', size=96):
    """Use explicit cell bounds; threshold only determines a rectangle, not output alpha."""
    image = images[atlas]
    bounds = image.getchannel('A').crop(cell).point(lambda value: 255 if value >= 16 else 0).getbbox()
    if bounds is None:
        raise ValueError(f'Empty frame: {name}')
    x, y = cell[0] + bounds[0], cell[1] + bounds[1]
    width, height = bounds[2] - bounds[0], bounds[3] - bounds[1]
    if anchor is None:
        anchor = (x + width / 2, y + height / 2)
    frames[name] = {
        'atlas': atlas,
        'rect': {'x': x, 'y': y, 'width': width, 'height': height},
        'anchor': {'x': round(anchor[0] - x, 2), 'y': round(anchor[1] - y, 2)},
        'kind': kind,
        'suggestedSize': size,
    }
    return name


def components(atlas, region):
    """Map disconnected animals whose bounding rectangles overlap (the eel tails)."""
    alpha = images[atlas].getchannel('A').crop(region)
    width, height = alpha.size
    data = list(alpha.get_flattened_data())
    seen = bytearray(len(data))
    groups = []
    for index, value in enumerate(data):
        if value < 64 or seen[index]:
            continue
        seen[index] = 1
        stack, pixels = [index], []
        while stack:
            current = stack.pop()
            x, y = current % width, current // width
            pixels.append((x + region[0], y + region[1]))
            for dx in [-1, 0, 1]:
                for dy in [-1, 0, 1]:
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < width and 0 <= ny < height:
                        neighbor = ny * width + nx
                        if not seen[neighbor] and data[neighbor] >= 64:
                            seen[neighbor] = 1
                            stack.append(neighbor)
        if len(pixels) > 500:
            groups.append(pixels)
    groups.sort(key=lambda pixels: min(x for x, y in pixels))
    if len(groups) != 4:
        raise ValueError(f'Expected four eel components, got {len(groups)}')
    return groups


def animation(name, sequence, fps=7, loop=True):
    animations[name] = {'frames': sequence, 'fps': fps, 'loop': loop}


# Explicit row/column separators mapped against each edited sheet, not generic grid slicing.
xs, ys = [0, 318, 636, 956, 1276], [0, 306, 612, 918, 1233]
anchors = [
    [(155, 135), (477, 135), (795, 135), (1116, 135)],
    [(126, 399), (410, 404), (750, 404), (1065, 404)],
    [(169, 698), (535, 700), (852, 700), (1170, 700)],
    [(150, 1015), (475, 1015), (795, 1015), (1118, 1015)],
]
for row, direction in enumerate(['down', 'left', 'right', 'up']):
    names = []
    for col in range(4):
        names.append(frame(f'explorer.{direction}.{col}', 'explorer',
            (xs[col], ys[row], xs[col + 1], ys[row + 1]), anchors[row][col], size=80))
    animation(f'explorer.idle.{direction}', names[:1], fps=1)
    animation(f'explorer.swim.{direction}', [names[1], names[2], names[3], names[2]])

xs, ys = [0, 443, 887, 1330, 1774], [0, 490, 887]
for row in range(2):
    for col in range(4):
        frame(f'blobfish.{row}.{col}', 'blobfish', (xs[col], ys[row], xs[col + 1], ys[row + 1]), size=96)
animation('blobfish.idle.down', ['blobfish.0.0'], fps=1)
animation('blobfish.swim.down', [f'blobfish.0.{col}' for col in range(4)], fps=5)
animation('blobfish.swim.left', ['blobfish.1.0', 'blobfish.1.1'], fps=5)
animation('blobfish.swim.right', ['blobfish.1.2', 'blobfish.1.3'], fps=5)

quadrants = [
    ('barreleye', [0, 163, 314, 459, 624], [0, 159, 282, 430, 599]),
    ('gulper', [624, 787, 949, 1088, 1254], [0, 174, 282, 430, 607]),
    ('goblin', [0, 176, 331, 478, 624], [607, 759, 916, 1038, 1254]),
    ('fringehead', [624, 789, 950, 1096, 1254], [607, 789, 910, 1050, 1254]),
]
for species, xs, ys in quadrants:
    for row in range(4):
        row_xs = {
            ('barreleye', 0): [0, 177, 348, 471, 624],
            ('barreleye', 2): [0, 164, 320, 468, 624],
            ('goblin', 0): [0, 179, 332, 501, 624],
            ('goblin', 1): [0, 151, 297, 449, 624],
            ('goblin', 2): [0, 155, 302, 471, 624],
            ('goblin', 3): [0, 162, 313, 459, 624],
            ('fringehead', 2): [624, 781, 919, 1062, 1254],
            ('fringehead', 3): [624, 786, 946, 1096, 1254],
        }.get((species, row), xs)
        eel_parts = components('creatures', (624, ys[row], 1254, ys[row + 1])) if species == 'gulper' and row < 3 else None
        for col in range(4):
            name = f'{species}.{row}.{col}'
            cell = (row_xs[col], ys[row], row_xs[col + 1], ys[row + 1])
            mask_runs = None
            if eel_parts:
                # Preserve existing alpha/color; isolate the intended component plus a 2px margin.
                pixels = eel_parts[col]
                expanded = {(x + dx, y + dy) for x, y in pixels for dx in range(-2, 3) for dy in range(-2, 3)
                            if 624 <= x + dx < 1254 and ys[row] <= y + dy < ys[row + 1]}
                cell = (min(x for x, y in expanded), min(y for x, y in expanded),
                        max(x for x, y in expanded) + 1, max(y for x, y in expanded) + 1)
                mask_runs = []
                for y in range(cell[1], cell[3]):
                    start = None
                    for x in range(cell[0], cell[2] + 1):
                        if (x, y) in expanded and start is None:
                            start = x
                        elif (x, y) not in expanded and start is not None:
                            mask_runs.append([y - cell[1], start - cell[0], x - start])
                            start = None
            frame(name, 'creatures', cell,
                  kind='environment' if row == 3 else 'sprite', size=128 if species == 'gulper' else 80)
            if mask_runs:
                # Rectangle stays identical to the region for local mask coordinates.
                frames[name]['rect'] = {'x': cell[0], 'y': cell[1], 'width': cell[2] - cell[0], 'height': cell[3] - cell[1]}
                frames[name]['maskRuns'] = mask_runs
    # Shared anchor for attack frames: keep tail/body stable as the jaws or frills expand.
    if species == 'gulper':
        for col in range(4):
            f = frames[f'{species}.2.{col}']
            source_anchor = [(715, 363), (835, 360), (986, 359), (1135, 358)][col]
            f['anchor'] = {'x': source_anchor[0] - f['rect']['x'], 'y': source_anchor[1] - f['rect']['y']}
    if species in ['goblin', 'fringehead', 'barreleye']:
        source_anchors = {
            'goblin': [(109, 964), (251, 964), (407, 964), (550, 964)],
            'fringehead': [(715, 956), (849, 956), (992, 956), (1155, 956)],
            'barreleye': [(85, 363), (240, 363), (389, 363), (537, 363)],
        }[species]
        for col in range(4):
            f = frames[f'{species}.2.{col}']
            f['anchor'] = {'x': source_anchors[col][0] - f['rect']['x'], 'y': source_anchors[col][1] - f['rect']['y']}
    animation(f'{species}.idle.profile', [f'{species}.0.{2 if species == "fringehead" else 0}'], fps=1)
    animation(f'{species}.swim', [f'{species}.1.{col}' for col in range(4)], fps=6)
    ability = {'barreleye': 'focus', 'gulper': 'expand', 'goblin': 'lunge', 'fringehead': 'flare'}[species]
    animation(f'{species}.{ability}', [f'{species}.2.{col}' for col in range(4)], fps=5, loop=False)

# Environment/variant naming for the master sheet's bottom rows.
environment = {
    'barreleye': ['sand-glow-1', 'sand-glow-2', 'sand-glow-3', 'sonar'],
    'gulper': ['ripple-1', 'ripple-2', 'depth-1', 'depth-2'],
    'goblin': ['substrate-1', 'substrate-2', 'substrate-3', 'lunge-trail'],
    'fringehead': ['flare-variant-1', 'flare-variant-2', 'rock-burrow', 'sand-burrow'],
}
aliases = {}
for species, names in environment.items():
    for col, name in enumerate(names):
        aliases[f'{species}.{name}'] = f'{species}.3.{col}'

frame('buoy', 'buoy', (380, 380, 880, 930), anchor=(627, 690), size=100)
animation('buoy.idle', ['buoy'], fps=1)

atlases = {}
for name, image in images.items():
    hist = image.getchannel('A').histogram()
    atlases[name] = {
        'image': f'{name}.png', 'width': image.width, 'height': image.height,
        'sha256': hashlib.sha256((ASSETS / f'{name}.png').read_bytes()).hexdigest(),
        'transparentPixels': hist[0],
    }

manifest = {
    'version': 1, 'atlases': atlases, 'frames': frames, 'aliases': aliases,
    'animations': animations,
    'world': {'waterAtlas': 'water', 'repeatMode': 'mirror', 'tileWorldSize': 320, 'buoyFrame': 'buoy'},
    'notes': [
        'Frame rectangles reference the transparent PNG atlases directly; no equal-cell slicing required.',
        'Suggested size is the largest dimension of a species reference frame in CSS/world pixels.',
        'Use a shared scale per species and the per-frame anchor; never independently fit each frame.',
        'Generated poses are prototype animations. Final combat timing and colliders are gameplay decisions.',
        'Environmental substrate squares are not verified seamless terrain tiles.',
    ],
}
(ASSETS / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(f'Wrote {len(frames)} frames, {len(animations)} animations, {len(aliases)} environment aliases.')
