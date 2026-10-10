from pathlib import Path

build = Path('src/build.js').read_text()
service_worker = Path('sw.js').read_text()
workflow = Path('.github/workflows/deploy-pages.yml').read_text()

assert "export const APP_VERSION = 'V1.8';" in build
assert "__AVA_DEPLOYMENT_ID__" in build
assert "__AVA_DEPLOYMENT_ID__" in service_worker
assert 'sed -i "s/__AVA_DEPLOYMENT_ID__/${GITHUB_SHA}/g" sw.js src/build.js' in workflow
print('Saving app version and deployment identity contracts passed')
