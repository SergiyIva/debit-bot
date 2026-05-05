import { existsSync, readFileSync } from 'node:fs';
import { GoogleAuth } from 'google-auth-library';

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

interface ServiceAccountCredentials {
  type: string;
  client_email: string;
  private_key: string;
  project_id?: string;
}

function loadServiceAccount(raw: string): ServiceAccountCredentials {
  const trimmed = raw.trim();

  // Path to file
  if (!trimmed.startsWith('{') && existsSync(trimmed)) {
    const fileContent = readFileSync(trimmed, 'utf8');
    return JSON.parse(fileContent);
  }

  // Inline JSON
  return JSON.parse(trimmed);
}

export function createGoogleAuth(credentialsRaw: string): GoogleAuth {
  const credentials = loadServiceAccount(credentialsRaw);

  if (credentials.type !== 'service_account') {
    throw new Error(
      `CREDENTIALS_GOOGLE must be a service account key (got type="${credentials.type}")`,
    );
  }

  return new GoogleAuth({
    credentials: {
      client_email: credentials.client_email,
      private_key: credentials.private_key,
    },
    scopes: SCOPES,
  });
}
