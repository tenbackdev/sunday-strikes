import React from 'react';

const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="container mx-auto px-4 flex flex-col justify-between items-center text-sm text-gray-500">
        <div>
          &copy; {new Date().getFullYear()} Sunday Strikes. All rights reserved.
        </div>
        {/*
        <div>
          <a href="#about" className="hover:text-gray-700">About Us</a>
        </div>
        */}
      </div>
    </footer>
  );
};

export default Footer;