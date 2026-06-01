#!/usr/bin/env python3
"""Rewrite Cobertura coverage.xml paths so SonarQube can match monorepo files."""
from __future__ import annotations

import sys
import xml.etree.ElementTree as ET

PREFIX = "backend/app/"


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "backend/coverage.xml"
    tree = ET.parse(path)
    root = tree.getroot()

    for sources in root.findall(".//sources"):
        for source in sources.findall("source"):
            source.text = "."

    for cls in root.iter("class"):
        filename = cls.get("filename")
        if not filename:
            continue
        normalized = filename.replace("\\", "/").lstrip("/")
        if not normalized.startswith(PREFIX):
            cls.set("filename", PREFIX + normalized)

    tree.write(path, encoding="unicode", xml_declaration=True)
    print(f"Rewrote coverage paths in {path} (prefix {PREFIX})")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
