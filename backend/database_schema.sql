-- RealTime Messenger Database Schema
-- Run this to create the database and tables manually

CREATE DATABASE IF NOT EXISTS realtime_messenger;
USE realtime_messenger;

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    first_Name VARCHAR(100) NOT NULL,
    last_Name VARCHAR(100) NOT NULL,
    gender VARCHAR(10),
    birth_Date DATETIME,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    created_At DATETIME NOT NULL,
    updated_At DATETIME NOT NULL,
    INDEX idx_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Messages table
CREATE TABLE IF NOT EXISTS Messages (
    Id INT AUTO_INCREMENT PRIMARY KEY,
    SenderId INT NOT NULL,
    ReceiverId INT NOT NULL,
    Content VARCHAR(1000) NOT NULL,
    SentAt DATETIME NOT NULL,
    IsRead BOOLEAN DEFAULT FALSE,
    INDEX idx_sender (SenderId),
    INDEX idx_receiver (ReceiverId),
    INDEX idx_sent_at (SentAt),
    INDEX idx_conversation (SenderId, ReceiverId, SentAt)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Optional: Add some sample data
INSERT INTO users (first_Name, last_Name, gender, birth_Date, email, password, created_At, updated_At)
VALUES 
    ('John', 'Doe', 'Male', '1990-01-01', 'john@example.com', 'password123', NOW(), NOW()),
    ('Jane', 'Smith', 'Female', '1992-05-15', 'jane@example.com', 'password123', NOW(), NOW());
