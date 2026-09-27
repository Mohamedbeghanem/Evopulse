/** Minimal RFC 4180 CSV reader plus .xlsx via read-excel-file. Output is always string cells. */

export type Tabular = { headers: string[]; rows: string[][]; sheet?: string };

export function parseCsv(text: string): string[][] {
  const input = text.replace(/^\uFEFF/, "");
  const firstLine = input.split(/\r?\n/, 1)[0] || "";
  const delimiter = [",", ";", "\t"].reduce(
    (best, candidate) => (firstLine.split(candidate).length > firstLine.split(best).length ? candidate : best),
    ",",
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += ch;
    }
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function cellText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  return String(value);
}

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 5000;

export async function readTabular(file: { name: string; bytes: Buffer }): Promise<Tabular> {
  if (file.bytes.length > MAX_IMPORT_BYTES) throw new Error("File is larger than 5 MB.");
  const lower = file.name.toLowerCase();
  let matrix: string[][];
  if (lower.endsWith(".xlsx")) {
    const { readSheet } = await import("read-excel-file/node");
    const data = (await readSheet(file.bytes)) as unknown[][];
    matrix = data.map((r) => r.map(cellText)).filter((r) => r.some((c) => c.trim() !== ""));
  } else if (lower.endsWith(".csv") || lower.endsWith(".txt") || lower.endsWith(".tsv") || !lower.includes(".")) {
    matrix = parseCsv(file.bytes.toString("utf8"));
  } else if (lower.endsWith(".xls")) {
    throw new Error("Legacy .xls is not supported. Save as .xlsx or .csv.");
  } else {
    throw new Error("Upload a .csv or .xlsx file.");
  }
  if (!matrix.length) throw new Error("The file is empty.");
  const [headers, ...rows] = matrix;
  if (rows.length > MAX_IMPORT_ROWS) throw new Error(`At most ${MAX_IMPORT_ROWS} rows per import.`);
  return { headers: headers.map((h) => h.trim()), rows };
}
