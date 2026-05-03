export type DiffLineKind = "context" | "add" | "delete" | "meta";

export type DiffLine = {
  kind: DiffLineKind;
  oldNumber: number | null;
  newNumber: number | null;
  content: string;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DiffFile = {
  header: string;
  hunks: DiffHunk[];
  meta: string[];
};

type HunkPosition = {
  oldLine: number;
  newLine: number;
};

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

export function parseUnifiedDiff(diff: string): DiffFile[] {
  const files: DiffFile[] = [];
  let currentFile: DiffFile | null = null;
  let currentHunk: DiffHunk | null = null;
  let position: HunkPosition | null = null;

  for (const rawLine of diff.split(/\r?\n/)) {
    if (rawLine.startsWith("diff --git ")) {
      currentFile = { header: rawLine, hunks: [], meta: [] };
      files.push(currentFile);
      currentHunk = null;
      position = null;
      continue;
    }

    if (!currentFile) {
      if (rawLine.trim()) {
        currentFile = { header: "Diff", hunks: [], meta: [rawLine] };
        files.push(currentFile);
      }
      continue;
    }

    const hunkMatch = rawLine.match(HUNK_HEADER);
    if (hunkMatch) {
      currentHunk = { header: rawLine, lines: [] };
      currentFile.hunks.push(currentHunk);
      position = {
        oldLine: Number(hunkMatch[1]),
        newLine: Number(hunkMatch[2]),
      };
      continue;
    }

    if (!currentHunk || !position) {
      if (rawLine.trim()) {
        currentFile.meta.push(rawLine);
      }
      continue;
    }

    if (rawLine.startsWith("+")) {
      currentHunk.lines.push({
        kind: "add",
        oldNumber: null,
        newNumber: position.newLine,
        content: rawLine.slice(1),
      });
      position.newLine += 1;
      continue;
    }

    if (rawLine.startsWith("-")) {
      currentHunk.lines.push({
        kind: "delete",
        oldNumber: position.oldLine,
        newNumber: null,
        content: rawLine.slice(1),
      });
      position.oldLine += 1;
      continue;
    }

    if (rawLine.startsWith("\\")) {
      currentHunk.lines.push({
        kind: "meta",
        oldNumber: null,
        newNumber: null,
        content: rawLine,
      });
      continue;
    }

    currentHunk.lines.push({
      kind: "context",
      oldNumber: position.oldLine,
      newNumber: position.newLine,
      content: rawLine.startsWith(" ") ? rawLine.slice(1) : rawLine,
    });
    position.oldLine += 1;
    position.newLine += 1;
  }

  return files;
}
