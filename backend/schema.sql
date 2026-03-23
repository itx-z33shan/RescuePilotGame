-- RESCUE PILOT GAME SCHEMA

SET FOREIGN_KEY_CHECKS = 0;

DROP TABLE IF EXISTS player_mission;
DROP TABLE IF EXISTS mission;
DROP TABLE IF EXISTS event;
DROP TABLE IF EXISTS player;

SET FOREIGN_KEY_CHECKS = 1;

-- Player table
CREATE TABLE player (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fuel INT DEFAULT 2500,
    rescued_people INT DEFAULT 0,
    reputation INT DEFAULT 100,
    current_airport VARCHAR(10),
    crashed TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Mission table (with icon!)
CREATE TABLE mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airport VARCHAR(10) NOT NULL,
    disaster_type VARCHAR(50) NOT NULL,
    icon VARCHAR(10) DEFAULT '🌍',
    severity_level INT NOT NULL,
    people_in_danger INT NOT NULL,
    reward_reputation INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Player-Mission junction
CREATE TABLE player_mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    mission_id INT NOT NULL,
    status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
    rescued_people INT DEFAULT 0,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
    FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Event table
CREATE TABLE event (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    probability FLOAT DEFAULT 0.1,
    fuel_effect INT DEFAULT 0,
    rescued_effect INT DEFAULT 0,
    reputation_effect INT DEFAULT 0,
    fatal TINYINT(1) DEFAULT 0,
    icon VARCHAR(10) DEFAULT '⚡',
    event_type ENUM('positive', 'negative', 'neutral') DEFAULT 'neutral'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Default events
INSERT INTO event VALUES
(1, 'Tailwind Boost', 'Favorable winds saved fuel!', 0.12, 200, 0, 5, 0, '🍃', 'positive'),
(2, 'Mechanical Issue', 'Minor repairs needed.', 0.08, -150, 0, -10, 0, '🔧', 'negative'),
(3, 'Media Coverage', 'News covered your efforts!', 0.07, 0, 0, 15, 0, '📰', 'positive'),
(4, 'Fuel Leak', 'Small leak detected.', 0.05, -300, 0, -15, 0, '💧', 'negative'),
(5, 'Smooth Landing', 'Nothing eventful.', 0.35, 0, 0, 0, 0, '✈️', 'neutral'),
(6, 'Grateful Survivor', 'Word of heroism spread!', 0.06, 0, 0, 20, 0, '🙏', 'positive'),
(7, 'Turbulence', 'Severe turbulence hit.', 0.08, -200, 0, -5, 0, '🌪️', 'negative'),
(8, 'Celebrity Tweet', 'Celebrity endorsed you!', 0.04, 0, 0, 25, 0, '⭐', 'positive'),
(9, 'Engine Failure', 'CRITICAL FAILURE!', 0.02, 0, 0, -50, 1, '💥', 'negative'),
(10, 'Found Stowaway', 'Survivor in cargo!', 0.04, -50, 1, 10, 0, '👤', 'positive'),
(11, 'Weather Delay', 'Bad weather delay.', 0.06, -100, 0, 0, 0, '🌧️', 'negative'),
(12, 'Efficient Route', 'Shortcut found!', 0.03, 150, 0, 5, 0, '🗺️', 'positive');