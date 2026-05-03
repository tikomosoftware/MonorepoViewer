import { useMemo } from "react";
import { parseUnifiedDiff, type DiffFile, type DiffLine } from "./diffParser";

export function DiffViewer({ diff }: { diff: string }) {
  const files = useMemo(() => parseUnifiedDiff(diff), [diff]);

  if (!diff.trim()) {
    return <div className="diff-empty">diffがありません</div>;
  }

  if (files.length === 0) {
    return <pre className="diff-plain">{diff}</pre>;
  }

  return (
    <div className="diff-view">
      {files.map((file, fileIndex) => (
        <DiffFileBlock key={`${file.header}:${fileIndex}`} file={file} />
      ))}
    </div>
  );
}

function DiffFileBlock({ file }: { file: DiffFile }) {
  const fileName = formatFileName(file.header);

  return (
    <section className="diff-file">
      <div className="diff-file-header">{fileName}</div>
      {file.meta.length > 0 && (
        <div className="diff-meta">
          {file.meta.map((line, index) => (
            <div key={`${line}:${index}`}>{line}</div>
          ))}
        </div>
      )}
      {file.hunks.map((hunk, index) => (
        <div className="diff-hunk" key={`${hunk.header}:${index}`}>
          <div className="diff-hunk-header">
            <span>Hunk {index + 1}</span>
            <code>{hunk.header}</code>
          </div>
          <div className="diff-lines">
            {hunk.lines.map((line, lineIndex) => (
              <DiffLineRow key={`${line.oldNumber ?? ""}:${line.newNumber ?? ""}:${lineIndex}`} line={line} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function DiffLineRow({ line }: { line: DiffLine }) {
  const marker = line.kind === "add" ? "+" : line.kind === "delete" ? "-" : line.kind === "meta" ? "\\" : " ";

  return (
    <div className={`diff-line diff-line-${line.kind}`}>
      <span className="diff-line-number">{line.oldNumber ?? ""}</span>
      <span className="diff-line-number">{line.newNumber ?? ""}</span>
      <span className="diff-line-marker">{marker}</span>
      <code className="diff-line-content">{line.content || " "}</code>
    </div>
  );
}

function formatFileName(header: string) {
  const match = header.match(/^diff --git a\/(.+?) b\/(.+)$/);
  if (!match) return header;
  return match[1] === match[2] ? match[2] : `${match[1]} -> ${match[2]}`;
}
