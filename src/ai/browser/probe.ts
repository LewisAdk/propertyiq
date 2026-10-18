export type Device = "webgpu" | "wasm";
export type ModelId = "generic" | "research";
export const CACHE = "transformers-cache"; // transformers.js Cache Storage default

export type ModelInfo = {
  title: string;
  identity: string;
  repo: string;
  // Host + path template, as transformers.js remoteHost / remotePathTemplate.
  host: () => string;
  path: string;
  hostLabel: string;
  bytes: number;
  // Files too large for the library's buffered cache.put; streamed into Cache Storage.
  stream: string[];
  // false: never written to browser storage (the local prototype keeps C: above its disk reserve).
  store: boolean;
  dtype: "q4f16" | "int8";
  // 2.1 GB of weights exceed the browser WASM heap (measured: std::bad_alloc).
  webgpuOnly: boolean;
  // Qwen3 instruct models think first unless the turn opens with an empty think block.
  assistantPrefix: string;
  // Pinned release: Hugging Face file listing for the pinned commit, and the SHA-256
  // and size each streamed file must have there. Checked before any download.
  verify?: {
    tree: string;
    files: Record<string, { sha256: string; size: number }>;
  };
};

// Public builds set VITE_RESEARCH_MODEL_URL to a Hugging Face URL pinned to a commit:
// https://huggingface.co/<owner>/<repo>/resolve/<40-hex commit>/. Anything else is ignored.
const pinned =
  /^https:\/\/huggingface\.co\/([\w.-]+\/[\w.-]+)\/resolve\/([0-9a-f]{40})\/$/.exec(
    (import.meta.env.VITE_RESEARCH_MODEL_URL as string | undefined) ?? "",
  );
const researchUrl = pinned?.[0];
const GENERIC_REVISION = "58ca03a5e7b354b480b1a82b34bde8dc7b854cc0";

export const MODELS: Record<ModelId, ModelInfo> = {
  generic: {
    title: "Generic Qwen3-0.6B",
    identity:
      "Public onnx-community/Qwen3-0.6B-ONNX (q4f16). Not PropertyIQ's model.",
    repo: "onnx-community/Qwen3-0.6B-ONNX",
    host: () => "https://huggingface.co/",
    path: `{model}/resolve/${GENERIC_REVISION}/`,
    hostLabel: "huggingface.co",
    bytes: 578_918_290,
    stream: ["onnx/model_q4f16.onnx"],
    store: true,
    dtype: "q4f16",
    webgpuOnly: false,
    assistantPrefix: "<think>\n\n</think>\n\n",
    verify: {
      tree: `https://huggingface.co/api/models/onnx-community/Qwen3-0.6B-ONNX/tree/${GENERIC_REVISION}/onnx`,
      files: {
        "onnx/model_q4f16.onnx": {
          sha256:
            "9e33a5911974174761d0dfdcc0bec975d9c45af0eae5e9eb647b8ba9442a8f91",
          size: 569_789_750,
        },
      },
    },
  },
  research: {
    title: "PropertyIQ research Qwen3-1.7B",
    identity:
      "Adapted from Alibaba's pretrained Qwen3-1.7B-Base (@ea980cb0), not trained from scratch: a 752-step LoRA fine-tune plus a 4-row end-of-answer repair, merged. int8 layers; the tied embedding, including the repaired rows, is exact FP16.",
    repo: "piq-qwen3-1.7b-repaired",
    // Public build: VITE_RESEARCH_MODEL_URL = pinned static base URL (ends with /).
    // Otherwise the local prototype serves it at /models/ and nothing is stored.
    host: () => researchUrl ?? `${self.location.origin}/models/`,
    path: researchUrl ? "" : "{model}/",
    hostLabel: researchUrl
      ? new URL(researchUrl).host
      : "this site (local prototype)",
    bytes: 2_140_077_945,
    stream: researchUrl ? ["onnx/model_int8.onnx_data"] : [],
    store: !!researchUrl,
    dtype: "int8",
    webgpuOnly: true,
    assistantPrefix: "",
    verify: pinned
      ? {
          tree: `https://huggingface.co/api/models/${pinned[1]}/tree/${pinned[2]}/onnx`,
          files: {
            // docs/step18-2/stage2-fidelity.json (serve_manifest)
            "onnx/model_int8.onnx_data": {
              sha256:
                "2a2613a83c5f0607e76079e2902b72082b8577a1eeaa953796a8c83c966d313d",
              size: 2_128_347_136,
            },
          },
        }
      : undefined,
  },
};

export type Probe = {
  webgpu: boolean;
  f16: boolean;
  maxBufferSize: number;
  maxStorageBufferBindingSize: number;
  deviceMemoryGiB?: number;
  quotaBytes?: number;
  usageBytes?: number;
  persisted?: boolean;
};

// q4f16 weights need shader-f16 on WebGPU; anything else runs on the WASM (CPU) backend.
export const chooseDevice = (p: Probe): Device =>
  p.webgpu && p.f16 ? "webgpu" : "wasm";

type GPUAdapterLike = {
  features: { has(name: string): boolean };
  limits: { maxBufferSize: number; maxStorageBufferBindingSize: number };
};

export async function probe(): Promise<Probe> {
  const gpu = (
    navigator as {
      gpu?: { requestAdapter(): Promise<GPUAdapterLike | null> };
    }
  ).gpu;
  const adapter = await gpu?.requestAdapter().catch(() => null);
  const estimate = await navigator.storage?.estimate().catch(() => undefined);
  return {
    webgpu: !!adapter,
    f16: !!adapter?.features.has("shader-f16"),
    maxBufferSize: adapter?.limits.maxBufferSize ?? 0,
    maxStorageBufferBindingSize:
      adapter?.limits.maxStorageBufferBindingSize ?? 0,
    deviceMemoryGiB: (navigator as { deviceMemory?: number }).deviceMemory,
    quotaBytes: estimate?.quota,
    usageBytes: estimate?.usage,
    persisted: await navigator.storage?.persisted?.().catch(() => undefined),
  };
}

export const weightUrl = (id: ModelId, file: string) =>
  `${MODELS[id].host()}${MODELS[id].path.replace("{model}", MODELS[id].repo)}${file}`;

// Whether this model's weights are already stored in this browser.
export async function isStored(id: ModelId) {
  try {
    const cache = await caches.open(CACHE);
    if (!MODELS[id].stream.length) return false;
    const hits = await Promise.all(
      MODELS[id].stream.map((f) => cache.match(weightUrl(id, f))),
    );
    return hits.every(Boolean);
  } catch {
    return false;
  }
}

// The research model exists only where a local server provides it.
export async function researchAvailable() {
  // A pinned public release is known to exist; asking would contact the host before consent.
  if (researchUrl) return true;
  try {
    const r = await fetch(weightUrl("research", "config.json"), {
      method: "HEAD",
      cache: "no-store",
    });
    return r.ok;
  } catch {
    return false;
  }
}

// The pinned commit's file listing must report the exact SHA-256 and size compiled
// into this app. A wrong repository, revision or file is refused before downloading.
export async function checkRelease(verify: NonNullable<ModelInfo["verify"]>) {
  const response = await fetch(verify.tree, { cache: "no-store" });
  if (!response.ok)
    throw new Error(
      `Could not check the model release: HTTP ${response.status}`,
    );
  const listing = (await response.json()) as {
    path: string;
    size: number;
    lfs?: { oid: string };
  }[];
  for (const [path, want] of Object.entries(verify.files)) {
    const got = listing.find((f) => f.path === path);
    if (got?.lfs?.oid !== want.sha256 || got.size !== want.size)
      throw new Error(
        `Model file ${path} does not match the pinned release; nothing was downloaded.`,
      );
  }
}

// The 26.9 MB ONNX Runtime file may be hosted with the pinned release (Pages caps
// files at 25 MiB). It is only accepted from that release, at the pinned SHA-256.
const ortUrl = import.meta.env.VITE_ORT_WASM_URL as string | undefined;
export const RUNTIME_FILE = "runtime/ort-wasm-simd-threaded.asyncify.wasm";
export const runtime = {
  url: ortUrl,
  verify:
    ortUrl && pinned && ortUrl === `${researchUrl}${RUNTIME_FILE}`
      ? {
          tree: `https://huggingface.co/api/models/${pinned[1]}/tree/${pinned[2]}/runtime`,
          files: {
            [RUNTIME_FILE]: {
              sha256:
                "49871f5a4409519797e127440868a6d1923339d9185907f301a5b2a1d90af082",
              size: 26_861_777,
            },
          },
        }
      : undefined,
};
