import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import {
  AlertCircle,
  Clock3,
  Code2,
  Database,
  File,
  FileCode2,
  FileCog,
  FileImage,
  FileJson,
  FileText,
  FolderGit2,
  GitCommitHorizontal,
  Info,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { DiffViewer } from "./DiffViewer";

type RepoInfo = {
  path: string;
  root: string;
  folders: RootFolder[];
};

type RootFolder = {
  name: string;
  path: string;
};

type CommitSummary = {
  hash: string;
  short_hash: string;
  subject: string;
  author_name: string;
  author_email: string;
  date: string;
};

type ChangedFile = {
  status: string;
  path: string;
  old_path?: string | null;
};

type CommitDetail = {
  files: ChangedFile[];
  diff: string;
};

type BusyState = "idle" | "repo" | "history" | "detail";
type ResizeTarget = "folders" | "commits" | "files";

const MIN_FOLDER_WIDTH = 160;
const MIN_COMMIT_WIDTH = 260;
const MIN_DETAIL_WIDTH = 360;
const MIN_FILE_HEIGHT = 120;
const MIN_DIFF_HEIGHT = 220;
const ALL_FOLDERS: RootFolder = {
  name: "All",
  path: "",
};

function App() {
  const [repoPath, setRepoPath] = useState("");
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<RootFolder | null>(null);
  const [commits, setCommits] = useState<CommitSummary[]>([]);
  const [selectedCommit, setSelectedCommit] = useState<CommitSummary | null>(null);
  const [selectedFile, setSelectedFile] = useState<ChangedFile | null>(null);
  const [detail, setDetail] = useState<CommitDetail | null>(null);
  const [diff, setDiff] = useState("");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<BusyState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isAboutOpen, setIsAboutOpen] = useState(false);
  const [folderWidth, setFolderWidth] = useState(220);
  const [commitWidth, setCommitWidth] = useState(426);
  const [fileHeight, setFileHeight] = useState(210);
  const workspaceRef = useRef<HTMLElement | null>(null);

  const filteredCommits = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return commits;
    return commits.filter((commit) =>
      [
        commit.hash,
        commit.short_hash,
        commit.subject,
        commit.author_name,
        commit.author_email,
        commit.date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [commits, query]);

  async function chooseRepository() {
    const selected = await open({ directory: true, multiple: false, title: "Gitリポジトリを選択" });
    if (typeof selected === "string") {
      setRepoPath(selected);
      await loadRepository(selected);
    }
  }

  async function loadRepository(path = repoPath) {
    const trimmed = path.trim();
    if (!trimmed) return;
    setBusy("repo");
    setError(null);
    setRepo(null);
    setSelectedFolder(null);
    setSelectedCommit(null);
    setSelectedFile(null);
    setCommits([]);
    setDetail(null);
    setDiff("");
    try {
      const nextRepo = await invoke<RepoInfo>("open_repository", { path: trimmed });
      setRepo(nextRepo);
      setRepoPath(nextRepo.root);
      setSelectedFolder(ALL_FOLDERS);
      const nextCommits = await invoke<CommitSummary[]>("get_folder_history", {
        repo: nextRepo.root,
        folder: ALL_FOLDERS.path,
        limit: 200,
      });
      setCommits(nextCommits);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function selectFolder(folder: RootFolder) {
    if (!repo) return;
    setSelectedFolder(folder);
    setSelectedCommit(null);
    setSelectedFile(null);
    setDetail(null);
    setDiff("");
    setQuery("");
    setBusy("history");
    setError(null);
    try {
      const nextCommits = await invoke<CommitSummary[]>("get_folder_history", {
        repo: repo.root,
        folder: folder.path,
        limit: 200,
      });
      setCommits(nextCommits);
    } catch (err) {
      setError(String(err));
      setCommits([]);
    } finally {
      setBusy("idle");
    }
  }

  async function selectCommit(commit: CommitSummary) {
    if (!repo || !selectedFolder) return;
    setSelectedCommit(commit);
    setSelectedFile(null);
    setDetail(null);
    setDiff("");
    setBusy("detail");
    setError(null);
    try {
      const nextDetail = await invoke<CommitDetail>("get_commit_detail", {
        repo: repo.root,
        commit: commit.hash,
        folder: selectedFolder.path,
      });
      setDetail(nextDetail);
      setDiff(nextDetail.diff);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("idle");
    }
  }

  async function selectFile(file: ChangedFile) {
    if (!repo || !selectedCommit) return;
    setSelectedFile(file);
    setBusy("detail");
    setError(null);
    try {
      const nextDiff = await invoke<string>("get_file_diff", {
        repo: repo.root,
        commit: selectedCommit.hash,
        path: file.path,
      });
      setDiff(nextDiff);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy("idle");
    }
  }

  function beginResize(target: ResizeTarget, event: React.PointerEvent<HTMLDivElement>) {
    const workspace = workspaceRef.current;
    if (!workspace) return;

    event.preventDefault();
    const bounds = workspace.getBoundingClientRect();
    const startX = event.clientX;
    const startY = event.clientY;
    const startFolderWidth = folderWidth;
    const startCommitWidth = commitWidth;
    const startFileHeight = fileHeight;

    const handleMove = (moveEvent: PointerEvent) => {
      if (target === "folders") {
        const maxWidth = bounds.width - MIN_COMMIT_WIDTH - MIN_DETAIL_WIDTH;
        setFolderWidth(clamp(startFolderWidth + moveEvent.clientX - startX, MIN_FOLDER_WIDTH, maxWidth));
      }
      if (target === "commits") {
        const maxWidth = bounds.width - folderWidth - MIN_DETAIL_WIDTH;
        setCommitWidth(clamp(startCommitWidth + moveEvent.clientX - startX, MIN_COMMIT_WIDTH, maxWidth));
      }
      if (target === "files") {
        const maxHeight = bounds.height - MIN_DIFF_HEIGHT;
        setFileHeight(clamp(startFileHeight + moveEvent.clientY - startY, MIN_FILE_HEIGHT, maxHeight));
      }
    };

    const handleUp = () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      document.body.classList.remove("is-resizing");
    };

    document.body.classList.add("is-resizing");
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <FolderGit2 size={22} />
          <div>
            <h1>Monorepo Viewer</h1>
            <p>{repo ? repo.root : "ローカルGitリポジトリを開いてください"}</p>
          </div>
        </div>
        <div className="repo-picker">
          <input
            value={repoPath}
            onChange={(event) => setRepoPath(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") void loadRepository();
            }}
            placeholder="C:\\path\\to\\repo"
          />
          <button type="button" onClick={chooseRepository}>
            参照
          </button>
          <button type="button" className="primary" onClick={() => void loadRepository()} disabled={busy === "repo"}>
            {busy === "repo" ? <Loader2 className="spin" size={16} /> : "開く"}
          </button>
          <button type="button" className="about-menu-button" onClick={() => setIsAboutOpen(true)}>
            <Info size={16} />
            <span>About</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="error-bar">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <section
        ref={workspaceRef}
        className="workspace"
        style={{
          gridTemplateColumns: `${folderWidth}px 6px ${commitWidth}px 6px minmax(${MIN_DETAIL_WIDTH}px, 1fr)`,
        }}
      >
        <aside className="folder-panel">
          <PanelTitle icon={<FolderGit2 size={17} />} title="Folders" count={repo ? repo.folders.length + 1 : 0} />
          <div className="list">
            {repo && (
              <button
                type="button"
                className={`list-row folder-row all-folder-row ${selectedFolder?.path === ALL_FOLDERS.path ? "active" : ""}`}
                onClick={() => void selectFolder(ALL_FOLDERS)}
              >
                <span>{ALL_FOLDERS.name}</span>
              </button>
            )}
            {repo?.folders.map((folder) => (
              <button
                key={folder.path}
                type="button"
                className={`list-row folder-row ${selectedFolder?.path === folder.path ? "active" : ""}`}
                onClick={() => void selectFolder(folder)}
              >
                <span>{folder.name}</span>
              </button>
            ))}
            {repo && repo.folders.length === 0 && <EmptyState text="HEADにルート直下フォルダがありません" />}
            {!repo && <EmptyState text="リポジトリ未選択" />}
          </div>
        </aside>
        <div
          className="resize-handle vertical"
          role="separator"
          aria-orientation="vertical"
          aria-label="フォルダパネルの幅を変更"
          onPointerDown={(event) => beginResize("folders", event)}
        />

        <section className="commit-panel">
          <div className="panel-title split">
            <div className="title-left">
              <GitCommitHorizontal size={17} />
              <span>Commits</span>
              <strong>{commits.length}</strong>
            </div>
            <label className="search">
              <Search size={15} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="検索" />
            </label>
          </div>
          <div className="list commit-list">
            {busy === "history" && <LoadingState text="履歴を取得中" />}
            {busy !== "history" &&
              filteredCommits.map((commit) => (
                <button
                  key={commit.hash}
                  type="button"
                  className={`list-row commit-row ${selectedCommit?.hash === commit.hash ? "active" : ""}`}
                  onClick={() => void selectCommit(commit)}
                >
                  <div className="commit-subject">{commit.subject}</div>
                  <div className="commit-meta">
                    <code>{commit.short_hash}</code>
                    <span>{commit.author_name}</span>
                    <span>{formatDate(commit.date)}</span>
                  </div>
                </button>
              ))}
            {selectedFolder && busy !== "history" && filteredCommits.length === 0 && (
              <EmptyState text="表示できるコミットがありません" />
            )}
            {!selectedFolder && <EmptyState text="フォルダを選択してください" />}
          </div>
        </section>
        <div
          className="resize-handle vertical"
          role="separator"
          aria-orientation="vertical"
          aria-label="コミットパネルの幅を変更"
          onPointerDown={(event) => beginResize("commits", event)}
        />

        <section className="detail-panel" style={{ gridTemplateRows: `${fileHeight}px 6px minmax(${MIN_DIFF_HEIGHT}px, 1fr)` }}>
          <div className="file-pane">
            <PanelTitle icon={<FileCode2 size={17} />} title="Changed Files" count={detail?.files.length ?? 0} />
            <div className="list file-list">
              {busy === "detail" && <LoadingState text="diffを取得中" />}
              {busy !== "detail" &&
                detail?.files.map((file) => (
                  <button
                    key={`${file.status}:${file.old_path ?? ""}:${file.path}`}
                    type="button"
                    className={`file-row ${selectedFile?.path === file.path ? "active" : ""}`}
                    onClick={() => void selectFile(file)}
                  >
                    <span className={`status status-${file.status[0]}`}>{file.status}</span>
                    <span className="file-type-icon" aria-hidden="true">
                      {getFileIcon(file.path)}
                    </span>
                    <span title={file.old_path ? `${file.old_path} -> ${file.path}` : file.path}>{file.path}</span>
                  </button>
                ))}
              {selectedCommit && busy !== "detail" && !detail && <EmptyState text="変更詳細を読み込めませんでした" />}
              {!selectedCommit && <EmptyState text="コミットを選択してください" />}
            </div>
          </div>
          <div
            className="resize-handle horizontal"
            role="separator"
            aria-orientation="horizontal"
            aria-label="変更ファイルパネルの高さを変更"
            onPointerDown={(event) => beginResize("files", event)}
          />
          <div className="diff-pane">
            <PanelTitle icon={<Clock3 size={17} />} title="Diff" />
            <DiffViewer diff={diff} />
          </div>
        </section>
      </section>

      {isAboutOpen && <AboutDialog onClose={() => setIsAboutOpen(false)} />}
    </main>
  );
}

function AboutDialog({ onClose }: { onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="about-dialog" role="dialog" aria-modal="true" aria-labelledby="about-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="about-header">
          <div>
            <h2 id="about-title">Monorepo Viewer</h2>
            <p>Folder-aware Git history viewer for local monorepos.</p>
          </div>
          <button type="button" className="icon-button" aria-label="Close About" onClick={onClose}>
            <X size={18} />
          </button>
        </header>

        <div className="about-body">
          <dl>
            <div>
              <dt>Version</dt>
              <dd>0.1.0</dd>
            </div>
            <div>
              <dt>Desktop</dt>
              <dd>Tauri v2</dd>
            </div>
            <div>
              <dt>Frontend</dt>
              <dd>React, TypeScript, Vite</dd>
            </div>
            <div>
              <dt>Git</dt>
              <dd>Local git CLI</dd>
            </div>
            <div>
              <dt>Repository</dt>
              <dd>https://github.com/tikomosoftware/MonorepoViewer</dd>
            </div>
          </dl>
          <p>
            This app focuses on repository-wide and root-folder-scoped commit history, changed files, and readable diffs.
          </p>
        </div>
      </section>
    </div>
  );
}

function PanelTitle({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="panel-title">
      <div className="title-left">
        {icon}
        <span>{title}</span>
        {typeof count === "number" && <strong>{count}</strong>}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div className="empty-state">{text}</div>;
}

function LoadingState({ text }: { text: string }) {
  return (
    <div className="loading-state">
      <Loader2 className="spin" size={18} />
      <span>{text}</span>
    </div>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, Math.max(min, max)));
}

function getFileIcon(path: string) {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";
  const fileName = path.split(/[\\/]/).pop()?.toLowerCase() ?? "";

  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "ico", "svg"].includes(extension)) {
    return <FileImage size={15} />;
  }
  if (["json", "jsonc", "lock"].includes(extension) || fileName === "package-lock.json") {
    return <FileJson size={15} />;
  }
  if (["ts", "tsx", "js", "jsx", "rs", "cs", "kt", "swift", "dart", "java", "py", "go", "cpp", "c", "h"].includes(extension)) {
    return <Code2 size={15} />;
  }
  if (["html", "css", "scss", "xaml", "xml", "vue", "svelte"].includes(extension)) {
    return <FileCode2 size={15} />;
  }
  if (["md", "txt", "log", "csv", "tsv"].includes(extension)) {
    return <FileText size={15} />;
  }
  if (["sql", "db", "sqlite"].includes(extension)) {
    return <Database size={15} />;
  }
  if (["toml", "yaml", "yml", "ini", "config", "conf"].includes(extension) || fileName.startsWith(".")) {
    return <FileCog size={15} />;
  }
  return <File size={15} />;
}

export default App;
