from pathlib import Path

media = Path('src/media.js').read_text()
portable = Path('src/portable.js').read_text()
data = Path('src/data.js').read_text()

assert "image: 6" in media
assert "video: 1" in media
assert "available: false" in media
assert "Cloud 媒體服務尚未連接" in media
assert "data:(image|video)" in portable
assert "qr: { kind: 'ava-qr-pointer'" in portable
assert "schemaVersion" in portable
assert "normalizeMediaList(page.media" in data
assert 'localStorage' not in media
assert 'localStorage' not in portable
print('portable-data and cloud-media boundary checks passed')
