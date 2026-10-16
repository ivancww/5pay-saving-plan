from pathlib import Path

build = Path('src/build.js').read_text()
service_worker = Path('sw.js').read_text()
workflow = Path('.github/workflows/deploy-pages.yml').read_text()
metadata = Path('version.json').read_text()

assert "export const APP_VERSION = 'V1.12.5';" in build
assert "__AVA_DEPLOYMENT_ID__" in build
assert '"version": "V1.12.5"' in metadata
assert '"buildId": "__AVA_DEPLOYMENT_ID__"' in metadata
assert "__AVA_DEPLOYMENT_ID__" in service_worker
assert 'sed -i "s/__AVA_DEPLOYMENT_ID__/${GITHUB_SHA}/g" sw.js src/build.js version.json' in workflow
print('Saving app version and deployment identity contracts passed')
