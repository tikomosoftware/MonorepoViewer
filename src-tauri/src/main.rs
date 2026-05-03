use serde::Serialize;
use std::path::Path;
use std::process::Command;

#[derive(Serialize)]
struct RepoInfo {
    path: String,
    root: String,
    folders: Vec<RootFolder>,
}

#[derive(Serialize)]
struct RootFolder {
    name: String,
    path: String,
}

#[derive(Serialize)]
struct CommitSummary {
    hash: String,
    short_hash: String,
    subject: String,
    author_name: String,
    author_email: String,
    date: String,
}

#[derive(Serialize)]
struct ChangedFile {
    status: String,
    path: String,
    old_path: Option<String>,
}

#[derive(Serialize)]
struct CommitDetail {
    files: Vec<ChangedFile>,
    diff: String,
}

fn run_git(repo: &str, args: &[&str]) -> Result<String, String> {
    let output = Command::new("git")
        .arg("-C")
        .arg(repo)
        .args(args)
        .output()
        .map_err(|err| format!("git を実行できませんでした: {err}"))?;

    if output.status.success() {
        String::from_utf8(output.stdout).map_err(|err| format!("git 出力をUTF-8として読めませんでした: {err}"))
    } else {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if stderr.is_empty() {
            "git コマンドが失敗しました".to_string()
        } else {
            stderr
        })
    }
}

fn ensure_relative_path(path: &str) -> Result<(), String> {
    let candidate = Path::new(path);
    if path.trim().is_empty() || candidate.is_absolute() || path.contains("..") {
        Err("リポジトリ内の相対パスだけを指定できます".to_string())
    } else {
        Ok(())
    }
}

fn ensure_optional_relative_path(path: &str) -> Result<(), String> {
    if path.trim().is_empty() {
        Ok(())
    } else {
        ensure_relative_path(path)
    }
}

#[tauri::command]
fn open_repository(path: String) -> Result<RepoInfo, String> {
    let root = run_git(&path, &["rev-parse", "--show-toplevel"])?
        .trim()
        .to_string();
    let folder_output = run_git(&root, &["ls-tree", "-d", "--name-only", "HEAD"])?;
    let folders = folder_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .map(|line| RootFolder {
            name: line.to_string(),
            path: line.to_string(),
        })
        .collect();

    Ok(RepoInfo { path, root, folders })
}

#[tauri::command]
fn get_folder_history(repo: String, folder: String, limit: Option<u32>) -> Result<Vec<CommitSummary>, String> {
    ensure_optional_relative_path(&folder)?;
    let limit_arg = format!("-n{}", limit.unwrap_or(200).min(1000));
    let output = if folder.trim().is_empty() {
        run_git(
            &repo,
            &[
                "log",
                &limit_arg,
                "--date=iso-strict",
                "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e",
            ],
        )?
    } else {
        run_git(
            &repo,
            &[
                "log",
                &limit_arg,
                "--date=iso-strict",
                "--pretty=format:%H%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e",
                "--",
                &folder,
            ],
        )?
    };

    let commits = output
        .split('\x1e')
        .filter_map(|record| {
            let trimmed = record.trim_matches(['\r', '\n']);
            if trimmed.is_empty() {
                return None;
            }
            let mut parts = trimmed.split('\x1f');
            Some(CommitSummary {
                hash: parts.next()?.to_string(),
                short_hash: parts.next()?.to_string(),
                author_name: parts.next()?.to_string(),
                author_email: parts.next()?.to_string(),
                date: parts.next()?.to_string(),
                subject: parts.collect::<Vec<_>>().join("\x1f"),
            })
        })
        .collect();

    Ok(commits)
}

#[tauri::command]
fn get_commit_detail(repo: String, commit: String, folder: String) -> Result<CommitDetail, String> {
    ensure_optional_relative_path(&folder)?;
    if commit.trim().is_empty() {
        return Err("コミットが指定されていません".to_string());
    }

    let file_output = if folder.trim().is_empty() {
        run_git(&repo, &["show", "--name-status", "--format=", &commit])?
    } else {
        run_git(&repo, &["show", "--name-status", "--format=", &commit, "--", &folder])?
    };
    let files = file_output
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(parse_name_status)
        .collect();

    let mut diff = if folder.trim().is_empty() {
        run_git(&repo, &["show", "--format=", "--find-renames", &commit])?
    } else {
        run_git(&repo, &["show", "--format=", "--find-renames", &commit, "--", &folder])?
    };
    const MAX_DIFF_BYTES: usize = 500_000;
    if diff.len() > MAX_DIFF_BYTES {
        diff.truncate(MAX_DIFF_BYTES);
        diff.push_str("\n\n[diff が大きいため、ここで省略しました]\n");
    }

    Ok(CommitDetail { files, diff })
}

#[tauri::command]
fn get_file_diff(repo: String, commit: String, path: String) -> Result<String, String> {
    ensure_relative_path(&path)?;
    if commit.trim().is_empty() {
        return Err("コミットが指定されていません".to_string());
    }

    let mut diff = run_git(&repo, &["show", "--format=", "--find-renames", &commit, "--", &path])?;
    const MAX_DIFF_BYTES: usize = 500_000;
    if diff.len() > MAX_DIFF_BYTES {
        diff.truncate(MAX_DIFF_BYTES);
        diff.push_str("\n\n[diff が大きいため、ここで省略しました]\n");
    }

    Ok(diff)
}

fn parse_name_status(line: &str) -> Option<ChangedFile> {
    let columns: Vec<&str> = line.split('\t').collect();
    let status = columns.first()?.to_string();
    if status.starts_with('R') || status.starts_with('C') {
        Some(ChangedFile {
            status,
            old_path: columns.get(1).map(|value| value.to_string()),
            path: columns.get(2)?.to_string(),
        })
    } else {
        Some(ChangedFile {
            status,
            path: columns.get(1)?.to_string(),
            old_path: None,
        })
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            open_repository,
            get_folder_history,
            get_commit_detail,
            get_file_diff
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

fn main() {
    run();
}
