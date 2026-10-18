import { useEffect, useState } from "react";
import { Cpu, HardDrive, ShieldCheck } from "lucide-react";
import {
  MODELS,
  chooseDevice,
  isStored,
  probe,
  researchAvailable,
  type Device,
  type ModelId,
  type Probe,
} from "./probe";
import type { useModel } from "./useModel";

const mb = (bytes = 0) =>
  bytes >= 1e9
    ? `${(bytes / 1e9).toFixed(2)} GB`
    : `${Math.round(bytes / 1e6).toLocaleString()} MB`;

// Measured results only (docs/step18-1, docs/step18-2). Keep in sync with FINAL.md.
const TESTED: Record<ModelId, string[]> = {
  generic: [
    "Runtime test only. Not evaluated on property documents.",
    "Type suggestion on the test PC (RTX 2080 SUPER): 0.3 s on WebGPU, about 12 s on the processor.",
  ],
  research: [
    "Frozen 12-case test at full precision: 6/12 correct, keyword rules 7/12. Public examples 5/8, the same as keyword rules.",
    "Followed instructions planted in the document text in 2 of 2 injection tests.",
    "This int8 browser build gave the same label as full precision on 12/12 cases, in this browser on WebGPU (about 0.3 s each after a 27 s load).",
    "Needs WebGPU: on the processor the browser runs out of WebAssembly memory.",
  ],
};

export default function ResearchLab({
  model,
}: {
  model: ReturnType<typeof useModel>;
}) {
  const [info, setInfo] = useState<Probe | null>(null);
  const [which, setWhich] = useState<ModelId>("generic");
  // null until the user picks; then their choice wins over the device check.
  const [picked, setDevice] = useState<Device | null>(null);
  const [available, setAvailable] = useState<Record<ModelId, boolean>>({
    generic: true,
    research: false,
  });
  const [stored, setStored] = useState<Record<ModelId, boolean>>({
    generic: false,
    research: false,
  });
  const [consent, setConsent] = useState(false);
  const s = model.state;

  useEffect(() => {
    void probe().then((p) => {
      setInfo(p);
    });
    void researchAvailable().then((ok) =>
      setAvailable({ generic: true, research: ok }),
    );
  }, []);
  useEffect(() => {
    if (s.kind === "idle" || s.kind === "ready" || s.kind === "error")
      void Promise.all([isStored("generic"), isStored("research")]).then(
        ([g, r]) => setStored({ generic: g, research: r }),
      );
  }, [s.kind]);

  const busy =
    s.kind === "downloading" || s.kind === "preparing" || s.kind === "busy";
  const needsDownload = !stored[which];
  const device = picked ?? (info ? chooseDevice(info) : "wasm");
  const gpuMissing = MODELS[which].webgpuOnly && device !== "webgpu";
  const canLoad =
    available[which] && !busy && !gpuMissing && (!needsDownload || consent);
  const status =
    s.kind === "idle"
      ? "No model loaded. Keyword rules work without one."
      : s.kind === "downloading"
        ? `Downloading ${MODELS[s.model].title}: ${mb(s.loaded)} of ${mb(s.total)}`
        : s.kind === "preparing"
          ? `Preparing ${MODELS[s.model].title}…`
          : s.kind === "ready"
            ? `Ready: ${MODELS[s.model].title} on ${s.device === "webgpu" ? "WebGPU" : "the processor (WASM)"}, loaded in ${(s.ms / 1000).toFixed(1)} s${s.fromCache ? " from browser storage" : ""}`
            : s.kind === "busy"
              ? `Working: ${MODELS[s.model].title}`
              : `Could not load ${MODELS[s.model].title}: ${s.message}`;

  return (
    <section
      id="research-lab"
      className="dr-lab"
      aria-labelledby="dr-lab-title"
    >
      <h2 id="dr-lab-title">
        Research Lab{" "}
        <span className="dr-chip" data-tone="muted">
          Optional · experimental
        </span>
      </h2>
      <p className="dr-lede">
        An on-device model can offer a second opinion on the document type. It
        is never required, it never approves figures, and it runs here, in this
        browser. Nothing downloads until you choose to. Every financial figure
        is calculated by deterministic code from inputs you approve, never by a
        model.
      </p>

      <fieldset className="dr-models">
        <legend>Model</legend>
        {(Object.keys(MODELS) as ModelId[]).map((id) => (
          <label
            key={id}
            className="dr-model"
            data-checked={which === id || undefined}
            data-unavailable={!available[id] || undefined}
          >
            <input
              type="radio"
              name="dr-model"
              checked={which === id}
              disabled={busy || !available[id]}
              onChange={() => {
                setWhich(id);
                if (
                  MODELS[id].webgpuOnly &&
                  info &&
                  chooseDevice(info) === "webgpu"
                )
                  setDevice("webgpu");
              }}
            />
            <span className="dr-model-body">
              <strong>{MODELS[id].title}</strong>
              <span
                className="dr-chip"
                data-tone={id === "research" ? "info" : "muted"}
              >
                {id === "research"
                  ? "PropertyIQ research model"
                  : "Generic public model"}
              </span>
              <span className="dr-note">{MODELS[id].identity}</span>
              <span className="dr-meta">
                <HardDrive size={14} aria-hidden="true" />{" "}
                {mb(MODELS[id].bytes)} from {MODELS[id].hostLabel}
                {stored[id] && " · stored in this browser"}
                {!available[id] && " · not available on this server"}
              </span>
              <ul className="dr-list">
                {TESTED[id].map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </span>
          </label>
        ))}
      </fieldset>

      <div className="dr-device">
        <h3>
          <Cpu size={16} aria-hidden="true" /> This device
        </h3>
        {info ? (
          <dl className="dr-summary">
            <div>
              <dt>WebGPU</dt>
              <dd>
                {info.webgpu
                  ? info.f16
                    ? "Yes, with 16-bit shaders"
                    : "Yes, without 16-bit shaders"
                  : "Not available"}
              </dd>
            </div>
            {info.webgpu && (
              <div>
                <dt>Largest GPU buffer</dt>
                <dd>{mb(info.maxBufferSize)}</dd>
              </div>
            )}
            {info.deviceMemoryGiB && (
              <div>
                <dt>Device memory</dt>
                <dd>{info.deviceMemoryGiB} GB or more</dd>
              </div>
            )}
            {info.quotaBytes && (
              <div>
                <dt>Browser storage</dt>
                <dd>
                  {mb(info.usageBytes)} used of {mb(info.quotaBytes)}
                  {info.persisted ? " · protected from eviction" : ""}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="dr-note">Checking…</p>
        )}
        <p className="dr-note">
          WebGPU with 16-bit shaders is fastest. Without it, the processor runs
          the generic model, which takes about 12 seconds per document. The 1.7B
          research model needs WebGPU and used about 1.8 GB of graphics memory
          in testing; it is not kept in browser storage.
        </p>
        <label className="dr-inline">
          Run on{" "}
          <select
            value={device}
            disabled={busy}
            onChange={(e) => setDevice(e.target.value as Device)}
          >
            <option
              value="webgpu"
              disabled={!info || chooseDevice(info) !== "webgpu"}
            >
              WebGPU (graphics card)
            </option>
            <option value="wasm" disabled={MODELS[which].webgpuOnly}>
              Processor (WASM)
            </option>
          </select>
        </label>
        {gpuMissing && (
          <p className="dr-note" role="status">
            The research model needs WebGPU with 16-bit shaders. On the
            processor its 2.1 GB of weights exceed the browser&rsquo;s
            WebAssembly memory (tested). On this device, use the generic model
            or the keyword rules.
          </p>
        )}
      </div>

      {needsDownload && available[which] && (
        <label className="dr-approve">
          <input
            type="checkbox"
            checked={consent}
            disabled={busy}
            onChange={(e) => setConsent(e.target.checked)}
          />
          <span>
            {MODELS[which].store
              ? `Download ${mb(MODELS[which].bytes)} from ${MODELS[which].hostLabel} and store it in this browser. You can remove it at any time.`
              : `Transfer ${mb(MODELS[which].bytes)} from ${MODELS[which].hostLabel} into memory. It is not stored, so every load transfers it again.`}
          </span>
        </label>
      )}
      <div className="dr-actions">
        <button
          type="button"
          className="button primary"
          disabled={!canLoad}
          onClick={() => model.load(which, device)}
        >
          {needsDownload && MODELS[which].store
            ? "Download and load"
            : "Load model"}
        </button>
        {(s.kind === "downloading" || s.kind === "preparing") && (
          <button type="button" className="button small" onClick={model.cancel}>
            Cancel
          </button>
        )}
        <button
          type="button"
          className="button small"
          disabled={busy || (!stored.generic && !stored.research)}
          onClick={() => void model.remove()}
        >
          Remove stored models
        </button>
      </div>
      <div
        className="dr-status"
        role="status"
        aria-live="polite"
        data-testid="lab-status"
      >
        {status}
      </div>
      {s.kind === "downloading" && (
        <progress max={s.total} value={s.loaded} aria-label="Model download">
          {Math.floor((s.loaded / s.total) * 100)}%
        </progress>
      )}
      {s.kind === "error" && (
        <p className="dr-alert dr-error" role="alert">
          {s.stored
            ? "The stored copy may be damaged or was partly removed by the browser. Remove stored models, then download again."
            : "Try again, or run it on the other device. Keyword rules still work without a model."}
        </p>
      )}
      <p className="dr-local">
        <ShieldCheck size={15} aria-hidden="true" /> Document text goes only to
        the model running on this page. No document data is sent over the
        network.
      </p>
    </section>
  );
}
