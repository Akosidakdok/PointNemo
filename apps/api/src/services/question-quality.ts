import { AIQuestionOutputSchema, AIQuestionSetOutputSchema, InsufficientSourceSchema, type AIQuestionSetOutput } from "@point-nemo/shared";
import { BadRequestError } from "../errors.js";
import { indexPassages, parseChunks } from "./source-selection.js";

export interface QuestionIssue { index: number; code: string; message: string }
export interface RepairSlot { index: number; topicName: string; difficulty: "easy" | "medium" | "hard"; problems: string[]; goal?: string; evidenceId?: string; allowedEvidenceIds?: string[]; distractorsOnly?: boolean }
export interface RepairPlan { topics: AIQuestionSetOutput["topics"]; questions: unknown[]; slots: RepairSlot[]; excludedSlots?: number[] }
export interface QuestionPlan { topics: AIQuestionSetOutput["topics"]; slots: Array<{index:number;topicName:string;difficulty:"easy"|"medium"|"hard";goal:string;evidenceId:string}> }
const normalize = (text: string): string => text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
const numericValues = (text: string): string => (text.match(/[+-]?\d+(?:[.,]\d+)*/g) ?? []).sort().join("|");
const choiceIdentity = (text: string): string => `${normalize(text)}|${numericValues(text)}`;
const isNegated = (text: string): boolean => /\b(?:not|never|no|cannot|without|neither|nor)\b|n't\b/i.test(text);
function contrastiveChoices(left: string, right: string): boolean {
  const leftValues = numericValues(left), rightValues = numericValues(right);
  const differentValues = Boolean(leftValues && rightValues && leftValues.split("|").length === rightValues.split("|").length && leftValues !== rightValues);
  return differentValues || isNegated(left) !== isNegated(right);
}
// Conservative wording equivalences for choices. This is a repair trigger,
// not a general semantic comparison or a proof that a distractor is false.
const choiceFingerprint = (text:string):string => normalize(text)
  .replace(/\breturns? (?:a |the )?response\b/g,"sends a response")
  .replace(/\bwhere to send\b/g,"where to deliver")
  .replace(/\b(?:selects|identifies) (?:a |the )?host interface\b/g,"identifies a host interface")
  .replace(/\b(?:selects|identifies) (?:a |the )?application endpoint\b/g,"identifies an application endpoint")
  .replace(/\b(?:an?|the|only)\b/g," ")
  .replace(/\b[\p{L}]{5,}s\b/gu,(word)=>/(?:ss|us|is|ics)$/.test(word)?word:word.slice(0,-1))
  .replace(/\s+/g," ").trim();
const stopWords = new Set("what which how why the a an is are was were of to in for and does do according source following statement best describe describes".split(" "));
function terms(text: string): Set<string> { return new Set(normalize(text).split(" ").filter((t) => t.length > 2 && !stopWords.has(t))); }
function semanticallyOverlappingChoices(left: string, right: string): boolean {
  // Different values and positive/negative claims are valid distractors even
  // when the surrounding sentence is identical.
  if (contrastiveChoices(left, right)) return false;
  const leftFingerprint = choiceFingerprint(left), rightFingerprint = choiceFingerprint(right);
  if (leftFingerprint && leftFingerprint === rightFingerprint) return true;
  // Word overlap and reordered subjects are not proof of equivalent meaning.
  // "A heats B" and "B heats A" can be different answers.
  return false;
}
function normalizedPhrase(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
}

export function parseQuestionPlan(output: unknown, validEvidenceIds: Set<string>, focusByEvidenceId?: Map<string,string>): QuestionPlan {
  if (InsufficientSourceSchema.safeParse(output).success) throw new BadRequestError("INSUFFICIENT_SOURCE", "The selected passages do not support three topics with nine distinct learning objectives. Add richer study material.");
  const topics = (output as any)?.topics;
  if (!Array.isArray(topics) || topics.length !== 3 || topics.some((topic:any)=>typeof topic?.name !== "string" || !topic.name.trim() || topic.name.length>100 || !Array.isArray(topic.objectives) || topic.objectives.length!==3)) {
    throw new BadRequestError("INVALID_MODEL_OUTPUT", "Plan three distinct topics with three learning objectives each.");
  }
  if (new Set(topics.map((topic:any)=>normalize(topic.name))).size!==3) throw new BadRequestError("INVALID_MODEL_OUTPUT", "Plan distinct topics; do not repeat a topic.");
  const slots: QuestionPlan["slots"] = [], assignedEvidenceIds = new Set<string>(), assignedFocusFacts = new Set<string>();
  for (const [topicIndex,topic] of topics.entries()) {
    for (const [index,objective] of topic.objectives.entries()) {
      if (typeof objective?.goal!=="string" || !objective.goal.trim() || objective.goal.length>120) {
        throw new BadRequestError("INVALID_MODEL_OUTPUT", "Each planned objective needs a short learning goal.");
      }
      if (typeof objective.evidenceId!=="string" || !validEvidenceIds.has(objective.evidenceId)) {
        throw new BadRequestError("INVALID_MODEL_OUTPUT", "Each planned objective must cite a passage from the selected PDF.");
      }
      if (assignedEvidenceIds.has(objective.evidenceId)) throw new BadRequestError("INVALID_MODEL_OUTPUT", "Each question must use a different source passage so the quiz covers nine distinct facts.");
      const focusFact = focusByEvidenceId?.get(objective.evidenceId);
      if (focusFact && assignedFocusFacts.has(normalize(focusFact))) throw new BadRequestError("INVALID_MODEL_OUTPUT", "Each question must test a different source fact, not a repeated statement from another passage.");
      assignedEvidenceIds.add(objective.evidenceId);
      if (focusFact) assignedFocusFacts.add(normalize(focusFact));
      slots.push({index:topicIndex*3+index,topicName:topic.name,difficulty:(["easy","medium","hard"] as const)[index]!,goal:objective.goal,evidenceId:objective.evidenceId});
    }
  }
  return {topics:topics.map((topic:any)=>({name:topic.name})),slots};
}

export function inspectQuestions(output: unknown, pagesJson: string): { issues: QuestionIssue[]; repair?: RepairPlan } {
  if (InsufficientSourceSchema.safeParse(output).success) throw new BadRequestError("INSUFFICIENT_SOURCE", "This source does not support three topics with nine distinct questions. Add more study material.");
  const draft = output as any;
  if (!draft || !Array.isArray(draft.topics) || draft.topics.length !== 3 || !Array.isArray(draft.questions) || draft.questions.length !== 9 ||
    draft.topics.some((t: any) => typeof t?.name !== "string" || !t.name.trim() || t.name.length > 100) || new Set(draft.topics.map((t: any) => normalize(t.name))).size !== 3) {
    return { issues: [{ index: -1, code: "INVALID_MODEL_OUTPUT", message: "Return exactly three distinct topics and nine questions." }] };
  }
  const pages = parseChunks(pagesJson), issues: QuestionIssue[] = [], accepted: Array<{ index: number; question: AIQuestionSetOutput["questions"][number] }> = [];
  const focusByCitation = new Map(indexPassages(pages).map((passage)=>[
    JSON.stringify([passage.pageNumber,passage.chunkId,passage.text]), normalize(passage.focus ?? passage.text),
  ]));
  const add = (index: number, code: string, message: string): void => { issues.push({ index, code, message }); };
  const difficulties = ["easy", "medium", "hard"] as const;
  for (const [index, raw] of draft.questions.entries()) {
    const question = AIQuestionOutputSchema.safeParse(raw);
    if (!question.success) {
      add(index, "INVALID_MODEL_OUTPUT", `Question ${index + 1}: ${question.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ").slice(0, 300)}`); continue;
    }
    const q = question.data;
    const expectedTopic = draft.topics[Math.floor(index / 3)].name;
    if (normalize(q.topicName) !== normalize(expectedTopic) || q.difficulty !== difficulties[index % 3]) add(index, "INVALID_MODEL_OUTPUT", `Use topic ${expectedTopic} and ${difficulties[index % 3]} difficulty.`);
    if (!normalize(q.prompt) || !q.prompt.trim().endsWith("?")) add(index, "INVALID_MODEL_OUTPUT", "Write a complete question ending in a question mark; do not return a statement that reveals the answer.");
    if (/(?:^|\s)[A-D][).]\s/u.test(q.prompt)) add(index, "INVALID_MODEL_OUTPUT", "Keep answer choices out of the prompt; return them only in the answer fields.");
    if (q.options.some((option)=>/^[A-D][).]\s/u.test(option))) add(index, "INVALID_MODEL_OUTPUT", "Return answer text without A/B/C/D labels.");
    if (new Set(q.options.map(choiceIdentity)).size !== 4) add(index, "INVALID_MODEL_OUTPUT", "All four answer options must be distinct.");
    if (q.options.some((option, optionIndex) => q.options.slice(optionIndex + 1).some((other) => semanticallyOverlappingChoices(option, other)))) {
      add(index,"INVALID_MODEL_OUTPUT","[answer_choices] Two choices express the same idea with different wording. Replace the overlap with a different, mutually exclusive wrong answer.");
    }
    if (q.options.some((option,optionIndex)=>q.options.slice(optionIndex+1).some((other)=> {
      if (contrastiveChoices(option,other)) return false;
      const left=` ${normalize(option)} `,right=` ${normalize(other)} `;
      return left.includes(right) || right.includes(left);
    }))) add(index,"INVALID_MODEL_OUTPUT","[answer_choices] One option contains another option. Use four separate answers, including distinct wrong choices.");
    for (const evidence of q.evidence) {
      const page = pages.find((p) => p.pageNumber === evidence.pageNumber && p.chunkId === evidence.chunkId);
      if (!page?.text.includes(evidence.quote)) add(index, "SOURCE_EVIDENCE_INVALID", "Choose an evidence ID from SOURCE; the quote must be an exact passage in its cited page.");
    }
    const answer = q.options[q.answerIndex]!;
    const answerWords = ` ${normalize(answer)} `;
    if (q.options.some((option,optionIndex)=> {
      if (optionIndex===q.answerIndex) return false;
      if (contrastiveChoices(answer, option)) return false;
      const optionWords = ` ${normalize(option)} `;
      return optionWords.includes(answerWords) || answerWords.includes(optionWords);
    })) add(index,"INVALID_MODEL_OUTPUT","[answer_choices] A distractor contains the correct answer or is contained in it. Use three different, mutually exclusive wrong answers; do not split a correct statement into several correct options.");
    const evidenceText = q.evidence.map((e) => e.quote).join(" ");
    const normalizedAnswer = normalizedPhrase(answer);
    if (!normalizedAnswer || normalizedAnswer.split(" ").length > 12 || normalizedAnswer.length > 100 ||
        !q.evidence.some((e)=>(` ${normalizedPhrase(e.quote)} `).includes(` ${normalizedAnswer} `))) {
      add(index,"SOURCE_EVIDENCE_INVALID","Copy the correct answer as a short exact phrase from its cited passage; do not substitute an unsupported plan label or add outside facts.");
    }
    // A conservative lexical screen catches disconnected answers. It is not an
    // entailment proof; correctness and difficulty still need benchmark review.
    const groundingTerms = terms(`${q.prompt} ${answer}`), sourceTerms = terms(evidenceText);
    if (groundingTerms.size && ![...groundingTerms].some((t) => sourceTerms.has(t))) add(index, "SOURCE_EVIDENCE_INVALID", "The question and correct answer are disconnected from their cited passage. Use a supported fact or application.");
    for (const previous of accepted) {
      const left = terms(q.prompt), right = terms(previous.question.prompt);
      const intersection = [...left].filter((t) => right.has(t)).length;
      const union = new Set([...left, ...right]).size;
      const sameStem = normalize(q.prompt) === normalize(previous.question.prompt);
      const sameAnswer = normalizedPhrase(answer) === normalizedPhrase(previous.question.options[previous.question.answerIndex]!);
      const currentFocusFacts = q.evidence.map((e)=>focusByCitation.get(JSON.stringify([e.pageNumber,e.chunkId,e.quote])));
      const previousFocusFacts = new Set(previous.question.evidence.map((e)=>focusByCitation.get(JSON.stringify([e.pageNumber,e.chunkId,e.quote]))).filter(Boolean));
      const sameFocusFact = currentFocusFacts.some((fact)=>Boolean(fact && previousFocusFacts.has(fact)));
      // Similar wording can compare different facts (for example IPv4's bit
      // count versus IPv6's). Shared wording alone is not a repeated fact.
      const similarStems = sameAnswer && intersection >= 3 && union > 0 && intersection / union >= 0.6;
      const repeatedFact = sameFocusFact || similarStems || (sameAnswer && intersection >= 2 && union > 0 && intersection / union >= 0.5);
      if (sameStem || repeatedFact) add(index, "DUPLICATE_QUESTION", `Question ${index + 1} repeats question ${previous.index + 1}. Test a different source-supported fact or application, not a rewording.`);
    }
    accepted.push({ index, question: q });
  }
  const indices = [...new Set(issues.map((i) => i.index))];
  return { issues, repair: issues.length ? {
    topics: draft.topics, questions: draft.questions,
    slots: indices.map((index) => ({ index, topicName: draft.topics[Math.floor(index / 3)].name,
      difficulty: difficulties[index % 3]!, problems: issues.filter((i) => i.index === index).map((i) => i.message) })),
  } : undefined };
}

export function mergeRepair(plan: RepairPlan, output: unknown): unknown {
  const replacements = (output as any)?.questions;
  if (!replacements || typeof replacements !== "object" || Array.isArray(replacements) || Object.keys(replacements).length !== plan.slots.length) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The repair did not return every requested question.");
  const requested = new Set(plan.slots.map((s) => s.index)), seen = new Set<number>();
  const questions = [...plan.questions];
  for (const [key,replacement] of Object.entries(replacements)) {
    const slot = Number(key), expected = plan.slots.find((s)=>s.index===slot);
    if (String(slot) !== key || !replacement || !expected || !requested.has(slot) || seen.has(slot)) throw new BadRequestError("INVALID_MODEL_OUTPUT", "The repair returned an unexpected or repeated question slot.");
    seen.add(slot);
    if (expected.distractorsOnly) {
      const original = AIQuestionOutputSchema.parse(questions[slot]);
      const distractors = (replacement as any).distractors;
      if (!Array.isArray(distractors) || distractors.length!==3 || distractors.some((value)=>typeof value!=="string" || !value.trim() || value.length>160)) throw new BadRequestError("INVALID_MODEL_OUTPUT","The repair must supply three complete distractors.");
      const options = [...distractors]; options.splice(original.answerIndex,0,original.options[original.answerIndex]!);
      questions[slot] = {...original,options};
      continue;
    }
    questions[slot] = { ...(replacement as object), topicName:expected.topicName, difficulty:expected.difficulty };
  }
  return { status: "ready", topics: plan.topics, questions };
}

export function requireQuestionQuality(output: unknown, pagesJson: string): AIQuestionSetOutput {
  const report = inspectQuestions(output, pagesJson);
  const first = report.issues[0];
  if (first) throw new BadRequestError(first.code, report.issues.map((i) => i.message).join(" ").slice(0, 1500));
  const parsed = AIQuestionSetOutputSchema.parse(output);
  parsed.questions.forEach((question,index)=>{question.topicName=parsed.topics[Math.floor(index/3)]!.name;});
  return parsed;
}
