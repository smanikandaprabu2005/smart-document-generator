import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000"; // backend base URL
export { API_URL };

// Create axios instance with default config
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor to include auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const generateDocument = async (data) => {
  const response = await api.post('/generate-document', data, {
    responseType: "blob",
  });

  const url = window.URL.createObjectURL(response.data);
  return { pdf_blob_url: url, filename: "document.pdf" };
};

// Bulk certificate upload (CSV/Excel)
export const generateBulkCertificates = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/generate-bulk-certificates', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    responseType: 'blob',
  });
  const url = window.URL.createObjectURL(response.data);
  return { zip_blob_url: url, filename: 'certificates.zip' };
};

// Upload template file for a document type
export const uploadTemplate = async (file, docType) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('docType', docType);
  const response = await api.post('/upload-template', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

// Login
export const loginUser = async (credentials) => {
  const response = await axios.post(`${API_URL}/login`, credentials, {
    headers: { "Content-Type": "application/json" },
  });
  return response.data;
};

// Admin create user
export const adminCreateUser = async (userData) => {
  const response = await api.post('/admin/create-user', userData);
  return response.data;
};

// Logout function
export const logout = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Get current user from localStorage
export const getCurrentUser = () => {
  const user = localStorage.getItem('user');
  return user ? JSON.parse(user) : null;
};

// Check if user is authenticated
export const isAuthenticated = () => {
  const token = localStorage.getItem('token');
  if (!token) return false;
  
  try {
    // Basic check - in production, you'd verify token expiration
    return true;
  } catch {
    return false;
  }
};
