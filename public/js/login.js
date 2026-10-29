/* global api */
// Login page: send email + password, keep the token, go to the home page.
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  loginError.textContent = '';
  const credentials = {
    email: loginForm.elements.email.value.trim(),
    password: loginForm.elements.password.value,
  };

  try {
    const { token } = await api.post('/auth/login', credentials);
    api.setToken(token);
    location.href = 'index.html';
  } catch (error) {
    loginError.textContent = error.message; // the server's message, e.g. "Wrong email or password"
  }
});
