import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { BadRequestError, ServiceUnavailableError } from "../errors.js";

const TOKENIZER_HASH = "c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539";
const CONFIG_HASH = "5b5d4f65d0acd3b2d56a35b56d374a36cbc1c8fa5cf3b3febbbfabf22f359583";
export const TOKENIZER_VERSION = "qwen2.5-nfc-byte-bpe-v1";
export const TOKENIZER_DIGEST = createHash("sha256").update(`${TOKENIZER_VERSION}:${TOKENIZER_HASH}:${CONFIG_HASH}`).digest("hex");

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }
export interface TokenCounter { readonly digest: string; count(text: string): number }

interface TokenizerAsset {
  normalizer: { type: string };
  model: { type: string; vocab: Record<string, number>; merges: string[] };
  added_tokens: Array<{ content: string; id: number }>;
}

// Qwen2's pinned Split + ByteLevel pre-tokenizer. The inline case-insensitive
// contraction group is expanded because JavaScript does not support (?i:...).
const PRE_TOKEN = /'[sS]|'[tT]|'[rR][eE]|'[vV][eE]|'[mM]|'[lL][lL]|'[dD]|[^\r\n\p{L}\p{N}]?\p{L}+|\p{N}| ?[^\s\p{L}\p{N}]+[\r\n]*|\s*[\r\n]+|\s+(?!\S)|\s+/gu;
const byteCharacters = (() => {
  const bytes = [...Array.from({ length: 94 }, (_, i) => i + 33), ...Array.from({ length: 12 }, (_, i) => i + 161), ...Array.from({ length: 82 }, (_, i) => i + 174)];
  const map = new Map(bytes.map((byte) => [byte, String.fromCodePoint(byte)]));
  let extra = 256;
  for (let byte = 0; byte < 256; byte++) if (!map.has(byte)) map.set(byte, String.fromCodePoint(extra++));
  return map;
})();

export class QwenTokenCounter implements TokenCounter {
  readonly digest = TOKENIZER_DIGEST;
  private readonly ranks = new Map<string, number>();
  private readonly vocab: Record<string, number>;
  private readonly specialPattern: RegExp;
  private readonly special = new Set<string>();
  private readonly cache = new Map<string, number>();

  constructor() {
    // src/services and dist/services both resolve to this repository-local asset.
    const bytes = readFileSync(fileURLToPath(new URL("../../../../assets/tokenizer/qwen2.5-tokenizer.json", import.meta.url)));
    const config = readFileSync(fileURLToPath(new URL("../../../../assets/tokenizer/tokenizer_config.json", import.meta.url)));
    if (createHash("sha256").update(bytes).digest("hex") !== TOKENIZER_HASH || createHash("sha256").update(config).digest("hex") !== CONFIG_HASH) {
      throw new ServiceUnavailableError("TOKENIZER_INVALID", "The pinned local Qwen tokenizer assets are missing or changed. Restore assets/tokenizer before generating.");
    }
    const asset = JSON.parse(bytes.toString("utf8")) as TokenizerAsset;
    if (asset.normalizer.type !== "NFC" || asset.model.type !== "BPE") throw new Error("Unsupported tokenizer format.");
    this.vocab = asset.model.vocab;
    asset.model.merges.forEach((pair, rank) => this.ranks.set(pair, rank));
    for (const token of asset.added_tokens) this.special.add(token.content);
    this.specialPattern = new RegExp(`(${[...this.special].sort((a, b) => b.length - a.length).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "u");
  }

  count(text: string): number {
    let count = 0;
    for (const part of text.split(this.specialPattern)) {
      if (this.special.has(part)) { count++; continue; }
      for (const match of part.normalize("NFC").matchAll(PRE_TOKEN)) count += this.countPiece(match[0]);
    }
    return count;
  }

  private countPiece(piece: string): number {
    const cached = this.cache.get(piece);
    if (cached !== undefined) return cached;
    const symbols = Array.from(Buffer.from(piece, "utf8"), (byte) => byteCharacters.get(byte)!);
    while (symbols.length > 1) {
      let best = Infinity, position = -1;
      for (let i = 0; i < symbols.length - 1; i++) {
        const rank = this.ranks.get(`${symbols[i]} ${symbols[i + 1]}`);
        if (rank !== undefined && rank < best) { best = rank; position = i; }
      }
      if (position < 0) break;
      symbols.splice(position, 2, symbols[position]! + symbols[position + 1]!);
    }
    if (symbols.some((symbol) => this.vocab[symbol] === undefined)) throw new Error("Tokenizer vocabulary mismatch.");
    if (this.cache.size < 2048) this.cache.set(piece, symbols.length);
    return symbols.length;
  }
}

let tokenizer: QwenTokenCounter | undefined;
export function localTokenizer(): QwenTokenCounter { return tokenizer ??= new QwenTokenCounter(); }
export function tokenizerStatus(): { available: boolean; digest?: string; message: string } {
  try { return { available: true, digest: localTokenizer().digest, message: "Pinned local Qwen tokenizer ready." }; }
  catch { return { available: false, message: "Restore the pinned assets/tokenizer files before fresh generation." }; }
}

export function chatTemplate(messages: ChatMessage[]): string {
  return messages.map((message) => `<|im_start|>${message.role}\n${message.content}<|im_end|>\n`).join("") + "<|im_start|>assistant\n";
}

export function checkTokenBudget(messages: ChatMessage[], maximum: number, counter: TokenCounter = localTokenizer()): number {
  const count = counter.count(chatTemplate(messages));
  if (count > maximum) throw new BadRequestError("TOKEN_OVERFLOW", `The complete prompt needs ${count} tokens; the limit is ${maximum}. Export a smaller text excerpt.`);
  return count;
}
