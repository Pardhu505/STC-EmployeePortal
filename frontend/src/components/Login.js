import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/use-toast';

const images = [
  'assets/carousel/1760922234178.jpg',
  'assets/carousel/1760922234926.jpg',
  'assets/carousel/1760922234968.jpg',
  'assets/carousel/1760922235049.jpg',
  'assets/carousel/1760922235281.jpg',
  'assets/carousel/1760922235358.jpg',
  'assets/carousel/1760922235406.jpg',
  'assets/carousel/1760922235497.jpg',
  'assets/carousel/1760922235534.jpg',
  'assets/carousel/1760922235603.jpg',
  'assets/carousel/1760922235760.jpg',
  'assets/carousel/1760922235776.jpg',
  'assets/carousel/1760922236111.jpg',
];

const Login = () => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();
  const { addToast } = useToast();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImageIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, 3000); // Change image every 3 seconds
    return () => clearInterval(timer);
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await login(email, password);
      addToast('Login successful!', { appearance: 'success' });
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error.message || 'An unexpected error occurred.';
      addToast(errorMessage, { appearance: 'error' });
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      {images.map((src, index) => (
        <img
          key={src}
          src={src}
          alt={`Carousel background ${index + 1}`}
          className={`absolute top-0 left-0 w-full h-full object-cover transition-opacity duration-1000 ${
            index === currentImageIndex ? 'opacity-100' : 'opacity-0'
          }`}
        />
      ))}
      <div className="absolute top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center">
        <div className="w-full max-w-md p-8 space-y-8 bg-white bg-opacity-10 backdrop-blur-lg rounded-xl shadow-2xl">
          <div className="text-center">
            <h2 className="text-4xl font-extrabold text-white">Login</h2>
            <p className="mt-2 text-sm text-gray-200">Welcome to the Employee Portal</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>
            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Sign in
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
