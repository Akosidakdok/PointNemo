import { defineConfig, loadEnv } from "vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, projectRoot, "");
  const apiPort = process.env.API_PORT ?? environment.API_PORT ?? "3000";
  const apiOrigin = `http://127.0.0.1:${apiPort}`;

  return {
    server: {
      host: "127.0.0.1",
      port: 5173,
      proxy: {
        "/api": {
          target: apiOrigin,
          changeOrigin: true,
          configure(proxy) {
            proxy.on("proxyReq", (proxyRequest, request) => {
              // Translate only requests originating from this local Vite listener.
              // Vite may choose a later port when 5173 is already occupied.
              const host = request.headers.host;
              const localPort = request.socket.localPort;
              const localHosts = [`127.0.0.1:${localPort}`, `localhost:${localPort}`];
              if (host && localHosts.includes(host) && request.headers.origin === `http://${host}`) {
                proxyRequest.setHeader("origin", apiOrigin);
              }
            });
            proxy.on("error", (_error, _request, response) => {
              if (!("writeHead" in response) || response.headersSent || response.writableEnded) return;
              response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
              response.end(JSON.stringify({
                success: false,
                error: {
                  code: "LOCAL_API_UNAVAILABLE",
                  message: "The local API is unavailable. Start Point Nemo with npm run dev, then retry Sonar processing.",
                },
              }));
            });
          },
        },
      },
    },
  };
});
