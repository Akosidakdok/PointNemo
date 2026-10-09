import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { readConfig } from "../apps/api/src/config.js";
import { initializeDatabase } from "../apps/api/src/db.js";
import { GenerationJobService } from "../apps/api/src/services/generation-job.js";

// Development diagnostic using real Ollama, never a release-gate substitute.
const fixture = process.argv[2] ?? "fixtures/networking-unseen.pdf";
const directory = join(process.env.LOCALAPPDATA ?? homedir(), "PointNemo", "evidence");
mkdirSync(directory, { recursive: true });
const stamp = Date.now().toString();
const config = readConfig({ ...process.env, OLLAMA_MODEL: "qwen2.5:1.5b", DATABASE_PATH: join(directory, `probe-${stamp}.sqlite`) });
const database = initializeDatabase(config.databasePath);
const service = new GenerationJobService(database, config);
try {
  const result = await service.enqueue({ originalName: fixture.split(/[\\/]/).at(-1)!, mimeType: "application/pdf", buffer: readFileSync(fixture) });
  let previous = "";
  for (;;) {
    const job = service.getJob(result.jobId);
    if (job.state !== previous) { console.log(JSON.stringify({ state: job.state, elapsedTimeMs: job.elapsedTimeMs, retryCount: job.retryCount })); previous = job.state; }
    if (["ready", "failed", "cancelled"].includes(job.state)) {
      const questionSet = job.questionSetId ? service.getQuestionSet(job.questionSetId) : undefined;
      const output = join(directory, `probe-${stamp}.json`);
      writeFileSync(output, JSON.stringify({ diagnosticOnly: true, config, job, questionSet }, null, 2));
      console.log(JSON.stringify({ job, output, topics: questionSet?.topics.map(t => t.name) }));
      if (job.state !== "ready") process.exitCode = 1;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
} finally { database.close(); }
