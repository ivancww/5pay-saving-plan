from pathlib import Path

sw = Path('sw.js').read_text()
main = Path('src/main.js').read_text()
views = Path('src/views.js').read_text()
styles = Path('styles.css').read_text()
build = Path('src/build.js').read_text()
workflow = Path('.github/workflows/deploy-pages.yml').read_text()

# P6 uses a bounded-width, touch-scrollable rail. Selection remains an exact
# Official policy year and updates through the existing click redraw path.
p6 = views.split('function p6', 1)[1].split('function p7', 1)[0]
assert 'class="timeline-rail"' in views
assert 'flex:0 0 96px' in styles
assert 'scroll-snap-type:x proximity' in styles
assert 'touch-action:pan-x' in styles
assert 'overflow-x:auto' in styles
assert "action = 'select-year'" in views
assert 'data-action="${action}"' in views
assert 'data-value="${item.value ?? item.year}"' in views
assert '<strong>${age == null ?' in views
assert '<small>第 ${item.localYear ?? item.year}年' in views
assert "supportedYears(official, 'none')" in p6
assert 'calculateSavingPortfolio({ session: state.session, overallPolicyYear: selectedYear, official })' in p6
assert 'html,body{overflow-x:hidden}' in styles

# The app shell receives its deployment identity automatically from the Pages
# workflow; no source edit is needed for a release.
assert "const DEPLOYMENT_ID = '__AVA_DEPLOYMENT_ID__';" in sw
assert "const CACHE_PREFIX = 'ava-saving-phase1-shell-';" in sw
assert '`${CACHE_PREFIX}${DEPLOYMENT_ID}`' in sw
assert 'GITHUB_SHA' in workflow
assert 'sed -i' in workflow
assert '__AVA_DEPLOYMENT_ID__' in workflow
assert "export const BUILD_ID = '__AVA_DEPLOYMENT_ID__';" in build
assert 'caches.keys()' in sw
assert 'caches.delete(key)' in sw
assert 'LEGACY_CACHES' in sw
assert "'ava-saving-phase1-v2'" in sw
assert "'ava-saving-phase1-20260930-p6-rail-v1'" in sw
assert 'self.skipWaiting()' in sw
assert 'self.clients.claim()' in sw
assert "event.request.mode === 'navigate'" in sw
assert "fetch(request, { cache: 'no-store' })" in sw
assert "caches.match('./index.html')" in sw
assert "fetch(request, { cache: 'no-store' })" in sw.split('async function sameOriginResponse', 1)[1]
assert 'new URL(event.request.url).origin !== self.location.origin' in sw
assert "updateViaCache: 'none'" in main
assert 'registration.update()' in main
assert 'controllerchange' in main
assert 'let refreshing = false' in main
assert main.count('window.location.reload()') == 1
assert 'if (refreshing) return' in main
assert 'localStorage.clear' not in sw + main
assert 'indexedDB.deleteDatabase' not in sw + main
assert 'window.__AVA_SAVING_BUILD__ = BUILD_ID' in main
assert 'AVA Platform' not in workflow
assert 'platform version' not in sw.lower() + main.lower() + workflow.lower()

print('mobile cache and P6 horizontal rail regression contracts passed')
