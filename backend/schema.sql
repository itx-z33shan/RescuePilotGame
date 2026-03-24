-- ============================================
-- RESCUE PILOT GAME SCHEMA (TiDB-safe)
-- ============================================

DROP TABLE IF EXISTS player_mission;
DROP TABLE IF EXISTS mission;
DROP TABLE IF EXISTS event;
DROP TABLE IF EXISTS player;

-- ============================================
-- PLAYER TABLE
-- ============================================
CREATE TABLE player (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    fuel INT DEFAULT 2500,
    rescued_people INT DEFAULT 0,
    reputation INT DEFAULT 100,
    current_airport VARCHAR(10),
    crashed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- MISSION TABLE
-- ============================================
CREATE TABLE mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    airport VARCHAR(10) NOT NULL,
    disaster_type VARCHAR(50) NOT NULL,
    icon VARCHAR(10) DEFAULT '🌍',
    severity_level INT NOT NULL,
    people_in_danger INT NOT NULL,
    reward_reputation INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PLAYER_MISSION TABLE
-- ============================================
CREATE TABLE player_mission (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    mission_id INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    rescued_people INT DEFAULT 0,
    completed_at TIMESTAMP NULL,
    FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
    FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE
);

-- ============================================
-- EVENT TABLE
-- ============================================
CREATE TABLE event (
    id INT AUTO_INCREMENT PRIMARY KEY,
    event_name VARCHAR(100) NOT NULL,
    description TEXT,
    probability FLOAT DEFAULT 0.1,
    fuel_effect INT DEFAULT 0,
    rescued_effect INT DEFAULT 0,
    reputation_effect INT DEFAULT 0,
    fatal BOOLEAN DEFAULT FALSE,
    icon VARCHAR(10) DEFAULT '⚡',
    event_type VARCHAR(20) DEFAULT 'neutral'
);

-- ============================================
-- INSERT EVENTS
-- ============================================
INSERT INTO event (
    event_name, description, probability, fuel_effect,
    rescued_effect, reputation_effect, fatal, icon, event_type
) VALUES
('Tailwind Boost', 'Favorable winds saved fuel during approach!', 0.12, 200, 0, 5, FALSE, '🍃', 'positive'),
('Mechanical Issue', 'Minor repairs needed - used extra fuel.', 0.08, -150, 0, -10, FALSE, '🔧', 'negative'),
('Media Coverage', 'Local news covered your heroic efforts!', 0.07, 0, 0, 15, FALSE, '📰', 'positive'),
('Fuel Leak', 'Small fuel leak detected and fixed.', 0.05, -300, 0, -15, FALSE, '💧', 'negative'),
('Smooth Landing', 'Perfect landing. Nothing eventful.', 0.35, 0, 0, 0, FALSE, '✈️', 'neutral'),
('Grateful Survivor', 'A rescued person spread word of your heroism!', 0.06, 0, 0, 20, FALSE, '🙏', 'positive'),
('Turbulence', 'Severe turbulence caused minor issues.', 0.08, -200, 0, -5, FALSE, '🌪️', 'negative'),
('Celebrity Tweet', 'A celebrity tweeted about your service!', 0.04, 0, 0, 25, FALSE, '⭐', 'positive'),
('Engine Failure', 'CRITICAL: Complete engine failure!', 0.02, 0, 0, -50, TRUE, '💥', 'negative'),
('Found Stowaway', 'Discovered a survivor in cargo bay!', 0.04, -50, 1, 10, FALSE, '👤', 'positive'),
('Weather Delay', 'Bad weather caused fuel consumption.', 0.06, -100, 0, 0, FALSE, '🌧️', 'negative'),
('Efficient Route', 'Found a shortcut - saved fuel!', 0.03, 150, 0, 5, FALSE, '🗺️', 'positive');