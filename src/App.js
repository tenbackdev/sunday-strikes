import React, { useState } from 'react';
import Header from './components/Header';
import Games from './components/Games';
import History from './components/History';
import Account from './components/Account';
import Footer from './components/Footer';

const App = () => {
  const [activeSection, setActiveSection] = useState('Games');

  const handleNavigation = (section) => {
    setActiveSection(section);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 pt-20">
      <Header onNavigate={handleNavigation} />
      
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
