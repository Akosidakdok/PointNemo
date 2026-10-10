# Offline Qwen tokenizer

These unchanged tokenizer assets come from [Qwen/Qwen2.5-1.5B-Instruct](https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct/tree/989aa7980e4cf806f80c7fef2b1adb7bc71aa306), revision `989aa7980e4cf806f80c7fef2b1adb7bc71aa306`. Downloaded October 10, 2026 (Asia/Manila). They are required local runtime data, not model weights. Runtime never downloads them.

| File | SHA-256 |
| --- | --- |
| qwen2.5-tokenizer.json | c0382117ea329cdf097041132f6d735924b697924d6f6fc3945713e96ce87539 |
| tokenizer_config.json | 5b5d4f65d0acd3b2d56a35b56d374a36cbc1c8fa5cf3b3febbbfabf22f359583 |

The local implementation uses the asset's NFC normalization, Qwen2 Split pattern, byte alphabet, ordered BPE merges, added tokens, and no-tools chat template. The tokenizer implementation and both asset hashes form the metadata digest. Planning, generation, and repair messages are checked before inference. JSON schemas are supplied separately through Ollama's format field. The prompt is sent through Ollama's raw generation endpoint with this exact template to keep counting and inference identical.

The supported model tags are `qwen2.5:1.5b` and `qwen2.5:3b`. Before inference, the installed GGUF architecture, vocabulary token IDs, and ordered merges are compared with these pinned assets through local Ollama. Verification is cached by model digest; a mismatched model is refused.
