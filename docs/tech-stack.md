# Technical Stack

## Overview

Monorepo Viewer is built as a Tauri desktop application with a React frontend and a Rust backend layer.
Git operations are performed by invoking the local `git` executable.

## Runtime Stack

| Area | Technology | Reason |
| --- | --- | --- |
| Desktop shell | Tauri v2 | Small native desktop wrapper with good local filesystem/process integration. |
| Frontend | React | Component-based UI for panes, lists, modals, and diff rendering. |
| Language | TypeScript | Safer UI state and DTO handling. |
| Build tool | Vite | Fast dev/build pipeline for the React frontend. |
| Backend/native commands | Rust | Tauri command layer and safe process execution. |
| Git integration | Git CLI | Matches user expectations and local Git behavior. |
| Icons | lucide-react | Lightweight consistent icon set. |

## Project Structure

```text
.
├── docs/
│   ├── design.md
│   └── tech-stack.md
├── src/
│   ├── App.tsx
│   ├── DiffViewer.tsx
│   ├── diffParser.ts
│   ├── main.tsx
│   └── styles.css
├── src-tauri/
│   ├── capabilities/
│   ├── icons/
│   ├── src/main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── package-lock.json
├── tsconfig.json
└── vite.config.ts
```

## Frontend Responsibilities

- Repository path input and folder picker.
- Folder and `All` selection.
- Commit list rendering and filtering.
- Changed file list rendering.
- File type icon selection.
- Resizable panel state.
- Structured diff rendering.
- About dialog.

## Rust/Tauri Responsibilities

- Validate a repository path.
- Resolve the Git repository root.
- Enumerate root folders.
- Fetch repository-wide or folder-scoped history.
- Fetch commit details.
- Fetch file-specific diffs.
- Enforce basic path safety for repository-relative pathspecs.

## Important Commands

Frontend build:

```powershell
npm.cmd run build
```

Tauri backend check:

```powershell
cd src-tauri
cargo check
```

Desktop build:

```powershell
npm.cmd run tauri -- build
```

## Dependency Notes

Use `npm.cmd` on Windows PowerShell if the local execution policy blocks `npm.ps1`.

The Tauri/Rust build requires a recent Rust stable toolchain. The current project has been verified with a Rust stable toolchain new enough for Tauri v2 dependencies.

