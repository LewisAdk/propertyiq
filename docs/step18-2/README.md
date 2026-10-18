# Step 18.2 Stage 1: browser runtime test with a generic model

> Superseded in part by [FINAL.md](FINAL.md): the CSP change now applies only to `VITE_BROWSER_AI=1` builds, and the spike panel became the document review workflow. Stage 1 numbers below are unchanged.

This stage uses the **generic public** `onnx-community/Qwen3-0.6B-ONNX` (revision `58ca03a5`, q4f16). It is **not** PropertyIQ's Qwen3-1.7B lineage, and it reads no document data. It only proves the runtime path: a Web Worker, WebGPU with a WASM fallback, a capability probe, download progress, Cache Storage and the CSP. See [ADR-0011](../adr/0011-browser-runtime-csp.md).

## What is built

- `src/ai/browser/`: `probe.ts` (WebGPU, `shader-f16`, buffer limits, device memory, storage quota; picks the device), `worker.ts` (Transformers.js 4.3.1 in a module worker, with the ONNX Runtime WASM self-hosted) and `BrowserAI.tsx` (panel with device choice, load, progress bar, test prompt, remove from browser).
- Build flag `VITE_BROWSER_AI=1`. Without it, a Vite resolve hook stubs the module, so default builds contain no worker, no model id and no 26.9 MB WASM file (checked in `dist`).
- `public/_headers`: `script-src` gains `'wasm-unsafe-eval'`, and `connect-src` gains `https://huggingface.co https://*.hf.co`. `vite preview` now sends these headers.
- Library workarounds in `worker.ts`:
  1. The commit is pinned in `remotePathTemplate`, because 4.3.1 drops `revision` while it lists pipeline files.
  2. The weights are streamed into Cache Storage, because Chromium rejects the library's buffered 570 MB `cache.put` ("Unexpected internal error").
  3. `useWasmCache` is off, because it would need `script-src blob:`.

## Results (`stage1-results.json`, Chromium headless with `--enable-unsafe-webgpu`, RTX 2080 SUPER)

| Phase | Device | Load | Test prompt | Model-host requests |
|---|---|---:|---:|---:|
| First load (download) | WebGPU | 14.5 s | 0.7 s | 16 |
| Same session | WASM | 2.7 s | 17.7 s | (incl. above) |
| Reload, internet blocked | WASM | 4.2 s from cache | 18.4 s | **0** |

- Every request outside the app went to the model host. None went to ports 8766, 11434 or 3000, or to any other host. There were no CSP violations, page errors or console warnings.
- The probe reported WebGPU yes, `shader-f16` yes, a 2,147 MB maximum buffer and storage binding, 32 GB device memory and a 10.7 GB storage quota.
- The output was the same on both backends.
- Cached files: `model_q4f16.onnx`, `config.json`, `generation_config.json`, `tokenizer.json`, `tokenizer_config.json`. The profile size is 625 MB.

## Limits

- Offline means the internet is blocked while the app is still served. There is no service worker, so a fully offline reload cannot load the app shell or the worker script. If the worker script fails to load, the panel shows an error instead of hanging.
- On Windows, a Playwright profile under a long path breaks Cache Storage (`caches.open` fails). The spec uses a short `%TEMP%\piq-browser-ai` path.
- Headless Chromium on one desktop GPU. There is no Firefox or Safari run, no integrated-GPU laptop and no phone.
- Ollama was still running (stopping it needs sudo). The browser blocked its port, and no request tried to reach it.

## Reproduce

```powershell
$env:VITE_BROWSER_AI='1'; pnpm build
pnpm exec playwright test -c playwright.browser-ai.config.ts
```

Checks: typecheck, lint, 268 unit tests (20 files, +1 `chooseDevice` test), default build, 34 desktop e2e passed (1 intentional skip), 2 browser-runtime e2e passed.
