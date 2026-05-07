# OJT Hours Tracker Backend - Render Deployment

## Setup Instructions for Render

### 1. Create Render Account
- Go to [render.com](https://render.com)
- Sign up and connect your GitHub account

### 2. Prepare Repository

Your backend is already ready. Just make sure:
- `server.js` is your entry point ✓
- `package.json` with all dependencies ✓
- `.env` file with database credentials

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
DB_HOST=your-database-host
DB_PORT=3306
DB_USER=your-database-user
DB_PASSWORD=your-database-password
DB_NAME=ojt_hours_tracker
NODE_ENV=production
```

**Database Options:**
- **Local MySQL**: Use public IP if accessible
- **Cloud SQL**: Use connection string
- **Managed**: Use Render's integrated Postgres (optional migration)

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
- **Database access**: Ensure your MySQL/database allows connections from Render IPs
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
- Check firewall allows Render IPs
- Verify DB_HOST, DB_USER, DB_PASSWORD in environment variables
- For MySQL on local machine: consider Cloud SQL migration

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
