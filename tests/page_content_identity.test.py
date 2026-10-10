from pathlib import Path


gas = Path('gas/Code.gs').read_text()
admin = Path('src/admin.js').read_text()

# The identity contract is domain-specific. page_id is a parent-page reference
# and may repeat; content_id is the stable identity of a page_content row.
assert "page_content: 'content_id'" in gas
assert 'const identity = copy[identityField_(domain)];' in gas
assert 'function identityField_(domain)' in gas

# The V1.8 editor keeps the complete original row in data-row-json and only
# overlays edited controls; it must not synthesize or re-key page_content IDs.
assert 'data-row-json="${escapeHtml(JSON.stringify(row))}"' in admin
assert "row = JSON.parse(record.dataset.rowJson || '{}')" in admin
assert "row[field.dataset.adminField] = readField(field)" in admin

production_page_content = [
    {'content_id': f'P1_C{i}', 'page_id': 'P1'} for i in range(1, 7)
] + [
    {'content_id': f'P2_C{i}', 'page_id': 'P2'} for i in range(1, 7)
]


def keys(domain, rows):
    fields = {
        'flow': 'page_id',
        'page_content': 'content_id',
        'routing': 'route_id',
        'current_methods': 'method_key',
        'withdrawal_strategies': 'strategy_code',
        'customer_view': 'block_id',
    }
    return [row[fields[domain]] for row in rows]


content_keys = keys('page_content', production_page_content)
assert len(content_keys) == len(set(content_keys))
assert len({row['page_id'] for row in production_page_content}) < len(production_page_content)

duplicate = production_page_content + [
    {'content_id': 'P1_C1', 'page_id': 'P1'}
]
duplicate_keys = keys('page_content', duplicate)
assert len(duplicate_keys) != len(set(duplicate_keys))

# The duplicate check occurs before locks, snapshots, and writes.
assert gas.index('const validated = validatePublish_(body.data);') < gas.index('const lock = LockService.getScriptLock()')
assert gas.index('const identity = copy[identityField_(domain)];') < gas.index('const lock = LockService.getScriptLock()')

print('page_content identity contract passed: content_id is unique; repeated page_id is allowed')
