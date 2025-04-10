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

  // State to track the current selected bowler
  const [currentBowlerId, setCurrentBowlerId] = useState(() => {
    const savedBowlerId = localStorage.getItem('currentBowlerId');
    return savedBowlerId !== null ? parseInt(savedBowlerId) : null;
  });

  // Save activeSection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('activeSection', activeSection);
  }, [activeSection]);

  // Save currentBowlerId to localStorage whenever it changes
  useEffect(() => {
    if (currentBowlerId !== null) {
      localStorage.setItem('currentBowlerId', currentBowlerId);
    }
  }, [currentBowlerId]);

  const handleNavigation = (section) => {
    setActiveSection(section);
  };

  const handleBowlerChange = (bowlerId) => {
    console.log('App: Setting current bowler ID to:', bowlerId);
    setCurrentBowlerId(bowlerId);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pt-20">
      <Header onNavigate={handleNavigation} activeSection={activeSection} />
      
      <main className="flex-grow container mx-auto p-4">
        {activeSection === 'Games' && <Games currentBowlerId={currentBowlerId} />}
        {activeSection === 'History' && <History currentBowlerId={currentBowlerId} />}
        {activeSection === 'Account' && 
          <Account 
            currentBowlerId={currentBowlerId} 
            onBowlerChange={handleBowlerChange} 
          />
        }
      </main>
      
      <Footer />
    </div>
  );
};

export default App;