#!/usr/bin/env python3
"""Validate the host-level CAT12/MATLAB Runtime setup.

Run from the repo root or from platform/backend after loading backend env vars.
Use --run with a valid T1 NIfTI file only when you want to execute CAT12.
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = REPO_ROOT / "backend"
sys.path.insert(0, str(BACKEND_ROOT))

from app.pipelines.mri import cat12_manager  # noqa: E402
from app.pipelines.mri.config import (  # noqa: E402
    CAT12_EXE,
    CAT12_OUTPUT_DIR,
    CAT12_ROOT,
    MCR_ROOT,
)


def _exists(path: str) -> str:
    if not path:
        return "not set"
    return "exists" if Path(path).exists() else "missing"


def main() -> int:
    parser = argparse.ArgumentParser(description="Check AI4NEURO CAT12 setup.")
    parser.add_argument("--input", help="Path to a valid T1 .nii or .nii.gz file.")
    parser.add_argument(
        "--run",
        action="store_true",
        help="Actually run CAT12 on --input and verify mwp1 output.",
    )
    args = parser.parse_args()

    print("CAT12 environment")
    print(f"  CAT12_ROOT={CAT12_ROOT or '<empty>'} [{_exists(CAT12_ROOT)}]")
    print(f"  CAT12_EXE={CAT12_EXE or '<empty>'} [{_exists(CAT12_EXE)}]")
    print(f"  MCR_ROOT={MCR_ROOT or '<empty>'} [{_exists(MCR_ROOT)}]")
    print(f"  CAT12_OUTPUT_DIR={CAT12_OUTPUT_DIR or '<empty>'}")

    issues = cat12_manager.validate_cat12_config()
    if issues:
        print("\nNot ready:")
        for issue in issues:
            print(f"  - {issue}")
        return 1

    print("\nConfig looks ready.")
    runtime_paths = cat12_manager._matlab_runtime_paths(MCR_ROOT)
    print(f"Detected MATLAB Runtime paths: {len(runtime_paths)}")
    for path in runtime_paths[:8]:
        print(f"  - {path}")
    if len(runtime_paths) > 8:
        print(f"  - ... {len(runtime_paths) - 8} more")

    if not args.run:
        print("\nDry run complete. Add --run --input /path/to/T1.nii.gz to execute CAT12.")
        return 0

    if not args.input:
        print("\n--run requires --input /path/to/T1.nii.gz")
        return 2

    input_path = Path(args.input).expanduser().resolve()
    if not input_path.exists():
        print(f"\nInput file not found: {input_path}")
        return 2

    print(f"\nRunning CAT12 on {input_path}")
    output_path = cat12_manager.run_cat12_preprocessing(str(input_path))
    if not output_path or not Path(output_path).exists():
        print("CAT12 ran but no mwp1 output was produced.")
        return 1

    print(f"CAT12 output ready: {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
