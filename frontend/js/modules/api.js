// Shared HTTP client for all frontend modules.
export const api = {
  async request(method, path, body) {
    const res = await fetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      credentials: "same-origin",
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  },
  get(path) {
    return this.request("GET", path);
  },
  post(path, body) {
    return this.request("POST", path, body);
  },
  put(path, body) {
    return this.request("PUT", path, body);
  },
  delete(path) {
    return this.request("DELETE", path);
  },
};
