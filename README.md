# OJT Hours Tracker

Calendar-based OJT tracker with a Node.js + MySQL backend.

## Stack
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js, Express
- Database: MySQL

## Features
- Log daily OJT hours and status (work, holiday, no-schedule)
- Set required total hours
- See monthly summary and progress bar
- Export DTR CSV
- Persist data in MySQL (no localStorage dependency)

## Setup

1. Install dependencies
	npm install

2. Create environment file
	- Copy .env.example to .env
	- Update DB credentials in .env

3. Create database schema
	- Run sql/schema.sql in your MySQL server
	- Example command:
	  mysql -u root -p < sql/schema.sql

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

