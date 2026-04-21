import os
import sys
import tempfile
from pathlib import Path

# Ensure app data goes to a tmp dir for tests
_TMP = Path(tempfile.mkdtemp(prefix="sqlutil-test-"))
os.environ.setdefault("SQLUTIL_DATA_DIR", str(_TMP))
os.environ.setdefault("SQLUTIL_ENCRYPTION_KEY", "test-key-please-change")

# Make the package importable when running `pytest` from the repo root.
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
