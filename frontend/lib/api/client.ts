/**
 * Shared axios instance.
 *
 * The request interceptor is wired for you: it attaches the stored bearer
 * token. You should not need to set the Authorization header by hand anywhere
 * else in the app.
 *
 * The RESPONSE interceptor is deliberately incomplete - see TASK-2.
 */
import axios from "axios";
import { getStoredToken, useAuthStore } from "@/lib/auth/authStore";

const baseURL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080/wp-json/bemalearn/v1";

export const api = axios.create({
  baseURL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = getStoredToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// TODO (Task 2): handle 401 here.
// Think about what should happen to stored auth state, and how a caller can
// tell a TRANSPORT failure (no response at all) from a BUSINESS refusal.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // No response at all = transport failure (server unreachable, CORS, DNS, etc).
    // We deliberately do nothing special here, error.response stays undefined
    // so callers can check `error.response === undefined` to detect this.
    if (error.response && error.response.status === 401) {
      // A real 401 means the stored token is invalid or expired.
      // Clear it so the app doesn't keep sending a dead token.
      useAuthStore.getState().signOut();
    }
    return Promise.reject(error);
  }
);

export default api;
