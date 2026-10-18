import {
  AutoModelForCausalLM,
  AutoTokenizer,
  env,
  type PreTrainedModel,
  type PreTrainedTokenizer,
  type Tensor,
} from "@huggingface/transformers";
import wasm from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.wasm?url";
import mjs from "onnxruntime-web/ort-wasm-simd-threaded.asyncify.mjs?url";
import {
  CACHE,
  MODELS,
  checkRelease,
  runtime,
  weightUrl,
  type Device,
  type ModelId,
} from "./probe";
import { EOS_IDS, classificationPrompt, excerpt } from "../classify";

env.allowLocalModels = false;
// The WASM cache imports the runtime from a blob: URL, which script-src 'self' forbids.
env.useWasmCache = false;
// Self-hosted runtime, or (public build) the pinned copy in the model release.
env.backends.onnx.wasm!.wasmPaths = { wasm: runtime.url || wasm, mjs };

export type Request =
  | { type: "load"; model: ModelId; device: Device }
  | { type: "classify"; text: string };
export type Reply =
  | { type: "progress"; loaded: number; total: number }
  | {
      type: "ready";
      model: ModelId;
      device: Device;
      ms: number;
      fromCache: boolean;
    }
  | {
      type: "classified";
      raw: string;
      eos: boolean;
      tokens: number;
      ms: number;
    }
  | { type: "error"; message: string; stored: boolean };

const post = (reply: Reply) => postMessage(reply);
let loaded: {
  id: ModelId;
  tokenizer: PreTrainedTokenizer;
  model: PreTrainedModel;
} | null = null;

// transformers.js buffers each file and then calls cache.put; Chromium rejects that for
// large weights ('Unexpected internal error'). Stream them in under the key the library
// looks up (its remote URL). A cancelled or failed stream stores nothing.
async function cacheWeights(
  id: ModelId,
  onBytes: (n: number, total: number) => void,
) {
  const cache = await caches.open(CACHE);
  const { verify } = MODELS[id];
  let stored = true;
  let checked = false;
  for (const file of MODELS[id].stream) {
    const url = weightUrl(id, file);
    if (await cache.match(url)) continue;
    stored = false;
    const expected = verify?.files[file];
    if (verify && !checked) {
      await checkRelease(verify);
      checked = true;
    }
    // Abort if no bytes arrive for 60 s; a cancelled or failed stream stores nothing.
    const stall = new AbortController();
    let timer = setTimeout(() => stall.abort(), 60_000);
    const response = await fetch(url, { signal: stall.signal });
    if (!response.ok || !response.body)
      throw new Error(`Model download failed: HTTP ${response.status}`);
    const total =
      expected?.size ||
      Number(response.headers.get("content-length")) ||
      MODELS[id].bytes;
    let n = 0;
    const counted = response.body.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, out) {
          clearTimeout(timer);
          timer = setTimeout(() => stall.abort(), 60_000);
          n += chunk.byteLength;
          onBytes(n, total);
          out.enqueue(chunk);
        },
      }),
    );
    try {
      await cache.put(
        url,
        new Response(counted, { headers: response.headers }),
      );
    } finally {
      clearTimeout(timer);
    }
    if (expected && n !== expected.size) {
      await cache.delete(url);
      throw new Error(
        `Model download was incomplete (${n} of ${expected.size} bytes); nothing was kept.`,
      );
    }
  }
  return stored;
}

// At most ~5 progress messages a second, so a 1.4 GB download does not flood the UI.
function throttled() {
  let last = 0;
  return (n: number, total: number) => {
    const now = performance.now();
    if (now - last < 200 && n < total) return;
    last = now;
    post({ type: "progress", loaded: n, total });
  };
}

// Public build: the 26.9 MB runtime lives in the pinned release. Its CDN URLs are signed
// and expire, so the HTTP cache cannot keep it; store it in Cache Storage after checking
// the release listing, and hand ONNX Runtime the bytes directly.
async function loadRuntime() {
  if (!runtime.url || !runtime.verify)
    throw new Error("The model runtime is not from the pinned release");
  const want = Object.values(runtime.verify.files)[0];
  const cache = await caches.open(CACHE);
  let response = await cache.match(runtime.url);
  if (!response) {
    await checkRelease(runtime.verify);
    const fresh = await fetch(runtime.url);
    if (!fresh.ok)
      throw new Error(`Runtime download failed: HTTP ${fresh.status}`);
    await cache.put(runtime.url, fresh.clone());
    response = fresh;
  }
  const bytes = await response.arrayBuffer();
  if (bytes.byteLength !== want.size) {
    await cache.delete(runtime.url);
    throw new Error("The model runtime download was incomplete; try again.");
  }
  env.backends.onnx.wasm!.wasmBinary = bytes;
}

self.onmessage = async ({ data }: MessageEvent<Request>) => {
  const start = performance.now();
  let stored = false;
  try {
    if (data.type === "load") {
      await loaded?.model.dispose();
      loaded = null;
      const info = MODELS[data.model];
      env.remoteHost = info.host();
      env.remotePathTemplate = info.path; // commit pinned in the path (4.3.1 drops `revision` while listing files)
      env.useBrowserCache = info.store;
      const progress = throttled();
      if (runtime.url) await loadRuntime();
      stored = info.store && (await cacheWeights(data.model, progress));
      const tokenizer = await AutoTokenizer.from_pretrained(info.repo);
      const model = await AutoModelForCausalLM.from_pretrained(info.repo, {
        dtype: info.dtype,
        progress_callback: info.store
          ? undefined
          : (p: {
              status: string;
              loaded?: number;
              total?: number;
              file?: string;
            }) => {
              if (p.status === "progress" && p.file?.endsWith("_data"))
                progress(p.loaded ?? 0, p.total ?? 0);
            },
        device: data.device,
      });
      loaded = { id: data.model, tokenizer, model };
      post({
        type: "ready",
        model: data.model,
        device: data.device,
        ms: performance.now() - start,
        fromCache: stored,
      });
    } else {
      if (!loaded) throw new Error("Load a model first");
      const { tokenizer, model, id } = loaded;
      const prompt =
        classificationPrompt(excerpt(data.text)) + MODELS[id].assistantPrefix;
      const inputs = tokenizer(prompt, { add_special_tokens: false });
      const prompted = (inputs.input_ids as Tensor).dims[1];
      if (prompted > 1800)
        throw new Error("Excerpt exceeds the model's context budget");
      const output = (await model.generate({
        ...inputs,
        max_new_tokens: 24,
        do_sample: false,
        repetition_penalty: 1.0,
        eos_token_id: EOS_IDS,
      })) as Tensor;
      const ids = (output.tolist() as bigint[][])[0]
        .slice(prompted)
        .map(Number);
      const eos = ids.length > 0 && EOS_IDS.includes(ids.at(-1)!);
      post({
        type: "classified",
        raw: tokenizer.decode(eos ? ids.slice(0, -1) : ids, {
          skip_special_tokens: false,
        }),
        eos,
        tokens: ids.length,
        ms: performance.now() - start,
      });
    }
  } catch (e) {
    post({
      type: "error",
      message: e instanceof Error ? e.message : String(e),
      stored,
    });
  }
};
