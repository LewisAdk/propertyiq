# Hugging Face release: PropertyIQ research Qwen3-1.7B (browser build)

Status: **C, preview verified; ready for your production approval.** The model is published (`bb21176a`), the branch is pushed and its Cloudflare preview passes end to end. Production is unchanged.

## 1. GitHub
- Branch `step18/ai-integration`, local commit `38369b1` (author: Lewis Adkins, noreply). Based on `origin/main` `5331fc2`, which is current. **Not pushed**: GitHub CLI isn't logged in, and pushing waits for your OK.
- 91 files, none over 1 MB. No secrets, tokens or personal email (scanned). `.gitignore` now excludes `*.onnx`, `*.onnx_data`, `*.safetensors`, `*.gguf`, `.huggingface/` and `hf_token*`. No model binaries are in the repo.
- Note: 11 local-dev scripts and reports contain WSL paths such as `/home/lewis/...`. They need these to run locally. Remove them if you'd rather not publish the paths.
- The PropertyIQ repo has **no LICENSE file**, so the app is "all rights reserved" by default. The model's Apache-2.0 applies only to the weights repo. Choosing an app licence is a separate decision.

## 2. Hugging Face repository (proposed)
- Account: `AwesomeLewis64` (free plan; signed in in the browser pane).
- Repo: **https://huggingface.co/AwesomeLewis64/propertyiq-qwen3-1.7b-research-onnx** (public). Release commit **`bb21176a95bcfdeafdcb006dc126dd6bd52ad5a7`**, uploaded with `hf upload` (huggingface_hub 2.1.1, separate venv `~/.venv-hf`). All 13 files were verified remotely against MANIFEST.sha256 (LFS SHA-256 for large files, git blob IDs for small ones). The only extra file is the repo's default `.gitattributes`.
- Free tier (official docs, verified 2026-10-18): public storage is "best-effort" (they ask that uploads be useful), the hard limit is 500 GB per file, and no payment is needed. About 2.17 GB fits. No PRO, no paid inference: visitors download the files and run them themselves.

## 3. Files (release folder `/home/lewis/conv-dev/export/hf_release/propertyiq-qwen3-1.7b-research-onnx`, built from hardlinks)

| File | Bytes | SHA-256 |
|---|---:|---|
| `onnx/model_int8.onnx_data` | 2,128,347,136 | `2a2613a83c5f0607e76079e2902b72082b8577a1eeaa953796a8c83c966d313d` |
| `runtime/ort-wasm-simd-threaded.asyncify.wasm` | 26,861,777 | `49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082` |
| `tokenizer.json` | 11,422,650 | `be75606093db2094d7cd20f3c2f385c212750648bd6ea4fb2bf507a6a4c55506` |
| `onnx/model_int8.onnx` | 300,460 | `d56f28c7f374d76b1fecb9f57d82039b75005c938dd9747e116bb4d71337a376` |
| `LICENSE` (Apache-2.0) | 9,197 | `a7d00bfd…4654a47` |
| `README.md` (model card) | 4,577 | `273eb55c…6f05cb4` |
| `chat_template.jinja` | 4,116 | `87a2728c…6b5` |
| `config.json` | 1,517 | `55ca1a83…4795` |
| `runtime/LICENSE-onnxruntime.txt` (MIT) | 1,073 | `2f07c727…922c` |
| `NOTICE` | 828 | `5a3ace81…9cf7` |
| `tokenizer_config.json` | 695 | `cbea7bca…e6f790` |
| `generation_config.json` | 139 | `1ef06577…7380` |
| `MANIFEST.sha256` | small | lists the above |

**Total: 2,166,954,165 bytes (2.17 GB).** The model files are byte-identical to the serve directory used in all browser tests (`hashes_match_tested_serve_dir: true`). Full manifest: `/home/lewis/conv-dev/export/hf_release_manifest.json`.

**Privacy evidence:**
- No research datasets, checkpoints, optimizer states, adapters, evaluation documents, local paths or credentials.
- The scan's only hits are vocabulary entries in Qwen's unchanged `tokenizer.json` (ordinary words such as "password").

## 4. Licences and attribution
- **Qwen3-1.7B-Base @ea980cb0:** Apache-2.0 (model card and metadata). Obligations: LICENSE, a notice of modifications (in NOTICE and the model card), and a citation to the Qwen3 report.
- **OASST2 @179dd21f:** Apache-2.0 (metadata, the same revision trained on). Credited in NOTICE.
- **Synthetic data:** `gen_synth.py` (SHA-256 `949f4872…` matches `synth_manifest.json`) builds every example from short hand-written pools inside the script. No external datasets, downloads or model-generated text. Licence cleared.
- **ONNX Runtime Web runtime file:** MIT (from its package metadata; the npm package ships no LICENSE file, so the standard Microsoft MIT text is included).
- **ONNX export:** produced by your own scripts with onnxruntime-genai (MIT tooling). Using the tool imposes no licence on its output.
- **Model card:** [release/MODEL_CARD.md](release/MODEL_CARD.md), uploaded as README.md. It covers lineage, LoRA, EOS repair, int8 export, intended use, measured results, failures, prompt-injection weakness, WebGPU and size requirements, data notices, the PropertyIQ link and the manifest. The research manuscript is described as unpublished. It makes no from-scratch or significant-gain claims.

## 5. Cloudflare build configuration
- Current state (DEPLOYMENT.md): Pages is connected to `LewisAdk/propertyiq` and deploys `main` automatically. Build: `pnpm install --frozen-lockfile && pnpm build`, output `dist`, `NODE_VERSION=22`, `PNPM_VERSION=11.25.0`, `SITE_URL` set for Production and Preview.
- Branch pushes: with Cloudflare's default settings, each pushed branch gets a public preview. Preview has no `VITE_BROWSER_AI`, so a push of this branch would build the **default site with the assistant compiled out** (verified: 0 model references, 0 WASM). I can't read your dashboard, so check Settings → Builds → Branch deployments.
- To preview the assistant after the weights are published, set these on **Preview only** (they apply to every preview branch):
  - `VITE_BROWSER_AI=1`
  - `VITE_RESEARCH_MODEL_URL=https://huggingface.co/AwesomeLewis64/propertyiq-qwen3-1.7b-research-onnx/resolve/<commit>/`
  - `VITE_ORT_WASM_URL=<same>runtime/ort-wasm-simd-threaded.asyncify.wasm`

  Verified with a template build: no file over 25 MiB, CSP limited to `'self'` + Hugging Face, the pinned URL bundled, no secrets.
- The app accepts only a URL pinned to a 40-character commit. Before downloading, it checks that the Hugging Face file listing for that commit reports the compiled SHA-256 and size of the weights and the runtime file. After streaming, it checks the byte count and refuses on any mismatch, keeping nothing.

## 6. Real-world download and cache results
**Measured on the published release** (`e2e-browser-ai/public.spec.ts`, clean Chromium profile, WebGPU, no local model server; `public-release-results.json`):
- Hugging Face serves 302 redirects to `us.aws.cdn.hf.co` (covered by `*.hf.co`), CORS echoes the site origin, `.wasm` is served as `application/wasm`, and range requests return 206.
- First visit: nothing contacts Hugging Face before consent. Consent, then download (2.17 GB incl. runtime) and load took **53.5 s** on this connection. 18 Hugging Face requests, no other hosts, no console errors. **12/12** labels equal the FP16 reference (6/12 vs expected, as before). The full workflow (upload → model suggestion → confirm T-12 → review with a correction → approve → calculate) gave **$62,500.00**.
- Return visit with the internet blocked: loaded from browser storage in **5.8 s**, suggestion in 0.5 s, **0 network requests** outside the app. The weights and the runtime file are both reused from Cache Storage.
- Fixed during this test: an empty Transformers.js path template produced `//` URLs. The runtime file is now cached because the CDN signs and expires its URLs.

**Cloudflare preview** https://step18-ai-integration.propertyiq.pages.dev (branch pushed by you; `preview-results.json`):
- Response CSP is exactly the flagged policy (`'wasm-unsafe-eval'`, `connect-src 'self' https://huggingface.co https://*.hf.co`). Production `propertyiq.pages.dev` still serves the strict default CSP.
- The worker bundle pins commit `bb21176a`. No `.wasm` is deployed to Pages; the runtime comes from the release.
- Clean profile: download plus load took **79.9 s**; 18 Hugging Face requests, no other hosts, 0 console errors; **12/12** labels equal FP16; the full workflow reached **$62,500.00**.
- Return visit with the internet blocked: **5.2 s** from browser storage, 0 network requests.

Earlier evidence:
- The Hugging Face listing API is readable cross-origin from the app, and its LFS hashes match what this check expects (tested on the generic model).
- The generic model loads from Hugging Face via redirect to `*.hf.co`, streams into Cache Storage and reloads offline.
- **Not yet proven:** the 2.1 GB research file through Hugging Face's CDN, and the content type of the `.wasm` file served from Hugging Face. If it isn't `application/wasm`, the runtime should fall back to slower compilation; check this on the preview.

## 7. Inference performance and compatibility
- Local (WebGPU, RTX 2080 SUPER): about 25 s load, about 0.3 s per document, +1.5 GB GPU memory, 12/12 labels equal the FP16 reference.
- Requires WebGPU with `shader-f16`. The WASM fallback fails for this model, so it's disabled with an explanation. Keyword rules work everywhere.

## 8. Security and privacy
- Inference runs only in the visitor's browser worker. No document text is sent anywhere (e2e network assertions). There is no endpoint to your PC: the 4B assistant and bridge exist only in dev mode with `VITE_LOCAL_AI=1`, are excluded from all production builds and bind to 127.0.0.1.
- No model request is made until the visitor selects a model and ticks consent (new e2e). Opening the site or the workspace downloads nothing.
- The model only fills a "not verified" suggestion. Approval is a human checkbox that any edit clears, and the NOI is deterministic code. Document text cannot trigger anything (prompt injection is acknowledged, not solved).
- Stalled downloads abort after 60 s with no data; cancelled or failed downloads store nothing; there is a damaged-cache recovery message.
- `pnpm audit --prod`: no known vulnerabilities.

## 9. Cost assumptions
$0. Cloudflare Pages Free (static only, no Functions). Hugging Face free public repo (no card, no per-download billing documented). No R2. Visitor bandwidth for the 2.17 GB model comes from Hugging Face's CDN; heavy abuse could prompt Hugging Face to ask for an upgrade (their "best-effort" policy), but nothing bills you automatically.

## 10. Production status
Unchanged. `https://propertyiq.pages.dev/` still serves `main` (`5331fc2`). The model repo is public, but nothing in production links to it yet.

## 11. What you need to do
1. ~~Approve publication; upload~~: done (`bb21176a`). **Now delete the write token** (Hugging Face → Settings → Access Tokens → `propertyiq-release` → Delete). Downloads don't need it.
2. ~~Create a write token~~ (done) on Hugging Face: Settings → Access Tokens → New token → Fine-grained → enable "Write" for the repo `AwesomeLewis64/propertyiq-qwen3-1.7b-research-onnx` (create the repo first, empty and public, via New → Model). Do **not** paste it here.
3. ~~Store the token locally~~ (done) (only you type it). In a terminal:

   ```
   wsl -d Ubuntu-24.04 -- bash -lc "python3 -m venv ~/.venv-hf && ~/.venv-hf/bin/pip install 'huggingface_hub[hf_xet]==1.0.*' && ~/.venv-hf/bin/hf auth login"
   ```

   `huggingface_hub` isn't installed in any existing environment; it's a small download, about 5 MB.
4. ~~Upload~~ (done): `hf upload AwesomeLewis64/propertyiq-qwen3-1.7b-research-onnx /home/lewis/conv-dev/export/hf_release/propertyiq-qwen3-1.7b-research-onnx . --repo-type model`, record the commit SHA, and verify the remote hashes.
5. **Approve the push** of `step18/ai-integration`. Your call: log in to GitHub CLI with `gh auth login`, or push it yourself. Then set the three Preview env vars in Cloudflare.
6. After I verify the preview: approve the merge to `main` (production).

## 12. Rollback
- **Weights:** make the Hugging Face repo private or delete it. The app then refuses to download, because the listing check fails.
- **Preview:** remove the three Preview env vars, or delete the preview deployment in Cloudflare.
- **Production (after a merge):** revert the merge commit on `main`, or roll back to the previous deployment in Cloudflare Pages (Deployments → … → Rollback). The default build never includes the assistant.
- **Local:** `git branch -f` is not needed. The commit is on the feature branch only; `main` and the original checkout are untouched.

Integrity at completion: `provenance.verify` 3,741/3,741 unchanged. Services: 8766, 11434, 8080 and 8000 are listening; dev server 5178 returns 200. C: has 29 GiB free.
