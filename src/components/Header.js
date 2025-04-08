// components/Header.jsx
import React, { useState, useEffect } from 'react';

const Header = ({ onNavigate }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      // Check if page is scrolled
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    // Add scroll event listener
    window.addEventListener('scroll', handleScroll);
    
    // Clean up
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const toggleMenu = () => {
    setMenuOpen(!menuOpen);
  };

  const handleNavClick = (section) => {
    onNavigate(section);
    setMenuOpen(false);
  };

  return (
    <header className={`bg-white shadow-sm fixed top-0 left-0 right-0 z-50 transition-all duration-200 ${
      scrolled ? 'py-1' : 'py-4'
    }`}>
      <div className="container mx-auto px-4 flex justify-between items-center">
        {/* Hamburger Menu */}
        <div className="relative">
          <button 
            onClick={toggleMenu}
            className="p-2 focus:outline-none"
            aria-label="Menu"
          >
            <svg className={`transition-all duration-300 ${
              scrolled ? 'w-5 h-5' : 'w-6 h-6'
            }`} fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16"></path>
            </svg>
          </button>
          
          {/* Dropdown Menu */}
          {menuOpen && (
            <div className="absolute left-0 mt-2 w-48 bg-white rounded shadow-lg z-10 border border-gray-200">
              <ul className="py-1">
                <li>
                  <button 
                    onClick={() => handleNavClick('Games')}
                    className="block px-4 py-2 w-full text-left hover:bg-gray-100"
                  >
                    Games
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavClick('History')}
                    className="block px-4 py-2 w-full text-left hover:bg-gray-100"
                  >
                    History
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleNavClick('Account')}
                    className="block px-4 py-2 w-full text-left hover:bg-gray-100"
                  >
                    Account
                  </button>
                </li>
              </ul>
            </div>
          )}
        </div>
        
        {/* Title */}
        <h1 className={`font-semibold text-center transition-all duration-300 ${
          scrolled ? 'text-lg' : 'text-xl'
        }`}>Sunday Strikes</h1>
        
        {/* Icon */}
        <div className={`transition-all duration-300 ${
          scrolled ? 'w-5 h-5' : 'w-6 h-6'
        }`}>
          <img 
            src="/SundayStrikesLogo192.png" 
            alt="Sunday Strikes Logo" 
            className="w-full h-full object-contain"
          />
        </div>
      </div>
    </header>
  );
};

export default Header;
