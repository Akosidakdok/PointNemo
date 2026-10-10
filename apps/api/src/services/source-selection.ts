import { BadRequestError } from "../errors.js";
import { createHash } from "node:crypto";

export interface SourceChunk { pageNumber: number; chunkId: string; text: string }
export interface SourcePassage extends SourceChunk { id: string; focus?: string }

export function parseChunks(pagesJson: string): SourceChunk[] {
  const pages: unknown = JSON.parse(pagesJson);
  if (!Array.isArray(pages) || pages.some((p) => !p || !Number.isInteger(p.pageNumber) || p.pageNumber < 1 || typeof p.chunkId !== "string" || typeof p.text !== "string")) {
    throw new BadRequestError("INVALID_SOURCE", "Extracted source pages are invalid.");
  }
  return pages as SourceChunk[];
}

// Every passage remains a verbatim substring of its original normalized page.
// IDs are stable for a given extraction, independent of the selection budget.
export function indexPassages(pages: SourceChunk[]): SourcePassage[] {
  const groups = pages.map((page, pageIndex) => {
    const sentences = page.text.split(/(?<=[.!?])\s+/u);
    const parts: string[] = [];
    for (const sentence of sentences) {
      let rest = sentence.trim();
      // Keep references such as "its subnet mask" with the sentence that
      // identifies the subject. Isolated pronouns can produce wrong citations.
      if (/^(?:it|its|they|their|these|those|this|that|each|once that)\b/i.test(rest) && parts.length) {
        const combined = `${parts.at(-1)} ${rest}`;
        if (combined.length <= 400) { parts[parts.length - 1] = combined; continue; }
        // The reference cannot be interpreted safely within this passage cap.
        continue;
      }
      while (rest.length > 400) {
        const boundary = rest.lastIndexOf(" ", 400);
        const end = boundary >= 20 ? boundary : 400;
        parts.push(rest.slice(0, end).trim()); rest = rest.slice(end).trim();
      }
      if (rest) parts.push(rest);
    }
    return parts.map((text, index) => {
      // Include up to two preceding sentences when they fit. Even sentences
      // without pronouns can refer to a code or rule introduced just before.
      let contextualText = text;
      for (let preceding = index - 1; preceding >= Math.max(0,index - 2); preceding--) {
        const candidate = `${parts[preceding]} ${contextualText}`;
        if (candidate.length > 400 || !page.text.includes(candidate)) break;
        contextualText = candidate;
      }
      return { ...page, text:contextualText, focus:text, id: `p${pageIndex + 1}s${index + 1}` };
    });
  });
  const edgeCounts = new Map<string, Set<number>>();
  for (const [index, group] of groups.entries()) {
    for (const passage of [group[0], group.at(-1)]) {
      if (!passage || passage.text.length > 120) continue;
      const key = passage.text.toLowerCase();
      const seen = edgeCounts.get(key) ?? new Set<number>(); seen.add(index); edgeCounts.set(key, seen);
    }
  }
  return groups.flatMap((group) => group.filter((p, index) => {
    if (p.text.length < 20 || /^\s*(?:page\s*)?\d+(?:\s*(?:of|\/)\s*\d+)?\s*$/i.test(p.text)) return false;
    const edge = index === 0 || index === group.length - 1;
    return !(groups.length >= 3 && edge && (edgeCounts.get(p.text.toLowerCase())?.size ?? 0) > groups.length / 2);
  }));
}

export function formatPassages(passages: SourcePassage[]): string {
  return passages.map((p) => `[${p.id} | page ${p.pageNumber}] ${p.text}${p.focus ? `\nFOCUS ${p.id}: ${p.focus}` : ""}`).join("\n");
}

export function selectPassages(pages: SourceChunk[], fits: (source: string) => boolean): { passages: SourcePassage[]; source: string; totalPassages: number } {
  const all = indexPassages(pages);
  const groups = pages.map((p) => all.filter((s) => s.pageNumber === p.pageNumber && s.chunkId === p.chunkId));
  // Visit distant pages before nearby ones, then round-robin their passages.
  const order: number[] = [];
  const spread = (start: number, end: number): void => {
    if (start > end) return;
    const mid = Math.floor((start + end) / 2); order.push(mid);
    spread(start, mid - 1); spread(mid + 1, end);
  };
  if (groups.length) { order.push(0); if (groups.length > 1) order.push(groups.length - 1); spread(1, groups.length - 2); }
  const selected: SourcePassage[] = [], seen = new Set<string>();
  for (let round = 0; round < Math.max(0, ...groups.map((g) => g.length)); round++) {
    for (const index of order) {
      const passage = groups[index]![round];
      if (!passage || seen.has(passage.text)) continue;
      const candidate = [...selected, passage];
      if (fits(formatPassages(candidate))) { selected.push(passage); seen.add(passage.text); }
    }
  }
  if (!selected.length) throw new BadRequestError("TOKEN_OVERFLOW", "No usable source passage fits the local model's input budget. Increase the input budget or use a shorter excerpt.");
  const positions = new Map(all.map((passage,index)=>[passage.id,index]));
  selected.sort((a,b)=>positions.get(a.id)!-positions.get(b.id)!);
  return { passages: selected, source: formatPassages(selected), totalPassages: all.length };
}

export function resolveEvidence(output: unknown, passages: SourcePassage[]): unknown {
  if (!output || typeof output !== "object") return output;
  const draft = output as any;
  if (!Array.isArray(draft.questions) && draft.questions && typeof draft.questions === "object" && Array.isArray(draft.topics)) {
    const keys = Object.keys(draft.questions);
    if (keys.length !== 9 || !Array.from({length:9},(_,i)=>String(i)).every((key)=>keys.includes(key))) return output;
    output = { ...draft, questions: Array.from({length:9},(_,i)=>({ ...draft.questions[String(i)], topicName:draft.topics[Math.floor(i/3)]?.name, difficulty:["easy","medium","hard"][i%3] })) };
  }
  if (!Array.isArray((output as any).questions)) return output;
  const catalog = new Map(passages.map((p) => [p.id, p]));
  return { ...(output as object), questions: (output as any).questions.map((question: any) => {
    if (!question || typeof question !== "object" || !("evidenceId" in question)) return question;
    const { evidenceId, slot: _slot, correctAnswer, distractors, ...fields } = question;
    if (typeof correctAnswer === "string" && Array.isArray(distractors)) {
      const answerIndex = createHash("sha256").update(String(fields.prompt)).digest()[0]! % 4;
      const options = [...distractors]; options.splice(answerIndex,0,correctAnswer);
      fields.options = options; fields.answerIndex = answerIndex;
    }
    const passage = catalog.get(evidenceId);
    return { ...fields, evidence: passage ? [{ pageNumber: passage.pageNumber, chunkId: passage.chunkId, quote: passage.text }] : [] };
  }) };
}
