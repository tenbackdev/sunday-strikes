import React from 'react';

const Games = () => {
  return (
    <div className="py-6">
      <h2 className="text-2xl font-semibold mb-6">Games</h2>
      <div className="bg-white p-6 rounded shadow-sm border border-gray-100">
        <p className="text-gray-600">Your upcoming and available games will appear here.</p>
        {/* Game content would go here */}
      </div>
    </div>
  );
};

export default Games;