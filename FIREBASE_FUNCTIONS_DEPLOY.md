# Firebase Functions Deployment Guide

Your Express backend is now ready to deploy to Firebase Cloud Functions with Firestore.

## Prerequisites

1. **Firebase Project** - Already set up (ojt-tracker-bf9ba)
2. **Firebase CLI** - Install globally: `npm install -g firebase-tools`
3. **Authenticated** - Run: `firebase login`

## Environment Variables for Cloud Functions

Firebase Functions can read environment variables from your deployment environment or a local `.env` file in the `functions` directory.

### Recommended Firebase settings

```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
NODE_ENV=production
```

**Important:** Never commit service account JSON to Git.

### Firestore access

- Enable Firestore in your Firebase project
- Make sure the service account has Firestore permissions

## Deployment Steps

### 1. Test Locally (Optional)
```bash
npm run functions:serve
```
This uses the Firebase Emulator Suite to test functions locally.

### 2. Deploy Functions Only
```bash
npm run functions:deploy
# OR
firebase deploy --only functions
```

### 3. Deploy Everything (Hosting + Functions)
```bash
npm run deploy:all
# OR
firebase deploy
```

### 4. View Logs
```bash
npm run functions:logs
# OR
firebase functions:log
```

## API Access After Deployment

Your API will be accessible at:
```
https://us-central1-ojt-tracker-bf9ba.cloudfunctions.net/api/
```

All endpoints work the same:
- `GET /api/settings`
- `PUT /api/settings`
- `GET /api/entries`
- `PUT /api/entries/:date`
- `DELETE /api/entries/month/:month`
- `GET /api/firebase/status`
- etc.

## Frontend Configuration

Update your frontend's API base URL in `script.js` to use the Cloud Functions URL:

```javascript
const API_BASE = 'https://us-central1-ojt-tracker-bf9ba.cloudfunctions.net';
```

Or keep using localhost:3001 for local development.

## Troubleshooting

### "No service account found"
```bash
firebase init
# Select your project and rebuild authentication
```

### "CORS errors"
- CORS is already configured in the Express app
- Both hosting and functions domains are allowed

### "Database connection failed"
- Verify `.env.local` credentials
- Ensure Cloud SQL or database is accessible from Cloud Functions
- Check firewall rules allow Cloud Functions access

### Check Deployment Status
```bash
firebase deploy --only functions --verbose
```

## Cost Considerations

- **Cloud Functions**: Free tier: 2M invocations/month
- **Firestore**: Generous free tier for small usage
- **Hosting**: 10GB free storage/month

Your app should fit comfortably within free tier limits!

## Rollback

If deployment fails, your previous version remains active:
```bash
firebase deploy --only functions
```

## Next Steps

1. Create `functions/.env.local` with your database credentials
2. Test locally: `npm run functions:serve`
3. Deploy: `npm run deploy:all`
4. Monitor: `npm run functions:logs`
