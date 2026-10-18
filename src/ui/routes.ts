export type Route = {
  mode: "monthly" | "quick" | "home";
  project?: string;
  section?: string;
};
export function readRoute(hash = window.location.hash): Route {
  const parts = hash.replace(/^#/, "").split("/");
  try {
    if (parts[0] === "monthly")
      return {
        mode: "monthly",
        project: parts[1] ? decodeURIComponent(parts[1]) : undefined,
        section: parts[2] ?? "overview",
      };
    if (parts[0] === "quick")
      return { mode: "quick", section: parts[1] ?? "overview" };
  } catch {
    return { mode: "home" };
  }
  return { mode: "home" };
}
export function navigate(hash: string) {
  if (window.location.hash === hash) return;
  window.history.pushState(
    null,
    "",
    hash || window.location.pathname + window.location.search,
  );
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}

// Experimental document assistant (src/ai/browser): flagged builds, or the dev bridge prototype.
export const documentAssistant =
  import.meta.env.VITE_BROWSER_AI === "1" ||
  (import.meta.env.DEV && import.meta.env.VITE_LOCAL_AI === "1");
