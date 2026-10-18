import { readTable } from "../extraction";
import type { RawTable } from "../../data/rentRoll";

export const ACCEPT = ".csv,.xlsx,.txt";
export const MAX_BYTES = 5 * 1024 * 1024; // same 5 MB limit as the import worker

export type LoadedDocument = {
  name: string;
  bytes: number;
  sha256: string;
  kind: "table" | "text";
  sheet?: string;
  raw?: RawTable;
  // What the classifiers read: the same tab-separated excerpt as the Step 18.1 bridge flow.
  text: string;
};

const hex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );

export function checkFile(file: { name: string; size: number }): string | null {
  if (!/\.(csv|xlsx|txt)$/i.test(file.name))
    return "Use a CSV, XLSX or TXT file. PDF and scanned documents are not supported.";
  if (file.size === 0) return "This file is empty.";
  if (file.size > MAX_BYTES) return "The file limit is 5 MB.";
  return null;
}

export async function readDocument(file: File): Promise<LoadedDocument> {
  const problem = checkFile(file);
  if (problem) throw new Error(problem);
  const sha256 = hex(
    await crypto.subtle.digest("SHA-256", await file.arrayBuffer()),
  );
  if (/\.txt$/i.test(file.name)) {
    const text = await file.text();
    if (!text.trim()) throw new Error("This file has no text.");
    return { name: file.name, bytes: file.size, sha256, kind: "text", text };
  }
  const parsed = await readTable(file);
  const text = [parsed.raw.headers, ...parsed.raw.rows.slice(0, 30)]
    .map((row) => row.map((v) => String(v ?? "")).join("\t"))
    .join("\n");
  return {
    name: file.name,
    bytes: file.size,
    sha256,
    kind: "table",
    sheet: parsed.sheets[0],
    raw: parsed.raw,
    text,
  };
}
