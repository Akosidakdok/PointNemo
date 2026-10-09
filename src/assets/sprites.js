/** Load a prepared atlas bundle; resolves PNG paths relative to its manifest. */
export async function loadAssetBundle(manifestUrl) {
  const url = new URL(manifestUrl, globalThis.location?.href);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Asset manifest failed: HTTP ${response.status}`);
  const manifest = await response.json();
  const images = {};
  await Promise.all(Object.entries(manifest.atlases).map(async ([name, atlas]) => {
    const image = new Image();
    image.src = new URL(atlas.image, url).href;
    await image.decode();
    if (image.naturalWidth !== atlas.width || image.naturalHeight !== atlas.height) {
      throw new Error(`Atlas dimensions do not match manifest: ${name}`);
    }
    images[name] = image;
  }));
  return { manifest, images };
}

export class SpriteAnimation {
  constructor(bundle, animation) {
    this.bundle = bundle;
    this.play(animation);
  }
  play(name, { restart = false } = {}) {
    if (!this.bundle.manifest.animations[name]) throw new Error(`Unknown animation: ${name}`);
    if (name !== this.name || restart) {
      this.name = name;
      this.elapsed = 0;
    }
  }
  update(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('dt must be nonnegative seconds.');
    this.elapsed += dt;
  }
  get frameName() {
    const animation = this.bundle.manifest.animations[this.name];
    const index = Math.floor(this.elapsed * animation.fps);
    return animation.frames[animation.loop ? index % animation.frames.length : Math.min(index, animation.frames.length - 1)];
  }
  get finished() {
    const animation = this.bundle.manifest.animations[this.name];
    return !animation.loop && this.elapsed >= animation.frames.length / animation.fps;
  }
  draw(ctx, x, y, scale = 1) {
    drawFrame(ctx, this.bundle, this.frameName, x, y, scale);
  }
}

/** x/y identifies the shared sprite anchor, not the top-left corner. */
export function drawFrame(ctx, bundle, frameName, x, y, scale = 1) {
  const name = bundle.manifest.aliases[frameName] ?? frameName;
  const frame = bundle.manifest.frames[name];
  if (!frame) throw new Error(`Unknown frame: ${frameName}`);
  const r = frame.rect;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(bundle.images[frame.atlas], r.x, r.y, r.width, r.height,
    Math.round(x - frame.anchor.x * scale), Math.round(y - frame.anchor.y * scale),
    Math.round(r.width * scale), Math.round(r.height * scale));
}

/** Pick ONE scale for each species and retain it across all its poses/attacks. */
export function speciesScale(bundle, species, desiredSize = 80) {
  const references = Object.entries(bundle.manifest.frames).filter(([name, frame]) => {
    if (frame.atlas !== species || frame.kind !== 'sprite') return false;
    return species === 'explorer' || name.includes('.0.') || name.includes('.1.') || species === 'buoy';
  });
  const largest = Math.max(...references.map(([, frame]) => Math.max(frame.source.width, frame.source.height)));
  if (!Number.isFinite(largest) || largest <= 0) throw new Error(`No reference frames for ${species}`);
  return desiredSize / largest;
}

/** Mirrored repeat joins matching edge pixels; generated water is not assumed seamless. */
export function drawWater(ctx, image, width, height, tileSize = 320, cameraX = 0, cameraY = 0) {
  ctx.imageSmoothingEnabled = false;
  const firstX = Math.floor(cameraX / tileSize);
  const firstY = Math.floor(cameraY / tileSize);
  for (let ty = firstY; ty * tileSize - cameraY < height; ty++) {
    for (let tx = firstX; tx * tileSize - cameraX < width; tx++) {
      const flipX = Math.abs(tx % 2) === 1;
      const flipY = Math.abs(ty % 2) === 1;
      ctx.save();
      ctx.translate(Math.round(tx * tileSize - cameraX + (flipX ? tileSize : 0)),
        Math.round(ty * tileSize - cameraY + (flipY ? tileSize : 0)));
      ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      ctx.drawImage(image, 0, 0, tileSize, tileSize);
      ctx.restore();
    }
  }
}
