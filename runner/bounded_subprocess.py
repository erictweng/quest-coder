"""Subprocess helpers that bound stdout/stderr while the child is running."""
from __future__ import annotations

import subprocess
import threading
import time
from dataclasses import dataclass
from typing import Mapping, Sequence


class OutputLimitExceeded(Exception):
    def __init__(self, stream: str):
        super().__init__(f"{stream} exceeded its output limit")
        self.stream = stream


@dataclass(frozen=True)
class BoundedCompletedProcess:
    returncode: int
    stdout: bytes
    stderr: bytes


def run_bounded(
    args: Sequence[str],
    *,
    input_bytes: bytes,
    timeout: float,
    stdout_limit: int,
    stderr_limit: int,
    cwd: str | None = None,
    env: Mapping[str, str] | None = None,
) -> BoundedCompletedProcess:
    """Run a child and kill it immediately when either output stream exceeds its cap."""
    proc = subprocess.Popen(
        list(args),
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        cwd=cwd,
        env=dict(env) if env is not None else None,
    )
    assert proc.stdin is not None and proc.stdout is not None and proc.stderr is not None
    chunks: dict[str, list[bytes]] = {"stdout": [], "stderr": []}
    totals = {"stdout": 0, "stderr": 0}
    limits = {"stdout": stdout_limit, "stderr": stderr_limit}
    exceeded: list[str] = []
    lock = threading.Lock()

    def reader(name: str, stream) -> None:
        while True:
            chunk = stream.read(16 * 1024)
            if not chunk:
                return
            with lock:
                totals[name] += len(chunk)
                if totals[name] > limits[name]:
                    exceeded.append(name)
                    proc.kill()
                    return
                chunks[name].append(chunk)

    threads = [
        threading.Thread(target=reader, args=("stdout", proc.stdout), daemon=True),
        threading.Thread(target=reader, args=("stderr", proc.stderr), daemon=True),
    ]
    for thread in threads:
        thread.start()

    try:
        proc.stdin.write(input_bytes)
        proc.stdin.close()
        deadline = time.monotonic() + timeout
        while proc.poll() is None:
            if exceeded:
                proc.kill()
                break
            if time.monotonic() >= deadline:
                proc.kill()
                raise subprocess.TimeoutExpired(args, timeout)
            time.sleep(0.005)
        proc.wait()
    finally:
        if proc.poll() is None:
            proc.kill()
            proc.wait()
        try:
            proc.stdin.close()
        except OSError:
            pass
        for thread in threads:
            thread.join(timeout=1)
        proc.stdout.close()
        proc.stderr.close()

    if exceeded:
        raise OutputLimitExceeded(exceeded[0])
    return BoundedCompletedProcess(proc.returncode, b"".join(chunks["stdout"]), b"".join(chunks["stderr"]))
