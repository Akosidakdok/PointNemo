export interface SpriteFrame {
  atlas: string;
  rect: { x: number; y: number; width: number; height: number };
  anchor: { x: number; y: number };
  kind: string;
  source: { width: number; height: number };
}

export interface AssetBundle {
  manifest: {
    atlases: Record<string, { image: string; width: number; height: number }>;
    frames: Record<string, SpriteFrame>;
    animations: Record<string, { frames: string[]; fps: number; loop: boolean }>;
    aliases: Record<string, string>;
  };
  images: Record<string, HTMLImageElement>;
}

export function loadAssetBundle(manifestUrl: string, options?: { atlases?: string[] }): Promise<AssetBundle>;
export class SpriteAnimation {
  constructor(bundle: AssetBundle, animation: string);
  name: string;
  elapsed: number;
  play(name: string, options?: { restart?: boolean }): void;
  update(dt: number): void;
  readonly frameName: string;
  readonly finished: boolean;
  draw(ctx: CanvasRenderingContext2D, x: number, y: number, scale?: number): void;
}
export function drawFrame(ctx: CanvasRenderingContext2D, bundle: AssetBundle, frameName: string, x: number, y: number, scale?: number): void;
export function speciesScale(bundle: AssetBundle, species: string, desiredSize?: number): number;
export function drawWater(ctx: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number, tileSize?: number, cameraX?: number, cameraY?: number): void;
