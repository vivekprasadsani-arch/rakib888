import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import twilio from 'twilio';
import { getDb, saveDb } from './src/sheetsDb.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

// Validate and login user with Access Token
app.post('/api/auth/login', async (req, res) => {
  const { token, deviceId, deviceInfo } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Access token is required' });
  }

  const db = await getDb();
  
  // Check if token matches adminToken
  if (token === db.adminToken) {
    return res.json({
      success: true,
      type: 'admin',
      token: token,
      message: 'Admin access granted via master token'
    });
  }

  // Find token in user list
  const userToken = db.tokens.find((t: any) => t.token === token);
  if (!userToken) {
    return res.status(401).json({ error: 'Invalid access token' });
  }

  // Check Expiry
  if (userToken.expiresAt && new Date() > new Date(userToken.expiresAt)) {
    if (userToken.status !== 'expired') {
      userToken.status = 'expired';
      await saveDb(db);
    }
    return res.status(403).json({ error: 'This access token has expired (1-month validity exceeded)' });
  }

  if (userToken.status !== 'active') {
    return res.status(403).json({ error: 'This access token has been disabled' });
  }

  // Device Binding Control
  if (!userToken.deviceFingerprint) {
    userToken.deviceFingerprint = deviceId || 'unknown-device-id';
    userToken.deviceInfo = deviceInfo || 'Unknown Browser';
    await saveDb(db);
  } else {
    if (userToken.deviceFingerprint !== deviceId) {
      return res.status(403).json({
        error: 'Security Block: This access token is already locked to another device or browser. Please contact your system administrator to reset it.'
      });
    }
  }

  return res.json({
    success: true,
    type: userToken.type,
    token: userToken.token,
    message: 'Login successful'
  });
});

// Admin endpoint: Get all tokens
app.get('/api/admin/tokens', async (req, res) => {
  const adminToken = req.headers['authorization'];
  const db = await getDb();

  if (!adminToken || (adminToken !== db.adminToken && !db.tokens.some((t: any) => t.token === adminToken && t.type === 'admin'))) {
    return res.status(401).json({ error: 'Unauthorized admin access' });
  }

  // Auto-expire tokens
  let changed = false;
  db.tokens.forEach((t: any) => {
    if (t.expiresAt && new Date() > new Date(t.expiresAt) && t.status === 'active') {
      t.status = 'expired';
      changed = true;
    }
  });
  if (changed) {
    await saveDb(db);
  }

  res.json({
    adminToken: db.adminToken,
    tokens: db.tokens
  });
});

// Admin endpoint: Update master admin token
app.post('/api/admin/master-token', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const { newMasterToken } = req.body;
  const db = await getDb();

  if (!authHeader || authHeader !== db.adminToken) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!newMasterToken || newMasterToken.trim().length < 4) {
    return res.status(400).json({ error: 'Invalid master token (min length 4)' });
  }

  db.adminToken = newMasterToken.trim();
  await saveDb(db);
  res.json({ success: true, message: 'Master admin token updated successfully' });
});

// Admin endpoint: Add a new user token
app.post('/api/admin/tokens', async (req, res) => {
  const adminToken = req.headers['authorization'];
  const db = await getDb();

  if (!adminToken || (adminToken !== db.adminToken && !db.tokens.some((t: any) => t.token === adminToken && t.type === 'admin'))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { type, customToken, validityDays } = req.body;
  
  let tokenStr = customToken ? customToken.trim() : '';
  if (!tokenStr) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let rand = '';
    for (let i = 0; i < 8; i++) {
      rand += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = type === 'admin' ? 'ADMIN-' : 'USER-';
    tokenStr = `${prefix}${rand}`;
  }

  if (db.tokens.some((t: any) => t.token === tokenStr) || tokenStr === db.adminToken) {
    return res.status(400).json({ error: 'Token already exists' });
  }

  const now = new Date();
  let expiresAt: string | null = null;

  if (validityDays === 'unlimited' || validityDays === -1) {
    expiresAt = null;
  } else if (typeof validityDays === 'number') {
    const expires = new Date();
    expires.setDate(now.getDate() + validityDays);
    expiresAt = expires.toISOString();
  } else {
    const expires = new Date();
    expires.setMonth(now.getMonth() + 1);
    expiresAt = expires.toISOString();
  }

  const newToken = {
    token: tokenStr,
    type: type === 'admin' ? 'admin' : 'user',
    deviceFingerprint: null,
    deviceInfo: null,
    status: 'active' as const,
    createdAt: now.toISOString(),
    expiresAt: expiresAt
  };

  db.tokens.push(newToken);
  await saveDb(db);

  res.json({ success: true, token: newToken });
});

// Admin endpoint: Update user token (Disable, Reset Device, Enable)
app.put('/api/admin/tokens/:token', async (req, res) => {
  const adminToken = req.headers['authorization'];
  const db = await getDb();

  if (!adminToken || (adminToken !== db.adminToken && !db.tokens.some((t: any) => t.token === adminToken && t.type === 'admin'))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token } = req.params;
  const { action } = req.body;

  const targetIndex = db.tokens.findIndex((t: any) => t.token === token);
  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Token not found' });
  }

  if (action === 'disable') {
    db.tokens[targetIndex].status = 'disabled';
  } else if (action === 'enable') {
    db.tokens[targetIndex].status = 'active';
  } else if (action === 'reset') {
    db.tokens[targetIndex].deviceFingerprint = null;
    db.tokens[targetIndex].deviceInfo = null;
  } else {
    return res.status(400).json({ error: 'Invalid action' });
  }

  await saveDb(db);
  res.json({ success: true, token: db.tokens[targetIndex] });
});

// Admin endpoint: Delete user token
app.delete('/api/admin/tokens/:token', async (req, res) => {
  const adminToken = req.headers['authorization'];
  const db = await getDb();

  if (!adminToken || (adminToken !== db.adminToken && !db.tokens.some((t: any) => t.token === adminToken && t.type === 'admin'))) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { token } = req.params;
  const targetIndex = db.tokens.findIndex((t: any) => t.token === token);
  if (targetIndex === -1) {
    return res.status(404).json({ error: 'Token not found' });
  }

  db.tokens.splice(targetIndex, 1);
  await saveDb(db);

  res.json({ success: true, message: 'Token deleted successfully' });
});

// -------------------------------------------------------------
// Disguised Telephony Engine (Twilio Proxy)
// -------------------------------------------------------------

function sanitizeErrorMessage(err: any): string {
  if (!err) return 'Unknown error occurred';
  const code = err.code;
  const msg = err.message || String(err);
  const lowerMsg = msg.toLowerCase();
  
  if (code === 21629 || 
      lowerMsg.includes('trial accounts are allowed only one') ||
      lowerMsg.includes('one twilio number')) {
    return 'You already have an active leased number. Please delete/release your existing active number first and try again.';
  }

  if (lowerMsg.includes('reached the maximum number of phone numbers') ||
      lowerMsg.includes('has reached the maximum') ||
      lowerMsg.includes('upgrade your account to provision')) {
    return 'your account ID token has limit please login a new token then try again number Lease';
  }
  
  return msg.replace(/twilio/gi, 'Signal Registry').replace(/Twilio/g, 'Registry');
}

// Connection Test
app.post('/api/network/connect', async (req, res) => {
  const { accessId, accessKey } = req.body;
  if (!accessId || !accessKey) {
    return res.status(400).json({ error: 'Missing system credentials' });
  }

  try {
    const client = twilio(accessId, accessKey);
    const account = await client.api.v2010.accounts(accessId).fetch();
    let sanitizedName = account.friendlyName || 'Secure Hub';
    sanitizedName = sanitizedName.replace(/twilio/gi, '').replace(/\s+/g, ' ').trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      sanitizedName = 'Secure Signal Gateway';
    }
    res.json({
      success: true,
      name: sanitizedName,
      status: account.status,
      message: 'System authorization established'
    });
  } catch (err: any) {
    res.status(401).json({ error: 'System connection failed. Please check your credentials.' });
  }
});

// Get Active Phone Numbers
app.post('/api/network/numbers', async (req, res) => {
  const { accessId, accessKey } = req.body;
  if (!accessId || !accessKey) {
    return res.status(400).json({ error: 'System credentials required' });
  }

  try {
    const client = twilio(accessId, accessKey);
    const numbersList = await client.incomingPhoneNumbers.list({ limit: 50 });
    
    const formatted = numbersList.map((num: any) => ({
      sid: num.sid,
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality,
      region: num.region,
      country: num.addressRequirements || 'US/CA/PR'
    }));

    res.json({ success: true, numbers: formatted });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Delete Active Phone Number
app.post('/api/network/numbers/delete', async (req, res) => {
  const { accessId, accessKey, numberSid } = req.body;
  if (!accessId || !accessKey || !numberSid) {
    return res.status(400).json({ error: 'Missing parameters' });
  }

  try {
    const client = twilio(accessId, accessKey);
    await client.incomingPhoneNumbers(numberSid).remove();
    res.json({ success: true, message: 'Resource disassociated successfully' });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Search Available Numbers to Buy
app.post('/api/network/search-numbers', async (req, res) => {
  const { accessId, accessKey, country, areaCode } = req.body;
  if (!accessId || !accessKey) {
    return res.status(400).json({ error: 'System credentials required' });
  }

  const countryCode = country || 'US';
  const query: any = { limit: 15 };
  if (areaCode) {
    query.areaCode = parseInt(areaCode);
  }

  try {
    const client = twilio(accessId, accessKey);
    let available: any[] = [];
    
    if (countryCode === 'US') {
      available = await client.availablePhoneNumbers('US').local.list(query);
    } else if (countryCode === 'CA') {
      available = await client.availablePhoneNumbers('CA').local.list(query);
    } else if (countryCode === 'PR') {
      available = await client.availablePhoneNumbers('PR').local.list(query);
    } else {
      available = await client.availablePhoneNumbers(countryCode).local.list(query);
    }

    const formatted = available.map(num => ({
      phoneNumber: num.phoneNumber,
      friendlyName: num.friendlyName,
      locality: num.locality,
      region: num.region,
      postalCode: num.postalCode,
      isoCountry: num.isoCountry
    }));

    res.json({ success: true, numbers: formatted });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Buy and Configure Number
app.post('/api/network/buy-number', async (req, res) => {
  const { accessId, accessKey, phoneNumber } = req.body;
  if (!accessId || !accessKey || !phoneNumber) {
    return res.status(400).json({ error: 'Missing phone number or authorization' });
  }

  try {
    const client = twilio(accessId, accessKey);
    const purchased = await client.incomingPhoneNumbers.create({ phoneNumber });
    res.json({
      success: true,
      phoneNumber: purchased.phoneNumber,
      sid: purchased.sid,
      friendlyName: purchased.friendlyName,
      message: 'Active number successfully leased and operational'
    });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Fetch Live SMS logs with Bangladesh Time (UTC+6)
app.post('/api/network/sms', async (req, res) => {
  const { accessId, accessKey } = req.body;
  if (!accessId || !accessKey) {
    return res.status(400).json({ error: 'System credentials required' });
  }

  try {
    const client = twilio(accessId, accessKey);
    const messages = await client.messages.list({ limit: 40 });

    const formatted = messages
      .filter(msg => msg.direction && msg.direction.toLowerCase().includes('inbound'))
      .map(msg => {
      const dateCreated = new Date(msg.dateCreated);
      const bdTimeString = dateCreated.toLocaleString('en-US', {
        timeZone: 'Asia/Dhaka',
        hour12: true,
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });

      return {
        sid: msg.sid,
        from: msg.from,
        to: msg.to,
        body: msg.body,
        status: msg.status,
        direction: msg.direction,
        dateCreated: msg.dateCreated,
        bdTime: bdTimeString
      };
    });

    res.json({ success: true, sms: formatted });
  } catch (err: any) {
    res.status(500).json({ error: sanitizeErrorMessage(err) });
  }
});

// Serve frontend build in production
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
  app.get('*', (req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.send('Telephony System API is active. Frontend build is not yet generated.');
  });
}

// Port Configuration
const PORT = Number(process.argv[2] ? parseInt(process.argv[2]) : (process.env.PORT || 3000));
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on port ${PORT}`);
});
