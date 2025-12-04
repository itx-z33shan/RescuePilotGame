-- Rescue Pilot Game Database Schema
-- Run this after you have the flight_game database with airport table

USE flight_game;

-- Player table
DROP TABLE IF EXISTS player_mission;
DROP TABLE IF EXISTS mission;
DROP TABLE IF EXISTS player;
DROP TABLE IF EXISTS event;

CREATE TABLE player (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fuel INT NOT NULL DEFAULT 2500,
    rescued_people INT DEFAULT 0,
    reputation INT DEFAULT 100,
    current_airport VARCHAR(10) NOT NULL,
    crashed INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Mission table
CREATE TABLE mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airport VARCHAR(10) NOT NULL,
    disaster_type VARCHAR(50) NOT NULL,
    icon VARCHAR(10) NOT NULL,
    severity_level INT NOT NULL,
    people_in_danger INT NOT NULL,
    reward_reputation INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Player-Mission relationship table
CREATE TABLE player_mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    mission_id INT NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    rescued_people INT DEFAULT 0,
    UNIQUE KEY unique_assignment (player_id, mission_id),
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
    FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE
);

-- Event table
CREATE TABLE event (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    description VARCHAR(255),
    probability INT NOT NULL,
    fuel_effect INT DEFAULT 0,
    rescued_effect INT DEFAULT 0,
    reputation_effect INT DEFAULT 0,
    fatal INT DEFAULT 0,
    icon VARCHAR(20) NOT NULL,
    event_type VARCHAR(20) NOT NULL
);

-- Insert events
INSERT INTO event 
(event_name, description, probability, fuel_effect, rescued_effect, reputation_effect, fatal, icon, event_type) 
VALUES
('Fuel Leaked', 'Sabotage or mechanical failure caused a massive leak while you were grounded. Significant fuel loss!', 4, -400, 0, 0, 0, '⛽', 'warning'),
('Terrorist Attack', 'A secondary terrorist attack hits the runway. Your immediate response is scrutinized, causing reputation loss.', 3, -50, 0, -50, 0, '💣', 'danger'),
('Bomb Threat', 'Authorities ground all flights due to a bomb threat. You lose time finding an alternate runway, costing fuel.', 2, -200, 0, -10, 0, '🚨', 'warning'),
('Plane Damage', 'Critical structural damage is discovered on your plane. Continuing is impossible.', 1, 0, 0, -50, 1, '✈️💔', 'danger'),
('Emergency Fuel Drop', 'A nearby military base provides emergency fuel supplies!', 2, 500, 0, 0, 0, '🛢️', 'good'),
('Media Coverage', 'Your heroic efforts were featured on the news! Public trust in your mission increases.', 2, 0, 0, 25, 0, '📺', 'good'),
('Volunteer Support', 'Local volunteers helped rescue additional people while you were landing!', 2, 0, 2, 10, 0, '🤝', 'good'),
('Nothing Happens', 'The airport is secure. All clear!', 5, 0, 0, 0, 0, '✅', 'good');

