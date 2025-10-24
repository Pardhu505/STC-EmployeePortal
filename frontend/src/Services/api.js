// src/Services/api.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const FULL_API_BASE_URL = API_BASE_URL + "/api";

const api = axios.create({
  baseURL: FULL_API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor if you use authentication
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token"); // example if using JWT
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

/**
 * A centralized error handler for API calls.
 * It extracts the most relevant error message from the axios error object.
 * @param {object} error - The error object from axios.
 * @param {string} [context='An unknown error occurred'] - A fallback error message.
 */
const handleError = (error, context = 'An unknown error occurred') => {
  console.error(`API Error in ${context}:`, error);
  // Prefer the backend's detailed error message, otherwise fall back.
  throw new Error(error.response?.data?.detail || error.message || context);
};

// Employee Management API functions
const employeeAPI = {
  // Get all employees
  getAllEmployees: async () => {
    try {
      const response = await api.get('/employees/');
      return response.data;
    } catch (error) {
      handleError(error, 'fetching employees');
    }
  },

  // Update an employee
  updateEmployee: async (employeeId, employeeData) => {
    try {
      // The backend expects the employee ID (email) in the URL
      const response = await api.put(`/employees/${employeeId}`, employeeData);
      return response.data;
    } catch (error) {
      handleError(error, `updating employee ${employeeId}`);
    }
  },
  // Deactivate an employee
  deactivateEmployee: async (employeeId) => {
    try {
      const response = await api.put(`/employees/${employeeId}/deactivate`);
      return response.data;
    } catch (error) {
      handleError(error, `deactivating employee ${employeeId}`);
    }
  },

  // Remove an employee (permanent deletion)
  removeEmployee: async (employeeId) => {
    try {
      const response = await api.delete(`/employees/${employeeId}/remove`);
      return response.data;
    } catch (error) {
      handleError(error, `removing employee ${employeeId}`);
    }
  },

  // Get employee by email
  getEmployeeByEmail: async (email) => {
    try {
      const response = await api.get(`/employees/email/${email}`);
      return response.data;
    } catch (error) {
      handleError(error, `fetching employee by email ${email}`);
    }
  },

  // Get employee by employee code
  getEmployeeByCode: async (empCode) => {
    try {
      const response = await api.get(`/employees/code/${empCode}`);
      return response.data;
    } catch (error) {
      handleError(error, `fetching employee by code ${empCode}`);
    }
  },

  // Deactivate user account (sets active: false)
  deactivateUser: async (email) => {
    try {
      const response = await api.put(`/users/${email}/deactivate`);
      return response.data;
    } catch (error) {
      handleError(error, `deactivating user ${email}`);
    }
  },

  // Change user password
  changePassword: async (userId, currentPassword, newPassword) => {
    try {
      const response = await api.put(`/users/${userId}/change-password`, {
        current_password: currentPassword,
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      handleError(error, `changing password for user ${userId}`);
    }
  },

  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      handleError(error, 'performing health check');
    }
  },

  // Get all employees with enriched work details
  getEmployeesWorkDetails: async () => {
    try {
      const response = await api.get('/employees/work-details');
      return response.data;
    } catch (error) {
      handleError(error, 'fetching employee work details');
    }
  },

  // Update profile picture
  updateProfilePicture: async (employeeId, base64Image) => {
    try {
      const response = await api.put(`/employees/${employeeId}/profile-picture`, {
        profilePicture: base64Image,
      });
      return response.data;
    } catch (error) {
      handleError(error, `updating profile picture for ${employeeId}`);
    }
  },

  // Update user profile details
  updateUserProfile: async (email, profileData) => {
    try {
      // This endpoint is often more specific for user-initiated updates
      const response = await api.put(`/users/${email}/profile`, profileData);
      return response.data;
    } catch (error) {
      handleError(error, `updating user profile for ${email}`);
    }
  },
};

// Admin-specific API functions
const adminAPI = {
  updateUserDetails: async (originalEmail, userData) => {
    try {
      // The request interceptor will automatically add the correct Authorization header.
      const response = await api.put(`/admin/users/${encodeURIComponent(originalEmail)}/details`, userData);
      return response.data;
    } catch (error) {
      handleError(error, `updating user details for ${originalEmail} (admin)`);
    }
  },
  
  deleteUser: async (email) => {
    try {
      const response = await api.delete(`/admin/users/${encodeURIComponent(email)}`);
      return response.data;
    } catch (error) {
      handleError(error, `deleting user ${email} (admin)`);
    }
  },
  
  resetPassword: async (email, newPassword) => {
    try {
      const response = await api.post(`/admin/users/${encodeURIComponent(email)}/reset-password`, {
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      handleError(error, `resetting password for ${email} (admin)`);
    }
  },
};

// Channels API functions
const channelsAPI = {
  // Get channels for a user
  getUserChannels: async (userId) => {
    try {
      const response = await api.get(`/channels?user_id=${userId}`);
      return response.data;
    } catch (error) {
      handleError(error, `fetching channels for user ${userId}`);
    }
  }
};

// Manager-specific API functions
const managerAPI = {
  // Get a manager's team
  getManagerTeam: async (manager_code) => {
    try {
      const response = await api.get(`/manager/${manager_code}/team`);
      return response.data;
    } catch (error) {
      handleError(error, `fetching team for manager ${manager_code}`);
    }
  },

  // Get attendance report for a manager's team
  getManagerAttendanceReport: async ({ manager_code, reportType, date, signal }) => {
    try {
      const params = new URLSearchParams({ view_type: reportType });
      if (reportType === 'day') {
        params.append('date', date.toISOString().split('T')[0]);
      } else { // month
        params.append('year', date.getFullYear());
        params.append('month', date.getMonth() + 1);
      }

      const response = await api.get(`/attendance-report/manager/${manager_code}`, {
        params,
        signal,
      });
      return response.data;
    } catch (error) {
      handleError(error, `fetching attendance report for manager ${manager_code}`);
    }
  },
};


export { api as default, employeeAPI, adminAPI, channelsAPI, managerAPI };