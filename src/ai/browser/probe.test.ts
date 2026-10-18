import { describe, expect, it, vi } from "vitest";
import { checkRelease, chooseDevice, type Probe } from "./probe";

const base: Probe = {
  webgpu: true,
  f16: true,
  maxBufferSize: 2 ** 30,
  maxStorageBufferBindingSize: 2 ** 30,
};

describe("chooseDevice", () => {
  it("uses WebGPU only when the adapter supports shader-f16", () => {
    expect(chooseDevice(base)).toBe("webgpu");
    expect(chooseDevice({ ...base, f16: false })).toBe("wasm");
    expect(chooseDevice({ ...base, webgpu: false, f16: false })).toBe("wasm");
  });
});

describe("checkRelease", () => {
  const verify = {
    tree: "https://huggingface.co/api/models/o/r/tree/abc/onnx",
    files: { "onnx/m.onnx_data": { sha256: "aa", size: 10 } },
  };
  const serve = (body: unknown, ok = true) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok,
        status: ok ? 200 : 404,
        json: async () => body,
      })),
    );

  it("accepts only the pinned SHA-256 and size", async () => {
    serve([{ path: "onnx/m.onnx_data", size: 10, lfs: { oid: "aa" } }]);
    await expect(checkRelease(verify)).resolves.toBeUndefined();
    serve([{ path: "onnx/m.onnx_data", size: 10, lfs: { oid: "bb" } }]);
    await expect(checkRelease(verify)).rejects.toThrow("does not match");
    serve([{ path: "onnx/m.onnx_data", size: 11, lfs: { oid: "aa" } }]);
    await expect(checkRelease(verify)).rejects.toThrow("does not match");
    serve([]);
    await expect(checkRelease(verify)).rejects.toThrow("does not match");
    serve(null, false);
    await expect(checkRelease(verify)).rejects.toThrow("HTTP 404");
  });
});
