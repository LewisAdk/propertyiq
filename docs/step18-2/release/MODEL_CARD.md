---
license: apache-2.0
base_model: Qwen/Qwen3-1.7B-Base
library_name: transformers.js
pipeline_tag: text-generation
language: [en]
tags: [onnx, webgpu, int8, research, experimental, propertyiq]
---

# PropertyIQ research Qwen3-1.7B: browser ONNX build (v1.0, experimental)

An experimental adaptation of [Qwen/Qwen3-1.7B-Base](https://huggingface.co/Qwen/Qwen3-1.7B-Base), packaged to run **inside a web browser on the visitor's own GPU** (WebGPU) with [Transformers.js](https://github.com/huggingface/transformers.js). [PropertyIQ](https://github.com/LewisAdk/propertyiq) uses it for an optional document-type suggestion (Rent Roll, T-12, Offering Memorandum, Other, Unknown) that the user must confirm.

It is **not** trained from scratch. It is a small fine-tune of Qwen's pretrained base model.

## Lineage
| Step | Detail |
|---|---|
| Base | `Qwen/Qwen3-1.7B-Base`, revision `ea980cb0a6c2ae4b936e82123acc929f1cec04c1` (Apache-2.0) |
| Conversational LoRA | 752 steps on 12,023 examples, drawn from OpenAssistant OASST2 English (revision `179dd21fc55192153d94adb0e0ce8f69e222bf75`, Apache-2.0) and synthetic format/tool examples produced by the author's own deterministic templates (no third-party text, no model-generated text) |
| Selective EOS repair | 32 steps adjusting only embedding rows 151644, 151645, 151657, 151658 (`<\|im_start\|>`, `<\|im_end\|>`, tool-call tags) so answers end naturally |
| Merge | LoRA and repair merged into FP16 weights; tied embedding/LM head preserved |
| Export | ONNX via onnxruntime-genai 0.17.1: int8 weights in all 28 transformer layers. The tied embedding/LM head is kept **exact FP16**, so the repaired rows are bit-identical to the merged checkpoint. |

The base checkpoint is the same pinned revision used in the author's separate, **unpublished** self-training research study (Lewis Adkins, manuscript in preparation). This release contains none of that study's adapters, data or results, and makes no claims about them.

## Measured behavior (honest)
- **Conversion fidelity** (ONNX Runtime vs the FP16 merged model): 12/12 identical classification labels, 15/15 natural end-of-answer stops without any EOS bias, first-token top-1 agreement 27/27, mean KL 0.002. An int4 variant was rejected because it changed answers.
- **In the browser** (Chromium, WebGPU, RTX 2080 SUPER): about 25 s to load, about 0.3 s per document, about +1.5 GB GPU memory. 12/12 labels match the FP16 reference.
- **Task accuracy is limited:** 6/12 correct on a frozen 12-case document set, vs 7/12 for simple keyword rules; 5/8 on public examples (equal to keyword rules). **No accuracy advantage was demonstrated.**
- **Prompt injection: it fails.** In 2/2 tests it followed instructions planted in the document text. Never let its output trigger actions, approvals or calculations.
- It often mislabels appraisal forms and operating-statement pages as rent rolls, and sometimes gives a non-label answer (treat that as Unknown).

## Requirements
- A browser with **WebGPU and `shader-f16`** (recent Chrome/Edge on a discrete or capable GPU). It does **not** run on the WASM/CPU backend: the browser runs out of WebAssembly memory.
- A **2.14 GB** download (plus a 26.9 MB runtime file), stored in browser Cache Storage after the first load.

## Intended use
Experimental, user-confirmed document-type suggestions in a local, privacy-preserving web app. Document text stays on the user's device. Do not use it for decisions, financial figures or anything safety-relevant.

## Files
| File | Purpose |
|---|---|
| `config.json`, `generation_config.json` | Qwen3 config (+ `transformers.js_config` for external data) |
| `tokenizer.json`, `tokenizer_config.json`, `chat_template.jinja` | Tokenizer and special tokens (unchanged from the base) |
| `onnx/model_int8.onnx`, `onnx/model_int8.onnx_data` | ONNX graph and weights |
| `runtime/ort-wasm-simd-threaded.asyncify.wasm` | ONNX Runtime Web 1.31.0-dev.20260914-8d85527a0 (MIT, `runtime/LICENSE-onnxruntime.txt`), hosted here because the PropertyIQ site's host limits files to 25 MiB |
| `MANIFEST.sha256` | SHA-256 of every file |
| `LICENSE`, `NOTICE` | Apache-2.0 and attribution |

## Licence and attribution
Apache-2.0 (see `LICENSE`). Modifications are listed above and in `NOTICE`. Built on Qwen3 by the Qwen Team, Alibaba Cloud; please also cite:

```
@misc{qwen3technicalreport,
  title={Qwen3 Technical Report}, author={Qwen Team}, year={2025},
  eprint={2505.09388}, archivePrefix={arXiv}, primaryClass={cs.CL}
}
```
Uses OpenAssistant OASST2 (Apache-2.0); thanks to its contributors.
