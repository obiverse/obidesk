/* obiDesk — Form Utilities */

function gatherFormData(formId) {
  var form = document.getElementById(formId);
  if (!form) return {};
  var data = {};
  var inputs = form.querySelectorAll('input, select, textarea');
  for (var i = 0; i < inputs.length; i++) {
    var el = inputs[i];
    if (el.id) data[el.id] = el.value.trim();
  }
  return data;
}

function validateRequired(data, fields) {
  for (var i = 0; i < fields.length; i++) {
    if (!data[fields[i]]) {
      return 'Please fill in all required fields.';
    }
  }
  return '';
}

function showFormStatus(containerId, message, isError) {
  var existing = document.querySelector('#' + containerId + ' .form-status');
  if (existing) existing.remove();
  var el = document.createElement('div');
  el.className = 'form-status ' + (isError ? 'form-status-err' : 'form-status-ok');
  el.textContent = message;
  document.getElementById(containerId).appendChild(el);
  if (!isError) {
    setTimeout(function() { el.remove(); }, 5000);
  }
}
