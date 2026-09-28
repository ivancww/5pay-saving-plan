export function exportCustomerView() {
  document.body.classList.add('printing-customer-view');
  window.setTimeout(() => { window.print(); window.setTimeout(() => document.body.classList.remove('printing-customer-view'), 800); }, 40);
}
