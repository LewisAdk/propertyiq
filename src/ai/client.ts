export const labels = [
  "Rent Roll",
  "T-12",
  "Offering Memorandum",
  "Other",
  "Unknown",
] as const;
export type Label = (typeof labels)[number];
export function classification(value: unknown): Label {
  if (
    !value ||
    typeof value !== "object" ||
    !("label" in value) ||
    !("valid" in value) ||
    value.valid !== true
  )
    return "Unknown";
  return labels.includes(value.label as Label)
    ? (value.label as Label)
    : "Unknown";
}
export async function request(
  operation: "classify" | "chat" | "calculate",
  data: object,
) {
  const session = await fetch("/api/local-ai/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(10000),
  });
  if (!session.ok) throw new Error("Local AI session unavailable");
  const response = await fetch(`/api/local-ai/${operation}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    signal: AbortSignal.timeout(250000),
  });
  const body = await response.json();
  if (!response.ok)
    throw new Error(body.error ?? "Local AI unavailable; nothing applied.");
  return body;
}
