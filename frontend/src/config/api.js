// API configuration
// export const API_BASE_URL = 'http://localhost:8000';
<<<<<<< HEAD
export const API_BASE_URL = 'https://stc-employeeportal.onrender.com';
=======
// // src/config/api.js
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:8000'; // Your local backend URL
>>>>>>> 8be87e4 (Initial commit with frontend and backend)
