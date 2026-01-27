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
