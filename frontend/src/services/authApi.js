import axios from "axios";

const API_BASE = "http://localhost:5000";
const AUTH_TOKEN_KEY = "cts_auth_token";

function getAuthHeaders() {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

export function saveSession(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  }
}

export function clearSession() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

export async function signup(payload) {
  const response = await axios.post(`${API_BASE}/auth/signup`, payload);
  if (response.data?.token) {
    saveSession(response.data.token);
  }
  return response.data;
}

export async function login(payload) {
  const response = await axios.post(`${API_BASE}/auth/login`, payload);
  if (response.data?.token) {
    saveSession(response.data.token);
  }
  return response.data;
}

export async function getProfile() {
  const response = await axios.get(`${API_BASE}/auth/profile`, {
    headers: getAuthHeaders()
  });
  return response.data;
}

export async function updateProfile(payload) {
  const response = await axios.put(`${API_BASE}/auth/profile`, payload, {
    headers: getAuthHeaders()
  });
  return response.data;
}

export async function logout() {
  try {
    await axios.post(`${API_BASE}/auth/logout`, {}, {
      headers: getAuthHeaders()
    });
  } finally {
    clearSession();
  }
}

export function getApiError(error, fallback) {
  return error?.response?.data?.error || error?.message || fallback;
}
