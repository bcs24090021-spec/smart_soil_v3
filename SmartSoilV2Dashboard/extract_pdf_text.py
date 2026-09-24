import re
import sys
import zlib

path = sys.argv[1]
data = open(path, 'rb').read()

objects = {}
for m in re.finditer(rb'(?m)^(\d+)\s+0\s+obj\s*\n(.*?)\nendobj', data, re.S):
    objects[int(m.group(1))] = m.group(2)

def decoded(obj):
    m = re.search(rb'stream\r?\n(.*?)\r?\nendstream', obj, re.S)
    if not m:
        return obj
    raw = m.group(1)
    try:
        return zlib.decompress(raw)
    except Exception:
        return raw

def parse_cmap(obj):
    s = decoded(obj).decode('latin1', 'ignore')
    cmap = {}
    for block in re.findall(r'beginbfchar\s*(.*?)\s*endbfchar', s, re.S):
        for a, b in re.findall(r'<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>', block):
            try:
                cmap[int(a, 16)] = bytes.fromhex(b).decode('utf-16-be')
            except Exception:
                pass
    for block in re.findall(r'beginbfrange\s*(.*?)\s*endbfrange', s, re.S):
        for a, b, c in re.findall(r'<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>\s+<([0-9A-Fa-f]+)>', block):
            start, end, target = int(a, 16), int(b, 16), int(c, 16)
            for code in range(start, end + 1):
                try:
                    cmap[code] = chr(target + code - start)
                except Exception:
                    pass
    return cmap

font_maps = {}
for num, obj in objects.items():
    m = re.search(rb'/ToUnicode\s*(\d+)\s+0\s+R', obj)
    if m:
        font_maps[num] = parse_cmap(objects.get(int(m.group(1)), b''))

font_ref_maps = {}
for num, obj in objects.items():
    m = re.search(rb'/ToUnicode\s*(\d+)\s+0\s+R', obj)
    if m:
        font_ref_maps[num] = font_maps.get(num, {})

def decode_hex(h, cmap):
    raw = bytes.fromhex(h)
    if not cmap:
        return raw.decode('latin1', 'replace')
    width = 2 if max(cmap, default=0) > 255 else 1
    out = []
    for i in range(0, len(raw), width):
        key = int.from_bytes(raw[i:i+width], 'big')
        out.append(cmap.get(key, '?'))
    return ''.join(out)

pages = []
for num, obj in objects.items():
    if not re.search(rb'/Type\s*/Page(?:[/\s]|$)', obj):
        continue
    refs = re.findall(rb'(\d+)\s+0\s+R', obj)
    content_refs = []
    in_contents = re.search(rb'/Contents\s*(\d+)\s+0\s+R', obj)
    if in_contents:
        content_refs = [int(in_contents.group(1))]
    arr = re.search(rb'/Contents\s*\[([^]]+)\]', obj, re.S)
    if arr:
        content_refs = [int(x) for x in re.findall(rb'(\d+)\s+0\s+R', arr.group(1))]
    text = []
    for cref in content_refs:
        stream = decoded(objects.get(cref, b''))
        current_map = {}
        for line in stream.decode('latin1', 'ignore').splitlines():
            fm = re.search(r'/([A-Za-z0-9]+)\s*[0-9.]+\s+Tf', line)
            if fm:
                name = fm.group(1).encode()
                # Find font resource object by scanning page resources' font entries.
                for obj2 in objects.values():
                    if re.search(rb'/' + re.escape(name) + rb'\s*(\d+)\s+0\s+R', obj2):
                        ref = re.search(rb'/' + re.escape(name) + rb'\s*(\d+)\s+0\s+R', obj2)
                        if ref:
                            current_map = font_maps.get(int(ref.group(1)), {})
                            break
            chunks = re.findall(r'<([0-9A-Fa-f]+)>', line)
            if chunks:
                value = ''.join(decode_hex(h, current_map) for h in chunks)
                if value.strip():
                    text.append(value)
    pages.append((num, text))

for i, (_, text) in enumerate(sorted(pages), 1):
    print(f'--- PAGE {i} ---')
    for line in text:
        print(line)
