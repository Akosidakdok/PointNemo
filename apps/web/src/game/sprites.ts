export interface FrameRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FramePoint {
  x: number;
  y: number;
}

export interface ManifestFrame {
  atlas: string;
  rect: FrameRect;
  anchor: FramePoint;
  kind?: string;
  suggestedSize?: number;
  source: {
    atlas: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ManifestAnimation {
  frames: string[];
  fps: number;
  loop: boolean;
}

export interface ManifestAtlas {
  image: string;
  width: number;
  height: number;
  cellWidth?: number;
  cellHeight?: number;
  sha256?: string;
  transparentPixels?: number;
}

export interface AssetManifest {
  version: number;
  atlases: Record<string, ManifestAtlas>;
  frames: Record<string, ManifestFrame>;
  animations: Record<string, ManifestAnimation>;
  aliases: Record<string, string>;
  world: {
    waterAtlas: string;
    repeatMode: string;
    tileWorldSize: number;
    buoyFrame: string;
  };
  notes?: string[];
}

export interface AssetBundle {
  manifest: AssetManifest;
  images: Record<string, HTMLImageElement>;
}

/** Load a prepared atlas bundle; resolves PNG paths relative to its manifest. */
export async function loadAssetBundle(
  manifestUrl: string = "/assets/runtime/manifest.json",
  onProgress?: (loaded: number, total: number) => void
): Promise<AssetBundle> {
  const url = new URL(manifestUrl, window.location.href);
  const response = await fetch(url.href);
  if (!response.ok) {
    throw new Error(`Asset manifest failed: HTTP ${response.status}`);
  }
  const manifest = (await response.json()) as AssetManifest;
  const images: Record<string, HTMLImageElement> = {};
  const entries = Object.entries(manifest.atlases);
  let loadedCount = 0;

  await Promise.all(
    entries.map(async ([name, atlas]) => {
      const image = new Image();
      image.src = new URL(atlas.image, url.href).href;
      await image.decode();
      if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) {
        throw new Error(
          `Atlas dimensions do not match manifest for ${name}: expected ${atlas.width}x${atlas.height}, got ${image.naturalWidth}x${image.naturalHeight}`
        );
      }
      images[name] = image;
      loadedCount++;
      if (onProgress) onProgress(loadedCount, entries.length);
    })
  );

  return { manifest, images };
}

export class SpriteAnimation {
  bundle: AssetBundle;
  name: string = "";
  elapsed: number = 0;

  constructor(bundle: AssetBundle, animation: string) {
    this.bundle = bundle;
    this.play(animation);
  }

  play(name: string, { restart = false }: { restart?: boolean } = {}) {
    if (!this.bundle.manifest.animations[name]) {
      throw new Error(`Unknown animation: ${name}`);
    }
    if (name !== this.name || restart) {
      this.name = name;
      this.elapsed = 0;
    }
  }

  update(dt: number) {
    if (!Number.isFinite(dt) || dt < 0) {
      throw new RangeError("dt must be nonnegative seconds.");
    }
    this.elapsed += dt;
  }

  get frameName(): string {
    const animation = this.bundle.manifest.animations[this.name];
    if (!animation) return "";
    const index = Math.floor(this.elapsed * animation.fps);
    return animation.frames[
      animation.loop ? index % animation.frames.length : Math.min(index, animation.frames.length - 1)
    ];
  }

  get finished(): boolean {
    const animation = this.bundle.manifest.animations[this.name];
    if (!animation) return true;
    return !animation.loop && this.elapsed >= animation.frames.length / animation.fps;
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale = 1) {
    if (this.frameName) {
      drawFrame(ctx, this.bundle, this.frameName, x, y, scale);
    }
  }
}

/** x/y identifies the shared sprite anchor, not the top-left corner. */
export function drawFrame(
  ctx: CanvasRenderingContext2D,
  bundle: AssetBundle,
  frameName: string,
  x: number,
  y: number,
  scale = 1
) {
  const name = bundle.manifest.aliases[frameName] ?? frameName;
  const frame = bundle.manifest.frames[name];
  if (!frame) {
    throw new Error(`Unknown frame: ${frameName}`);
  }
  const r = frame.rect;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    bundle.images[frame.atlas],
    r.x,
    r.y,
    r.width,
    r.height,
    Math.round(x - frame.anchor.x * scale),
    Math.round(y - frame.anchor.y * scale),
    Math.round(r.width * scale),
    Math.round(r.height * scale)
  );
}

/** Pick ONE scale for each species and retain it across all its poses/attacks. */
export function speciesScale(bundle: AssetBundle, species: string, desiredSize = 80): number {
  const references = Object.entries(bundle.manifest.frames).filter(([name, frame]) => {
    if (frame.atlas !== species || frame.kind !== "sprite") return false;
    return species === "explorer" || name.includes(".0.") || name.includes(".1.") || species === "buoy";
  });
  const largest = Math.max(
    ...references.map(([, frame]) => Math.max(frame.source.width, frame.source.height))
  );
  if (!Number.isFinite(largest) || largest <= 0) {
    throw new Error(`No reference frames for ${species}`);
  }
  return desiredSize / largest;
}

/** Mirrored repeat joins matching edge pixels; generated water is not assumed seamless. */
export function drawWater(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
  tileSize = 320,
  cameraX = 0,
  cameraY = 0
) {
  ctx.imageSmoothingEnabled = false;
  const firstX = Math.floor(cameraX / tileSize);
  const firstY = Math.floor(cameraY / tileSize);
  for (let ty = firstY; ty * tileSize - cameraY < height; ty++) {
    for (let tx = firstX; tx * tileSize - cameraX < width; tx++) {
      const flipX = Math.abs(tx % 2) === 1;
      const flipY = Math.abs(ty % 2) === 1;
      ctx.save();
      ctx.translate(
        Math.round(tx * tileSize - cameraX + (flipX ? tileSize : 0)),
        Math.round(ty * tileSize - cameraY + (flipY ? tileSize : 0))
      );
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(image, 0, 0, tileSize, tileSize);
      ctx.restore();
    }
  }
}
