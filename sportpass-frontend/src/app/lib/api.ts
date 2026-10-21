// One place for the backend address and the login token.
// Set VITE_API_URL in sportpass-frontend/.env when deploying,
// e.g. VITE_API_URL=https://sportpass.example.edu
export const API_BASE: string = (
  ((import.meta as any).env?.VITE_API_URL as string | undefined) ||
  "http://localhost:5000"
).replace(/\/$/, "");

// Like fetch(), but adds the logged-in user's token and the API address.
// If the server says the session is no longer valid, the user is logged out.
export async function apiFetch(path: string, init: RequestInit = {}) {
  const token = localStorage.getItem("token");
  const headers = new Headers(init.headers || {});

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url, { ...init, headers });

  if (response.status === 401 && token) {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    window.location.reload();
  }

  return response;
}
