import { google } from 'googleapis';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load .env file
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Google Sheets configuration - from environment variables
const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '12EG6YGamhr4Vbymul3CY5MNWqFRtwfKvB1VwGR1WjP0';
const CREDENTIALS_PATH = process.env.GOOGLE_CREDENTIALS_PATH 
  ? path.resolve(process.env.GOOGLE_CREDENTIALS_PATH)
  : path.join(__dirname, '..', 'oasis-numbers-465216-a5c259d21ebf.json');

// Sheet names
const ADMIN_TOKEN_SHEET = 'AdminToken';
const TOKENS_SHEET = 'Tokens';

// Database interface
export interface Database {
  adminToken: string;
  tokens: Token[];
}

export interface Token {
  token: string;
  type: 'user' | 'admin';
  deviceFingerprint: string | null;
  deviceInfo: string | null;
  status: 'active' | 'disabled' | 'expired';
  createdAt?: string;
  expiresAt?: string | null;
}

// Google Sheets client
let sheets: any = null;
let auth: any = null;

// In-memory cache to avoid hitting Google Sheets on every request
let cachedDb: Database | null = null;
let lastSyncTime = 0;
const CACHE_TTL_MS = 5000; // 5 seconds cache

// Get Google credentials - supports both file and environment variable
function getCredentials(): any {
  // Method 1: Try to get credentials from GOOGLE_CREDENTIALS_JSON env var (for Render)
  if (process.env.GOOGLE_CREDENTIALS_JSON) {
    console.log('Loading Google credentials from environment variable');
    return JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
  }
  
  // Method 2: Try to read from file (for local development)
  console.log('Loading Google credentials from file:', CREDENTIALS_PATH);
  const credentialsRaw = fs.readFileSync(CREDENTIALS_PATH, 'utf-8');
  return JSON.parse(credentialsRaw);
}

// Initialize Google Sheets API
async function initGoogleSheets() {
  if (sheets) return sheets;

  try {
    const credentials = getCredentials();
    
    auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    sheets = google.sheets({ version: 'v4', auth });
    
    await ensureSheetsExist();
    
    return sheets;
  } catch (error) {
    console.error('Failed to initialize Google Sheets:', error);
    throw error;
  }
}

// Ensure required sheets exist
async function ensureSheetsExist() {
  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SPREADSHEET_ID,
    });

    const existingSheets = spreadsheet.data.sheets.map(
      (s: any) => s.properties.title
    );

    const sheetsToCreate = [];
    
    if (!existingSheets.includes(ADMIN_TOKEN_SHEET)) {
      sheetsToCreate.push({
        properties: { title: ADMIN_TOKEN_SHEET },
      });
    }
    
    if (!existingSheets.includes(TOKENS_SHEET)) {
      sheetsToCreate.push({
        properties: { title: TOKENS_SHEET },
      });
    }

    if (sheetsToCreate.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        requestBody: {
          requests: sheetsToCreate.map((sheet: any) => ({
            addSheet: sheet,
          })),
        },
      });

      // Initialize AdminToken sheet
      if (!existingSheets.includes(ADMIN_TOKEN_SHEET)) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${ADMIN_TOKEN_SHEET}!A1:B2`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['Key', 'Value'],
              ['adminToken', 'adminRakib017@#$'],
            ],
          },
        });
      }

      // Initialize Tokens sheet with headers and default tokens
      if (!existingSheets.includes(TOKENS_SHEET)) {
        await sheets.spreadsheets.values.update({
          spreadsheetId: SPREADSHEET_ID,
          range: `${TOKENS_SHEET}!A1:G4`,
          valueInputOption: 'RAW',
          requestBody: {
            values: [
              ['token', 'type', 'deviceFingerprint', 'deviceInfo', 'status', 'createdAt', 'expiresAt'],
              ['USER-777-XYZ', 'user', '', '', 'active', '', ''],
              ['ADMIN-888-ABC', 'admin', '', '', 'active', '', ''],
            ],
          },
        });
      }
    }
  } catch (error) {
    console.error('Error ensuring sheets exist:', error);
  }
}

// Deep clone helper to prevent cache mutation
function cloneDb(db: Database): Database {
  return {
    adminToken: db.adminToken,
    tokens: db.tokens.map(t => ({ ...t }))
  };
}

// Get database from Google Sheets (with caching)
export async function getDb(): Promise<Database> {
  const now = Date.now();
  
  // Return a COPY of cached version if still valid (prevents cache mutation)
  if (cachedDb && (now - lastSyncTime) < CACHE_TTL_MS) {
    return cloneDb(cachedDb);
  }

  try {
    await initGoogleSheets();

    // Get admin token
    const adminTokenResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ADMIN_TOKEN_SHEET}!A:B`,
    });

    const adminTokenRows = adminTokenResponse.data.values || [];
    let adminToken = 'adminRakib017@#$';
    
    for (const row of adminTokenRows) {
      if (row[0] === 'adminToken' && row[1]) {
        adminToken = row[1];
        break;
      }
    }

    // Get tokens
    const tokensResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TOKENS_SHEET}!A:G`,
    });

    const tokenRows = tokensResponse.data.values || [];
    const tokens: Token[] = [];

    // Skip header row (index 0)
    for (let i = 1; i < tokenRows.length; i++) {
      const row = tokenRows[i];
      if (row && row[0]) {
        const tokenType = row[1] === 'admin' ? 'admin' : 'user';
        const tokenStatus = ['active', 'disabled', 'expired'].includes(row[4]) 
          ? row[4] as 'active' | 'disabled' | 'expired' 
          : 'active';
        
        tokens.push({
          token: row[0],
          type: tokenType,
          deviceFingerprint: row[2] || null,
          deviceInfo: row[3] || null,
          status: tokenStatus,
          createdAt: row[5] || undefined,
          expiresAt: row[6] || null,
        });
      }
    }

    const db: Database = { adminToken, tokens };
    
    // Update cache with a copy
    cachedDb = cloneDb(db);
    lastSyncTime = now;
    
    return db;
  } catch (error) {
    console.error('Error reading from Google Sheets:', error);
    // Return cached version if available, otherwise defaults
    if (cachedDb) {
      console.warn('Returning cached database due to Sheets read error');
      return cachedDb;
    }
    return {
      adminToken: 'adminRakib017@#$',
      tokens: [
        { token: 'USER-777-XYZ', type: 'user', deviceFingerprint: null, deviceInfo: null, status: 'active' },
        { token: 'ADMIN-888-ABC', type: 'admin', deviceFingerprint: null, deviceInfo: null, status: 'active' },
      ],
    };
  }
}

// Save database to Google Sheets (and update cache)
export async function saveDb(data: Database): Promise<void> {
  try {
    await initGoogleSheets();

    // Save admin token
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${ADMIN_TOKEN_SHEET}!A:B`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [
          ['Key', 'Value'],
          ['adminToken', data.adminToken],
        ],
      },
    });

    // Save tokens (including header)
    const tokenValues = [
      ['token', 'type', 'deviceFingerprint', 'deviceInfo', 'status', 'createdAt', 'expiresAt'],
    ];

    for (const token of data.tokens) {
      tokenValues.push([
        token.token,
        token.type,
        token.deviceFingerprint || '',
        token.deviceInfo || '',
        token.status,
        token.createdAt || '',
        token.expiresAt || '',
      ]);
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${TOKENS_SHEET}!A:G`,
      valueInputOption: 'RAW',
      requestBody: {
        values: tokenValues,
      },
    });

    // Update cache with a COPY after successful save
    cachedDb = cloneDb(data);
    lastSyncTime = Date.now();
    
    console.log('Database saved to Google Sheets successfully');
  } catch (error) {
    console.error('Error saving to Google Sheets:', error);
    throw error;
  }
}

// Force refresh cache (e.g., after admin actions)
export function invalidateCache(): void {
  cachedDb = null;
  lastSyncTime = 0;
}
