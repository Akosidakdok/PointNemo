import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { request as httpRequest } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import Database from "better-sqlite3";
import { createApp } from "../src/app.js";
import { readConfig, type ApiConfig } from "../src/config.js";
import { initializeDatabase, type SqliteDatabase } from "../src/db.js";
import { OllamaService, type OllamaStatus } from "../src/services/ollama.js";
import { TOKENIZER_DIGEST } from "../src/services/token-budget.js";

const config: ApiConfig = { ...readConfig({}), port: 0, databasePath: "", inferenceTimeoutMs: 1000, jobTimeoutMs: 5000 };

class FixtureOllama extends OllamaService {
  status: OllamaStatus = { available: true, model: config.ollamaModel, message: "Fixture readiness",
    digest: "fixture-digest", tokenizerReady: true, tokenizerDigest: TOKENIZER_DIGEST };
  async getStatus(): Promise<OllamaStatus> { return this.status; }
}

async function withApp(
  callback: (context: { baseUrl: string; database: SqliteDatabase; ollama: FixtureOllama }) => Promise<void>,
  options: { builtWeb?: boolean; development?: boolean } = {},
): Promise<void> {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-release-api-"));
  const database = initializeDatabase(join(directory, "test.sqlite"));
  const ollama = new FixtureOllama(config);
  const webDistPath = join(directory, "web");
  if (options.builtWeb) {
    await mkdir(join(webDistPath, "assets"), { recursive: true });
    await writeFile(join(webDistPath, "index.html"), "<!doctype html><html><body>Point Nemo test build</body></html>");
    await writeFile(join(webDistPath, "assets", "app.js"), "console.log('local test asset');");
  }
  const app = createApp(config, database, ollama, { webDistPath, allowDevelopmentOrigins: options.development ?? false });
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try { await callback({ baseUrl, database, ollama }); }
  finally {
    await new Promise<void>((done, reject) => server.close((error) => error ? reject(error) : done()));
    if (database.open) database.close();
    await rm(directory, { recursive: true, force: true });
  }
}

function requestWithHeaders(url: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((done, reject) => {
    const request = httpRequest(url, { method: "POST", headers: { "content-type": "application/json", ...headers } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk: string) => { body += chunk; });
      response.on("end", () => done({ status: response.statusCode!, body }));
    });
    request.on("error", reject);
    request.end("{}");
  });
}

test("release configuration uses port 3000, external app-data storage, and the pinned loopback model", () => {
  const localAppData = join(tmpdir(), "point-nemo-config-app-data");
  const defaults = readConfig({ LOCALAPPDATA: localAppData });
  assert.equal(defaults.port, 3000);
  assert.equal(defaults.ollamaModel, "qwen2.5:3b");
  assert.equal(defaults.ollamaBaseUrl, "http://127.0.0.1:11434");
  assert.equal(defaults.databasePath.startsWith(resolve("apps")), false);
  if (process.platform === "win32") assert.equal(defaults.databasePath, join(localAppData, "PointNemo", "point-nemo.sqlite"));
  assert.equal(readConfig({ DATABASE_PATH: "" }).databasePath, readConfig({}).databasePath);
  assert.equal(readConfig({ OLLAMA_BASE_URL: "http://localhost:11434/" }).ollamaBaseUrl, defaults.ollamaBaseUrl);
  assert.throws(() => readConfig({ OLLAMA_MODEL: "qwen3:4b" }));
  for (const url of ["http://192.168.1.2:11434", "https://127.0.0.1:11434", "http://user:secret@127.0.0.1:11434", "http://127.0.0.1:11434/api", "http://example.com:11434"]) {
    assert.throws(() => readConfig({ OLLAMA_BASE_URL: url }));
  }
  assert.throws(() => readConfig({ API_PORT: "0" }));
  assert.throws(() => readConfig({ INFERENCE_TIMEOUT_MS: "NaN" }));
  assert.throws(() => readConfig({ OLLAMA_NUM_CTX: "4096" }));
  for (const [name, value] of [["OLLAMA_NUM_CTX", "16384"], ["OLLAMA_MAX_INPUT_TOKENS", "4097"],
    ["OLLAMA_MAX_OUTPUT_TOKENS", "3073"], ["INFERENCE_TIMEOUT_MS", "180001"], ["JOB_TIMEOUT_MS", "360001"]]) {
    assert.throws(() => readConfig({ [name!]: value }));
  }
  const debug = readConfig({ OLLAMA_MAX_INPUT_TOKENS: "3000", OLLAMA_MAX_OUTPUT_TOKENS: "2000", INFERENCE_TIMEOUT_MS: "1000", JOB_TIMEOUT_MS: "2000" });
  assert.equal(debug.ollamaNumCtx, 8192);
  assert.equal(debug.ollamaMaxInputTokens, 3000);
  assert.equal(debug.inferenceTimeoutMs, 1000);
});

test("v4 migration preserves descendants, permits independent duplicate hashes, and applies legacy metadata defaults", async () => {
  const directory = await mkdtemp(join(tmpdir(), "point-nemo-migration-"));
  const path = join(directory, "legacy.sqlite");
  const legacy = new Database(path);
  const documentId = randomUUID(), setId = randomUUID(), topicId = randomUUID(), questionId = randomUUID();
  const jobId = randomUUID(), runId = randomUUID(), slotId = randomUUID(), attemptId = randomUUID();
  try {
    legacy.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE subjects(id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '');
      CREATE TABLE documents(id TEXT PRIMARY KEY, filename TEXT NOT NULL, sha256 TEXT NOT NULL UNIQUE,
        page_count INTEGER NOT NULL, normalized_char_count INTEGER NOT NULL, pages_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE generation_jobs(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        state TEXT NOT NULL, question_set_id TEXT, error_code TEXT, started_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, finished_at TEXT, cancel_requested INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE question_sets(id TEXT PRIMARY KEY, document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
        model_tag TEXT NOT NULL, model_digest TEXT NOT NULL, settings_hash TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE topics_p0(id TEXT PRIMARY KEY, question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE, name TEXT NOT NULL);
      CREATE TABLE questions_p0(id TEXT PRIMARY KEY, question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
        topic_id TEXT NOT NULL REFERENCES topics_p0(id) ON DELETE CASCADE, difficulty TEXT NOT NULL, prompt TEXT NOT NULL, options_json TEXT NOT NULL,
        answer_index INTEGER NOT NULL, explanation TEXT NOT NULL, evidence_json TEXT NOT NULL);
      CREATE TABLE runs(id TEXT PRIMARY KEY, question_set_id TEXT NOT NULL REFERENCES question_sets(id) ON DELETE CASCADE,
        state TEXT NOT NULL DEFAULT 'active', player_hp INTEGER NOT NULL DEFAULT 100, current_encounter_hp INTEGER NOT NULL DEFAULT 100,
        xp INTEGER NOT NULL DEFAULT 0, combo INTEGER NOT NULL DEFAULT 0, current_slot_index INTEGER NOT NULL DEFAULT 0,
        rules_version TEXT NOT NULL DEFAULT '1.0', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
      CREATE TABLE run_slots(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        question_id TEXT NOT NULL REFERENCES questions_p0(id), slot_index INTEGER NOT NULL, encounter_type TEXT NOT NULL, UNIQUE(run_id, slot_index));
      CREATE TABLE run_attempts(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
        slot_id TEXT NOT NULL REFERENCES run_slots(id) ON DELETE CASCADE, selected_option_index INTEGER NOT NULL,
        is_correct INTEGER NOT NULL, feedback_json TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(run_id, slot_id));
      PRAGMA user_version = 4;
    `);
    legacy.prepare("INSERT INTO subjects(id,name) VALUES ('sample','Retained sample')").run();
    legacy.prepare("INSERT INTO documents(id,filename,sha256,page_count,normalized_char_count,pages_json) VALUES (?,'original.pdf','same-file-hash',1,320,'[]')").run(documentId);
    legacy.prepare("INSERT INTO generation_jobs(id,document_id,state) VALUES (?,?,'ready')").run(jobId, documentId);
    legacy.prepare("INSERT INTO question_sets(id,document_id,model_tag,model_digest,settings_hash) VALUES (?,?,'qwen2.5:1.5b','old-digest','old-settings')").run(setId, documentId);
    legacy.prepare("INSERT INTO topics_p0 VALUES (?,?,'Networking')").run(topicId, setId);
    legacy.prepare("INSERT INTO questions_p0 VALUES (?,?,?,'easy','Legacy prompt','[]',0,'Legacy feedback','[]')").run(questionId, setId, topicId);
    legacy.prepare("INSERT INTO runs(id,question_set_id) VALUES (?,?)").run(runId, setId);
    legacy.prepare("INSERT INTO run_slots VALUES (?,?,?,0,'surface')").run(slotId, runId, questionId);
    legacy.prepare("INSERT INTO run_attempts(id,run_id,slot_id,selected_option_index,is_correct,feedback_json) VALUES (?,?,?,0,1,'{}')").run(attemptId, runId, slotId);
  } finally { legacy.close(); }

  let database: SqliteDatabase | undefined;
  try {
    database = initializeDatabase(path);
    assert.equal(database.pragma("user_version", { simple: true }), 6);
    assert.equal(database.pragma("foreign_keys", { simple: true }), 1);
    assert.deepEqual(database.pragma("foreign_key_check"), []);
    for (const table of ["subjects", "documents", "generation_jobs", "question_sets", "topics_p0", "questions_p0", "runs", "run_slots", "run_attempts"]) {
      assert.equal((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {count:number}).count, 1, `${table} is preserved`);
    }
    const metadata = database.prepare("SELECT extractor_version,prompt_version,schema_version,tokenizer_digest,document_hash FROM question_sets WHERE id=?").get(setId) as Record<string, string>;
    assert.deepEqual(Object.values(metadata), Array(5).fill("legacy-incompatible"));
    const job = database.prepare("SELECT error_message,error_stage,timings_json,retry_count FROM generation_jobs WHERE id=?").get(jobId);
    assert.deepEqual(job, { error_message: null, error_stage: null, timings_json: "{}", retry_count: 0 });
    const run = database.prepare("SELECT updated_at,created_at,failure_stage FROM runs WHERE id=?").get(runId) as {updated_at:string;created_at:string;failure_stage:null};
    assert.equal(run.updated_at, run.created_at);
    assert.equal(run.failure_stage, null);
    database.prepare("INSERT INTO documents(id,filename,sha256,page_count,normalized_char_count,pages_json) VALUES (?,'fresh.pdf','same-file-hash',1,320,'[]')").run(randomUUID());
    database.close();
    database = initializeDatabase(path);
    assert.equal((database.prepare("SELECT COUNT(*) AS count FROM documents WHERE sha256='same-file-hash'").get() as {count:number}).count, 2);
    database.prepare("DELETE FROM documents WHERE id=?").run(documentId);
    for (const table of ["generation_jobs", "question_sets", "topics_p0", "questions_p0", "runs", "run_slots", "run_attempts"]) {
      assert.equal((database.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {count:number}).count, 0, `${table} cascades on deletion`);
    }
    assert.deepEqual(database.pragma("foreign_key_check"), []);
  } finally {
    if (database?.open) database.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("mutations enforce local Host/Origin while allowing same-origin requests and plain CLI requests", async () => {
  await withApp(async ({ baseUrl }) => {
    const post = (headers: Record<string, string>) => fetch(`${baseUrl}/api/runs`, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: "{}" });
    assert.equal((await post({ origin: baseUrl, "sec-fetch-site": "same-origin" })).status, 400);
    assert.equal((await post({})).status, 400);
    for (const headers of [{ origin: "https://attacker.example" }, { origin: "null" }, { "sec-fetch-site": "cross-site" },
      { "sec-fetch-site": "same-site" }, { "sec-fetch-mode": "navigate" }, { origin: "http://localhost:5173" }]) {
      const result = await requestWithHeaders(`${baseUrl}/api/runs`, headers);
      assert.equal(result.status, 403, `Rejected metadata: ${JSON.stringify(headers)}`);
      assert.equal(JSON.parse(result.body).error.retryable, false);
    }
    const hostile = await requestWithHeaders(`${baseUrl}/api/runs`, { host: "attacker.example" });
    assert.equal(hostile.status, 403);
    assert.equal(JSON.parse(hostile.body).error.code, "HOST_NOT_ALLOWED");
  });
});

test("explicit development mode admits the Vite loopback origin", async () => {
  await withApp(async ({ baseUrl }) => {
    for (const origin of ["http://localhost:5173", "http://127.0.0.1:5173"]) {
      const result = await fetch(`${baseUrl}/api/runs`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: "{}" });
      assert.equal(result.status, 400, "Allowed development origin reaches input validation.");
    }
  }, { development: true });
});

test("built web assets and deep SPA links are served without masking missing API routes/assets", async () => {
  await withApp(async ({ baseUrl }) => {
    for (const path of ["/", "/library/resume"]) {
      const response = await fetch(baseUrl + path, { headers: { accept: "text/html" } });
      assert.equal(response.status, 200);
      assert.match(await response.text(), /Point Nemo test build/);
    }
    const asset = await fetch(`${baseUrl}/assets/app.js`);
    assert.equal(asset.status, 200);
    assert.match(await asset.text(), /local test asset/);
    const api = await fetch(`${baseUrl}/api/unknown`, { headers: { accept: "text/html" } });
    assert.equal(api.status, 404);
    assert.equal((await api.json() as {error:{code:string}}).error.code, "NOT_FOUND");
    assert.equal((await fetch(`${baseUrl}/assets/missing.js`)).status, 404);
  }, { builtWeb: true });
});

test("health reports real database and model/tokenizer readiness and safe failures", async (t) => {
  await withApp(async ({ baseUrl, database, ollama }) => {
    let result = await fetch(`${baseUrl}/api/health`);
    assert.equal(result.status, 200);
    const ready = await result.json() as {ready:boolean;database:{available:boolean};tokenizer:{available:boolean};ollama:{digest:string}};
    assert.equal(ready.ready, true);
    assert.equal(ready.database.available, true);
    assert.equal(ready.tokenizer.available, true);
    assert.equal(ready.ollama.digest, "fixture-digest");
    ollama.status = { ...ollama.status, tokenizerReady: false };
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 503);
    ollama.status = { ...ollama.status, tokenizerReady: true, available: false };
    assert.equal((await fetch(`${baseUrl}/api/health`)).status, 503);
    t.mock.method(ollama, "getStatus", async () => { throw new Error("private model output"); });
    result = await fetch(`${baseUrl}/api/health`);
    assert.equal(result.status, 503);
    assert.equal((await result.text()).includes("private model output"), false);
    database.close();
    result = await fetch(`${baseUrl}/api/health`);
    assert.equal(result.status, 503);
    assert.equal((await result.json() as {database:{available:boolean}}).database.available, false);
  });
});

test("unexpected API errors and malformed JSON omit private source/output and do not log it", async (t) => {
  await withApp(async ({ baseUrl, database }) => {
    const logged: unknown[][] = [];
    t.mock.method(console, "error", (...values: unknown[]) => { logged.push(values); });
    t.mock.method(database, "prepare", () => { throw new Error("PRIVATE SOURCE AND RAW MODEL OUTPUT"); });
    const response = await fetch(`${baseUrl}/api/runs`);
    assert.equal(response.status, 500);
    const body = await response.text();
    assert.equal(body.includes("PRIVATE SOURCE"), false);
    assert.equal(JSON.parse(body).error.code, "INTERNAL_ERROR");
    const invalid = await fetch(`${baseUrl}/api/runs`, { method: "POST", headers: { "content-type": "application/json" }, body: "{PRIVATE SOURCE" });
    assert.equal(invalid.status, 400);
    assert.equal((await invalid.text()).includes("PRIVATE SOURCE"), false);
    assert.deepEqual(logged, []);
  });
});

test("document library, cancellation, and repeated deletion honor their HTTP contracts", async () => {
  await withApp(async ({ baseUrl, database }) => {
    const documentId = randomUUID(), jobId = randomUUID();
    database.prepare("INSERT INTO documents(id,filename,sha256,page_count,normalized_char_count,pages_json) VALUES (?,'contract.pdf','contract-hash',1,0,'[]')").run(documentId);
    database.prepare("INSERT INTO generation_jobs(id,document_id,state) VALUES (?,?,'extracting')").run(jobId, documentId);
    const library = await fetch(`${baseUrl}/api/documents`);
    assert.equal(library.status, 200);
    const documents = await library.json() as {data:Array<{id:string;filename:string;jobs:Array<{state:string}>}>};
    assert.equal(documents.data[0]?.id, documentId);
    assert.equal(documents.data[0]?.filename, "contract.pdf");
    const cancel = await fetch(`${baseUrl}/api/jobs/${jobId}/cancel`, { method: "POST" });
    assert.equal(cancel.status, 200);
    const cancelled = await cancel.json() as {data:{state:string}};
    assert.equal(cancelled.data.state, "cancelled");
    const repeat = await fetch(`${baseUrl}/api/jobs/${jobId}/cancel`, { method: "POST" });
    assert.equal(repeat.status, 200);
    assert.deepEqual(await repeat.json(), cancelled);
    for (let i = 0; i < 2; i++) {
      const deleted = await fetch(`${baseUrl}/api/documents/${documentId}`, { method: "DELETE" });
      assert.equal(deleted.status, 204);
      assert.equal(await deleted.text(), "");
    }
    assert.equal((await fetch(`${baseUrl}/api/jobs/${jobId}`)).status, 404);
    assert.deepEqual((await (await fetch(`${baseUrl}/api/documents`)).json() as {data:unknown[]}).data, []);
  });
});
