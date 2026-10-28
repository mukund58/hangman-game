"""
Zero-dependency & pytest-compatible test runner for the Hangman Python project.
Runs `pytest -v` if pytest is installed in the current environment; otherwise
provides a lightweight pytest shim and executes all test functions in `tests/`.
"""

from __future__ import annotations

from contextlib import contextmanager
import inspect
from pathlib import Path
import re
import sys
import tempfile
import time
from typing import Any, Callable, Iterator, List, Sequence, Tuple


class _PytestShim:
    """Minimal compatibility shim for `pytest.raises` and `pytest.mark.parametrize`."""

    class mark:
        @staticmethod
        def parametrize(argnames: str, argvalues: Sequence[Any]) -> Callable[[Callable[..., Any]], Callable[..., Any]]:
            def decorator(fn: Callable[..., Any]) -> Callable[..., Any]:
                setattr(fn, "_parametrize", (argnames, list(argvalues)))
                return fn

            return decorator

    @staticmethod
    @contextmanager
    def raises(expected_exc: type[BaseException], match: str | None = None) -> Iterator[None]:
        try:
            yield
        except expected_exc as exc:
            if match and not re.search(match, str(exc)):
                raise AssertionError(
                    f"Exception {exc!r} did not match pattern {match!r}"
                ) from exc
            return
        raise AssertionError(f"Expected exception {expected_exc.__name__} was not raised.")


def run_all_tests() -> Tuple[bool, List[dict[str, Any]]]:
    """Executes all test modules in `tests/` and returns (all_passed, results)."""
    root = Path(__file__).resolve().parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))

    try:
        import pytest as _real_pytest  # noqa: F401
    except ImportError:
        sys.modules["pytest"] = _PytestShim()  # type: ignore[assignment]

    import tests.test_logic as test_logic
    import tests.test_networking as test_networking
    import tests.test_scoring as test_scoring

    modules = [
        ("tests/test_logic.py", test_logic),
        ("tests/test_scoring.py", test_scoring),
        ("tests/test_networking.py", test_networking),
    ]

    results: List[dict[str, Any]] = []
    all_passed = True

    for mod_label, mod in modules:
        for name, obj in inspect.getmembers(mod, inspect.isfunction):
            if not name.startswith("test_"):
                continue

            start = time.perf_counter()
            try:
                param_info = getattr(obj, "_parametrize", None)
                sig = inspect.signature(obj)
                if param_info:
                    _, values = param_info
                    for val in values:
                        obj(val)
                elif "tmp_path" in sig.parameters:
                    with tempfile.TemporaryDirectory() as tmp_dir:
                        obj(Path(tmp_dir))
                else:
                    obj()
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                results.append(
                    {
                        "module": mod_label,
                        "name": name,
                        "status": "PASSED",
                        "duration_ms": elapsed_ms,
                    }
                )
            except Exception as exc:
                all_passed = False
                elapsed_ms = round((time.perf_counter() - start) * 1000, 2)
                results.append(
                    {
                        "module": mod_label,
                        "name": name,
                        "status": "FAILED",
                        "duration_ms": elapsed_ms,
                        "error": str(exc),
                    }
                )

    return all_passed, results


if __name__ == "__main__":
    passed, test_results = run_all_tests()
    for item in test_results:
        status_str = item["status"]
        print(f"{item['module']}::{item['name']} {status_str} ({item['duration_ms']}ms)")
        if "error" in item:
            print(f"    Error: {item['error']}")
    print(f"\nSummary: {sum(1 for r in test_results if r['status'] == 'PASSED')}/{len(test_results)} passed")
    sys.exit(0 if passed else 1)
