// Vercel Serverless Function - Twilio SMS
// Set TWILIO_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE in Vercel env vars
import twilio from 'twilio';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { lat, lon } = req.body;
  const accountSid = process.env.TWILIO_SID; 
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const client = twilio(accountSid, authToken);

  try {
    await client.messages.create({
      body: `SHAKTHI EMERGENCY: I need help! My location: https://www.google.com/maps?q=${lat},${lon}`,
      from: '+1234567890', // Your Twilio Number
      to: '7624989627'      // Your emergency contact
    });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}