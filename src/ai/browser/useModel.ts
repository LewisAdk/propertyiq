import { useEffect, useRef, useState } from "react";
import { CACHE, type Device, type ModelId } from "./probe";
import type { Reply, Request } from "./worker";

type Ready = {
  kind: "ready";
  model: ModelId;
  device: Device;
  ms: number;
  fromCache: boolean;
};
export type ModelState =
  | { kind: "idle" }
  | { kind: "downloading"; model: ModelId; loaded: number; total: number }
  | { kind: "preparing"; model: ModelId }
  | Ready
  | { kind: "busy"; model: ModelId; ready: Ready }
  | { kind: "error"; model: ModelId; message: string; stored: boolean };

export type Classified = {
  raw: string;
  eos: boolean;
  tokens: number;
  ms: number;
};

// One worker per page. Terminating it cancels a download; nothing partial is stored.
export function useModel() {
  const [state, setState] = useState<ModelState>({ kind: "idle" });
  const worker = useRef<Worker | null>(null);
  const pending = useRef<{
    resolve: (c: Classified) => void;
    reject: (e: Error) => void;
  } | null>(null);
  const current = useRef<ModelState>(state);
  current.current = state;

  useEffect(() => () => worker.current?.terminate(), []);

  function stop() {
    worker.current?.terminate();
    worker.current = null;
    pending.current?.reject(new Error("Stopped"));
    pending.current = null;
  }

  function start(model: ModelId) {
    stop();
    const w = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    w.onerror = () => {
      stop();
      setState({
        kind: "error",
        model,
        message: "The model runner stopped. Reload the page and try again.",
        stored: false,
      });
    };
    w.onmessage = ({ data }: MessageEvent<Reply>) => {
      if (data.type === "progress")
        setState(
          data.loaded >= data.total
            ? { kind: "preparing", model }
            : {
                kind: "downloading",
                model,
                loaded: data.loaded,
                total: data.total,
              },
        );
      else if (data.type === "ready")
        setState({
          kind: "ready",
          model,
          device: data.device,
          ms: data.ms,
          fromCache: data.fromCache,
        });
      else if (data.type === "classified") {
        const s = current.current;
        if (s.kind === "busy") setState(s.ready);
        pending.current?.resolve(data);
        pending.current = null;
      } else {
        const s = current.current;
        if (s.kind === "busy") setState(s.ready);
        else
          setState({
            kind: "error",
            model,
            message: data.message,
            stored: data.stored,
          });
        pending.current?.reject(new Error(data.message));
        pending.current = null;
      }
    };
    worker.current = w;
    return w;
  }

  return {
    state,
    load(model: ModelId, device: Device) {
      // Ask the browser not to evict stored models under storage pressure (it may still refuse).
      navigator.storage?.persist?.().catch(() => undefined);
      setState({ kind: "preparing", model });
      start(model).postMessage({
        type: "load",
        model,
        device,
      } satisfies Request);
    },
    cancel() {
      stop();
      setState({ kind: "idle" });
    },
    async remove() {
      stop();
      await caches.delete(CACHE).catch(() => undefined);
      setState({ kind: "idle" });
    },
    classify(text: string) {
      const s = current.current;
      if (s.kind !== "ready" || !worker.current)
        return Promise.reject(new Error("Load a model first"));
      setState({ kind: "busy", model: s.model, ready: s });
      return new Promise<Classified>((resolve, reject) => {
        pending.current = { resolve, reject };
        worker.current!.postMessage({
          type: "classify",
          text,
        } satisfies Request);
      });
    },
  };
}
