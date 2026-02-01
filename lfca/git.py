from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Iterator, List


_COMMIT_MARKER = "__LFCA_COMMIT__"
_HEX40_RE = re.compile(r"^[0-9a-f]{40}$")


@dataclass(frozen=True)
class CommitHeader:
    commit_oid: str
    parents: List[str]
    author_name: str
    author_email: str
    authored_ts: int
    committer_ts: int
    subject: str


def _token_stream(proc: subprocess.Popen[bytes], chunk_size: int = 1 << 20) -> Iterator[str]:
    buffer = b""
    while True:
        chunk = proc.stdout.read(chunk_size)
        if not chunk:
            break
        buffer += chunk
        while b"\0" in buffer:
            token, buffer = buffer.split(b"\0", 1)
            yield token.decode("utf-8", errors="replace")
    if buffer:
        yield buffer.decode("utf-8", errors="replace")


def iter_log(
    repo_path: Path,
    since: str | None = None,
    until: str | None = None,
    ref: str = "HEAD",
    all_refs: bool = False
) -> Iterable[tuple[CommitHeader, list[tuple[str, str, str | None]]]]:
    args = [
        "git",
        "-C",
        str(repo_path),
        "log",
        "--name-status",
        "--find-renames=60%",
        "--date-order",
        "-z",
    ]
    if since:
        args.append(f"--since={since}")
    if until:
        args.append(f"--until={until}")

    if all_refs:
        args.append("--all")
    else:
        args.append(ref)

    pretty = "%x00".join(
        [
            _COMMIT_MARKER,
            "%H",
            "%P",
            "%an",
            "%ae",
            "%at",
            "%ct",
            "%s",
        ]
    )
    args.append(f"--pretty=format:{pretty}")

    proc = subprocess.Popen(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if not proc.stdout:
        raise RuntimeError("Failed to open git log output stream.")

    tokens = _token_stream(proc)
    current_header: CommitHeader | None = None
    current_changes: list[tuple[str, str, str | None]] = []

    try:
        for token in tokens:
            if not token:
                continue
            if token == _COMMIT_MARKER:
                if current_header is not None:
                    yield current_header, current_changes
                    current_changes = []
                commit_oid = next(tokens, "")
                parents_raw = next(tokens, "")
                author_name = next(tokens, "")
                author_email = next(tokens, "")
                authored_ts = int(next(tokens, "0") or 0)
                committer_ts = int(next(tokens, "0") or 0)
                subject = next(tokens, "")
                parents = parents_raw.split() if parents_raw else []
                if not _HEX40_RE.match(commit_oid):
                    raise RuntimeError(f"Unexpected commit oid token: {commit_oid}")
                current_header = CommitHeader(
                    commit_oid=commit_oid,
                    parents=parents,
                    author_name=author_name,
                    author_email=author_email,
                    authored_ts=authored_ts,
                    committer_ts=committer_ts,
                    subject=subject,
                )
                continue

            if current_header is None:
                continue

            status = token.strip()
            if not status:
                continue
            if status.startswith("R") or status.startswith("C"):
                old_path = next(tokens, "")
                new_path = next(tokens, "")
                current_changes.append((status, new_path, old_path))
            else:
                path = next(tokens, "")
                current_changes.append((status, path, None))

        if current_header is not None:
            yield current_header, current_changes
    finally:
        proc.stdout.close()
        proc.wait()


def count_commits(repo_path: Path, since: str | None = None, until: str | None = None) -> int:
    args = ["git", "-C", str(repo_path), "rev-list", "--count", "HEAD"]
    if since:
        args.append(f"--since={since}")
    if until:
        args.append(f"--until={until}")
    output = subprocess.check_output(args, stderr=subprocess.STDOUT)
    return int(output.decode("utf-8").strip() or 0)


def get_head_oid(repo_path: Path) -> str:
    """Get current HEAD commit OID."""
    result = subprocess.run(
        ["git", "-C", str(repo_path), "rev-parse", "HEAD"],
        capture_output=True, text=True, check=True
    )
    return result.stdout.strip()


@dataclass(frozen=True)
class GitRemoteInfo:
    """Information about the git remote."""
    remote_url: str | None
    web_url: str | None
    provider: str | None  # github, gitlab, azure_devops, bitbucket
    default_branch: str


def get_remote_url(repo_path: Path, remote: str = "origin") -> str | None:
    """Get the remote URL for a repository."""
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_path), "remote", "get-url", remote],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except Exception:
        pass
    return None


def get_default_branch(repo_path: Path, remote: str = "origin") -> str:
    """Get the default branch name."""
    # Try to get from remote HEAD
    try:
        result = subprocess.run(
            ["git", "-C", str(repo_path), "symbolic-ref", f"refs/remotes/{remote}/HEAD"],
            capture_output=True, text=True
        )
        if result.returncode == 0:
            ref = result.stdout.strip()
            # refs/remotes/origin/main -> main
            if ref.startswith(f"refs/remotes/{remote}/"):
                return ref.split("/")[-1]
    except Exception:
        pass
    
    # Try common defaults
    for branch in ["main", "master", "develop"]:
        try:
            result = subprocess.run(
                ["git", "-C", str(repo_path), "rev-parse", "--verify", f"refs/heads/{branch}"],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                return branch
        except Exception:
            pass
    
    return "main"


def detect_git_provider(remote_url: str) -> str | None:
    """Detect the git hosting provider from the remote URL."""
    if not remote_url:
        return None
    
    url_lower = remote_url.lower()
    
    if "github.com" in url_lower:
        return "github"
    elif "gitlab.com" in url_lower or "gitlab." in url_lower:
        return "gitlab"
    elif "dev.azure.com" in url_lower or "visualstudio.com" in url_lower:
        return "azure_devops"
    elif "bitbucket.org" in url_lower or "bitbucket." in url_lower:
        return "bitbucket"
    
    return None


def transform_to_web_url(remote_url: str) -> str | None:
    """Transform a git remote URL to a web URL."""
    if not remote_url:
        return None
    
    url = remote_url.strip()
    
    # SSH format: git@github.com:org/repo.git
    ssh_match = re.match(r'^git@([^:]+):(.+?)(?:\.git)?$', url)
    if ssh_match:
        host, path = ssh_match.groups()
        
        # Azure DevOps SSH: git@ssh.dev.azure.com:v3/org/project/repo
        azure_ssh = re.match(r'^ssh\.dev\.azure\.com$', host)
        if azure_ssh:
            parts = path.lstrip('/').split('/')
            if len(parts) >= 4 and parts[0] == 'v3':
                org, project, repo = parts[1], parts[2], parts[3]
                return f"https://dev.azure.com/{org}/{project}/_git/{repo}"
        
        return f"https://{host}/{path}"
    
    # HTTPS format: https://github.com/org/repo.git
    https_match = re.match(r'^https?://([^/]+)/(.+?)(?:\.git)?$', url)
    if https_match:
        host, path = https_match.groups()
        
        # Azure DevOps HTTPS: https://org@dev.azure.com/org/project/_git/repo
        azure_https = re.match(r'^([^@]+)@dev\.azure\.com$', host)
        if azure_https:
            # Return clean URL without auth
            org_match = re.match(r'^([^/]+)/([^/]+)/_git/(.+)$', path)
            if org_match:
                org, project, repo = org_match.groups()
                return f"https://dev.azure.com/{org}/{project}/_git/{repo}"
        
        return f"https://{host}/{path}"
    
    return None


def get_git_remote_info(repo_path: Path, remote: str = "origin") -> GitRemoteInfo:
    """Get comprehensive git remote information."""
    remote_url = get_remote_url(repo_path, remote)
    web_url = transform_to_web_url(remote_url) if remote_url else None
    provider = detect_git_provider(remote_url) if remote_url else None
    default_branch = get_default_branch(repo_path, remote)
    
    return GitRemoteInfo(
        remote_url=remote_url,
        web_url=web_url,
        provider=provider,
        default_branch=default_branch
    )
