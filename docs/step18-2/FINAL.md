# Step 18.2: final report (local prototype)

Nothing was deployed, published, pushed, merged or trained. Everything below runs locally. The feature is experimental and behind a build flag.

## 1. Completion summary

**Finished and tested**
- **The exact research model runs in the browser.** Qwen3-1.7B-Base `@ea980cb0`, the 752-step LoRA and the 4-row EOS repair were merged (Stage 0) and exported to ONNX (Stage 2). On WebGPU, the browser gives the same label as the full-precision reference on 12/12 frozen cases.
- **The generic public model** (Qwen3-0.6B, Stage 1) still works on WebGPU and WASM. It loads from browser storage and works with the internet blocked.
- **The document review workflow** (`#documents`), in five steps:
  1. upload (drag and drop or browse; CSV/XLSX/TXT; 5 MB limit; paste option)
  2. document type: deterministic keyword rules plus an optional on-device suggestion, then the user's own decision
  3. figure review: original vs reviewed value, unit, period and source row; "Corrected" and "Missing" marks
  4. explicit approval
  5. annual NOI with steps, corrections and an audit trail

  Any edit clears the approval and the result. Blank amounts stay blank.
- **Research Lab** (`#research-lab`): model identity, tested limits, device check, consent before any download, progress, cancel, remove, and recovery from a damaged cache.
- **The CSP relaxes only in the flagged build.** The default production build is unchanged: strict CSP, no model code, no WASM file.

**Still experimental:** document-type suggestion as a whole. Classification accuracy equals the keyword baseline, and prompt injection is not resisted (see §4). There is no public hosting for the weights or the 26.9 MB runtime WASM ([ADR-0011](../adr/0011-browser-runtime-csp.md)).

## 2. Exact model identity

The browser can run **both** models, each clearly labelled:

| | Generic public model | PropertyIQ research model |
|---|---|---|
| Source | `onnx-community/Qwen3-0.6B-ONNX` @ `58ca03a5`, q4f16 | Qwen3-1.7B-Base `@ea980cb0` + completed LoRA (752 steps, 12,023 examples) + selective repair of rows 151644/151645/151657/151658 (32 steps), merged in FP16 |
| Browser format | as published | ONNX (onnxruntime-genai 0.17.1 builder): **int8** weights in all 28 layers; the tied embedding/lm_head kept **exact FP16** and shared (one copy) |
| Download | 579 MB from huggingface.co, stored in Cache Storage | 2.14 GB from this site's `/models/` route (local prototype only); **not stored** in the browser |
| Lineage checks | n/a | ONNX tied matrix equals the merged checkpoint bit-for-bit; all 4 repaired rows equal; Stage 0 rows equal checkpoint-32 and the PEFT effective rows; research integrity 3,741/3,741 |

### Quantization effect (ONNX Runtime CPU vs the Stage 0 FP16 GPU reference, 27 prompts)

| Export | Size | Natural EOS (no bias) | Labels = reference | First-token top-1 | Mean KL | Token-identical |
|---|---:|---:|---:|---:|---:|---:|
| int4 (RTN) | 1.42 GB | 13/15 | 5/12 | 11/27 | 0.355 | 7/27 |
| **int8 (used)** | 2.13 GB | **15/15** | **12/12** | **27/27** | **0.002** | 21/27 |

int4 changed behavior: answers became sentences, which strict validation counts as Unknown. int8 is faithful; the 6 non-identical generations diverge late in long answers. The evidence is in `stage2-fidelity.json`; the scripts are in `C:\Users\Lewis\Desktop\claudecode\stage2\`.

## 3. UI/UX changes

The old floating debug panel is replaced, in the flagged build, by a full page with a calm 5-step layout. The main app stays mounted, so the user's analysis is kept.
- Steps show open, done or locked states with a reason ("Confirm the document type first").
- Suggestions look different from decisions: dashed amber "Suggestion, not verified" chips vs solid keyword chips. Disagreement between the two is flagged.
- The figure table marks corrected rows in amber and missing values in red. On phones each row becomes a two-column card.
- The approval checkbox is required before "Calculate NOI". The result shows NOI, EGI, steps, corrections and an expandable audit trail with the file SHA-256.
- Design tokens only, no new fonts or libraries, light and dark themes, 390 px with no overflow, axe clean. Following the impeccable craft floor: no eyebrow labels, no ghost cards, and a 4 px focus offset.

Screenshots: [result, desktop](workflow-result-desktop.png) · [result, mobile](workflow-result-mobile.png) · [Research Lab, desktop](research-lab-desktop.png) · [Research Lab, mobile](research-lab-mobile.png) · [research model suggestion](suggestion-research-desktop.png).

## 4. Measured performance

Headless Chromium with WebGPU, RTX 2080 SUPER, 32 GB RAM (`runtime-results.json`):

| | Load | Per-document suggestion | Notes |
|---|---:|---:|---|
| Generic, first download (Stage 1) | 14.5 s | 0.7 s test prompt | 579 MB |
| Generic, WebGPU, from storage | 3.9 s | 0.3 s | 0 model-host requests |
| Generic, WASM, from storage | 4.3 s | about 12 s | |
| Generic, internet blocked | 4.9 s (WASM) | 11.1 s | no network requests outside the app |
| **Research 1.7B, WebGPU** | **25–28 s** (2.14 GB from the local route, not cached) | **0.2–0.9 s** | GPU memory 1,658 → 3,439 MiB (+1.8 GB) |
| Research 1.7B, WASM | fails: `std::bad_alloc` | — | exceeds the WASM heap; the Lab now offers this model on WebGPU only |

**Classification accuracy (research model in the browser, 12 frozen cases):** 6/12 correct vs expected labels, the same as Step 18.1 FP16 and below keyword rules at 7/12. Public examples score 5/8, equal to keyword rules. Both injected variants answered "Offering Memorandum" (0/2). The appraisal form and the operating-statement page are still called Rent Roll. The lead disclosure gives an invalid label, which counts as Unknown. **No accuracy advantage.**

## 5. Testing (final runs)

| Check | Result |
|---|---|
| TypeScript (app + e2e) / ESLint | pass / pass (0 warnings) |
| Unit tests | **274 passed**, 22 files (+6: strict labels, keyword parity with the bridge on all 12 cases, NOI port incl. 5 cases matched against the live calculator at `127.0.0.1:8000`) |
| Bridge/resource tests (WSL) | 14 passed |
| Default build | pass; no `Qwen3`, no `.wasm`, no workspace code; `_headers` strict |
| Flagged build | pass; relaxed CSP only in `dist/_headers` |
| Default e2e regression (Chromium/Firefox/WebKit × desktop/390 px) | **199 passed, 11 skipped**, 0 failed |
| Step 18.2 workflow e2e (desktop + mobile) | 8 passed: full flow to **$62,500.00** with a correction, invalidation on edit, blank amounts blocked, PDF refused, non-T-12 locked, consent required, axe clean, no overflow, only app requests |
| Step 18.2 runtime e2e | 4 passed: generic WebGPU+WASM from cache, internet-blocked reload, research 12 cases on WebGPU with zero non-app requests, WASM refusal for research |

Regenerated tracked screenshots under `docs/screenshots` and `docs/verification` were restored after the regression run.

## 6. Preservation

- Research integrity (`provenance.verify`): **3,741/3,741 unchanged**, dev base matches the original, venv inventory unchanged.
- Repaired adapter SHA-256 `a2b503e3…dc0d` is unchanged. The AI repo HEAD `a18c5d0a…` and stash `b145e41a…` are unchanged. No checkpoint or adapter was written.
- New files only under `/home/lewis/conv-dev/export/`: `.venv-onnx`, `stage2_int4_webgpu`, `stage2_int8_webgpu`, `stage2_serve`, reports and logs.
- Original PropertyIQ checkout: 38 status entries, HEAD `5331fc2`, package files unchanged. **One known deviation:** the Stage 1 `pnpm add` went through a `node_modules` junction and left `node_modules/@huggingface/transformers` in the original. Nothing tracked changed. To restore it later, with your approval: `pnpm prune` in the original checkout, or delete only that symlink. This worktree now has its own `node_modules` (no junction).
- Disk: the lowest physical free space this session was 12.97 GiB, after the int8 export, when the research model was deliberately kept out of browser storage. It is 29 GiB at the end.

## 7. Services

| Service | State |
|---|---|
| Ollama :11434 | running throughout (stopping it needs sudo; the tests blocked its port instead) |
| Open WebUI :8080 | **restarted** with `deploy/start-webui.sh` (Terminal tab "Open WebUI"); HTTP 200 |
| Local AI bridge :8766 | **restarted** with the documented command (Terminal tab "Local AI bridge"); listening |
| Calculator :8000 | running, untouched; HTTP 200 |
| PropertyIQ dev server :5178 | running (pre-existing); HTTP 200 |

No startup settings were changed. Nothing on port 3000; Open WebUI uses 8080.

## 8. Launch the local prototype (PowerShell)

```powershell
Set-Location 'C:\Users\Lewis\Documents\Codex\step18-propertyiq'
$env:VITE_BROWSER_AI='1'
pnpm build
$env:PIQ_RESEARCH_MODEL_DIR='\\wsl.localhost\Ubuntu-24.04\home\lewis\conv-dev\export\stage2_serve'
.\node_modules\.bin\vite.cmd preview --port 4199 --strictPort
```

Open `http://127.0.0.1:4199/#documents` in Chrome or Edge, which have WebGPU. Use the Research Lab at the bottom to load a model. To rerun the tests: `pnpm exec playwright test -c playwright.browser-ai.config.ts` with the same two environment variables set.

## 9. Highest-priority remaining blocker

**The research model gives no accuracy benefit and is not robust to injection** (6/12 vs keyword rules 7/12; 0/2 on injection). The browser path is now faithful to the model, so better results need better model data or training, which was out of scope. Public use would also need weight hosting: about 2.14 GB plus the 26.9 MB runtime file, beyond the Cloudflare Pages per-file limit, and a training-data licence check.
