from pathlib import Path
import json

root = Path('.')
assert 'AKfycbw_tBrwEiGfaZSNBgLwv1eNyjG8KEWj0QeHZZPANh5endIuPfwl8HMT6LujWWqSXZaKRg' in (root/'src/data.js').read_text()
all_source = ''.join(p.read_text(errors='ignore') for p in root.rglob('*') if p.is_file() and '.git' not in p.parts)
assert 'AKfycbw_tBrwEiGfaZSNBgLwv1eNyjG8KEWj0QeHZZPANh5endIuPfwl8HMT6LujWWqSXZaKRg' in all_source
assert 'Math.pow' not in ''.join(p.read_text(errors='ignore') for p in root.rglob('*.js'))
manifest = json.loads((root/'manifest.webmanifest').read_text())
assert manifest['display'] == 'standalone'
for name in ['P1','P2','P3','P4','P5','P6','P7']:
    assert name in (root/'src/views.js').read_text()
print('static safety, PWA, and flow checks passed')
