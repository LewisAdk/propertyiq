import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import {
  createReadStream,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join, normalize, sep } from "node:path";
const browserAI = process.env.VITE_BROWSER_AI === "1";
// Flagged builds only (ADR-0011): WebAssembly compilation and the public model host.
// The default build keeps public/_headers unchanged.
const relax = (text: string) =>
  browserAI
    ? text
        .replace("script-src 'self'", "script-src 'self' 'wasm-unsafe-eval'")
        .replace(
          "connect-src 'self'",
          "connect-src 'self' https://huggingface.co https://*.hf.co",
        )
    : text;
// `vite preview` sends the production headers (CSP included) from public/_headers.
const headers = Object.fromEntries(
  [
    ...relax(readFileSync("public/_headers", "utf8")).matchAll(
      /^\s+([^:]+):\s*(.+)$/gm,
    ),
  ].map((m) => [m[1], m[2].trim()]),
);
// Local prototype only: `vite preview` serves the research model export at /models/.
const modelDir = browserAI ? process.env.PIQ_RESEARCH_MODEL_DIR : undefined;
export default defineConfig({
  cacheDir: ".cache/vite",
  plugins: [
    react(),
    {
      name: "browser-ai-flag",
      enforce: "pre",
      // Without the flag, stub the module so its worker and 27 MB WASM are never emitted.
      resolveId: (id) =>
        !browserAI &&
        process.env.VITE_LOCAL_AI !== "1" &&
        id.endsWith("/ai/browser/Experiment")
          ? "\0browser-ai-off"
          : null,
      load: (id) => (id === "\0browser-ai-off" ? "export default null" : null),
      closeBundle() {
        if (!browserAI) return;
        writeFileSync(
          "dist/_headers",
          relax(readFileSync("public/_headers", "utf8")),
        );
        // A public build hosts the 26.9 MB runtime elsewhere (Pages caps files at 25 MiB).
        if (process.env.VITE_ORT_WASM_URL)
          for (const f of readdirSync("dist/assets"))
            if (f.endsWith(".wasm")) rmSync(`dist/assets/${f}`);
      },
      configurePreviewServer(server) {
        if (!modelDir) return;
        const root = normalize(modelDir);
        server.middlewares.use("/models", (req, res) => {
          try {
            const path = decodeURIComponent((req.url ?? "/").split("?")[0]);
            const file = normalize(join(root, path));
            if (!file.startsWith(root + sep)) throw new Error("outside");
            const { size } = statSync(file);
            res.setHeader("Content-Length", size);
            res.setHeader("Cache-Control", "no-store");
            res.setHeader(
              "Content-Type",
              file.endsWith(".json")
                ? "application/json"
                : "application/octet-stream",
            );
            if (req.method === "HEAD") res.end();
            else createReadStream(file).pipe(res);
          } catch {
            res.statusCode = 404;
            res.end();
          }
        });
      },
    },
  ],
  preview: { host: "127.0.0.1", headers },
  server: {
    host: "127.0.0.1",
    port: 5178,
    strictPort: true,
    proxy:
      process.env.PROPERTYIQ_LOCAL_AI === "1"
        ? {
            "/api/local-ai": {
              target: "http://127.0.0.1:8766",
              changeOrigin: true,
            },
          }
        : undefined,
  },
  worker: { format: "es" },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/finance/**/*.ts"],
      exclude: ["src/finance/**/*.test.ts"],
      reporter: ["text", "html", "json-summary"],
      thresholds: { statements: 90, lines: 90, functions: 90, branches: 80 },
    },
  },
});
