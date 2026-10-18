# Step 18.2 handoff (resumable state)

Final report: [FINAL.md](FINAL.md). This file is the short work log.

## Done
- Stage 0 (earlier run): FP16 merge + reference logits, `/home/lewis/conv-dev/export/stage0_*`.
- Stage 1 (earlier run): generic Qwen3-0.6B runtime spike (`stage1-results.json`).
- Stage 2 export: `/home/lewis/conv-dev/export/`
  - `.venv-onnx` (onnxruntime-genai 0.17.1, onnxruntime 1.30.0, onnx 1.23.1, onnx-ir 1.0.0; uses `.venv-train` torch/transformers through a `.pth` file).
  - `stage2_int4_webgpu`: int4, 1.42 GB, lossy (5/12 labels, KL 0.355). Kept as evidence, not used.
  - `stage2_int8_webgpu`: int8, 2.13 GB, faithful (12/12 labels, 15/15 EOS, KL 0.002). **Used.**
  - `stage2_serve/piq-qwen3-1.7b-repaired`: browser layout (hardlinked int8 data and a relocated graph).
  - Scripts: `C:\Users\Lewis\Desktop\claudecode\stage2\validate_onnx.py`, `make_serve_dir.py`. Evidence: `stage2-fidelity.json`.
- Browser: `src/ai/browser/` worker (two models, throttled progress, streamed cache, cancel, damaged-cache recovery), `useModel`, the `DocumentReview` 5-step workflow, `ResearchLab`, `Experiment` (route `#documents` / `#research-lab`) and `workspace.css`.
- `src/ai/classify.ts` (strict labels, keyword rules ported from the bridge, Step 18.1 prompt) and `src/ai/noi.ts` (exact decimal port of `realestate_calc.income_noi`; 5 live-service parity cases).
- CSP is relaxed in flagged builds only (`vite.config.ts` rewrites `dist/_headers`); `public/_headers` is unchanged.

## Modified files (worktree)
`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `vite.config.ts`, `src/main.tsx`, `tsconfig.e2e.json`, `playwright.browser-ai.config.ts`, `e2e-browser-ai/*`, `src/ai/{classify,noi}.ts(+tests)`, `src/ai/browser/*`, `docs/adr/0011-browser-runtime-csp.md`, `docs/step18-2/*`. Not modified: `LocalAI.tsx`, `client.ts`, `extraction.ts`, `ExtractionReview.tsx`, `scripts/local-ai/`, `public/_headers`.

## Decisions
- int8 over int4: int4 changed answers (format drift, 13/15 EOS). int8 matches the FP16 reference.
- The research model is never stored in the browser. Each load streams it from the local `/models/` route, to protect the disk reserve.
- No service worker: the model works offline from cache; the app shell needs its server.

## Blockers / remaining
- Original checkout `node_modules` has an extra `@huggingface/transformers` link. A safe restore needs owner approval (see FINAL.md).
- Hosting the 26.9 MB WASM and the 2.14 GB research weights publicly is not done (no infrastructure is authorized).

## Launch-prep session (2026-10-18), completed; see DEPLOYMENT_READY.md
Done:
- Floating entry and floating dev panel removed. The "Document assistant · Experimental" button now sits directly under the homepage search bar (`StartPage.tsx`, flag `documentAssistant` in `src/ui/routes.ts`). The dev-only 4B LocalAI panel is embedded at the bottom of the workspace (`DocumentReview.tsx`); `LocalAI.tsx` itself is unchanged.
- `Experiment.tsx`: no entry link; Back returns to `#home` and refocuses the button. Fixed a load race: a click before the listener attached was lost (re-sync in the effect). The entry uses `navigate()`, because the app turns hash links into pushState without firing hashchange.
- Research Lab copy: adapted from pretrained Qwen3-1.7B-Base, not trained from scratch; math is deterministic, never the model.
- Hosting hooks: `VITE_RESEARCH_MODEL_URL` (pinned static base URL ending in `/`; enables Cache Storage) and `VITE_ORT_WASM_URL` (external 26.9 MB runtime; the build then deletes the local `.wasm`).
- Tests: typecheck, lint and 274 unit tests pass; flagged workflow e2e 12/12 (desktop + mobile, including the homepage entry, keyboard, no-floating check, and the no-WebGPU gate); both builds checked.
- Facts verified from official docs: Pages has a 25 MiB/asset limit, 20,000 files and 500 builds/month on Free. R2 free tier is 10 GB-month, 1M Class A, 10M Class B, egress free; beyond that $0.015/GB-month, $4.50/M A, $0.36/M B; no billing cap is mentioned on the pricing page. Hugging Face: free public storage is "best-effort", 500 GB hard file limit. Qwen3-1.7B-Base is Apache-2.0.
Remaining:
1. Confirm the R2 payment-method requirement (third-party sources only so far) and r2.dev rate limits from official docs.
2. Licensing of training data: check the 12,023-row sources (OASST and synthetic generator terms) in /home/lewis/conv-dev.
3. Security review pass (pnpm audit, CSP, uploads, retention).
4. Runtime e2e rerun (4 tests) and default e2e (199) after these UI changes; integrity check; services check.
5. Write docs/step18-2/DEPLOYMENT_READY.md (screenshots: home-*.png, workflow-result-*.png, research-lab-*.png, suggestion-research-desktop.png).
