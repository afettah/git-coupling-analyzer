
import io
import subprocess
from pathlib import Path
from lfca.git import _token_stream, CommitHeader, _COMMIT_MARKER, _HEX40_RE
import re

# Mocking the stream to simulate the problematic Git output
class MockProc:
    def __init__(self, data):
        self.stdout = io.BytesIO(data)
    def wait(self):
        pass

def test_parsing():
    # Constructing a mock output with the problematic newline and null bytes
    # __LFCA_COMMIT__\0<hash>\0<parents>\0<author>\0<email>\0<at>\0<ct>\0<subject>\0\n\0M\0file.txt\0
    
    commit_oid = "a" * 40
    data = (
        _COMMIT_MARKER.encode() + b"\0" +
        commit_oid.encode() + b"\0" +
        b"parent_oid\0" +
        b"Author Name\0" +
        b"author@email.com\0" +
        b"1234567890\0" +
        b"1234567890\0" +
        b"Subject\0" +
        b"\n\0" +  # The problematic newline followed by null
        b"M\0" +
        b"path/to/file.txt\0" +
        _COMMIT_MARKER.encode() + b"\0" +
        commit_oid.encode() + b"\x00"
    )

    proc = MockProc(data)
    tokens = _token_stream(proc)
    
    current_header = None
    current_changes = []
    
    results = []
    
    for token in tokens:
        if not token:
            continue
        if token == _COMMIT_MARKER:
            if current_header is not None:
                results.append((current_header, current_changes))
                current_changes = []
            commit_oid_token = next(tokens, "")
            parents_raw = next(tokens, "")
            author_name = next(tokens, "")
            author_email = next(tokens, "")
            authored_ts = int(next(tokens, "0") or 0)
            committer_ts = int(next(tokens, "0") or 0)
            subject = next(tokens, "")
            parents = parents_raw.split() if parents_raw else []
            current_header = CommitHeader(
                commit_oid=commit_oid_token,
                parents=parents,
                author_name=author_name,
                author_email=author_email,
                authored_ts=authored_ts,
                committer_ts=committer_ts,
                subject=subject,
            )
            continue

        status = token.strip()
        if not status:
            continue
        
        path = next(tokens, "")
        current_changes.append((status, path, None))

    if current_header is not None:
        results.append((current_header, current_changes))

    print(f"Results length: {len(results)}")
    for i, (h, c) in enumerate(results):
        print(f"Result {i}: {h.commit_oid}, changes: {len(c)}")

    assert len(results) >= 1
    header, changes = results[0]
    assert header.commit_oid == "a" * 40
    assert len(changes) == 1
    assert changes[0][0] == "M"
    assert changes[0][1] == "path/to/file.txt"
    print("Test passed!")

if __name__ == "__main__":
    test_parsing()
