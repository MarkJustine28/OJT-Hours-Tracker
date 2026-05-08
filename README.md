# OJT Hours Tracker

Calendar-based OJT tracker with a Node.js + Firestore backend.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: Firestore

## Features
- Log daily OJT hours and status (work, holiday, no-schedule)
- Set required total hours
- See monthly summary and progress bar
- Export DTR CSV
- Persist data in Firestore (no localStorage dependency)

## Setup

1. Install dependencies
	npm install

2. Create environment file
	- Copy `.env.example` to `.env`
	- Add `FIREBASE_SERVICE_ACCOUNT` or `FIREBASE_KEY_PATH`

3. Configure Firebase
	- Make sure Firestore is enabled in your Firebase project
	- Add the Firebase service account JSON to your Render environment or local `.env`

4. Start server
	npm run dev

5. Open app
	http://localhost:3000

## API Endpoints
- GET /api/health
- GET /api/settings
- PUT /api/settings
- GET /api/entries
- PUT /api/entries/:date
- DELETE /api/entries/month/:month

## Notes
- Date format for API entry route: YYYY-MM-DD
- Month format for clear month route: YYYY-MM

