import { NextRequest, NextResponse } from "next/server";

// Helper to convert PEM string to binary ArrayBuffer
function str2ab(str: string) {
  const buf = new ArrayBuffer(str.length);
  const bufView = new Uint8Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}

// Helper to Base64 Url Encode
function base64UrlEncode(str: string) {
  return btoa(str)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function arrayBufferToBase64Url(buffer: ArrayBuffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}

// Helper to import the private key
async function importPrivateKey(pem: string) {
  // Remove headers and newlines
  const pemContents = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  // Base64 decode
  const binaryDerString = atob(pemContents);
  const binaryDer = str2ab(binaryDerString);

  return crypto.subtle.importKey(
    "pkcs8",
    binaryDer,
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"]
  );
}

// Helper to sign JWT
async function signJwt(payload: any, privateKeyPem: string, sub: string) {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: payload.client_email,
    sub: payload.client_email,
    aud: "https://impersonation.googleapis.com/", // Default usually, but for direct auth we often use token endpoint
    ...payload,
    iat: now,
    exp: now + 3600
  };
  // For Google OAuth2 service account:
  // aud should be "https://oauth2.googleapis.com/token"
  claim.aud = "https://oauth2.googleapis.com/token";
  claim.scope = "https://www.googleapis.com/auth/bigquery";


  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedBody = base64UrlEncode(JSON.stringify(claim));
  const data = `${encodedHeader}.${encodedBody}`;

  const key = await importPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    str2ab(data)
  );

  return `${data}.${arrayBufferToBase64Url(signature)}`;
}

class BigQueryEdgeClient {
  public readonly projectId: string;
  private credentials: { client_email: string; private_key: string };
  private token: string | null = null;
  private tokenExpiry: number = 0;

  constructor(options: { projectId: string; credentials: { client_email: string; private_key: string } }) {
    this.projectId = options.projectId;
    this.credentials = options.credentials;
  }

  private async getAuthToken() {
    // Check if token is valid (with buffer)
    if (this.token && Date.now() < this.tokenExpiry - 60000) {
      return this.token;
    }

    const jwt = await signJwt(
      { client_email: this.credentials.client_email },
      this.credentials.private_key,
      this.credentials.client_email
    );

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get access token: ${errorText}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000);
    return this.token;
  }

  async query(options: { query: string; params?: any; types?: any; location?: string }) {
    const token = await this.getAuthToken();
    const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/queries`;

    const requestBody: any = {
      query: options.query,
      useLegacySql: false,
      parameterMode: "NAMED"
    };

    if (options.params) {
      requestBody.queryParameters = Object.entries(options.params).map(([key, value]) => {
        let type = "STRING";
        let val = value;

        // Prefer explicit type if provided
        if (options.types && options.types[key]) {
          type = options.types[key];
        } else {
          if (typeof value === "number") type = "INT64";
          if (typeof value === "boolean") type = "BOOL";
        }

        return {
          name: key,
          parameterType: { type },
          parameterValue: { value: String(val) }
        };
      });
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`BigQuery Query Failed: ${err}`);
    }

    const data = await response.json();

    // Transform rows from BQ JSON format to object
    const schema = data.schema?.fields || [];
    const rows = data.rows?.map((row: any) => {
      const obj: any = {};
      row.f.forEach((cell: any, index: number) => {
        obj[schema[index].name] = cell.v;
      });
      return obj;
    }) || [];

    // Return rows and raw response
    return [rows, data];
  }

  dataset(datasetId: string) {
    return {
      table: (tableId: string) => ({
        insert: async (rows: any[]) => {
          const token = await this.getAuthToken();
          const url = `https://bigquery.googleapis.com/bigquery/v2/projects/${this.projectId}/datasets/${datasetId}/tables/${tableId}/insertAll`;

          const body = {
            kind: "bigquery#tableDataInsertAllRequest",
            rows: rows.map(r => ({ json: r }))
          };

          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(body)
          });

          if (!response.ok) {
            const err = await response.text();
            throw new Error(`BigQuery Insert Failed: ${err}`);
          }

          const data = await response.json();
          if (data.insertErrors && data.insertErrors.length > 0) {
            throw new Error(JSON.stringify(data.insertErrors));
          }
          return data;
        }
      })
    };
  }
}

export { BigQueryEdgeClient as BigQuery };
