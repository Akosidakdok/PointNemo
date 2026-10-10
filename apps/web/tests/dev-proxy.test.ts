import test from "node:test";
import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { createServer } from "vite";

test("dev proxy supports its actual local port while preserving origin rejection", async (t) => {
  let apiOrigin = "";
  const backend = createHttpServer((request, response) => {
    const origin = request.headers.origin;
    response.setHeader("Content-Type", "application/json");
    response.statusCode = request.method === "POST" && origin !== apiOrigin ? 403 : 200;
    response.end(JSON.stringify({ origin: origin ?? null }));
  });
  backend.listen(0, "127.0.0.1");
  await once(backend, "listening");
  t.after(() => { backend.closeAllConnections(); if (backend.listening) backend.close(); });
  const address = backend.address();
  assert.ok(address && typeof address !== "string");
  apiOrigin = `http://127.0.0.1:${address.port}`;
  const previousPort = process.env.API_PORT;
  process.env.API_PORT = String(address.port);
  t.after(() => {
    if (previousPort === undefined) delete process.env.API_PORT;
    else process.env.API_PORT = previousPort;
  });
  const vite = await createServer({
    configFile: fileURLToPath(new URL("../vite.config.ts", import.meta.url)),
    root: fileURLToPath(new URL("../", import.meta.url)),
    logLevel: "silent",
    server: { host: "127.0.0.1", port: 0, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  t.after(() => vite.close());
  await vite.listen();
  const listener = vite.httpServer?.address();
  assert.ok(listener && typeof listener !== "string");
  const webOrigin = `http://127.0.0.1:${listener.port}`;

  const health = await fetch(`${webOrigin}/api/health`);
  assert.equal(health.status, 200);
  for (const host of [`127.0.0.1:${listener.port}`, `localhost:${listener.port}`]) {
    const response = await fetch(`http://${host}/api/documents`, {
      method: "POST", headers: { Origin: `http://${host}` },
    });
    const body = await response.json();
    assert.equal(response.status, 200, JSON.stringify({ host, body }));
    assert.equal(body.origin, apiOrigin);
  }
  for (const origin of ["https://untrusted.example", "http://127.0.0.1:1"]) {
    const response = await fetch(`${webOrigin}/api/documents`, {
      method: "POST", headers: { Origin: origin },
    });
    assert.equal(response.status, 403);
    assert.equal((await response.json()).origin, origin);
  }

  backend.closeAllConnections();
  await new Promise<void>((resolve, reject) => backend.close((error) => error ? reject(error) : resolve()));
  const offline = await fetch(`${webOrigin}/api/health`);
  assert.equal(offline.status, 503);
  assert.equal((await offline.json()).error.code, "LOCAL_API_UNAVAILABLE");
});
