import { defineConfig } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const playgroundRoot = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: playgroundRoot,
  publicDir: resolve(playgroundRoot, "../../../assets/prepared/runtime"),
  server: {
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
  },
});
