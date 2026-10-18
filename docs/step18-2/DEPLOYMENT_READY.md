# PropertyIQ: deployment-ready report (Step 18.2 public beta candidate)

Date: 2026-10-18. Nothing has been deployed, pushed, published or paid for. Branch `step18/ai-integration` (uncommitted, in the worktree `C:\Users\Lewis\Documents\Codex\step18-propertyiq`).

**Verdict: B. Nearly ready, with specific blockers.** The engineering is complete and tested. Launch is blocked only by decisions that need you: publishing the weights (licence notices are prepared), a free hosting account, and enabling the relaxed CSP in production. See §I.

## A. Current status

| Area | Status |
|---|---|
| Default PropertyIQ site | Unchanged and green. The default build has no AI code, no model, no WASM and the original strict CSP. |
| Document assistant (flag `VITE_BROWSER_AI=1`) | Complete. The entry button sits under the homepage search bar; the 5-step review leads to a deterministic NOI; plus the Research Lab. |
| Research model in the browser | Works on WebGPU. Experimental: accuracy equals keyword rules (no benefit), and it is not robust to prompt injection. |
| Generic demo model | Works on WebGPU and WASM, reloads from browser storage, works with the internet blocked. |
| Public hosting | Prepared, not created (templates and steps below). |
| Blocked on you | Weight publication, hosting account, production flag and CSP. |

## B. Final UI

The floating bottom-right button and the floating dev panel are gone. The entry is a native **"Document assistant · Experimental"** button directly beneath the homepage search bar (the deal composer), styled with the existing `.button` tokens. It opens a dedicated page (`#documents`) with "Back to PropertyIQ", which returns to the homepage and refocuses the button. The analysis underneath stays mounted, and nothing overlays the financial tables.

- Homepage: [desktop](home-desktop.png) · [mobile](home-mobile.png)
- Review result: [desktop](workflow-result-desktop.png) · [mobile](workflow-result-mobile.png)
- Research Lab: [desktop](research-lab-desktop.png) · [mobile](research-lab-mobile.png) · [research model suggestion](suggestion-research-desktop.png)

The existing 4B assistant needs the local bridge, so it appears at the bottom of the document page in dev mode with `VITE_LOCAL_AI=1`. It no longer floats. `LocalAI.tsx` is unchanged.

Fixed during this pass:
1. A load race could swallow the first click on the entry button. Fixed, with an e2e test on mobile.
2. A device choice made before the device check finished was overwritten. Fixed.
3. Research-model cards were misaligned. Fixed.
4. A stale storage note in the Research Lab. Fixed.

The Research Lab states that the model is:
- adapted from pretrained Qwen and not trained from scratch;
- limited in accuracy;
- WebGPU-only;
- a 2.14 GB download;
- never doing the math: figures come from deterministic code.

## C. AI verification (measured, RTX 2080 SUPER, headless Chromium, `runtime-results.json`)

| | Result |
|---|---|
| Research 1.7B, WebGPU | Loads in 24.7 s (2.14 GB, local route). About 0.2–0.9 s per document. GPU memory +1.5 GB (1,641 → 3,137 MiB). |
| Labels vs FP16 reference | **12/12** identical in the browser (int8 ONNX). Stage 2 conversion check: 15/15 natural EOS, KL 0.002. |
| Accuracy (12 frozen cases) | 6/12, vs keyword rules 7/12. Prompt injection 0/2. One case gives an invalid label, which strict validation turns into Unknown. |
| Unsupported device | No WebGPU: the research model cannot be loaded and the Lab says why; keyword rules still answer instantly (e2e). On WASM the research model fails with `std::bad_alloc`, so the option is disabled. |
| Generic 0.6B | WebGPU 3.7 s load / 0.3 s; WASM 4.0 s / 11.8 s. Both load from browser storage; 0 model-host requests when cached. |
| Network isolation | Every model e2e asserts no request outside the app and the model host. The bridge (8766), Ollama (11434) and Open WebUI (8080/3000) are blocked and never contacted. No document data leaves the page. |
| Safeguards | The model only fills a "Suggestion, not verified" chip. The user picks the type, reviews the figures and ticks approval; any edit clears both. The model has no tools. |

## D. Production hosting ($0 target)

**Recommended: Cloudflare Pages for the app, plus a public Hugging Face model repo for the weights and runtime.**

| Service | Verified limits (official docs, 2026-10-18) | Cost risk |
|---|---|---|
| Cloudflare Pages Free | 25 MiB per asset; 20,000 files; 500 builds/month; 100 `_headers` rules; no bandwidth limit listed | $0. Static assets only; no Functions are used. |
| Hugging Face Hub, free account | Public storage is "best-effort" (they ask for useful content); a single file can be up to 500 GB; no card required | $0. Downloads are served from HF's CDN, and no bandwidth fees are documented. |
| Cloudflare R2 (alternative) | Free: 10 GB-month, 1M Class A, 10M Class B per month; **free egress**. Beyond that: $0.015/GB-month, $4.50/M Class A, $0.36/M Class B. The pricing page lists **no spending cap**. `r2.dev` URLs are "rate-limited… for development purposes"; production needs a custom domain added as a zone in the same account. | Low (2.2 GB stored is within 10 GB) but **not guaranteed $0**: Class B reads beyond 10M/month are billed. Third-party sources (not official) say enabling R2 asks for a payment method. **Not activated.** |

Why Hugging Face: it is $0, needs no card, the CSP already allows `huggingface.co`/`*.hf.co`, and pinning the commit in the URL pins the content.

Architecture:
1. **Pages** serves the flagged build (`dist/`), built with:
   - `VITE_BROWSER_AI=1`
   - `VITE_RESEARCH_MODEL_URL=https://huggingface.co/<you>/propertyiq-qwen3-1.7b-research/resolve/<commit>/`
   - `VITE_ORT_WASM_URL=<same base>runtime/ort-wasm-simd-threaded.asyncify.wasm`

   With `VITE_ORT_WASM_URL` set, the build deletes the 26.9 MB local WASM, leaving no file over 25 MiB (verified).
2. **Weights:** the HF repo holds `stage2_serve/piq-qwen3-1.7b-repaired/*`, `runtime/<wasm>`, `LICENSE`, `NOTICE` and `README.md` (from `release/MODEL_CARD.md`). Integrity rests on the commit-pinned URL; SHA-256 values are in `stage2-fidelity.json` (`serve_manifest`).
3. **Browser:** streams the weights with progress and stores them in Cache Storage. Later visits make no model requests. The visitor can remove them in the Lab.
4. **No AI download for ordinary users:** the model loads only after an explicit consent tick in the Research Lab. The keyword rules and all financial tools work without it.

## E. Licensing

| Component | Licence | Obligation |
|---|---|---|
| Qwen3-1.7B-Base @`ea980cb0` | Apache-2.0 (verified on the model page and in its metadata) | Include the licence text, state your modifications, keep notices. A citation is requested. |
| OASST2 English @`179dd21f` | Apache-2.0 (verified in HF metadata; the same revision trained on) | Attribution in NOTICE. |
| Synthetic examples | Your own deterministic template generator (`synth_manifest.json`, seed 3407); no model-generated text according to the Step 17 docs | None. Unresolved: confirm that the template and paraphrase pools contain no copied third-party text. |
| onnxruntime-web runtime WASM | MIT | Ship its licence alongside it. |

**Assessment:** distribution under Apache-2.0 appears permitted. `release/NOTICE` and `release/MODEL_CARD.md` are drafted. Open item: confirm the synthetic template pools above. This is not legal advice.

## F. Testing (final run, 2026-10-18)

| Check | Result |
|---|---|
| TypeScript (app + e2e), ESLint | pass, pass (0 warnings) |
| Unit | **274 passed** (22 files), including NOI parity with the live Python calculator (5 cases) and keyword-rule parity with the bridge (12/12) |
| Bridge/resource (WSL) | 14 passed |
| Default build | pass. 0 `Qwen3` references, 0 WASM, strict CSP, no file over 25 MiB |
| Flagged build | pass. Relaxed CSP only in `dist/_headers`. Local mode has one 26.9 MB WASM; the public template build has none |
| Default e2e (Chromium/Firefox/WebKit × desktop/390 px) | **199 passed, 11 skipped** (skips are pre-existing, intentional), 0 failed |
| Flagged e2e | **16 passed**. Workflow ×2 viewports: upload → $62,500.00, invalidation, blank amounts, PDF refused, non-T-12 locked, consent, homepage entry and back (keyboard), no floating widget, no-WebGPU gate, axe, no overflow. Runtime: generic WebGPU+WASM cached, internet blocked, research 12 cases on WebGPU, WASM refusal |
| `pnpm audit --prod` | no known vulnerabilities |

Not tested: Firefox or Safari WebGPU, integrated-GPU laptops, real phones, the 2.14 GB Cache Storage path from a public host (only the 579 MB generic model's caching is proven), and real Cloudflare or HF responses.

## G. Preservation

- `provenance.verify`: **3,741/3,741 unchanged**, dev base equals the original, venv inventory unchanged.
- Repaired adapter SHA `a2b503e3…`; AI repo HEAD `a18c5d0`; stash `b145e41`: all unchanged. No checkpoint or adapter was written.
- Original checkout: 38 status entries, HEAD `5331fc2`, unchanged. The extra `node_modules/@huggingface/transformers` link from Stage 1 is still there and was **not** pruned (it needs your approval). The worktree's `node_modules` is separate.
- Disk: 29 GiB free on C:.
- Services:

| Service | State |
|---|---|
| Open WebUI :8080 | 200 |
| Ollama :11434 | 200 |
| Calculator :8000 | 200 |
| Bridge :8766 | listening |
| Dev server :5178 | was found stopped and restarted with the Step 18.1 command (Terminal tab "PropertyIQ dev (5178)") |

## H. Launch instructions

Local preview (PowerShell):
```powershell
Set-Location 'C:\Users\Lewis\Documents\Codex\step18-propertyiq'
$env:VITE_BROWSER_AI='1'; pnpm build
$env:PIQ_RESEARCH_MODEL_DIR='\\wsl.localhost\Ubuntu-24.04\home\lewis\conv-dev\export\stage2_serve'
.\node_modules\.bin\vite.cmd preview --port 4199 --strictPort
```
Open `http://127.0.0.1:4199/`, then click **Document assistant** under the search bar.

Public deployment (only after §I approvals):
1. Commit this branch locally with your noreply identity, review the diff, and merge only when you choose.
2. Create a free Hugging Face account/repo `propertyiq-qwen3-1.7b-research` (public).
3. Upload everything in `/home/lewis/conv-dev/export/stage2_serve/piq-qwen3-1.7b-repaired/`, plus:
   - `runtime/ort-wasm-simd-threaded.asyncify.wasm` (from `node_modules/onnxruntime-web/dist/`)
   - `LICENSE` (Apache-2.0)
   - `NOTICE` and `README.md` (from `docs/step18-2/release/`)
4. Note the commit SHA. Check that the uploaded hashes match `stage2-fidelity.json`.
5. Build:
   ```powershell
   $env:VITE_BROWSER_AI='1'
   $env:VITE_RESEARCH_MODEL_URL='https://huggingface.co/<you>/propertyiq-qwen3-1.7b-research/resolve/<sha>/'
   $env:VITE_ORT_WASM_URL='https://huggingface.co/<you>/propertyiq-qwen3-1.7b-research/resolve/<sha>/runtime/ort-wasm-simd-threaded.asyncify.wasm'
   pnpm build
   ```
   Confirm no file in `dist` exceeds 25 MiB and that `dist/_headers` has the relaxed CSP.
6. Deploy `dist/` to the `propertyiq` Pages project. Use a preview branch first (`wrangler pages deploy dist --branch beta`); deploying to production needs your approval.
7. On the preview URL, load the research model once, classify the 12 frozen cases, and check the cached reload.

## I. Final approval checklist (each needs your explicit yes)

- [ ] Publish the derived weights publicly on Hugging Face (licence check done; confirm the synthetic template pools).
- [ ] Create the Hugging Face account/repo (free, no card). Do **not** enable R2 unless you accept possible charges beyond the free tier.
- [ ] Enable the flagged build in production, which relaxes the production CSP (`'wasm-unsafe-eval'` plus Hugging Face in `connect-src`; ADR-0011).
- [ ] Deploy the build to `propertyiq.pages.dev` (preview first, then production).
- [ ] Update `PRODUCT.md` ("no AI claims"/CSP wording) to describe the opt-in experimental assistant.
- [ ] Commit, merge and push the `step18/ai-integration` branch.
- [ ] Optionally: approve `pnpm prune` (or removing one symlink) in the original checkout.
