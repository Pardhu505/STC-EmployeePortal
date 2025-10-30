// src/Services/api.js
import axios from "axios";
import { API_BASE_URL } from "../config/api";

const api = axios.create({
  // Set your backend URL here. Fallback to localhost:8000 if the env var is missing or empty.
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add a request interceptor if you use authentication
api.interceptors.request.use(
  (config) => {
    // For admin requests, the backend expects a Base64 encoded user object.
    // For other requests, a different token might be used.
    // This logic specifically handles the admin auth format.
    const userString = localStorage.getItem("showtimeUser");
    if (userString) {
      try {
        // The backend's get_current_admin_user expects a base64 encoded JSON string.
        const token = btoa(userString);
        config.headers["Authorization"] = `Bearer ${token}`;
      } catch (e) { console.error("Could not encode user for auth token", e); }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Employee Management API functions
export const employeeAPI = {
  // Get all employees
  getAllEmployees: async () => {
    try {
      const response = await api.get('/employees');
      return response.data;
    } catch (error) {
      console.error('Error fetching employees:', error);
      throw error;
    }
  },

  // Update an employee
  updateEmployee: async (employeeId, employeeData) => {
    try {
      // The backend expects the employee ID (email) in the URL
      const response = await api.put(`/employees/${employeeId}`, employeeData);
      return response.data;
    } catch (error) {
      console.error('Error updating employee:', error);
      throw error;
    }
  },
  // Deactivate an employee
  deactivateEmployee: async (employeeId) => {
    try {
      const response = await api.put(`/employees/${employeeId}/deactivate`);
      return response.data;
    } catch (error) {
      console.error('Error deactivating employee:', error);
      throw error;
    }
  },

  // Remove an employee (permanent deletion)
  removeEmployee: async (employeeId) => {
    try {
      const response = await api.delete(`/employees/${employeeId}/remove`);
      return response.data;
    } catch (error) {
      console.error('Error removing employee:', error);
      throw error;
    }
  },

  // Get employee by email
  getEmployeeByEmail: async (email) => {
    try {
      const response = await api.get(`/employees/email/${email}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching employee by email:', error);
      throw error;
    }
  },

  // Get employee by employee code
  getEmployeeByCode: async (empCode) => {
    try {
      const response = await api.get(`/employees/code/${empCode}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching employee by code:', error);
      throw error;
    }
  },

  // Deactivate user account (sets active: false)
  deactivateUser: async (email) => {
    try {
      const response = await api.put(`/users/${email}/deactivate`);
      return response.data;
    } catch (error) {
      console.error('Error deactivating user:', error);
      throw error;
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
      console.error('Error changing password:', error);
      throw error;
    }
  },

  healthCheck: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error) {
      console.error('Error during health check:', error);
      throw error;
    }
  },

  // Get all employees with enriched work details
  getEmployeesWorkDetails: async () => {
    try {
      const response = await api.get('/employees/work-details');
      return response.data;
    } catch (error) {
      console.error('Error fetching employee work details:', error);
      throw error;
    }
  },

  // Get a single employee's enriched work details
  getSingleEmployeeWorkDetails: async (email) => {
    try {
      const response = await api.get(`/employees/email/${email}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching single employee work details:', error);
      throw error;
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
      console.error('Error updating profile picture:', error);
      throw error;
    }
  },

  // Update user profile details
  updateUserProfile: async (email, profileData) => {
    try {
      // This endpoint is often more specific for user-initiated updates
      const response = await api.put(`/users/${email}/profile`, profileData);
      return response.data;
    } catch (error) {
      console.error('Error updating user profile:', error);
      throw error;
    }
  },

  // Admin-specific API functions
  admin: {
    updateUserDetails: async (originalEmail, userData, userObject) => {
      try {
        const response = await api.put(`/admin/users/${encodeURIComponent(originalEmail)}/details`, userData);
        return response.data;
      } catch (error) {
        console.error('Error updating user details (admin):', error);
        throw error.response?.data || { detail: error.message };
      }
    },
    
    deleteUser: async (email, userObject) => {
      try {
        const response = await api.delete(`/admin/users/${encodeURIComponent(email)}`);
        return response.data;
      } catch (error) {
        console.error('Error deleting user (admin):', error);
        throw error.response?.data || { detail: error.message };
      }
    },
    
    resetPassword: async (email, newPassword, userObject) => {
      try {
        const response = await api.post(`/admin/users/${encodeURIComponent(email)}/reset-password`, {
          new_password: newPassword,
        });
        return response.data;
      } catch (error) {
        console.error('Error resetting password (admin):', error);
        throw error.response?.data || { detail: error.message };
      }
    },
  }
};



// Channels API functions
export const channelsAPI = {
  // Get channels for a user
  getUserChannels: async (userId) => {
    try {
      const response = await api.get(`/channels?user_id=${userId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching user channels:', error);
      throw error;
    }
  }
};

// Manager-specific API functions
export const managerAPI = {
  // Get a manager's team
  getManagerTeam: async (manager_code) => {
    try {
      const response = await api.get(`/manager/${manager_code}/team`);
      return response.data;
    } catch (error) {
      console.error(`Error fetching team for manager ${manager_code}:`, error);
      throw error;
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
      console.error(`Error fetching attendance report for manager ${manager_code}:`, error);
      throw error;
    }
  },
};


export default api;
