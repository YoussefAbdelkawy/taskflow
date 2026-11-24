/* global api */
// Login page: check the fields, send email + password, keep the token, then go back to the
// page that sent us here (login.html?next=task.html%3Fid%3D3) or to the dashboard.
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const submitButton = loginForm.querySelector('button[type="submit"]');

// Only a page of this app, never another site (no open redirect)
const SAFE_NEXT = /^[a-z][a-z-]*\.html(\?[\w=&%.-]*)?$/;
const nextPage = () => {
  const next = new URLSearchParams(location.search).get('next');
  return next && SAFE_NEXT.test(next) ? next : 'index.html';
};

function showFieldError(input, message) {
  document.getElementById(`${input.id}-error`).textContent = message;
  input.setAttribute('aria-invalid', String(Boolean(message)));
}

// Imperative: one check per field, every message shown at once
function fieldsAreValid() {
  const { email, password } = loginForm.elements;
  let isValid = true;
  showFieldError(email, '');
  showFieldError(password, '');
  if (!email.value.trim()) {
    showFieldError(email, 'Enter your email address');
    isValid = false;
  } else if (!email.validity.valid) {
    showFieldError(email, 'This is not an email address');
    isValid = false;
  }
  if (!password.value) {
    showFieldError(password, 'Enter your password');
    isValid = false;
  }
  return isValid;
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  if (!fieldsAreValid()) return;
  const credentials = {
    email: loginForm.elements.email.value.trim(),
    password: loginForm.elements.password.value,
  };

  submitButton.disabled = true;
  try {
    const { token } = await api.post('/auth/login', credentials);
    api.setToken(token);
    location.href = nextPage();
  } catch (error) {
    loginError.textContent = error.message; // the server's message, e.g. "Wrong email or password"
    submitButton.disabled = false;
  }
});
