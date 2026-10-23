import json
import sys
from pathlib import Path

from pypdf import PdfReader


def resolve_object(value):
    return value.get_object() if hasattr(value, "get_object") else value


def font_descriptor(font):
    subtype = str(font.get("/Subtype", ""))
    if subtype == "/Type0":
        descendants = resolve_object(font.get("/DescendantFonts", []))
        if not descendants:
            return None
        descendant = resolve_object(descendants[0])
        return resolve_object(descendant.get("/FontDescriptor"))
    return resolve_object(font.get("/FontDescriptor"))


def inspect(path_value):
    path = Path(path_value)
    reader = PdfReader(path)
    fonts = {}

    for page in reader.pages:
        resources = resolve_object(page.get("/Resources", {}))
        page_fonts = resolve_object(resources.get("/Font", {}))
        for resource_name, reference in page_fonts.items():
            font = resolve_object(reference)
            subtype = str(font.get("/Subtype", ""))
            descriptor = font_descriptor(font)
            embedded = bool(
                (subtype == "/Type3" and "/CharProcs" in font)
                or (
                    descriptor
                    and any(
                        key in descriptor for key in ("/FontFile", "/FontFile2", "/FontFile3")
                    )
                )
            )
            fonts[str(resource_name)] = {
                "baseFont": str(font.get("/BaseFont", "")),
                "subtype": subtype,
                "embedded": embedded,
            }

    return {
        "file": str(path),
        "pages": len(reader.pages),
        "encrypted": reader.is_encrypted,
        "text": "\n".join(page.extract_text() or "" for page in reader.pages),
        "fonts": fonts,
        "allFontsEmbedded": bool(fonts) and all(font["embedded"] for font in fonts.values()),
    }


if __name__ == "__main__":
    print(json.dumps([inspect(path) for path in sys.argv[1:]], ensure_ascii=False))
