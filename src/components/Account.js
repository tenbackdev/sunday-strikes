import React, { useState, useEffect } from 'react';

const Account = ({ currentBowlerId, onBowlerChange }) => {
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [apiResponse, setApiResponse] = useState(null);
  const [bowlers, setBowlers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });
  const [currentBowler, setCurrentBowler] = useState(null);

  // Handle scroll effect to match header
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Fetch bowlers from API and set the current bowler
  useEffect(() => {
    const fetchBowlers = async () => {
      console.log('Component: Starting to fetch bowlers');
      try {
        setLoading(true);
        console.log('Component: Calling API endpoint');
        const response = await fetch('/api/bowler/bowlers', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        console.log('Component: API response status:', response.status);
        
        if (!response.ok) {
          console.error('Component: API returned error status:', response.status);
          throw new Error(`Failed to fetch bowlers: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Component: Received data from API:', data);
        setBowlers(data);
        
        // Set bowler based on currentBowlerId from props or first bowler if available
        if (data.length > 0) {
          if (currentBowlerId) {
            console.log('Component: Looking for bowler with ID:', currentBowlerId);
            const savedBowler = data.find(bowler => bowler.bowlerId === currentBowlerId);
            if (savedBowler) {
              console.log('Component: Found saved bowler:', savedBowler);
              setCurrentBowler(savedBowler);
            } else {
              console.log('Component: Saved bowler not found, using first bowler');
              setCurrentBowler(data[0]);
              // Update parent state with new bowler ID
              onBowlerChange(data[0].bowlerId);
            }
          } else {
            console.log('Component: No saved bowler ID, using first bowler');
            setCurrentBowler(data[0]);
            // Update parent state with new bowler ID
            onBowlerChange(data[0].bowlerId);
          }
        } else {
          console.log('Component: No bowlers received from API');
        }
        
        setLoading(false);
      } catch (err) {
        console.error('Component: Error in fetchBowlers:', err);
        setError('Error loading bowlers. Please try again.');
        setLoading(false);
      }
    };
  
    console.log('Component: Account component mounted, initiating data fetch');
    fetchBowlers();
  }, [currentBowlerId, onBowlerChange]);

  const toggleRegisterForm = () => {
    setShowRegisterForm(!showRegisterForm);
    setApiResponse(null); // Clear any previous API responses
  };

  const handleBowlerSelect = (e) => {
    const selectedId = parseInt(e.target.value);
    const selected = bowlers.find(bowler => bowler.bowlerId === selectedId);
    if (selected) {
      setCurrentBowler(selected);
    }
  };

  const selectBowler = () => {
    if (currentBowler) {
      console.log('Component: User selected bowler with ID:', currentBowler.bowlerId);
      onBowlerChange(currentBowler.bowlerId);
      setApiResponse({
        success: true,
        message: `Selected ${currentBowler.firstName} ${currentBowler.lastName} as your active bowler`
      });
    }
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [id]: value
    }));
  };

  const handleRegister = async () => {
    try {
      const response = await fetch('api/bowler/add', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      const data = await response.json();
      
      setApiResponse({
        success: response.ok,
        message: response.ok ? 'Bowler registered successfully!' : data.message || 'Registration failed'
      });
      
      if (response.ok) {
        // Clear form after successful registration
        setFormData({
          firstName: '',
          lastName: '',
          email: ''
        });
        
        // Refresh bowler list to include the new bowler
        const refreshResponse = await fetch('/api/bowler/bowlers', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          }
        });
        
        if (refreshResponse.ok) {
          const refreshedData = await refreshResponse.json();
          setBowlers(refreshedData);
          
          // Assuming the newly added bowler is the last one in the list
          if (refreshedData.length > 0) {
            const newBowler = refreshedData[refreshedData.length - 1];
            setCurrentBowler(newBowler);
            onBowlerChange(newBowler.bowlerId);
          }
        }
        
        // Hide the register form
        setShowRegisterForm(false);
      }
    } catch (error) {
      setApiResponse({
        success: false,
        message: 'Error connecting to server. Please try again.'
      });
    }
  };

  return (
    <div className="pb-6">
      {/* Sticky title under header - adjusts position based on header size */}
      <div className={`sticky z-40 bg-gray-50 border-b border-gray-200 mb-6 transition-all duration-300 ${
        scrolled ? 'top-12' : 'top-16'
      }`}>
        <h2 className={`font-semibold container mx-auto px-4 transition-all duration-300 ${
          scrolled ? 'text-xl py-2' : 'text-2xl py-4'
        }`}>Account</h2>
      </div>

      <div className="container mx-auto px-4">
        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            <p className="mt-2 text-gray-600">Loading bowlers...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* API Response Alert */}
        {apiResponse && (
          <div className={`mb-4 p-4 rounded ${
            apiResponse.success ? 'bg-green-100 border border-green-400 text-green-700' : 
            'bg-red-100 border border-red-400 text-red-700'
          }`}>
            {apiResponse.message}
          </div>
        )}
        
        {/* Main content area - only show when not loading */}
        {!loading && !error && currentBowler && (
          <>
            {!showRegisterForm ? (
              <div className="bg-white rounded shadow-sm border border-gray-100 mb-6">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Bowler Details</h3>
                    <button 
                      onClick={toggleRegisterForm}
                      className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                      Register New Bowler
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="border-b pb-2">
                      <p className="text-sm text-gray-500">ID Number</p>
                      <p className="font-medium">{currentBowler.bowlerId}</p>
                    </div>
                    <div className="border-b pb-2">
                      <p className="text-sm text-gray-500">First Name</p>
                      <p className="font-medium">{currentBowler.firstName}</p>
                    </div>
                    <div className="border-b pb-2">
                      <p className="text-sm text-gray-500">Last Name</p>
                      <p className="font-medium">{currentBowler.lastName}</p>
                    </div>
                    <div className="border-b pb-2">
                      <p className="text-sm text-gray-500">Status</p>
                      <div className={`inline-flex items-center ${currentBowler.isActive ? 'text-green-600' : 'text-red-600'}`}>
                        <span className={`w-2 h-2 rounded-full mr-2 ${currentBowler.isActive ? 'bg-green-600' : 'bg-red-600'}`}></span>
                        <span>{currentBowler.isActive ? 'Active' : 'Inactive'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded shadow-sm border border-gray-100 mb-6">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Register New Bowler</h3>
                    <button 
                      onClick={toggleRegisterForm}
                      className="text-gray-500 hover:text-gray-700"
                    >
                      Cancel
                    </button>
                  </div>
                  
                  <form className="space-y-4">
                    <div>
                      <label htmlFor="firstName" className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                      <input 
                        type="text" 
                        id="firstName" 
                        value={formData.firstName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="lastName" className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                      <input 
                        type="text" 
                        id="lastName" 
                        value={formData.lastName}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                      <input 
                        type="email" 
                        id="email" 
                        value={formData.email}
                        onChange={handleInputChange}
                        className="w-full p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <button 
                        type="button"
                        onClick={handleRegister}
                        className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 rounded transition-colors"
                      >
                        Register
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            
            {/* Bowler Selection */}
            <div className="bg-white rounded shadow-sm border border-gray-100 p-6">
              <h3 className="text-lg font-medium mb-4">Select Active Bowler</h3>
              <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
                <select 
                  className="w-full md:w-auto flex-grow p-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={currentBowler.bowlerId}
                  onChange={handleBowlerSelect}
                >
                  {bowlers.map(bowler => (
                    <option key={bowler.bowlerId} value={bowler.bowlerId}>
                      {bowler.firstName} {bowler.lastName} (ID: {bowler.bowlerId})
                    </option>
                  ))}
                </select>
                <button 
                  onClick={selectBowler}
                  className="w-full md:w-auto bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded transition-colors"
                >
                  Select Bowler
                </button>
              </div>
              {currentBowlerId === currentBowler.bowlerId && (
                <div className="mt-2 text-green-600 text-sm flex items-center">
                  <span className="w-2 h-2 rounded-full mr-2 bg-green-600"></span>
                  <span>This bowler is currently selected</span>
                </div>
              )}
            </div>
          </>
        )}

        {/* No bowlers available message */}
        {!loading && !error && bowlers.length === 0 && (
          <div className="bg-white rounded shadow-sm border border-gray-100 p-6 text-center">
            <p className="text-gray-600 mb-4">No bowlers found.</p>
            <button 
              onClick={toggleRegisterForm}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded text-sm transition-colors"
            >
              Register New Bowler
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Account;