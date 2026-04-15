"""Compatibility launcher for db_setup.py.

This file exists only to support accidental runs of "db_setup 2.py".
It delegates execution to the real setup script in the same folder.
"""

from pathlib import Path
import runpy


if __name__ == '__main__':
	target = Path(__file__).with_name('db_setup.py')
	runpy.run_path(str(target), run_name='__main__')
