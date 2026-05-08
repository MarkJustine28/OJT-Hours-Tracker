# OJT Hours Tracker Backend - Render Deployment

## Setup Instructions for Render

### 1. Create Render Account
- Go to [render.com](https://render.com)
- Sign up and connect your GitHub account

### 2. Prepare Repository

Your backend is already ready. Just make sure:
- `server.js` is your entry point ✓
- `package.json` with all dependencies ✓
- `.env` file or Render environment variables with Firebase credentials

### 3. Create New Web Service on Render

1. **Dashboard** → **New** → **Web Service**
2. **Connect Repository** → Select your GitHub repo
3. **Configuration**:
   - **Name**: `ojt-hours-tracker-api`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: Free (or Starter for reliability)

### 4. Add Environment Variables

In Render Dashboard → **Environment**:

```
PORT=3000
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"..."}
# or: FIREBASE_KEY_PATH=/opt/render/project/src/service-account.json
NODE_ENV=production
```

**Firebase Options:**
- **Service account JSON**: Store it in a Render environment variable
- **Key path**: Mount a JSON file and point `FIREBASE_KEY_PATH` to it

### 5. Deploy

- Render auto-deploys on git push
- Or manually deploy from Render Dashboard
- Wait 2-3 minutes for deployment

### 6. Get Your Backend URL

Once deployed, Render provides:
```
https://ojt-hours-tracker-api.onrender.com
```

### 7. Update Frontend

Update `script.js` to use your Render backend:

```javascript
const API_BASE = 'https://ojt-hours-tracker-api.onrender.com';
```

### Cost

- **Free Tier**: Limited, spins down after 15 mins inactivity
- **Starter**: $7/month, always on, 0.5 GB RAM
- Good for small APIs like yours

### Important Notes

- **Free tier limitation**: Services spin down after 15 mins of inactivity (add 30 sec boot time)
- **Firebase access**: Ensure the service account has Firestore permissions
- **Auto-deploy**: Enable GitHub auto-deploy for continuous deployment

---

## Quick Start

```bash
# 1. Push to GitHub
git add .
git commit -m "Setup Render deployment"
git push origin main

# 2. Connect to Render via dashboard
# 3. Add environment variables
# 4. Deploy!
# 5. Update frontend API_BASE URL
```

## Troubleshooting

### "Cannot connect to database"
- Verify `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_KEY_PATH` is set
- Confirm Firestore is enabled for the Firebase project
- Make sure the service account has access to Firestore

### "Port already in use"
- server.js already handles port conflicts, tries next port automatically
- Render will use the assigned PORT env variable

### "Deployment fails"
- Check build logs in Render Dashboard
- Verify `npm install` and `npm start` work locally
- Ensure package.json has all dependencies

### "Free tier keeps spinning down"
- Upgrade to Starter tier ($7/month)
- Or use health check endpoint to keep it warm
