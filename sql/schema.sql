CREATE DATABASE IF NOT EXISTS ojt_hours_tracker;
USE ojt_hours_tracker;

CREATE TABLE IF NOT EXISTS settings (
  id TINYINT PRIMARY KEY,
  required_hours INT NOT NULL DEFAULT 240,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT INTO settings (id, required_hours)
VALUES (1, 240)
ON DUPLICATE KEY UPDATE required_hours = required_hours;

CREATE TABLE IF NOT EXISTS time_entries (
  entry_date DATE PRIMARY KEY,
  hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  status ENUM('work', 'holiday', 'no-schedule') NOT NULL DEFAULT 'work',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
