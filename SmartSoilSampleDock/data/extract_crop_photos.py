"""Extract crop photos from the reference DOCX without changing image bytes."""

import argparse
import csv
import hashlib
import re
from pathlib import Path

from docx import Document
from docx.oxml.ns import qn


def slug(name):
    return re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("docx", type=Path)
    args = parser.parse_args()

    out_dir = Path(__file__).parent / "crop_photos_v1"
    out_dir.mkdir(exist_ok=True)
    document = Document(args.docx)
    rows = document.tables[0].rows[1:]
    manifest = []

    for row in rows:
        crop_id = int(row.cells[0].text.strip())
        crop_name = row.cells[1].text.strip()
        blips = row.cells[2]._tc.xpath(".//a:blip")
        if len(blips) > 1:
            raise ValueError(f"Multiple photos in row {crop_id}: {crop_name}")

        filename = ""
        digest = ""
        if blips:
            relationship_id = blips[0].get(qn("r:embed"))
            part = document.part.related_parts[relationship_id]
            extension = Path(part.partname.filename).suffix.lower()
            filename = f"{crop_id:02d}_{slug(crop_name)}{extension}"
            image_bytes = part.blob
            (out_dir / filename).write_bytes(image_bytes)
            digest = hashlib.sha256(image_bytes).hexdigest()

        manifest.append((crop_id, crop_name, filename, digest))

    manifest_path = out_dir / "manifest.csv"
    with manifest_path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(("id", "crop_name_en", "photo_file", "sha256"))
        writer.writerows(manifest)

    print(f"Extracted {sum(bool(item[2]) for item in manifest)} photos from {len(rows)} crop rows")
    print(f"Missing photos: {', '.join(item[1] for item in manifest if not item[2])}")
    print(manifest_path)


if __name__ == "__main__":
    main()
