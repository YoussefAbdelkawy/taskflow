/* global api, layout */
// Home page: shows that the frontend can reach the backend, and greets the user.
api
  .get('/health')
  .then((data) => {
    document.getElementById('status').textContent = data.status;
  })
  .catch(() => {
    document.getElementById('status').textContent = 'offline';
  });

layout.userReady
  .then((user) => {
    document.getElementById('welcome').textContent = `Welcome, ${user.name}`;
  })
  .catch(() => {
    // not logged in: api.js is already sending the browser to login.html
  });
