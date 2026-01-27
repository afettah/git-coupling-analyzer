import logging
import sys
from pathlib import Path
from typing import Optional

def setup_logging(
    log_file: Optional[Path] = None,
    level: int = logging.INFO,
    verbose: bool = False
) -> None:
    """Configures logging for the application."""
    if verbose:
        level = logging.DEBUG

    handlers: list[logging.Handler] = [
        logging.StreamHandler(sys.stdout)
    ]

    if log_file:
        log_file.parent.mkdir(parents=True, exist_ok=True)
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=handlers,
        force=True
    )

def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
