from __future__ import annotations

import subprocess
from pathlib import Path

from code_intel.config import RepoPaths


def mirror_repo(repo_path: Path, paths: RepoPaths) -> None:
    paths.ensure_dirs()
    if paths.mirror_path.exists():
        subprocess.run(
            [
                "git",
                "-C",
                str(paths.mirror_path),
                "fetch",
                "--prune",
                "--tags",
            ],
            check=True,
        )
        return

    subprocess.run(
        [
            "git",
            "clone",
            "--mirror",
            str(repo_path),
            str(paths.mirror_path),
        ],
        check=True,
    )
