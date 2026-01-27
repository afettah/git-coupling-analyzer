"""Changeset grouping strategies."""

from __future__ import annotations

import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Iterator

from lfca.config import CouplingConfig


@dataclass
class Changeset:
    """A logical changeset (one or more commits grouped)."""
    id: str
    file_ids: set[int]
    weight: float = 1.0
    timestamp: int = 0


def group_by_commit(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Each commit is its own changeset."""
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    commit_ts: dict[str, int] = {}
    
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    for commit in commits:
        commit_ts[commit["commit_oid"]] = commit["committer_ts"]
    
    for commit_oid, file_ids in commit_files.items():
        if len(file_ids) > config.max_changeset_size:
            continue
        
        yield Changeset(
            id=commit_oid,
            file_ids=file_ids,
            timestamp=commit_ts.get(commit_oid, 0)
        )


def group_by_author_time(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Group commits by same author within time window."""
    
    window_seconds = config.author_time_window_hours * 3600
    
    # Sort commits by time
    sorted_commits = sorted(commits, key=lambda c: c["committer_ts"])
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    # Group by author + time window
    current_group: Changeset | None = None
    current_author: str | None = None
    current_end_time: int = 0
    
    for commit in sorted_commits:
        author = commit["author_email"]
        ts = commit["committer_ts"]
        files = commit_files.get(commit["commit_oid"], set())
        
        if (current_group is None or 
            author != current_author or 
            ts > current_end_time):
            # Start new group
            if current_group and len(current_group.file_ids) <= config.max_logical_changeset_size:
                yield current_group
            
            current_group = Changeset(
                id=f"{author}:{ts}",
                file_ids=set(),
                timestamp=ts
            )
            current_author = author
            current_end_time = ts + window_seconds
        
        current_group.file_ids.update(files)
    
    if current_group and len(current_group.file_ids) <= config.max_logical_changeset_size:
        yield current_group


def group_by_ticket_id(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Group commits by ticket ID extracted from message."""
    
    if not config.ticket_id_pattern:
        raise ValueError("ticket_id_pattern required for by_ticket_id mode")
    
    pattern = re.compile(config.ticket_id_pattern)
    
    # Group changes by commit
    commit_files: dict[str, set[int]] = defaultdict(set)
    for change in changes:
        commit_files[change["commit_oid"]].add(change["file_id"])
    
    # Group by ticket
    ticket_files: dict[str, set[int]] = defaultdict(set)
    ticket_ts: dict[str, int] = {}
    
    for commit in commits:
        message = commit.get("message_subject", "")
        match = pattern.search(message)
        
        if match:
            ticket_id = match.group(1) if match.groups() else match.group(0)
        else:
            ticket_id = commit["commit_oid"]  # Fallback to commit
        
        files = commit_files.get(commit["commit_oid"], set())
        ticket_files[ticket_id].update(files)
        
        if ticket_id not in ticket_ts:
            ticket_ts[ticket_id] = commit["committer_ts"]
    
    for ticket_id, file_ids in ticket_files.items():
        if len(file_ids) > config.max_logical_changeset_size:
            continue
        
        yield Changeset(
            id=ticket_id,
            file_ids=file_ids,
            timestamp=ticket_ts.get(ticket_id, 0)
        )


def get_changesets(
    commits: list[dict],
    changes: list[dict],
    config: CouplingConfig
) -> Iterator[Changeset]:
    """Get changesets based on configured grouping mode."""
    
    if config.changeset_mode == "by_commit":
        yield from group_by_commit(commits, changes, config)
    elif config.changeset_mode == "by_author_time":
        yield from group_by_author_time(commits, changes, config)
    elif config.changeset_mode == "by_ticket_id":
        yield from group_by_ticket_id(commits, changes, config)
    else:
        raise ValueError(f"Unknown changeset_mode: {config.changeset_mode}")
