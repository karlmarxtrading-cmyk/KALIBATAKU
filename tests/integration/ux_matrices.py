"""Regenerate the versioned AC, FM and audit registers after binding release evidence."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[2]/'tools'))
from assess_release import main
if __name__=='__main__':main()
