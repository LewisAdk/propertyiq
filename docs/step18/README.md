# Step 18 local prototype

Branch `step18/ai-integration`, based on `5331fc2780c323d63fc897b49e081daab11e70e0`.
Worktree: `C:\Users\Lewis\Documents\Codex\step18-propertyiq`.
Nothing pushed, merged, trained, or publicly deployed. Existing finance code is unchanged.

## What works

- Development-only expandable panel: user supplies TXT, CSV, XLSX (first worksheet), or pasted document text, then explicitly requests a type suggestion. Strict label/EOS validation, Unknown fallback, user correction and confirmation. No self-reported confidence. Classification cannot call tools or modify financial inputs.
- Separate existing Qwen3-4B-Instruct assistant, plain-text unverified explanations. Document interpretation uses pasted excerpts; no automatic extraction or memory integration.
- Complete reviewed JSON can be sent to the existing deterministic `/v1/income-noi?detail=full` service only after explicit confirmation. Editing inputs clears approval and the displayed result. No model-generated tool call is executed. This does not alter PropertyIQ's existing finance engine or imports.
- All operations are stateless; the prototype does not store uploaded files, questions or conversations. Evaluation outputs below are intentionally retained, public/fictional material only. Existing browser-local PropertyIQ storage is unchanged.

## Actual evidence

| Check | Result |
|---|---|
| Application unit suite | 255 passed, 18 files |
| Type checking and lint | Passed |
| Static production build | Passed; assistant panel eliminated from production bundle |
| Existing desktop browser suite | 34 passed, 1 intentional skip |
| Bridge tests | 6 passed: strict labels, human approval, fixed calculator route, intended 4B routing, disk reserve, foreign origins/hosts and resident-model protection |
| Live browser integration | 1.7B suggestion, correction/confirmation, 4B answer, approved deterministic NOI, approval invalidation, malformed-output fallback passed |
| Final panel layout | Desktop 1440×1000 and mobile 390×844 checked using saved live outputs; no page errors or horizontal overflow |
| Public excerpt classification | 7/10 correct views from five source documents; keyword baseline 6/10 |
| Separate ambiguity controls | Model 1/2; baseline 2/2 |
| Combined (not independent documents) | Model 8/12; baseline 8/12 |
| Output format / termination | 0/12 invalid labels, 12/12 natural EOS stops |
| Research preservation | 3,741/3,741 verified unchanged; development base still matches original |
| Original PropertyIQ checkout | All 36 modified and two untracked files hash-identical; HEAD and stash unchanged |

The 1.7B model confused the heading-free offering-memorandum excerpt with a rent roll, abstained (Unknown) on both W-9 views, and mislabeled “Page 3. Continued.” as Rent Roll. Valid formatting is not evidence of correct classification. Keep this experimental; this does not justify production use or a claim of general document accuracy.

Sources and exact excerpts/hashes are recorded in `classification-results.json`. The public source documents are the [Greylock rent-roll form](https://www.greylockinvestment.com/content/docs/Real_Estate_Rent_Roll.pdf), three explicitly fictional document cards in [CREscope's reconciliation walkthrough](https://crescope.com/sample/reconcile), and the [IRS W-9](https://www.irs.gov/pub/irs-pdf/fw9.pdf). The ten views are five titled excerpts and five heading-free versions, not ten independent documents. No full PDF parsing, scanned-document OCR, production documents, or private data were tested. Prompts were fixed before the single batch; no training, retries or prompt optimization against these labels.

## Model identity and runtime

1.7B lineage: pinned Qwen3-1.7B-Base revision `ea980cb0a6c2ae4b936e82123acc929f1cec04c1` → preserved completed 752-step conversational LoRA → 32-step repair of the four tied token rows. It is not a newly pretrained model or the research math adapter. The existing verified loader is reused. Final adapter SHA256 `a2b503e3b3c67ea996f74a0b682cf23d6dbd0f1179586fb11d3bdaae8f31dc0d` matches checkpoint 32; completed source LoRA SHA256 `6e197aaf9b2aaa74e9ceaa64fa0e258bd880e1332060065d5511514643aecf60` is unchanged.

Repaired inference: HF Transformers/PEFT, FP16 base with saved FP32 adapters/token rows, SDPA CUDA, plain ChatML, greedy, 24 new tokens, EOS `[151645,151643]`, pad `151643`, **no EOS bias**. Text limited to 4,000 characters / 1,800 input tokens. Each classification request loads once and exits, releasing its CUDA memory. Actual evaluation model-load time 8.689 s, generation 0.197–1.371 s per excerpt, peak PyTorch allocation 3.881 GiB; total batch wall time 24.595 s includes process/import overhead. This is not full-device VRAM usage.

4B: preserved Ollama `qwen3:4b-instruct-2507-q4_K_M`, digest `0edcdef34593eac1aa2be9c7d06c432dcf81945adca5eca2f27662c18f168ba0`, Q4_K_M, native Ollama template, temperature 0, 2,048 context / 256 output tokens. Measured warm request 0.681 s, 66 output tokens; generation 0.598 s, warm load 0.000726 s. Cold 4B load time was not captured. This is not a controlled quality comparison with 1.7B.

RTX 2080 SUPER: after the 4B request, nvidia-smi reported 3,977 MiB used / 4,011 MiB free / 8,192 MiB total (driver accounting); Ollama reported 2,876,160,081 bytes resident. A short pre-guard coexistence probe succeeded, but that does not establish safety at longer contexts. **Final code rejects classification whenever Ollama reports any resident model**, preserves its normal idle timeout, and never forcibly unloads the working assistant. Live final guard returned HTTP 422 as intended. Bridge requests serialize; another external client can still race for GPU memory. Worker CUDA/device/free-memory checks and process error handling fail closed. Classification becomes available after Ollama naturally idles; no background retries.

Physical C: free space measured at 21.99 GiB after evaluation; reserve is 12 GiB. Every bridge operation checks actual `/mnt/c` physical free space plus a 64 MiB request margin. No new model copy, merge, quantization or checkpoints are created. These checks do not reserve disk space against unrelated Windows processes. See `research-integrity.json`, `source-integrity.json`, `resources-and-assistant.json` and the test logs for evidence.

## Start locally

Two PowerShell terminals; close each with Ctrl+C to stop only this prototype. Existing Open WebUI, Ollama and calculator startup/configuration stays untouched. Dependencies currently reuse the existing checkout's node_modules through a directory junction; no package was installed.

Terminal 1:

```powershell
wsl.exe -d Ubuntu-24.04 -- /usr/bin/python3 -B /mnt/c/Users/Lewis/Documents/Codex/step18-propertyiq/scripts/local-ai/bridge.py
```

Terminal 2:

```powershell
Set-Location 'C:\Users\Lewis\Documents\Codex\step18-propertyiq'
$env:PROPERTYIQ_LOCAL_AI='1'
$env:VITE_LOCAL_AI='1'
.\node_modules\.bin\vite.cmd --configLoader runner --host 127.0.0.1
```

Open `http://127.0.0.1:5178` and expand “Local research prototype” at the bottom right. Do classification before using 4B, or wait for Ollama's ordinary idle timeout. These processes are currently running for the local demo; do not start duplicates.

Reproduce non-inference checks:

```powershell
.\node_modules\.bin\tsc.cmd -b
.\node_modules\.bin\tsc.cmd -p tsconfig.e2e.json
.\node_modules\.bin\eslint.cmd src --max-warnings 0
.\node_modules\.bin\vitest.cmd run --configLoader runner
.\node_modules\.bin\vite.cmd build --configLoader runner
.\node_modules\.bin\playwright.cmd test --project=desktop
node scripts/local-ai/browser-check.mjs --replay
wsl.exe -d Ubuntu-24.04 -- bash -lc 'cd /mnt/c/Users/Lewis/Documents/Codex/step18-propertyiq/scripts/local-ai && python3 -B -m unittest -v test_bridge'
```

`evaluate.py` refuses to overwrite the existing evaluation report. `browser-check.mjs` without `--replay` performs live inference and must start with Ollama idle; replay tests the UI using preserved live results. Browser regression snapshots were restored only in this new worktree; Step 18 screenshots remain here.

Example complete NOI input (the live test produced EGI 93,600 and NOI 62,400):

```json
{"gross_potential_rent_usd_annual":96000,"vacancy_rate":0.05,"credit_loss_rate":0,"concessions_usd_annual":0,"other_income_usd_annual":2400,"operating_expenses_usd_annual":{"expenses":31200},"management_fee_rate_of_egi":null,"management_fee_usd_annual":0}
```

## Security, limits and recommendation

The bridge binds only `127.0.0.1:8766`, checks exact Origin and Host, accepts bounded JSON POSTs, and offers no CORS headers, remote model URLs or arbitrary tools. Vite proxies it only when explicitly enabled, also loopback-only. Normal production builds omit the assistant component; Cloudflare's current static deployment cannot access these local services. No public endpoint, tunnel, firewall rule, credentials, database reset or power setting was introduced. Local processes on this Windows account remain trusted; this is not multi-user authentication or isolation.

Recommendation: retain the local experimental prototype and collect a larger permissioned document set before enabling the feature for real users. Before any public integration, separately approve an authenticated backend/private worker connection with authorization, TLS, document retention/privacy policy, request quotas, centralized GPU admission, stronger representative document evaluation and adversarial/security testing. Do not expose Ollama, Open WebUI or this bridge directly to the internet. No production infrastructure was implemented.

Accurate research description: “A local document-type suggestion prototype using my independently evaluated conversational adaptation and token-row repair of pretrained Qwen3-1.7B-Base.” Attribute Qwen; do not claim to have pretrained Qwen or demonstrated production reliability. The evidence currently shows an application of that adaptation, not a demonstrated advantage over a simple baseline.

Not checked: full PDF/OCR workflows, public-hosting security, sustained concurrent load, cold 4B loading or a broader model-quality benchmark. No further training is proposed by this prototype.
