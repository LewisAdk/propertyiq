import { defineConfig, devices } from "@playwright/test";
// Step 18.2 document review + on-device model tests. Build first:
//   $env:VITE_BROWSER_AI='1'; pnpm build
// runtime.spec.ts downloads/loads models; set PIQ_RESEARCH_MODEL_DIR to serve the research export.
export default defineConfig({
  testDir: "./e2e-browser-ai",
  workers: 1,
  timeout: 60000,
  reporter: [["list"]],
  use: { reducedMotion: "reduce", screenshot: "only-on-failure" },
  projects: [
    {
      name: "desktop",
      testMatch: "workflow.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      testMatch: "workflow.spec.ts",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true,
      },
    },
    { name: "runtime", testMatch: "runtime.spec.ts" },
  ],
  webServer: {
    command: "pnpm exec vite preview --port 4198 --strictPort",
    url: "http://127.0.0.1:4198",
    reuseExistingServer: false,
    env: { VITE_BROWSER_AI: "1" },
  },
});
