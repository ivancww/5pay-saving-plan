export function parseMoney(value) {
  if (value == null || value === '') return null;
  const digits = String(value).replace(/[^0-9]/g, '');
  if (!digits) return null;
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : null;
}

export function formatMoneyInput(value) {
  const parsed = typeof value === 'number' ? value : parseMoney(value);
  return parsed == null ? '' : Math.round(parsed).toLocaleString('en-US');
}

export function preserveMoneyCaret(rawValue, caretPosition, formattedValue) {
  const before = String(rawValue ?? '').slice(0, Math.max(0, caretPosition ?? 0));
  const digitCount = (before.match(/[0-9]/g) || []).length;
  if (!digitCount) return 0;
  let seen = 0;
  for (let index = 0; index < formattedValue.length; index += 1) {
    if (/[0-9]/.test(formattedValue[index])) seen += 1;
    if (seen >= digitCount) return index + 1;
  }
  return formattedValue.length;
}

export function formatMoneyInputElement(input) {
  if (!input) return null;
  const raw = input.value;
  const start = input.selectionStart ?? raw.length;
  const end = input.selectionEnd ?? start;
  const formatted = formatMoneyInput(raw);
  input.value = formatted;
  if (typeof input.setSelectionRange === 'function' && document.activeElement === input) {
    const nextStart = preserveMoneyCaret(raw, start, formatted);
    const nextEnd = start === end ? nextStart : preserveMoneyCaret(raw, end, formatted);
    input.setSelectionRange(nextStart, nextEnd);
  }
  return parseMoney(formatted);
}
