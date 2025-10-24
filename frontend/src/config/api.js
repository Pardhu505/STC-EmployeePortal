// // API configuration
// export const API_BASE_URL = 'http://localhost:8000';
// // // // src/config/api.js
export const API_BASE_URL = process.env.NODE_ENV === 'production'
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:8000'; // Your local backend URL
