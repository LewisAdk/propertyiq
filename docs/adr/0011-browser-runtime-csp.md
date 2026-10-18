# 11. On-device model runtime: CSP, hosting and scope (experimental)

Status: accepted for the Step 18.2 experiment · 2026-10-17 (owner approved the plan in `STEP18_2_PLAN.md`; revised the same day for the final local prototype)

Step 18.2 adds an experimental document-type suggestion that runs in the visitor's browser, plus a document review workflow. Two models are wired:

- the **generic public** `onnx-community/Qwen3-0.6B-ONNX` (revision `58ca03a5`, q4f16), downloaded from Hugging Face. This is not PropertyIQ's model, and the UI says so.
- the **PropertyIQ research model**: Qwen3-1.7B-Base `@ea980cb0`, the 752-step LoRA and the 4-row EOS repair, merged and exported to ONNX (int8 layers, exact FP16 tied embedding). It exists only where a local server provides it.

## Decision

- Code lives in `src/ai/browser/` behind the build flag `VITE_BROWSER_AI=1`. Without the flag, a Vite resolve hook stubs the entry module. Default builds then contain no worker, no model id, no workspace CSS and no WASM file (checked in `dist`).
- **The CSP changes only in flagged builds.** `public/_headers` stays `script-src 'self'; connect-src 'self'`. When the flag is set, the build rewrites `dist/_headers`, and `vite preview` sends:
  - `script-src 'self' 'wasm-unsafe-eval'`: compiling WebAssembly needs this. It does not allow `eval` or inline scripts.
  - `connect-src 'self' https://huggingface.co https://*.hf.co`: the generic model host and its download CDN. The research model is same-origin.
- Runtime: Transformers.js 4.3.1 with ONNX Runtime Web, pinned exactly. It uses WebGPU when the adapter has `shader-f16`, otherwise WASM. The ONNX Runtime `.mjs`/`.wasm` files are bundled and served from `'self'`. `env.useWasmCache` is off, because it would need `script-src blob:`.
- The model only suggests. Its output must be exactly one label, ending at natural EOS; anything else is Unknown. The user chooses the type. The deterministic NOI calculation runs only after the user's explicit approval, and any edit clears that approval. Document text cannot trigger anything: the model has no tools, and its output only fills a suggestion chip.
- Document text goes only to the worker on the same page. No document data is sent over the network (asserted in e2e).

## Hosting (no infrastructure created)

- **The ONNX Runtime WASM file is 26.9 MB** (`ort-wasm-simd-threaded.asyncify.wasm`). That is above the 25 MiB per-file limit noted for Cloudflare Pages (verify the current limit). Viable static options:
  1. Serve the runtime `.wasm`/`.mjs` from the same bucket as the weights, add that origin to `connect-src`/`script-src`, and pin file hashes.
  2. Use the 16.8 MB `jspi` build in browsers with JSPI, keeping (1) as the fallback.
  3. Serve the app from Cloudflare Workers Static Assets or R2 behind a custom domain, whose per-file limits differ (verify).
- The **research model** (2.14 GB) would need R2 or Hugging Face, sharded below per-file limits, with CORS and pinned hashes. Before publishing derived weights, confirm the training-data licences (STEP18_2_PLAN §1.3). Nothing is uploaded at this stage.
- The local prototype serves the research export at `/models/` from `vite preview`, using `PIQ_RESEARCH_MODEL_DIR`. It is never stored in the browser, to keep the development disk above its reserve.

## Questions settled before accepting (short grill)

- *Does this break "no backend"?* No. Model files are static downloads, made only after explicit consent in the Research Lab.
- *Why flag-only CSP?* So the default production site keeps its strict policy.
- *Offline?* Model files are reused from Cache Storage, verified with the internet blocked. There is no service worker, so the app shell itself still needs its web server. No service worker was added: it is not needed for the model, and it adds update and cache-invalidation risk.
- *Copy:* "experimental document-type suggestion", "on-device model", "runs in this browser". It never says "AI-powered" (CLAUDE.md).

## Consequences

- `PRODUCT.md` stays accurate for the default build. Update it if a flagged build is ever deployed.
- The workspace is an overlay route (`#documents`, `#research-lab`). The main app stays mounted and hidden, so returning keeps the user's analysis.
- Prompt injection is not solved. The research model followed planted instructions in 2/2 Step 18.1 tests. The capability boundary, not the label, is the protection.
