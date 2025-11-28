import React from "react";
import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { Toaster } from "./components/ui/toaster";
import Login from "./components/Login";
import Dashboard from "@/components/Dashboard";
import Signup from "@/components/signup";
import LoadingSpinner from "@/LoadingSpinner";
import APMapping from "@/components/APMapping";
import ExcelDataViewer from "@/pages/ExcelDataViewer";

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;
  }
  
  return user ? <Navigate to="/dashboard" /> : children;
};

function App() {
  return (
    <AuthProvider>
      
        <div className="App">
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={
                <PublicRoute>
                  <Login />
                </PublicRoute>
              } />
              <Route path="/signup" element={
                <PublicRoute>
                  <Signup />
                </PublicRoute>
              } />
              <Route path="/dashboard" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/ap-mapping" element={
                <ProtectedRoute>
                  <APMapping />
                </ProtectedRoute>
              } />
              <Route path="/excel-data" element={
                <ProtectedRoute>
                  <ExcelDataViewer />
                </ProtectedRoute>
              } />
              <Route path="/" element={<Navigate to="/dashboard" />} />
            </Routes>
          </BrowserRouter>
          <Toaster />
        </div>
      
    </AuthProvider>
  );
}

export default App;
