import json
import random
import math
from flask import Flask, request, jsonify
from flask_cors import CORS
from database import Database

# Initialize Flask app
app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Database instance
db = Database()

# Game Configuration
CONFIG = {
    'start_fuel': 2500,
    'start_reputation': 100,
    'missions_available': 12,
    'missions_to_complete': 6,
    'recharge_cost': 20,
    'recharge_gain': 1000,
    'max_fuel': 3500,
    'max_reputation': 200
}

# Mission Templates
MISSION_TEMPLATES = [
    {'disaster': 'Flood', 'icon': '🌊', 'severity_range': [2, 4], 'people_range': [3, 6], 'reward': 10},
    {'disaster': 'Crash', 'icon': '💥', 'severity_range': [3, 5], 'people_range': [2, 5], 'reward': 15},
    {'disaster': 'Earthquake', 'icon': '🏚️', 'severity_range': [4, 6], 'people_range': [5, 9], 'reward': 25},
    {'disaster': 'Fire', 'icon': '🔥', 'severity_range': [2, 4], 'people_range': [2, 5], 'reward': 12},
    {'disaster': 'Storm', 'icon': '🌪️', 'severity_range': [3, 5], 'people_range': [3, 7], 'reward': 18},
    {'disaster': 'Avalanche', 'icon': '🏔️', 'severity_range': [4, 6], 'people_range': [2, 4], 'reward': 20},
    {'disaster': 'Tsunami', 'icon': '🌊', 'severity_range': [5, 7], 'people_range': [6, 10], 'reward': 30},
    {'disaster': 'Volcanic', 'icon': '🌋', 'severity_range': [5, 7], 'people_range': [4, 8], 'reward': 28},
    {'disaster': 'Landslide', 'icon': '⛰️', 'severity_range': [3, 5], 'people_range': [3, 6], 'reward': 16},
    {'disaster': 'Explosion', 'icon': '💣', 'severity_range': [4, 6], 'people_range': [4, 7], 'reward': 22}
]

AIRPORT_TYPE_FILTER = "('large_airport', 'medium_airport')"


# ============================================
# UTILITY FUNCTIONS
# ============================================

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates using Haversine formula"""
    R = 6371
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lon / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return round(R * c)


# ============================================
# AIRPORT ROUTES
# ============================================

@app.route('/api/airports', methods=['GET'])
def get_airports():
    """Get random European airports"""
    limit = request.args.get('limit', 25, type=int)

    sql = f"""
        SELECT ident, name, latitude_deg, longitude_deg
        FROM airport
        WHERE continent = 'EU'
        AND type IN {AIRPORT_TYPE_FILTER}
        ORDER BY RAND()
        LIMIT %s
    """
    cursor = db.get_cursor()
    cursor.execute(sql, (limit,))
    airports = cursor.fetchall()

    return jsonify(airports)


@app.route('/api/airport/<icao>', methods=['GET'])
def get_airport(icao):
    """Get single airport by ICAO code"""
    sql = "SELECT ident, name, latitude_deg, longitude_deg FROM airport WHERE ident = %s"
    cursor = db.get_cursor()
    cursor.execute(sql, (icao,))
    airport = cursor.fetchone()

    if airport:
        return jsonify(airport)
    return jsonify({'error': 'Airport not found'}), 404


@app.route('/api/airports/distance', methods=['POST'])
def calculate_airport_distance():
    """Calculate distance between two airports"""
    data = request.get_json()
    icao1 = data.get('from')
    icao2 = data.get('to')

    cursor = db.get_cursor()

    cursor.execute("SELECT latitude_deg, longitude_deg FROM airport WHERE ident = %s", (icao1,))
    airport1 = cursor.fetchone()

    cursor.execute("SELECT latitude_deg, longitude_deg FROM airport WHERE ident = %s", (icao2,))
    airport2 = cursor.fetchone()

    if not airport1 or not airport2:
        return jsonify({'error': 'Airport not found'}), 404

    distance = calculate_distance(
        airport1['latitude_deg'], airport1['longitude_deg'],
        airport2['latitude_deg'], airport2['longitude_deg']
    )

    return jsonify({'distance': distance})


# ============================================
# PLAYER ROUTES
# ============================================

@app.route('/api/player', methods=['POST'])
def create_player():
    """Create a new player and initialize game"""
    data = request.get_json()
    player_name = data.get('name', 'Pilot')

    cursor = db.get_cursor()

    # Get random starting airport
    cursor.execute(f"""
        SELECT ident FROM airport
        WHERE continent = 'EU'
        AND type IN {AIRPORT_TYPE_FILTER}
        ORDER BY RAND()
        LIMIT 1
    """)
    start_row = cursor.fetchone()

    if not start_row:
        return jsonify({'error': 'No airports available in database'}), 500

    start_airport = start_row['ident']

    # Create player
    sql = """
        INSERT INTO player (name, fuel, rescued_people, reputation, current_airport, crashed)
        VALUES (%s, %s, %s, %s, %s, 0)
    """
    cursor.execute(sql, (
        player_name,
        CONFIG['start_fuel'],
        0,
        CONFIG['start_reputation'],
        start_airport
    ))

    player_id = cursor.lastrowid

    # Get mission airports
    cursor.execute(f"""
        SELECT ident, name, latitude_deg, longitude_deg
        FROM airport
        WHERE continent = 'EU'
        AND type IN {AIRPORT_TYPE_FILTER}
        AND ident != %s
        ORDER BY RAND()
        LIMIT %s
    """, (start_airport, CONFIG['missions_available']))

    mission_airports = cursor.fetchall()

    missions = []
    for i, airport in enumerate(mission_airports):
        if i < 4:
            template = random.choice([t for t in MISSION_TEMPLATES if t['severity_range'][1] <= 5])
            severity = random.randint(2, 4)
        elif i < 8:
            template = random.choice(MISSION_TEMPLATES)
            severity = random.randint(template['severity_range'][0], template['severity_range'][1])
        else:
            template = random.choice([t for t in MISSION_TEMPLATES if t['severity_range'][0] >= 4])
            severity = random.randint(template['severity_range'][0], template['severity_range'][1])

        people = random.randint(template['people_range'][0], template['people_range'][1])

        cursor.execute("""
            INSERT INTO mission (airport, disaster_type, icon, severity_level, people_in_danger, reward_reputation)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (airport['ident'], template['disaster'], template['icon'], severity, people, template['reward']))

        mission_id = cursor.lastrowid

        cursor.execute("""
            INSERT INTO player_mission (player_id, mission_id, status)
            VALUES (%s, %s, 'pending')
        """, (player_id, mission_id))

        missions.append({
            'id': mission_id,
            'airport': airport,
            'disaster': template['disaster'],
            'icon': template['icon'],
            'severity': severity,
            'peopleInDanger': people,
            'reward': template['reward'],
            'status': 'pending'
        })

    cursor.execute(
        "SELECT ident, name, latitude_deg, longitude_deg FROM airport WHERE ident = %s",
        (start_airport,)
    )
    start_airport_info = cursor.fetchone()

    return jsonify({
        'playerId': player_id,
        'playerName': player_name,
        'fuel': CONFIG['start_fuel'],
        'reputation': CONFIG['start_reputation'],
        'rescuedPeople': 0,
        'currentAirport': start_airport_info,
        'missions': missions,
        'config': CONFIG
    })


@app.route('/api/player/<int:player_id>', methods=['GET'])
def get_player(player_id):
    """Get player information"""
    cursor = db.get_cursor()

    cursor.execute("SELECT * FROM player WHERE id = %s", (player_id,))
    player = cursor.fetchone()

    if not player:
        return jsonify({'error': 'Player not found'}), 404

    cursor.execute("""
        SELECT ident, name, latitude_deg, longitude_deg
        FROM airport WHERE ident = %s
    """, (player['current_airport'],))
    current_airport = cursor.fetchone()

    cursor.execute("""
        SELECT m.id, m.airport, m.disaster_type, m.icon, m.severity_level,
               m.people_in_danger, m.reward_reputation, pm.status,
               a.name as airport_name, a.latitude_deg, a.longitude_deg
        FROM player_mission pm
        JOIN mission m ON pm.mission_id = m.id
        JOIN airport a ON m.airport = a.ident
        WHERE pm.player_id = %s
    """, (player_id,))
    missions_data = cursor.fetchall()

    missions = []
    for m in missions_data:
        missions.append({
            'id': m['id'],
            'airport': {
                'ident': m['airport'],
                'name': m['airport_name'],
                'latitude_deg': m['latitude_deg'],
                'longitude_deg': m['longitude_deg']
            },
            'disaster': m['disaster_type'],
            'icon': m['icon'],
            'severity': m['severity_level'],
            'peopleInDanger': m['people_in_danger'],
            'reward': m['reward_reputation'],
            'status': m['status']
        })

    return jsonify({
        'playerId': player['id'],
        'playerName': player['name'],
        'fuel': player['fuel'],
        'reputation': player['reputation'],
        'rescuedPeople': player['rescued_people'],
        'currentAirport': current_airport,
        'crashed': player['crashed'],
        'missions': missions,
        'config': CONFIG
    })


@app.route('/api/player/<int:player_id>', methods=['PUT'])
def update_player(player_id):
    """Update player stats"""
    data = request.get_json()
    cursor = db.get_cursor()

    updates = []
    values = []

    if 'fuel' in data:
        updates.append('fuel = %s')
        values.append(data['fuel'])

    if 'reputation' in data:
        updates.append('reputation = %s')
        values.append(data['reputation'])

    if 'rescuedPeople' in data:
        updates.append('rescued_people = %s')
        values.append(data['rescuedPeople'])

    if 'currentAirport' in data:
        updates.append('current_airport = %s')
        values.append(data['currentAirport'])

    if 'crashed' in data:
        updates.append('crashed = %s')
        values.append(data['crashed'])

    if updates:
        sql = f"UPDATE player SET {', '.join(updates)} WHERE id = %s"
        values.append(player_id)
        cursor.execute(sql, tuple(values))

    return jsonify({'success': True})


# ============================================
# MISSION ROUTES
# ============================================

@app.route('/api/player/<int:player_id>/mission/<int:mission_id>', methods=['GET'])
def get_mission_at_airport(player_id, mission_id):
    """Get mission details"""
    cursor = db.get_cursor()

    cursor.execute("""
        SELECT m.id, m.airport, m.disaster_type, m.icon, m.severity_level,
               m.people_in_danger, m.reward_reputation, pm.status,
               a.name as airport_name, a.latitude_deg, a.longitude_deg
        FROM player_mission pm
        JOIN mission m ON pm.mission_id = m.id
        JOIN airport a ON m.airport = a.ident
        WHERE pm.player_id = %s AND m.id = %s
    """, (player_id, mission_id))

    mission = cursor.fetchone()

    if not mission:
        return jsonify({'error': 'Mission not found'}), 404

    return jsonify({
        'id': mission['id'],
        'airport': {
            'ident': mission['airport'],
            'name': mission['airport_name'],
            'latitude_deg': mission['latitude_deg'],
            'longitude_deg': mission['longitude_deg']
        },
        'disaster': mission['disaster_type'],
        'icon': mission['icon'],
        'severity': mission['severity_level'],
        'peopleInDanger': mission['people_in_danger'],
        'reward': mission['reward_reputation'],
        'status': mission['status']
    })


@app.route('/api/player/<int:player_id>/check-mission', methods=['POST'])
def check_mission_at_current_airport(player_id):
    """Check if there's a pending mission at current airport"""
    data = request.get_json()
    airport_icao = data.get('airport')

    cursor = db.get_cursor()

    cursor.execute("""
        SELECT m.id, m.airport, m.disaster_type, m.icon, m.severity_level,
               m.people_in_danger, m.reward_reputation, pm.status,
               a.name as airport_name, a.latitude_deg, a.longitude_deg
        FROM player_mission pm
        JOIN mission m ON pm.mission_id = m.id
        JOIN airport a ON m.airport = a.ident
        WHERE pm.player_id = %s AND m.airport = %s AND pm.status = 'pending'
    """, (player_id, airport_icao))

    mission = cursor.fetchone()

    if not mission:
        return jsonify({'hasMission': False})

    return jsonify({
        'hasMission': True,
        'mission': {
            'id': mission['id'],
            'airport': {
                'ident': mission['airport'],
                'name': mission['airport_name'],
                'latitude_deg': mission['latitude_deg'],
                'longitude_deg': mission['longitude_deg']
            },
            'disaster': mission['disaster_type'],
            'icon': mission['icon'],
            'severity': mission['severity_level'],
            'peopleInDanger': mission['people_in_danger'],
            'reward': mission['reward_reputation'],
            'status': mission['status']
        }
    })


@app.route('/api/player/<int:player_id>/mission/<int:mission_id>/attempt', methods=['POST'])
def attempt_mission(player_id, mission_id):
    """Attempt a rescue mission"""
    cursor = db.get_cursor()

    cursor.execute("""
        SELECT m.severity_level, m.people_in_danger, m.reward_reputation
        FROM mission m
        JOIN player_mission pm ON m.id = pm.mission_id
        WHERE m.id = %s AND pm.player_id = %s AND pm.status = 'pending'
    """, (mission_id, player_id))

    mission = cursor.fetchone()

    if not mission:
        return jsonify({'error': 'Mission not found or already completed'}), 404

    success_roll = random.randint(1, 10)
    adjusted_roll = success_roll + 1
    success = adjusted_roll >= mission['severity_level']

    if success:
        cursor.execute("""
            UPDATE player_mission
            SET status = 'completed', rescued_people = %s
            WHERE player_id = %s AND mission_id = %s
        """, (mission['people_in_danger'], player_id, mission_id))

        cursor.execute("""
            UPDATE player
            SET rescued_people = rescued_people + %s,
                reputation = reputation + %s
            WHERE id = %s
        """, (mission['people_in_danger'], mission['reward_reputation'], player_id))

        cursor.execute("""
            SELECT COUNT(*) as completed FROM player_mission
            WHERE player_id = %s AND status = 'completed'
        """, (player_id,))
        completed_count = cursor.fetchone()['completed']

        return jsonify({
            'success': True,
            'peopleRescued': mission['people_in_danger'],
            'reputationGained': mission['reward_reputation'],
            'roll': success_roll,
            'adjusted_roll': adjusted_roll,
            'needed': mission['severity_level'],
            'completedMissions': completed_count,
            'missionsToWin': CONFIG['missions_to_complete'],
            'victory': completed_count >= CONFIG['missions_to_complete']
        })
    else:
        rep_loss = mission['reward_reputation'] // 2

        cursor.execute("""
            UPDATE player_mission SET status = 'failed'
            WHERE player_id = %s AND mission_id = %s
        """, (player_id, mission_id))

        cursor.execute("""
            UPDATE player SET reputation = reputation - %s
            WHERE id = %s
        """, (rep_loss, player_id))

        return jsonify({
            'success': False,
            'reputationLost': rep_loss,
            'roll': success_roll,
            'adjusted_roll': adjusted_roll,
            'needed': mission['severity_level'],
            'victory': False
        })


@app.route('/api/player/<int:player_id>/mission/<int:mission_id>/skip', methods=['POST'])
def skip_mission(player_id, mission_id):
    """Skip a mission without attempting it"""
    cursor = db.get_cursor()
    skip_penalty = 5

    cursor.execute("""
        UPDATE player SET reputation = GREATEST(0, reputation - %s)
        WHERE id = %s
    """, (skip_penalty, player_id))

    cursor.execute("SELECT reputation FROM player WHERE id = %s", (player_id,))
    new_rep = cursor.fetchone()['reputation']

    return jsonify({
        'success': True,
        'reputationLost': skip_penalty,
        'newReputation': new_rep
    })


# ============================================
# EVENT ROUTES
# ============================================

@app.route('/api/events', methods=['GET'])
def get_all_events():
    """Get all events"""
    cursor = db.get_cursor()
    cursor.execute("SELECT * FROM event")
    events = cursor.fetchall()

    result = []
    for e in events:
        result.append({
            'id': e['id'],
            'name': e['event_name'],
            'description': e['description'],
            'probability': e['probability'],
            'fuelEffect': e['fuel_effect'],
            'rescuedEffect': e['rescued_effect'],
            'reputationEffect': e['reputation_effect'],
            'fatal': bool(e['fatal']),
            'icon': e['icon'],
            'type': e['event_type']
        })

    return jsonify(result)


@app.route('/api/event/random', methods=['GET'])
def get_random_event():
    """Get a random event based on probability weights"""
    cursor = db.get_cursor()
    cursor.execute("SELECT * FROM event")
    events = cursor.fetchall()

    weights = [e['probability'] for e in events]
    total_weight = sum(weights)
    rand = random.random() * total_weight

    cumulative = 0
    selected_event = events[-1]
    for event in events:
        cumulative += event['probability']
        if rand <= cumulative:
            selected_event = event
            break

    return jsonify({
        'id': selected_event['id'],
        'name': selected_event['event_name'],
        'description': selected_event['description'],
        'probability': selected_event['probability'],
        'fuelEffect': selected_event['fuel_effect'],
        'rescuedEffect': selected_event['rescued_effect'],
        'reputationEffect': selected_event['reputation_effect'],
        'fatal': bool(selected_event['fatal']),
        'icon': selected_event['icon'],
        'type': selected_event['event_type']
    })


@app.route('/api/player/<int:player_id>/apply-event', methods=['POST'])
def apply_event(player_id):
    """Apply event effects to player"""
    data = request.get_json()
    cursor = db.get_cursor()

    fuel_effect = data.get('fuelEffect', 0)
    reputation_effect = data.get('reputationEffect', 0)
    rescued_effect = data.get('rescuedEffect', 0)
    fatal = data.get('fatal', False)

    if fatal:
        cursor.execute("UPDATE player SET crashed = 1 WHERE id = %s", (player_id,))
    else:
        cursor.execute("""
            UPDATE player
            SET fuel = GREATEST(0, fuel + %s),
                reputation = reputation + %s,
                rescued_people = rescued_people + %s
            WHERE id = %s
        """, (fuel_effect, reputation_effect, rescued_effect, player_id))

    cursor.execute("SELECT * FROM player WHERE id = %s", (player_id,))
    player = cursor.fetchone()

    return jsonify({
        'success': True,
        'fuel': player['fuel'],
        'reputation': player['reputation'],
        'rescuedPeople': player['rescued_people'],
        'crashed': bool(player['crashed'])
    })


# ============================================
# TRAVEL ROUTE
# ============================================

@app.route('/api/player/<int:player_id>/fly', methods=['POST'])
def fly_to_airport(player_id):
    """Fly to a new airport"""
    data = request.get_json()
    destination_icao = data.get('destination')
    distance = data.get('distance')

    cursor = db.get_cursor()

    cursor.execute("SELECT fuel FROM player WHERE id = %s", (player_id,))
    player = cursor.fetchone()

    if not player:
        return jsonify({'error': 'Player not found'}), 404

    if distance > player['fuel']:
        return jsonify({'error': 'Not enough fuel'}), 400

    new_fuel = player['fuel'] - distance

    cursor.execute("""
        UPDATE player SET current_airport = %s, fuel = %s WHERE id = %s
    """, (destination_icao, new_fuel, player_id))

    cursor.execute("""
        SELECT ident, name, latitude_deg, longitude_deg FROM airport WHERE ident = %s
    """, (destination_icao,))
    destination = cursor.fetchone()

    crashed = new_fuel <= 0
    if crashed:
        cursor.execute("UPDATE player SET crashed = 1 WHERE id = %s", (player_id,))

    return jsonify({
        'success': True,
        'fuel': new_fuel,
        'currentAirport': destination,
        'crashed': crashed
    })


# ============================================
# REFUEL ROUTE
# ============================================

@app.route('/api/player/<int:player_id>/refuel', methods=['POST'])
def refuel(player_id):
    """Refuel the plane"""
    cursor = db.get_cursor()

    cursor.execute("SELECT fuel, reputation FROM player WHERE id = %s", (player_id,))
    player = cursor.fetchone()

    if not player:
        return jsonify({'error': 'Player not found'}), 404

    if player['reputation'] < CONFIG['recharge_cost']:
        return jsonify({'error': 'Not enough reputation'}), 400

    new_fuel = min(CONFIG['max_fuel'], player['fuel'] + CONFIG['recharge_gain'])
    new_reputation = player['reputation'] - CONFIG['recharge_cost']

    cursor.execute("""
        UPDATE player SET fuel = %s, reputation = %s WHERE id = %s
    """, (new_fuel, new_reputation, player_id))

    return jsonify({
        'success': True,
        'fuel': new_fuel,
        'reputation': new_reputation
    })


# ============================================
# GAME STATUS ROUTE
# ============================================

@app.route('/api/player/<int:player_id>/status', methods=['GET'])
def get_game_status(player_id):
    """Get complete game status"""
    cursor = db.get_cursor()

    cursor.execute("SELECT * FROM player WHERE id = %s", (player_id,))
    player = cursor.fetchone()

    if not player:
        return jsonify({'error': 'Player not found'}), 404

    cursor.execute("""
        SELECT
            COUNT(*) as total,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
        FROM player_mission WHERE player_id = %s
    """, (player_id,))
    mission_stats = cursor.fetchone()

    game_over = player['crashed'] == 1 or player['fuel'] <= 0
    victory = mission_stats['completed'] >= CONFIG['missions_to_complete'] and not game_over

    return jsonify({
        'gameOver': game_over,
        'victory': victory,
        'crashed': bool(player['crashed']),
        'fuel': player['fuel'],
        'reputation': player['reputation'],
        'rescuedPeople': player['rescued_people'],
        'missions': {
            'total': mission_stats['total'],
            'completed': mission_stats['completed'],
            'failed': mission_stats['failed'],
            'pending': mission_stats['pending'],
            'toWin': CONFIG['missions_to_complete']
        }
    })


# ============================================
# NEARBY AIRPORTS ROUTE
# ============================================

@app.route('/api/player/<int:player_id>/nearby-airports', methods=['GET'])
def get_nearby_airports(player_id):
    """Get all airports with distance from current location"""
    cursor = db.get_cursor()

    cursor.execute("""
        SELECT a.ident, a.latitude_deg, a.longitude_deg, p.fuel
        FROM player p
        JOIN airport a ON p.current_airport = a.ident
        WHERE p.id = %s
    """, (player_id,))
    player = cursor.fetchone()

    if not player:
        return jsonify({'error': 'Player not found'}), 404

    cursor.execute(f"""
        SELECT ident, name, latitude_deg, longitude_deg
        FROM airport
        WHERE continent = 'EU'
        AND type IN {AIRPORT_TYPE_FILTER}
        AND ident != %s
    """, (player['ident'],))
    airports = cursor.fetchall()

    cursor.execute("""
        SELECT m.airport, m.disaster_type, m.severity_level, m.reward_reputation, m.icon
        FROM player_mission pm
        JOIN mission m ON pm.mission_id = m.id
        WHERE pm.player_id = %s AND pm.status = 'pending'
    """, (player_id,))
    mission_data = cursor.fetchall()
    mission_airports = {m['airport']: m for m in mission_data}

    result = []
    for airport in airports:
        distance = calculate_distance(
            player['latitude_deg'], player['longitude_deg'],
            airport['latitude_deg'], airport['longitude_deg']
        )

        mission_info = mission_airports.get(airport['ident'])

        result.append({
            'ident': airport['ident'],
            'name': airport['name'],
            'latitude_deg': airport['latitude_deg'],
            'longitude_deg': airport['longitude_deg'],
            'distance': distance,
            'inRange': distance <= player['fuel'],
            'hasMission': airport['ident'] in mission_airports,
            'missionInfo': {
                'disaster': mission_info['disaster_type'],
                'severity': mission_info['severity_level'],
                'reward': mission_info['reward_reputation'],
                'icon': mission_info['icon']
            } if mission_info else None
        })

    result.sort(key=lambda x: (not x['hasMission'], x['distance']))

    return jsonify(result)


# ============================================
# RUN APP
# ============================================

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=3000, debug=True)