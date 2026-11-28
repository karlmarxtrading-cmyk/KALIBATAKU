"""Run the browser performance lab, then the budget reconciliation (AC-068/069/071)."""
import subprocess, sys
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
a = subprocess.run([sys.executable, 'tests/v12/extended.py', 'perf'], cwd=ROOT)
b = subprocess.run([sys.executable, 'tests/perf/analyze.py'], cwd=ROOT)
sys.exit(1 if a.returncode or b.returncode else 0)
