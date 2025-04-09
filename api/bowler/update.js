import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  console.log('Update API handler: Request received for updating bowler');
  
  if (req.method !== 'POST') {
    console.log('Update API handler: Invalid method', req.method);
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    console.log('Update API handler: Processing update request');
    
    // Extract data from request body
    const { bowlerId, firstName, lastName, isActive } = req.body;
    
    if (!bowlerId) {
      console.error('Update API handler: No bowler ID provided');
      return res.status(400).json({ message: 'Bowler ID is required' });
    }
    
    // Check if at least one update field is provided
    if (firstName === undefined && lastName === undefined && isActive === undefined) {
      console.error('Update API handler: No update fields provided');
      return res.status(400).json({ message: 'At least one update field (firstName, lastName, or isActive) is required' });
    }
    
    // Read the configuration file
    const configPath = path.join(process.cwd(), 'api.config.json');
    const configFile = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configFile);
    
    const bowlerIdManagerDeploymentId = config.bowlerIdManagerDeploymentId;
    
    if (!bowlerIdManagerDeploymentId) {
      console.error('Update API handler: bowlerIdManagerDeploymentId is missing or undefined');
      throw new Error('bowlerIdManagerDeploymentId is not defined in configuration');
    }

    // Construct updates object with only the provided fields
    const updates = {};
    if (firstName !== undefined) updates.firstName = firstName;
    if (lastName !== undefined) updates.lastName = lastName;
    if (isActive !== undefined) updates.isActive = isActive;

    // Prepare request payload
    const payload = {
      function: "updateBowler",
      bowlerId: bowlerId,
      updates: updates
    };
    
    const apiUrl = `https://script.google.com/macros/s/${bowlerIdManagerDeploymentId}/exec`;
    console.log('Update API handler: Constructed API URL -', apiUrl);
    console.log('Update API handler: Sending payload -', JSON.stringify(payload));

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    if (!response.ok) {
      console.error('Update API handler: External API returned error status -', response.status);
      throw new Error(`Failed to update bowler via external API: ${response.status}`);
    }
    
    const data = await response.json();

    console.log('Update API handler: Update successful, sending response');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('Update API handler: Error occurred -', error.message);
    console.error('Update API handler: Full error -', error);
    return res.status(500).json({ message: `Failed to update bowler: ${error.message}` });
  }
}