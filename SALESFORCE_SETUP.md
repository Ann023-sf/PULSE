# Salesforce Integration Setup

## Required Environment Variables

Add these to your Vercel project settings:

```
SALESFORCE_CLIENT_ID=<Your Connected App Consumer Key>
SALESFORCE_CLIENT_SECRET=<Your Connected App Consumer Secret>
SALESFORCE_REDIRECT_URI=https://your-app.vercel.app/api/salesforce/callback
SALESFORCE_LOGIN_URL=https://login.salesforce.com
```

For sandbox orgs, use:
```
SALESFORCE_LOGIN_URL=https://test.salesforce.com
```

## Salesforce Connected App Setup

1. **Log in to Salesforce Setup**
   - Go to Setup → App Manager → New Connected App

2. **Configure Basic Information**
   - Connected App Name: `Pulse Dashboard`
   - API Name: `Pulse_Dashboard`
   - Contact Email: your email

3. **Enable OAuth Settings**
   - Check "Enable OAuth Settings"
   - Callback URL: `https://your-app.vercel.app/api/salesforce/callback`
   - For local development, also add: `http://localhost:3000/api/salesforce/callback`

4. **Select OAuth Scopes**
   - Access and manage your data (api)
   - Perform requests on your behalf at any time (refresh_token, offline_access)

5. **Save and Get Credentials**
   - After saving, click "Manage Consumer Details"
   - Copy the Consumer Key → `SALESFORCE_CLIENT_ID`
   - Copy the Consumer Secret → `SALESFORCE_CLIENT_SECRET`

6. **IP Relaxation (Optional for testing)**
   - In Connected App settings, set "IP Relaxation" to "Relax IP restrictions"

## API Endpoints

### Authentication
- `GET /api/salesforce/auth` - Initiates OAuth flow
- `GET /api/salesforce/callback` - OAuth callback (handled automatically)
- `GET /api/salesforce/status` - Check connection status
- `DELETE /api/salesforce/status` - Disconnect from Salesforce

### Data
- `GET /api/salesforce/pending-work` - Fetch pending work items

**Query Parameters for `/api/salesforce/pending-work`:**
| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| scope | "me" \| "my_team" | "me" | User scope |
| focusDate | ISO date string | today | Focus date for calculations |
| staleDays | number | 7 | Days without update to flag as stale |

## Data Returned

The `/api/salesforce/pending-work` endpoint returns:

```json
{
  "tasks": {
    "overdue": [...],       // Tasks with ActivityDate < today
    "urgentNext3Days": [...], // Tasks due in next 3 days
    "total": 15
  },
  "cases": {
    "open": [...],          // All open cases
    "stale": [...],         // Cases not updated in X days
    "total": 8
  },
  "opportunities": {
    "closingSoon": [...],   // Closing within 7 days
    "pastDue": [...],       // CloseDate passed but not closed
    "total": 5
  },
  "summary": "Text summary for AI..."
}
```

## Security Notes

- OAuth tokens are stored in HTTP-only cookies (not accessible to JavaScript)
- Refresh tokens are used automatically when access tokens expire
- All Salesforce API calls happen server-side only
- No credentials are ever sent to the browser
