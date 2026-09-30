from pathlib import Path

sw = Path('sw.js').read_text()
main = Path('src/main.js').read_text()
views = Path('src/views.js').read_text()
styles = Path('styles.css').read_text()
build = Path('src/build.js').read_text()

# P6 uses a bounded-width, touch-scrollable rail. Selection remains an exact
# Official policy year and updates through the existing click redraw path.
p6 = views.split('function p6', 1)[1].split('function p7', 1)[0]
assert 'class="timeline-rail"' in views
assert 'flex:0 0 96px' in styles
assert 'scroll-snap-type:x proximity' in styles
assert 'touch-action:pan-x' in styles
assert 'overflow-x:auto' in styles
assert 'data-action="select-year"' in views
assert 'data-value="${year}"' in views
assert '<strong>${age == null ?' in views
assert '<small>第 ${year}年</small>' in views
assert "supportedYears(official, 'none')" in p6
assert 'calculateOfficial({ annualContribution: state.session.annualContribution, policyYear: selectedYear' in p6
assert 'html,body{overflow-x:hidden}' in styles

# The app shell has an explicit release cache, removes prior caches, and does
# not let a cached document permanently mask a deployed update.
assert "const CACHE = 'ava-saving-phase1-20260930-p6-rail-v1';" in sw
assert 'caches.keys()' in sw
assert 'caches.delete(key)' in sw
assert 'self.skipWaiting()' in sw
assert 'self.clients.claim()' in sw
assert "event.request.mode === 'navigate'" in sw
assert "fetch(request, { cache: 'no-store' })" in sw
assert "caches.match('./index.html')" in sw
assert "updateViaCache: 'none'" in main
assert 'registration.update()' in main
assert 'controllerchange' in main
assert 'let refreshing = false' in main
assert 'localStorage.clear' not in sw + main
assert 'indexedDB.deleteDatabase' not in sw + main
assert "export const BUILD_ID = '2026-09-30-p6-rail-cache-v1';" in build
assert 'window.__AVA_SAVING_BUILD__ = BUILD_ID' in main

print('mobile cache and P6 horizontal rail regression contracts passed')
