# Design Document

## Purpose

Monorepo Viewer is a focused Git history viewer for local monorepos. Its main job is to answer:

- What changed in this repository?
- What changed under this root folder?
- Which files changed in this commit?
- What is the diff for this commit or file?

It deliberately avoids becoming a full Git client. Commit creation, branch management, merge tools,
stash management, and remote operations are outside the MVP scope.

## User Workflow

1. Open a local Git repository.
2. Review the repository-wide history from `All`.
3. Optionally select a root-level folder to narrow the history.
4. Select a commit.
5. Inspect changed files.
6. Select a file to view its file-specific diff.

## UI Layout

The application uses a three-column layout:

```text
Folders | Commits | Changed Files / Diff
```

The right column is split vertically:

```text
Changed Files
-------------
Diff
```

Panel sizes are resizable so users can adapt the workspace to long paths, long commit messages, or large diffs.

## Data Flow

```text
React UI
  -> Tauri invoke()
  -> Rust command
  -> git CLI
  -> parsed DTO
  -> React state
```

The frontend does not call Git directly. All Git access goes through Tauri commands implemented in Rust.

## Git Commands

Repository validation:

```bash
git -C <repo> rev-parse --show-toplevel
```

Root folders:

```bash
git -C <repo> ls-tree -d --name-only HEAD
```

Repository-wide history:

```bash
git -C <repo> log -n200 --date=iso-strict --pretty=format:<record-format>
```

Folder history:

```bash
git -C <repo> log -n200 --date=iso-strict --pretty=format:<record-format> -- <folder>
```

Commit details:

```bash
git -C <repo> show --name-status --format= <commit>
git -C <repo> show --format= --find-renames <commit>
```

Folder-scoped commit details add the pathspec:

```bash
git -C <repo> show --name-status --format= <commit> -- <folder>
git -C <repo> show --format= --find-renames <commit> -- <folder>
```

File diff:

```bash
git -C <repo> show --format= --find-renames <commit> -- <file>
```

## Core Types

```ts
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
```

## Diff Rendering

Git unified diff text is parsed into a simple view model:

- file blocks
- file metadata
- hunks
- line rows
- old/new line numbers
- add/delete/context/meta line kinds

The renderer intentionally keeps parsing conservative. If the diff format is not recognized, the app can still fall back to plain text rendering.

## Security and Safety

- Git commands are executed through `std::process::Command`, not shell string concatenation.
- Repository paths and pathspecs are passed as arguments.
- File/folder pathspecs must be relative and cannot contain `..`.
- Diff output is truncated after a fixed byte limit to avoid freezing on very large diffs.

## MVP Boundaries

Included:

- repository-wide history
- root-folder history
- commit detail
- changed file list
- commit diff
- file diff
- resizable panes
- structured diff display

Not included yet:

- branch selector
- uncommitted changes
- submodule support
- rename-following history for folders
- author/date filters
- paging beyond the current log limit
- syntax highlighting inside diff lines

## Future Ideas

- Persist the last opened repository.
- Persist panel sizes.
- Add branch selection.
- Add date and author filters.
- Add commit graph indicators.
- Add copy hash/path actions.
- Add a safer large-diff preview mode.

