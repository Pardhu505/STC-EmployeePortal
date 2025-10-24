import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../LoadingSpinner';

const AdminRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  // Check for admin status. This is now more specific and corrects a syntax error.
  const designation = user?.designation?.toLowerCase() || '';
  const isUserAdmin = 
    user?.isAdmin === true ||
    user?.email === 'admin@showtimeconsulting.in' ||
    designation === 'system admin';

  // If the user is not an admin, redirect them to the main dashboard page.
  return isUserAdmin ? children : <Navigate to="/dashboard" />;
};

export default AdminRoute;