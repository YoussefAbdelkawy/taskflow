/* global api */
// Placeholder: shows that the frontend can reach the backend.
api
  .get('/health')
  .then((data) => {
    document.getElementById('status').textContent = data.status;
  })
  .catch(() => {
    document.getElementById('status').textContent = 'offline';
  });
