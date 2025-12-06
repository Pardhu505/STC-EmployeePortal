import React from 'react';
import { FaLinkedin, FaTwitter, FaFacebook } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer className="bg-white/80 backdrop-blur-md border-t border-gray-200 mt-8">
      <div className="container mx-auto px-4 py-6 flex flex-col md:flex-row items-center justify-between">
        <p className="text-sm text-gray-600 mb-4 md:mb-0">
          &copy; {new Date().getFullYear()} Showtime Consulting. All rights reserved.
        </p>
        <div className="flex items-center space-x-4">
          <a href="https://www.linkedin.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-700">
            <FaLinkedin size={20} />
          </a>
          <a href="https://www.twitter.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-500">
            <FaTwitter size={20} />
          </a>
          <a href="https://www.facebook.com" target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-blue-600">
            <FaFacebook size={20} />
          </a>
        </div>
      </div>
    </footer>
  );
};

export default Footer;