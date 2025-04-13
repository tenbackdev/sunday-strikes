import React, { useState, useEffect } from 'react';

const Games = ({ currentBowlerId }) => {
  // State for games history
  const [games, setGames] = useState(() => {
    const savedGames = localStorage.getItem(`games-${currentBowlerId}`);
    return savedGames ? JSON.parse(savedGames) : [];
  });
  
  // State for form visibility
  const [showForm, setShowForm] = useState(false);
  
  // State for current bowler information
  const [currentBowler, setCurrentBowler] = useState({
    firstName: '',
    lastName: ''
  });

  // State for available opponents (active bowlers)
  const [availableOpponents, setAvailableOpponents] = useState([]);
  
  // State for loading status
  const [isLoading, setIsLoading] = useState(false);
  
  // State for form inputs - Default values persist after submission
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    house: '',
    lane: '',
    isPair: false,
    opponent: '',
    pattern: 'House Shot',
    score: '',
    strikes: '0',
    spares: '0',
    opens: '0',
    opponentScore: '',
    opponentStrikes: '0',
    opponentSpares: '0',
    opponentOpens: '0'
  });
  
  // Fetch current bowler information
  useEffect(() => {
    if (currentBowlerId) {
      fetchCurrentBowler();
      fetchAvailableOpponents();
    }
  }, [currentBowlerId]);
  
  // Fetch current bowler data from API
  const fetchCurrentBowler = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/bowler/bowler?id=${currentBowlerId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch bowler data');
      }
      
      const data = await response.json();
      
      if (data && data.bowler) {
        setCurrentBowler({
          firstName: data.bowler.firstName || '',
          lastName: data.bowler.lastName || ''
        });
      }
    } catch (error) {
      console.error('Error fetching current bowler:', error);
      // Fallback to localStorage if API fails
      const savedBowlers = localStorage.getItem('bowlers');
      if (savedBowlers) {
        const bowlersArray = JSON.parse(savedBowlers);
        const bowler = bowlersArray.find(b => b.id === currentBowlerId);
        if (bowler) {
          setCurrentBowler({
            firstName: bowler.firstName || '',
            lastName: bowler.lastName || ''
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };
  
  // Fetch available opponents (active bowlers) from API
  const fetchAvailableOpponents = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/bowler/bowlers', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch bowlers data');
      }
      
      const data = await response.json();

      console.log(data);
      //console.log(data.bowlers);
      console.log(JSON.stringify(data));
      
      if (data) {
        // Filter out the current bowler
        const filteredOpponents = data
          .filter(bowler => bowler.id !== currentBowlerId)
          .map(bowler => ({
            id: bowler.id,
            name: `${bowler.firstName} ${bowler.lastName.charAt(0)}.`
          }));
        
        // Add "None" option
        filteredOpponents.push({ id: "none", name: "None" });
        
        setAvailableOpponents(filteredOpponents);
      }
    } catch (error) {
      console.error('Error fetching opponents:', error);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Update localStorage when games change
  useEffect(() => {
    if (currentBowlerId) {
      localStorage.setItem(`games-${currentBowlerId}`, JSON.stringify(games));
    }
  }, [games, currentBowlerId]);
  
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value
    });
  };
  
  // Validate frame count (strikes + spares + opens should be between 10 and 12)
  const validateFrameCount = (strikes, spares, opens) => {
    const total = parseInt(strikes) + parseInt(spares) + parseInt(opens);
    return total >= 10 && total <= 12;
  };
  
  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validate score
    const score = parseInt(formData.score);
    if (isNaN(score) || score < 0 || score > 300) {
      alert('Score must be between 0 and 300');
      return;
    }
    
    // Validate frame count
    if (!validateFrameCount(formData.strikes, formData.spares, formData.opens)) {
      alert('The sum of strikes, spares, and opens must be between 10 and 12');
      return;
    }
    
    // Validate opponent score if opponent is selected
    if (formData.opponent && formData.opponent !== 'none' && formData.opponent !== '') {
      const opponentScore = parseInt(formData.opponentScore);
      if (isNaN(opponentScore) || opponentScore < 0 || opponentScore > 300) {
        alert('Opponent score must be between 0 and 300');
        return;
      }
      
      if (!validateFrameCount(formData.opponentStrikes, formData.opponentSpares, formData.opponentOpens)) {
        alert('The sum of opponent strikes, spares, and opens must be between 10 and 12');
        return;
      }
    }
    
    // Create new game object
    const newGame = {
      id: Date.now(),
      ...formData,
      date: formData.date,
      house: formData.house,
      lane: formData.lane,
      isPair: formData.isPair,
      opponent: formData.opponent !== 'none' && formData.opponent !== '' ? formData.opponent : null
    };
    
    // Add new game to games array
    setGames([newGame, ...games]);
    
    // Reset only the score and frame fields, keep the venue information
    setFormData({
      ...formData,
      score: '',
      strikes: '0',
      spares: '0',
      opens: '0',
      opponentScore: '',
      opponentStrikes: '0',
      opponentSpares: '0',
      opponentOpens: '0'
    });
    
    // Hide form
    setShowForm(false);
    
    // Show confirmation
    alert('Game submitted successfully!');
  };
  
  // Navigate to account section
  const navigateToAccount = () => {
    // Use localStorage to change the active section (same as App.js does)
    localStorage.setItem('activeSection', 'Account');
    // Force page refresh to apply the change
    window.location.reload();
  };
  
  // Generate number options for dropdown
  const generateOptions = (max) => {
    const options = [];
    for (let i = 0; i <= max; i++) {
      options.push(<option key={i} value={i}>{i}</option>);
    }
    return options;
  };
  
  // Calculate the total frames
  const calculateTotalFrames = (strikes, spares, opens) => {
    return parseInt(strikes) + parseInt(spares) + parseInt(opens);
  };
  
  // Find opponent name by ID
  const getOpponentName = (opponentId) => {
    if (availableOpponents.length > 0) {
      const opponent = availableOpponents.find(o => o.id.toString() === opponentId.toString());
      return opponent ? opponent.name : 'Unknown';
    }
    return 'Unknown';
  };
  
  return (
    <div className="py-6">
      <h2 className="text-2xl font-semibold mb-6">Games</h2>
      
      {isLoading ? (
        <div className="text-center py-4">
          <p>Loading...</p>
        </div>
      ) : currentBowlerId ? (
        <>
          <div className="bg-white p-6 rounded shadow-sm border border-gray-100 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">Add New Game</h3>
              <button 
                onClick={() => setShowForm(!showForm)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
              >
                {showForm ? 'Cancel' : 'Add Game'}
              </button>
            </div>
            
            {showForm && (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input
                      type="date"
                      name="date"
                      value={formData.date}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">House (Bowling Alley)</label>
                    <input
                      type="text"
                      name="house"
                      value={formData.house}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Lane</label>
                    <div className="flex items-center">
                      <input
                        type="number"
                        name="lane"
                        min="1"
                        max="999"
                        value={formData.lane}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                      <div className="ml-2 flex items-center">
                        <input
                          type="checkbox"
                          id="isPair"
                          name="isPair"
                          checked={formData.isPair}
                          onChange={handleInputChange}
                          className="h-4 w-4 text-blue-500 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <label htmlFor="isPair" className="ml-1 text-sm text-gray-700">Pair</label>
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Opponent</label>
                    <select
                      name="opponent"
                      value={formData.opponent}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="">Select Opponent</option>
                      {availableOpponents.map(opponent => (
                        <option key={opponent.id} value={opponent.id}>{opponent.name}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Pattern</label>
                    <input
                      type="text"
                      name="pattern"
                      value={formData.pattern}
                      onChange={handleInputChange}
                      className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      placeholder="House Shot"
                    />
                  </div>
                </div>
                
                <hr className="my-4" />
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Your Game Details */}
                  <div className="bg-gray-50 p-4 rounded-md">
                    <h4 className="font-medium text-center mb-3 pb-2 border-b border-gray-200">
                      {currentBowler.firstName || ''} {currentBowler.lastName ? currentBowler.lastName.charAt(0) + '.' : ''}
                    </h4>
                    
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                      <input
                        type="number"
                        name="score"
                        min="0"
                        max="300"
                        value={formData.score}
                        onChange={handleInputChange}
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Strikes</label>
                        <select
                          name="strikes"
                          value={formData.strikes}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {generateOptions(12)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Spares</label>
                        <select
                          name="spares"
                          value={formData.spares}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {generateOptions(12)}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Opens</label>
                        <select
                          name="opens"
                          value={formData.opens}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        >
                          {generateOptions(12)}
                        </select>
                      </div>
                    </div>
                    
                    <div className="mt-2 text-sm text-gray-500 text-right">
                      Total Frames: {calculateTotalFrames(formData.strikes, formData.spares, formData.opens)}
                    </div>
                  </div>
                  
                  {/* Opponent Game Details */}
                  {formData.opponent && formData.opponent !== 'none' ? (
                    <div className="bg-gray-50 p-4 rounded-md">
                      <h4 className="font-medium text-center mb-3 pb-2 border-b border-gray-200">
                      {availableOpponents.find(o => {if (!o || !o.id || !formData.opponent) return false;  
                                                          return String(o.id) === String(formData.opponent);
                                                    })?.name || 'Opponent'}
                      </h4>
                      
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Score</label>
                        <input
                          type="number"
                          name="opponentScore"
                          min="0"
                          max="300"
                          value={formData.opponentScore}
                          onChange={handleInputChange}
                          className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          required
                        />
                      </div>
                      
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Strikes</label>
                          <select
                            name="opponentStrikes"
                            value={formData.opponentStrikes}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          >
                            {generateOptions(12)}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Spares</label>
                          <select
                            name="opponentSpares"
                            value={formData.opponentSpares}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          >
                            {generateOptions(12)}
                          </select>
                        </div>
                        
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Opens</label>
                          <select
                            name="opponentOpens"
                            value={formData.opponentOpens}
                            onChange={handleInputChange}
                            className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            required
                          >
                            {generateOptions(12)}
                          </select>
                        </div>
                      </div>
                      
                      <div className="mt-2 text-sm text-gray-500 text-right">
                        Total Frames: {calculateTotalFrames(formData.opponentStrikes, formData.opponentSpares, formData.opponentOpens)}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-gray-50 p-4 rounded-md flex items-center justify-center text-gray-400">
                      <p>Select an opponent to add their game details</p>
                    </div>
                  )}
                </div>
                
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-md transition-colors"
                  >
                    Submit Game
                  </button>
                </div>
              </form>
            )}
          </div>
          
          <h3 className="text-xl font-medium mb-4">Game History</h3>
          
          {games.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {games.map(game => (
                <div key={game.id} className="bg-white p-4 rounded shadow-sm border border-gray-100">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium">{game.house}</h4>
                    <span className="text-sm text-gray-500">{new Date(game.date).toLocaleDateString()}</span>
                  </div>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    <p>Lane: {game.lane} {game.isPair && '(Pair)'}</p>
                    <p>Pattern: {game.pattern}</p>
                  </div>
                  
                  <hr className="my-2" />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <div className="font-medium mb-1">
                        {currentBowler.firstName || ''} {currentBowler.lastName ? currentBowler.lastName.charAt(0) + '.' : ''}
                      </div>
                      <div className="flex justify-between mb-1">
                        <span>Score:</span>
                        <span className="font-medium">{game.score}</span>
                      </div>
                      
                      <div className="grid grid-cols-3 text-sm text-gray-600">
                        <div>Strikes: {game.strikes}</div>
                        <div>Spares: {game.spares}</div>
                        <div>Opens: {game.opens}</div>
                      </div>
                    </div>
                    
                    {game.opponent && (
                      <div>
                        <div className="font-medium mb-1">
                          {getOpponentName(game.opponent)}
                        </div>
                        <div className="flex justify-between mb-1">
                          <span>Score:</span>
                          <span className="font-medium">{game.opponentScore}</span>
                        </div>
                        
                        <div className="grid grid-cols-3 text-sm text-gray-600">
                          <div>Strikes: {game.opponentStrikes}</div>
                          <div>Spares: {game.opponentSpares}</div>
                          <div>Opens: {game.opponentOpens}</div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white p-6 rounded shadow-sm border border-gray-100 text-center text-gray-500">
              No games recorded yet. Add your first game to start tracking your bowling history.
            </div>
          )}
        </>
      ) : (
        <div className="bg-white p-6 rounded shadow-sm border border-gray-100 text-center">
          <p className="text-gray-600 mb-3">Please select a bowler from your account to add games.</p>
          <button 
            onClick={navigateToAccount}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
          >
            Go to Account
          </button>
        </div>
      )}
    </div>
  );
};

export default Games;