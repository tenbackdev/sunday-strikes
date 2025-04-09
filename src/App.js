import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import Games from './components/Games';
import History from './components/History';
import Account from './components/Account';
import Footer from './components/Footer';

const App = () => {
  // Initialize activeSection from localStorage or default to 'Games'
  const [activeSection, setActiveSection] = useState(() => {
    const savedSection = localStorage.getItem('activeSection');
    return savedSection !== null ? savedSection : 'Games';
  });

  // Save activeSection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);

  const handleNavigation = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pt-20">
      <Header onNavigate={handleNavigation} activeSection={activeSection} />
      
      <main className="flex-grow container mx-auto p-4">
        {activeSection === 'Games' && <Games />}
        {activeSection === 'History' && <History />}
        {activeSection === 'Account' && <Account />}
      </main>
      
      <Footer />
    </div>
  );
};

export default App;