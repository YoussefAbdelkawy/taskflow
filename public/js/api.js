/* exported api */
// The ONE place the frontend talks to the backend. Tony extends this file.
// Every page calls api.get(...) / api.post(...) instead of writing fetch() itself.
const api = {
  async request(method, url, body) {
    const response = await fetch(`/api${url}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  get(url) {
    return api.request('GET', url);
  },
  post(url, body) {
    return api.request('POST', url, body);
  },
};
