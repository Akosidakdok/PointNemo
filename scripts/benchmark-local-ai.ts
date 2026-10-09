import { mkdir, readFile, writeFile, mkdtemp } from "node:fs/promises";
import { join, resolve, basename } from "node:path";
import { tmpdir, cpus, totalmem } from "node:os";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { readConfig } from "../apps/api/src/config.js";
import { initializeDatabase } from "../apps/api/src/db.js";
import { GenerationJobService } from "../apps/api/src/services/generation-job.js";
import { OllamaService, PROMPT_VERSION } from "../apps/api/src/services/ollama.js";
import { LocalPdfExtractor } from "../apps/api/src/services/document-extractor.js";
import type { GenerationJob } from "@point-nemo/shared";

const option = (name: string, fallback: string): string => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const models = option("models", "qwen2.5:1.5b,qwen2.5:3b").split(",");
const fixtures = option("fixtures", "fixtures/networking-demo.pdf,fixtures/networking-unseen.pdf").split(",");
const repeats = Number(option("runs", "2"));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 20) throw new Error("--runs must be 1–20.");
const outputPath = resolve(option("output", "artifacts/local-ai-benchmark.json"));
const baseline = process.argv.includes("--baseline");
async function baselineService(): Promise<typeof GenerationJobService> {
  // Replay committed code in memory. Never reset the user's checkout or library.
  const compile = (path: string, overrides: Record<string, string> = {}): string => {
    const original = execFileSync("git", ["show", `HEAD:${path}`], {encoding:"utf8",windowsHide:true});
    let compiled = transpileModule(original, {compilerOptions:{module:ModuleKind.ESNext,target:ScriptTarget.ES2022}}).outputText;
    compiled = compiled.replace(/from ["']([^"']+)["']/g, (_match, specifier: string) => {
      if (specifier.startsWith("node:")) return `from ${JSON.stringify(specifier)}`;
      const target = overrides[specifier] ?? (specifier.startsWith(".")
        ? pathToFileURL(resolve(path, "..", specifier.replace(/\.js$/, ".ts"))).href : import.meta.resolve(specifier));
      return `from ${JSON.stringify(target)}`;
    });
    return `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`;
  };
  const ollama = compile("apps/api/src/services/ollama.ts");
  const jobs = compile("apps/api/src/services/generation-job.ts", {"./ollama.js":ollama});
  return (await import(jobs)).GenerationJobService;
}
const Service = baseline ? await baselineService() : GenerationJobService;
await mkdir(resolve(outputPath, ".."), { recursive: true });
const directory = await mkdtemp(join(tmpdir(), "point-nemo-benchmark-"));
const database = initializeDatabase(join(directory, "benchmark.sqlite"));
const records: Array<Record<string, unknown>> = [], skipped: Array<{ model: string; reason: string }> = [];
let active: { service: GenerationJobService; jobId: string } | undefined;
let interrupted = false;
process.once("SIGINT", () => { interrupted = true; if (active) active.service.cancelJob(active.jobId); });
const base = readConfig();
let gpu = "unavailable";
try { gpu = execFileSync("nvidia-smi", ["--query-gpu=name,memory.total", "--format=csv,noheader"], { encoding: "utf8", windowsHide: true }).trim(); } catch {}
const save = async (): Promise<void> => {
  const summary = models.map((model) => {
    const rows = records.filter((r) => r.model === model && r.kind === "generation");
    const durations = rows.map((r) => (r.job as GenerationJob).timings?.totalMs ?? 0).sort((a, b) => a - b);
    const percentile = (fraction: number): number | null => durations.length ? durations[Math.max(0, Math.ceil(durations.length * fraction) - 1)]! : null;
    const median = durations.length ? (durations[Math.floor((durations.length-1)/2)]!+durations[Math.floor(durations.length/2)]!)/2 : null;
    return { model, samples: rows.length, medianMs: median, p95Ms: percentile(0.95),
      startup: ["cold","warm"].map((startup)=>{ const times=rows.filter((r)=>r.startup===startup).map((r)=>(r.job as GenerationJob).timings?.totalMs ?? 0).sort((a,b)=>a-b); return {startup,samples:times.length,medianMs:times.length?(times[Math.floor((times.length-1)/2)]!+times[Math.floor(times.length/2)]!)/2:null}; }),
      firstPassRate: rows.length ? rows.filter((r) => (r.job as GenerationJob).state === "ready" && !(r.job as GenerationJob).retryCount).length / rows.length : null,
      completionRate: rows.length ? rows.filter((r) => (r.job as GenerationJob).state === "ready").length / rows.length : null };
  });
  await writeFile(outputPath, JSON.stringify({ createdAt: new Date().toISOString(), hardware: { gpu, cpu: cpus()[0]?.model, ramGiB: totalmem() / 2 ** 30 },
    pipelineVersion: baseline ? "committed-head" : PROMPT_VERSION, reviewEnabled:process.argv.includes("--review"),
    baseline: baseline ? execFileSync("git",["rev-parse","HEAD"],{encoding:"utf8",windowsHide:true}).trim() : null,
    databasePath: join(directory, "benchmark.sqlite"), note: "Small synthetic-fixture benchmark. Automated validation is not a proof of answer correctness; review exported questions and evidence.", summary, skipped, records }, null, 2));
};
try {
  // Avoid competing with an interactive generation job on the same GPU.
  try {
    const response = await fetch(`http://127.0.0.1:${base.port}/api/documents`, { signal: AbortSignal.timeout(2000) });
    const body = await response.json() as any;
    if (body.data?.some((d: any) => d.jobs?.some((j: any) => ["extracting", "generating", "validating"].includes(j.state)))) throw new Error("An interactive Point Nemo job is active. Run the benchmark after it finishes.");
  } catch (error) { if ((error as Error).message.startsWith("An interactive")) throw error; }
  for (const model of models) {
    if (interrupted) break;
    const config = readConfig({ ...process.env, OLLAMA_MODEL: model, OLLAMA_SEED: "42", OLLAMA_REVIEW:process.argv.includes("--review") ? "1" : "0", INFERENCE_TIMEOUT_MS: "180000", JOB_TIMEOUT_MS: "360000" });
    const ollama = new OllamaService(config);
    const drafts: unknown[] = [];
    const generate = ollama.generateQuestions.bind(ollama);
    ollama.generateQuestions = async (source, options) => { const output = await generate(source,options); drafts.push(output); return output; };
    const plan = ollama.planQuestions.bind(ollama);
    ollama.planQuestions = async (source,options) => { const output = await plan(source,options); drafts.push({kind:"plan",output}); return output; };
    const review = ollama.reviewQuestions.bind(ollama);
    ollama.reviewQuestions = async (questions,options) => { const output = await review(questions,options); drafts.push({kind:"review",output}); return output; };
    const status = await ollama.getStatus();
    if (!status.available) { skipped.push({ model, reason: status.message }); await save(); continue; }
    // The baseline service constructs its own committed Ollama adapter.
    const service = baseline ? new Service(database,config,new LocalPdfExtractor()) : new Service(database, config, new LocalPdfExtractor(), ollama);
    for (const fixture of fixtures) {
      for (let run = 0; run < repeats && !interrupted; run++) {
        const startup = run === 0 ? "cold" : "warm";
        if (run === 0) await fetch(`${config.ollamaBaseUrl}/api/generate`, { method: "POST", headers: {"content-type":"application/json"}, body: JSON.stringify({model, keep_alive:0}), signal:AbortSignal.timeout(15000) });
        console.log(`Generating ${model} / ${basename(fixture)} / ${startup}`);
        drafts.length = 0;
        const bytes = await readFile(resolve(fixture));
        const request = await service.enqueue({ originalName:basename(fixture),mimeType:"application/pdf",buffer:bytes });
        active = { service, jobId:request.jobId };
        let job: GenerationJob;
        do { await new Promise((done) => setTimeout(done,250)); job = service.getJob(request.jobId); }
        while (["extracting", "generating", "validating"].includes(job.state));
        active = undefined;
        const questionSet = job.questionSetId ? service.getQuestionSet(job.questionSetId) : undefined;
        let runtime: unknown;
        try { const response = await fetch(`${config.ollamaBaseUrl}/api/ps`); runtime = await response.json(); } catch {}
        records.push({ kind:"generation", model, fixture, startup, job, questionSet, runtime, drafts:[...drafts] });
        console.log(`${job.state}: ${job.timings?.totalMs}ms; repairs=${job.retryCount}; ${job.errorMessage ?? "validated nine questions"}`);
        if (questionSet && !baseline) {
          const start = performance.now();
          const reuse = await service.enqueue({originalName:basename(fixture),mimeType:"application/pdf",buffer:await readFile(resolve(fixture))},true);
          if (!reuse.reused) { service.cancelJob(reuse.jobId); throw new Error("Compatible benchmark lesson did not reuse its cache entry."); }
          records.push({kind:"cache",model,fixture,elapsedMs:performance.now()-start,reused:reuse.reused});
        }
        await save();
      }
    }
  }
  await save();
  console.log(`Benchmark report: ${outputPath}`);
} finally { database.close(); }
