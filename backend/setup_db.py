import mysql.connector
import sys

print("=" * 60)
print("🚀 RESCUE PILOT GAME - Database Setup")
print("=" * 60)

DB_CONFIG = {
    'host': 'localhost',
    'port': 3306,
    'user': 'root',
    'password': '12345'
}

DATABASE_NAME = 'flight_game'

def main():
    conn = None
    try:
        print("\n📡 Connecting to MySQL...")
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor()
        print("✅ Connected to MySQL server")
        
        # Create database
        print(f"\n📁 Creating database '{DATABASE_NAME}'...")
        cursor.execute(f"CREATE DATABASE IF NOT EXISTS {DATABASE_NAME}")
        cursor.execute(f"USE {DATABASE_NAME}")
        conn.commit()
        print(f"✅ Database '{DATABASE_NAME}' ready")
        
        # Drop existing tables
        print("\n🧹 Cleaning old tables...")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 0")
        for table in ['player_mission', 'mission', 'event', 'player']:
            cursor.execute(f"DROP TABLE IF EXISTS {table}")
        cursor.execute("SET FOREIGN_KEY_CHECKS = 1")
        conn.commit()
        
        # Create player table
        print("\n📋 Creating tables...")
        cursor.execute("""
            CREATE TABLE player (
                id INT AUTO_INCREMENT PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                fuel INT DEFAULT 2500,
                rescued_people INT DEFAULT 0,
                reputation INT DEFAULT 100,
                current_airport VARCHAR(10),
                crashed TINYINT(1) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("  ✅ player table created")
        
        # Create mission table WITH ICON COLUMN
        cursor.execute("""
            CREATE TABLE mission (
                id INT AUTO_INCREMENT PRIMARY KEY,
                airport VARCHAR(10) NOT NULL,
                disaster_type VARCHAR(50) NOT NULL,
                icon VARCHAR(10) DEFAULT '🌍',
                severity_level INT NOT NULL,
                people_in_danger INT NOT NULL,
                reward_reputation INT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("  ✅ mission table created (with icon column)")
        
        # Create player_mission table
        cursor.execute("""
            CREATE TABLE player_mission (
                id INT AUTO_INCREMENT PRIMARY KEY,
                player_id INT NOT NULL,
                mission_id INT NOT NULL,
                status ENUM('pending', 'completed', 'failed') DEFAULT 'pending',
                rescued_people INT DEFAULT 0,
                completed_at TIMESTAMP NULL,
                FOREIGN KEY (player_id) REFERENCES player(id) ON DELETE CASCADE,
                FOREIGN KEY (mission_id) REFERENCES mission(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("  ✅ player_mission table created")
        
        # Create event table
        cursor.execute("""
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
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        """)
        print("  ✅ event table created")
        
        # Insert events
        print("\n📝 Inserting events...")
        events = [
            ('Tailwind Boost', 'Favorable winds saved fuel during approach!', 0.12, 200, 0, 5, 0, '🍃', 'positive'),
            ('Mechanical Issue', 'Minor repairs needed - used extra fuel.', 0.08, -150, 0, -10, 0, '🔧', 'negative'),
            ('Media Coverage', 'Local news covered your heroic efforts!', 0.07, 0, 0, 15, 0, '📰', 'positive'),
            ('Fuel Leak', 'Small fuel leak detected and fixed.', 0.05, -300, 0, -15, 0, '💧', 'negative'),
            ('Smooth Landing', 'Perfect landing. Nothing eventful.', 0.35, 0, 0, 0, 0, '✈️', 'neutral'),
            ('Grateful Survivor', 'A rescued person spread word of your heroism!', 0.06, 0, 0, 20, 0, '🙏', 'positive'),
            ('Turbulence', 'Severe turbulence caused minor issues.', 0.08, -200, 0, -5, 0, '🌪️', 'negative'),
            ('Celebrity Tweet', 'A celebrity tweeted about your service!', 0.04, 0, 0, 25, 0, '⭐', 'positive'),
            ('Engine Failure', 'CRITICAL: Complete engine failure!', 0.02, 0, 0, -50, 1, '💥', 'negative'),
            ('Found Stowaway', 'Discovered a survivor in cargo bay!', 0.04, -50, 1, 10, 0, '👤', 'positive'),
            ('Weather Delay', 'Bad weather caused fuel consumption.', 0.06, -100, 0, 0, 0, '🌧️', 'negative'),
            ('Efficient Route', 'Found a shortcut - saved fuel!', 0.03, 150, 0, 5, 0, '🗺️', 'positive')
        ]
        
        cursor.executemany("""
            INSERT INTO event (event_name, description, probability, fuel_effect, 
                               rescued_effect, reputation_effect, fatal, icon, event_type)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, events)
        conn.commit()
        print(f"  ✅ Inserted {len(events)} events")
        
        # Verify tables
        print("\n🔍 Verifying structure...")
        cursor.execute("SHOW TABLES")
        tables = [row[0] for row in cursor.fetchall()]
        print(f"  Tables: {', '.join(tables)}")
        
        # Verify icon column
        cursor.execute("DESCRIBE mission")
        columns = [row[0] for row in cursor.fetchall()]
        if 'icon' in columns:
            print("  ✅ 'icon' column verified in mission table")
        else:
            print("  ❌ 'icon' column MISSING!")
            sys.exit(1)
        
        # Check airport table
        cursor.execute("SHOW TABLES LIKE 'airport'")
        if cursor.fetchone():
            cursor.execute("SELECT COUNT(*) FROM airport WHERE continent = 'EU' AND type = 'large_airport'")
            count = cursor.fetchone()[0]
            print(f"  ✅ Airport table: {count} European airports")
        else:
            print("  ⚠️  Airport table NOT FOUND!")
            print("\n" + "=" * 60)
            print("⚠️  WARNING: Airport table is required!")
            print("=" * 60)
            print("""
The game needs airport data to work. You need to import it.

If you have airport data from another flight_game database,
you can export and import it:

1. Export: mysqldump -u root -p12345 old_db airport > airport.sql
2. Import: mysql -u root -p12345 flight_game < airport.sql
""")
        
        print("\n" + "=" * 60)
        print("🎉 DATABASE SETUP COMPLETE!")
        print("=" * 60)
        print("""
Next steps:
1. Ensure 'airport' table exists with data
2. Run: python app.py
3. Open browser and play!
""")
        
    except mysql.connector.Error as err:
        print(f"\n❌ MySQL Error: {err}")
        if "Access denied" in str(err):
            print("🔧 Check username/password in setup_db.py")
        elif "Can't connect" in str(err):
            print("🔧 Make sure MySQL is running")
        sys.exit(1)
        
    finally:
        if conn and conn.is_connected():
            cursor.close()
            conn.close()
            print("\n🔌 Connection closed")

if __name__ == "__main__":
    main()