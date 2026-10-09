import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const effectDir = new URL('../assets/effects/prepared/', import.meta.url);
const runtimeDir = new URL('../assets/prepared/runtime/', import.meta.url);

export async function mergeVfxRuntime() {
  await run(process.env.ASSET_PYTHON || 'python', [fileURLToPath(new URL('./prepare-vfx.py', import.meta.url))]);
  const runtime = JSON.parse(await readFile(new URL('manifest.json', runtimeDir), 'utf8'));
  const effects = JSON.parse(await readFile(new URL('manifest.json', effectDir), 'utf8'));
  for (const key of Object.keys(runtime.atlases)) if (key === 'effects') delete runtime.atlases[key];
  for (const key of Object.keys(runtime.frames)) if (key.startsWith('effects.')) delete runtime.frames[key];
  for (const key of Object.keys(runtime.animations)) if (key.startsWith('effects.')) delete runtime.animations[key];
  Object.assign(runtime.atlases, effects.atlases);
  Object.assign(runtime.frames, effects.frames);
  Object.assign(runtime.animations, effects.animations);
  await copyFile(new URL('effects.png', effectDir), new URL('effects.png', runtimeDir));
  await writeFile(new URL('manifest.json', runtimeDir), `${JSON.stringify(runtime, null, 2)}\n`);
  const webRuntimeDir = new URL('../apps/web/public/assets/runtime/', import.meta.url);
  try {
    await copyFile(new URL('effects.png', effectDir), new URL('effects.png', webRuntimeDir));
    await writeFile(new URL('manifest.json', webRuntimeDir), `${JSON.stringify(runtime, null, 2)}\n`);
    await writeFile(new URL('../apps/web/public/manifest.json', import.meta.url), `${JSON.stringify(runtime, null, 2)}\n`);
  } catch {}
  console.log(`Merged ${Object.keys(effects.frames).length} VFX frames into runtime bundle.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  mergeVfxRuntime().catch((error) => { console.error(error); process.exitCode = 1; });
}
