# Monorepo Viewer

Monorepo Viewer is a small desktop GUI for inspecting Git history in large local repositories.
It focuses on quickly switching between repository-wide history and root-folder-specific history,
then drilling into changed files and diffs for a selected commit.

## Features

- Open a local Git repository from the desktop app.
- View repository-wide commit history with `All`.
- Select a root-level folder to view `git log -- <folder>` style history.
- Select a commit to inspect changed files.
- Select a changed file to view only that file's diff.
- Read structured diffs with file headers, hunk headers, line numbers, and add/delete coloring.
- Resize the folder, commit, changed-file, and diff panels.

## Tech Stack

- Desktop shell: Tauri v2
- Frontend: React + TypeScript + Vite
- Native/backend layer: Rust
- Git integration: local `git` CLI
- Icons: lucide-react

For more detail, see [docs/tech-stack.md](docs/tech-stack.md).

## Development

Install dependencies:

```powershell
npm.cmd install
```

Run frontend build:

```powershell
npm.cmd run build
```

Check the Tauri/Rust backend:

```powershell
cd src-tauri
cargo check
```

Build the desktop app:

```powershell
npm.cmd run tauri -- build
```

The built executable is generated at:

```text
src-tauri/target/release/monorepo-viewer.exe
```

Windows installer bundles are generated under:

```text
src-tauri/target/release/bundle/
```

## Documentation

- [Design document](docs/design.md)
- [Technical stack](docs/tech-stack.md)

## Current Scope

This project is intentionally narrower than a full Git client. It does not aim to replace SourceTree,
GitKraken, or the Git CLI. The MVP focuses on making monorepo history easier to inspect by folder.

