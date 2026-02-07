from __future__ import annotations

import re
import subprocess
from dataclasses import dataclass, field
from enum import Enum, auto
from pathlib import Path
from typing import Iterable, Iterator, List


_COMMIT_MARKER = "__CI_COMMIT__"
_HEX40_RE = re.compile(r"^[0-9a-f]{40}$")
_VALID_STATUS_RE = re.compile(r"^([AMDTUXB]|[RC]\d{2,3})$")


class ParseState(Enum):
    """State machine states for deterministic git log parsing."""
    EXPECT_COMMIT_OR_STATUS = auto()  # After header or change, expect next commit or status
    EXPECT_PATH = auto()              # After A/M/D status, expect file path
    EXPECT_OLD_PATH = auto()          # After R/C status, expect old path
    EXPECT_NEW_PATH = auto()          # After old path in rename, expect new path


@dataclass
class ValidationIssue:
    """Record of a validation issue during parsing."""
    commit_oid: str | None
    issue_type: str
    severity: str  # 'warning' | 'error'
    token_value: str | None
    expected_value: str | None
    message: str
    # Extended context for debugging
    author: str | None = None
    committed_at: int | None = None
    subject: str | None = None
    cursor_position: int | None = None


@dataclass
class ParseContext:
    """Mutable context for the state machine parser."""
    state: ParseState = ParseState.EXPECT_COMMIT_OR_STATUS
    cursor: int = 0
    pending_status: str | None = None
    pending_old_path: str | None = None


def _is_valid_git_status(token: str) -> bool:
    """Check if token is a valid git status code."""
    return bool(_VALID_STATUS_RE.match(token))


def _is_valid_path(path: str, strict: bool = True) -> bool:
    """Reject obviously invalid file paths.
    
    Args:
        path: The path to validate
        strict: If True, apply stricter validation rules
    """
    if not path or len(path) < 2:
        return False
    # Single letters are status codes, not files
    if len(path) == 1:
        return False
    # Rename similarity codes (R100, R091, etc.)
    if re.match(r'^[RC]\d{2,3}$', path):
        return False
    # Git commit hashes
    if re.match(r'^[0-9a-f]{40}$', path):
        return False
    # Unix timestamps
    if re.match(r'^\d{9,10}$', path):
        return False
    # Email addresses (no slash, has @)
    if '@' in path and '/' not in path:
        return False
    # Internal markers
    if path.startswith('__LFCA_'):
        return False
    
    if strict:
        # In strict mode, short paths without / or . are suspicious
        if len(path) <= 3 and path.isalpha():
            return False
        if not ('/' in path or '.' in path) and len(path) < 10:
            return False
    
    return True


def _create_issue(
    issue_type: str,
    token: str | None,
    expected: str,
    message: str,
    header: "CommitHeader | None" = None,
    cursor: int | None = None,
    severity: str = "warning"
) -> ValidationIssue:
    """Factory for creating validation issues with commit context."""
    return ValidationIssue(
        commit_oid=header.commit_oid if header else None,
        issue_type=issue_type,
        severity=severity,
        token_value=token,
        expected_value=expected,
        message=message,
        author=header.author_name if header else None,
        committed_at=header.committer_ts if header else None,
        subject=header.subject if header else None,
        cursor_position=cursor,
    )


@dataclass
class CommitHeader:
    commit_oid: str
    parents: List[str]
    author_name: str
    author_email: str
    authored_ts: int
    committer_ts: int
    subject: str
    validation_issues: List[ValidationIssue] = field(default_factory=list)


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
    all_refs: bool = False,
    validation_mode: str = "soft",  # strict | soft | permissive
) -> Iterable[tuple[CommitHeader, list[tuple[str, str, str | None]]]]:
    """Parse git log with deterministic state machine.
    
    Args:
        repo_path: Path to git repository
        since: Only commits after this date
        until: Only commits before this date
        ref: Git reference to start from
        all_refs: If True, include all branches
        validation_mode: How to handle validation errors
            - "strict": Raise exception on invalid data
            - "soft": Log and skip invalid tokens (default)
            - "permissive": Accept questionable data with warning
    
    Yields:
        Tuples of (CommitHeader, list of changes)
    """
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
    
    # State machine context
    ctx = ParseContext()
    current_header: CommitHeader | None = None
    current_changes: list[tuple[str, str, str | None]] = []
    validation_issues: list[ValidationIssue] = []
    strict_path_check = validation_mode != "permissive"

    def record_issue(issue: ValidationIssue) -> None:
        """Record validation issue, raise if strict mode."""
        validation_issues.append(issue)
        if validation_mode == "strict" and issue.severity == "error":
            raise ValueError(f"Validation error: {issue.message}")
    
    def reset_state() -> None:
        """Reset state machine to expect next status or commit."""
        ctx.state = ParseState.EXPECT_COMMIT_OR_STATUS
        ctx.pending_status = None
        ctx.pending_old_path = None

    try:
        for token in tokens:
            ctx.cursor += 1
            
            if not token:
                continue
                
            # Handle commit marker - always resets state
            if token == _COMMIT_MARKER:
                # Yield previous commit if exists
                if current_header is not None:
                    # Check for incomplete state (missing paths)
                    if ctx.state != ParseState.EXPECT_COMMIT_OR_STATUS:
                        record_issue(_create_issue(
                            "incomplete_change",
                            ctx.pending_status,
                            "complete status+path sequence",
                            f"Commit ended with incomplete change: status={ctx.pending_status}",
                            current_header,
                            ctx.cursor,
                        ))
                    current_header.validation_issues = validation_issues
                    yield current_header, current_changes
                    current_changes = []
                    validation_issues = []
                
                # Parse commit header
                commit_oid = next(tokens, "")
                ctx.cursor += 1
                parents_raw = next(tokens, "")
                ctx.cursor += 1
                author_name = next(tokens, "")
                ctx.cursor += 1
                author_email = next(tokens, "")
                ctx.cursor += 1
                authored_ts = int(next(tokens, "0") or 0)
                ctx.cursor += 1
                committer_ts = int(next(tokens, "0") or 0)
                ctx.cursor += 1
                subject = next(tokens, "")
                ctx.cursor += 1
                
                parents = parents_raw.split() if parents_raw else []
                
                if not _HEX40_RE.match(commit_oid):
                    issue = _create_issue(
                        "invalid_commit_oid",
                        commit_oid,
                        "40-character hex commit hash",
                        f"Invalid commit OID: {commit_oid!r}",
                        severity="error",
                        cursor=ctx.cursor,
                    )
                    record_issue(issue)
                    reset_state()
                    continue
                
                current_header = CommitHeader(
                    commit_oid=commit_oid,
                    parents=parents,
                    author_name=author_name,
                    author_email=author_email,
                    authored_ts=authored_ts,
                    committer_ts=committer_ts,
                    subject=subject,
                )
                reset_state()
                continue

            if current_header is None:
                continue

            token = token.strip()
            if not token:
                continue
            
            # State machine transitions
            if ctx.state == ParseState.EXPECT_COMMIT_OR_STATUS:
                # Expect a valid git status code
                if not _is_valid_git_status(token):
                    record_issue(_create_issue(
                        "invalid_status",
                        token,
                        "A|M|D|T|U|X|B|R###|C###",
                        f"Invalid git status code: {token!r}",
                        current_header,
                        ctx.cursor,
                    ))
                    # Stay in same state, try to resync on next token
                    continue
                
                ctx.pending_status = token
                
                # Determine next state based on status type
                if token.startswith("R") or token.startswith("C"):
                    ctx.state = ParseState.EXPECT_OLD_PATH
                else:
                    ctx.state = ParseState.EXPECT_PATH
            
            elif ctx.state == ParseState.EXPECT_PATH:
                # Expect a valid file path after A/M/D status
                if not _is_valid_path(token, strict=strict_path_check):
                    record_issue(_create_issue(
                        "invalid_path",
                        token,
                        "valid file path",
                        f"Invalid file path after {ctx.pending_status}: {token!r}",
                        current_header,
                        ctx.cursor,
                    ))
                    # Resync: if this looks like a status, process it as such
                    if _is_valid_git_status(token):
                        ctx.pending_status = token
                        if token.startswith("R") or token.startswith("C"):
                            ctx.state = ParseState.EXPECT_OLD_PATH
                        else:
                            ctx.state = ParseState.EXPECT_PATH
                    else:
                        reset_state()
                    continue
                
                # Valid path - record change
                current_changes.append((ctx.pending_status, token, None))
                reset_state()
            
            elif ctx.state == ParseState.EXPECT_OLD_PATH:
                # Expect old path in rename/copy
                if not _is_valid_path(token, strict=strict_path_check):
                    record_issue(_create_issue(
                        "invalid_path",
                        token,
                        "valid old path for rename",
                        f"Invalid old path after {ctx.pending_status}: {token!r}",
                        current_header,
                        ctx.cursor,
                    ))
                    # Resync
                    if _is_valid_git_status(token):
                        ctx.pending_status = token
                        if token.startswith("R") or token.startswith("C"):
                            ctx.state = ParseState.EXPECT_OLD_PATH
                        else:
                            ctx.state = ParseState.EXPECT_PATH
                    else:
                        reset_state()
                    continue
                
                ctx.pending_old_path = token
                ctx.state = ParseState.EXPECT_NEW_PATH
            
            elif ctx.state == ParseState.EXPECT_NEW_PATH:
                # Expect new path in rename/copy
                if not _is_valid_path(token, strict=strict_path_check):
                    record_issue(_create_issue(
                        "invalid_path",
                        token,
                        "valid new path for rename",
                        f"Invalid new path after {ctx.pending_old_path}: {token!r}",
                        current_header,
                        ctx.cursor,
                    ))
                    # Resync
                    if _is_valid_git_status(token):
                        ctx.pending_status = token
                        if token.startswith("R") or token.startswith("C"):
                            ctx.state = ParseState.EXPECT_OLD_PATH
                        else:
                            ctx.state = ParseState.EXPECT_PATH
                    else:
                        reset_state()
                    continue
                
                # Valid rename - record change with both paths
                current_changes.append((ctx.pending_status, token, ctx.pending_old_path))
                reset_state()

        # Yield final commit
        if current_header is not None:
            if ctx.state != ParseState.EXPECT_COMMIT_OR_STATUS:
                record_issue(_create_issue(
                    "incomplete_change",
                    ctx.pending_status,
                    "complete status+path sequence",
                    f"Log ended with incomplete change: status={ctx.pending_status}",
                    current_header,
                    ctx.cursor,
                ))
            current_header.validation_issues = validation_issues
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
