import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log('Add API handler: Request received for adding new bowler');
  
  if (req.method !== 'POST') {
    console.log('Add API handler: Invalid method', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Add API handler: Processing add request');
    
    // Extract data from request body
    const { firstName, lastName, isActive } = req.body;
    
    // Check if required fields are provided
    if (!firstName || !lastName) {
      console.error('Add API handler: Missing required fields');
      return res.status(400).json({ message: 'First name and last name are required' });
    }
    
    // Read the configuration file
    const configPath = path.join(process.cwd(), 'api.config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configFile);
    
    const bowlerIdManagerDeploymentId = config.bowlerMacroId;
    
    if (!bowlerIdManagerDeploymentId) {
      console.error('Add API handler: bowlerIdManagerDeploymentId is missing or undefined');
      throw new Error('bowlerIdManagerDeploymentId is not defined in configuration');
    }

    // Prepare request payload
    const payload = {
      function: "addBowler",
      firstName: firstName,
      lastName: lastName,
      isActive: isActive !== undefined ? isActive : true
    };
    
    const apiUrl = `https://script.google.com/macros/s/${bowlerIdManagerDeploymentId}/exec`;
    console.log('Add API handler: Constructed API URL -', apiUrl);
    console.log('Add API handler: Sending payload -', JSON.stringify(payload));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Add API handler: External API returned error status -', response.status);
      throw new Error(`Failed to add bowler via external API: ${response.status}`);
    }
    
    const data = await response.json();

    console.log('Add API handler: Add operation successful, sending response');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Add API handler: Error occurred -', error.message);
    console.error('Add API handler: Full error -', error);
    return res.status(500).json({ message: `Failed to add bowler: ${error.message}` });
  }
}