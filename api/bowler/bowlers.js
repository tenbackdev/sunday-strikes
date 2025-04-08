// pages/api/bowler/bowlers.js
import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log('API handler: Request received for bowlers');
  
  if (req.method !== 'GET') {
    console.log('API handler: Invalid method', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('API handler: Starting to fetch bowlers data');
    
    // Read the configuration file
    const configPath = path.join(process.cwd(), 'api.config.json');
    console.log('API handler: Config path -', configPath);
    
    console.log('API handler: Reading config file');
    const configFile = fs.readFileSync(configPath, 'utf8');
    console.log('API handler: Config file content -', configFile);
    
    console.log('API handler: Parsing JSON config');
    const config = JSON.parse(configFile);
    console.log('API handler: Config object -', config);

    console.log('API handler: bowlerMacroId from config -', config.bowlerMacroId);
    
    // IMPORTANT FIX: This line has a bug - you're trying to destructure from config.bowlerMacroId
    // But bowlerMacroId is likely a string value, not an object containing another bowlerMacroId property
    // const { bowlerMacroId } = config.bowlerMacroId; // INCORRECT
    
    // CORRECTED LINE:
    const bowlerMacroId = config.bowlerMacroId; // Direct access, no destructuring needed
    console.log('API handler: Final bowlerMacroId value -', bowlerMacroId);
    
    if (!bowlerMacroId) {
      console.error('API handler: bowlerMacroId is missing or undefined');
      throw new Error('bowlerMacroId is not defined in configuration');
    }

    const apiUrl = `https://script.google.com/macros/s/${bowlerMacroId}/exec?action=getAllBowlers&activeOnly=true`;
    console.log('API handler: Constructed API URL -', apiUrl);
    
    console.log('API handler: Fetching data from external API');
    const response = await fetch(apiUrl);
    console.log('API handler: API response status -', response.status);
    
    if (!response.ok) {
      console.error('API handler: External API returned error status -', response.status);
      throw new Error(`Failed to fetch bowlers from external API: ${response.status}`);
    }
    
    console.log('API handler: Parsing response JSON');
    const data = await response.json();
    console.log('API handler: Received data -', 
      Array.isArray(data) ? `Array with ${data.length} items` : typeof data);
    
    console.log('API handler: Sending successful response');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('API handler: Error occurred -', error.message);
    console.error('API handler: Full error -', error);
    return res.status(500).json({ message: `Failed to fetch bowlers: ${error.message}` });
  }
}