#!/usr/bin/env python3
"""Rewrite pytest junit.xml classnames for SonarQube monorepo paths."""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET

PREFIX = "backend."


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "backend/junit.xml"
    tree = ET.parse(path)
    root = tree.getroot()

    updated = 0
    for testcase in root.iter("testcase"):
        classname = testcase.get("classname")
        if not classname or classname.startswith(PREFIX):
            continue
        if classname.startswith("tests."):
            testcase.set("classname", PREFIX + classname)
            updated += 1

    tree.write(path, encoding="unicode", xml_declaration=True)
    print(f"Rewrote {updated} junit classnames in {path} (prefix {PREFIX})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
