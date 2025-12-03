// script.js

// ============================================
// RESCUE PILOT - GAME ENGINE
// ============================================

// Game Configuration
const CONFIG = {
  startFuel: 2500,
  startReputation: 100,
  missionsToAssign: 6,
  rechargeCost: 20,
  rechargeGain: 1000,
  maxFuel: 3500,
  maxReputation: 200,
};

// European Airports Database
const AIRPORTS = [
  {
    ident: "EGLL",
    name: "London Heathrow Airport",
    lat: 51.4775,
    lon: -0.4614,
  },
  {
    ident: "LFPG",
    name: "Paris Charles de Gaulle Airport",
    lat: 49.0097,
    lon: 2.5479,
  },
  {
    ident: "EHAM",
    name: "Amsterdam Schiphol Airport",
    lat: 52.3086,
    lon: 4.7639,
  },
  { ident: "EDDF", name: "Frankfurt Airport", lat: 50.0379, lon: 8.5622 },
  { ident: "LEMD", name: "Madrid Barajas Airport", lat: 40.4983, lon: -3.5676 },
  { ident: "LIRF", name: "Rome Fiumicino Airport", lat: 41.8003, lon: 12.2389 },
  { ident: "EGKK", name: "London Gatwick Airport", lat: 51.1481, lon: -0.1903 },
  {
    ident: "LEBL",
    name: "Barcelona El Prat Airport",
    lat: 41.2971,
    lon: 2.0785,
  },
  { ident: "EDDM", name: "Munich Airport", lat: 48.3538, lon: 11.7861 },
  {
    ident: "LOWW",
    name: "Vienna International Airport",
    lat: 48.1103,
    lon: 16.5697,
  },
  { ident: "LSZH", name: "Zurich Airport", lat: 47.4647, lon: 8.5492 },
  { ident: "EKCH", name: "Copenhagen Airport", lat: 55.618, lon: 12.6508 },
  {
    ident: "ENGM",
    name: "Oslo Gardermoen Airport",
    lat: 60.1939,
    lon: 11.1004,
  },
  {
    ident: "ESSA",
    name: "Stockholm Arlanda Airport",
    lat: 59.6519,
    lon: 17.9186,
  },
  { ident: "LPPT", name: "Lisbon Portela Airport", lat: 38.7813, lon: -9.1359 },
  { ident: "EBBR", name: "Brussels Airport", lat: 50.9014, lon: 4.4844 },
  { ident: "EIDW", name: "Dublin Airport", lat: 53.4264, lon: -6.2499 },
  {
    ident: "LGAV",
    name: "Athens International Airport",
    lat: 37.9364,
    lon: 23.9445,
  },
  { ident: "EPWA", name: "Warsaw Chopin Airport", lat: 52.1657, lon: 20.9671 },
  {
    ident: "LKPR",
    name: "Prague Václav Havel Airport",
    lat: 50.1008,
    lon: 14.26,
  },
  {
    ident: "LHBP",
    name: "Budapest Ferenc Liszt Airport",
    lat: 47.4369,
    lon: 19.2556,
  },
  {
    ident: "EFHK",
    name: "Helsinki-Vantaa Airport",
    lat: 60.3172,
    lon: 24.9633,
  },
  { ident: "LIMC", name: "Milan Malpensa Airport", lat: 45.6306, lon: 8.7281 },
  { ident: "EGCC", name: "Manchester Airport", lat: 53.3537, lon: -2.275 },
  { ident: "EDDL", name: "Düsseldorf Airport", lat: 51.2895, lon: 6.7668 },
];

// Mission Templates
const MISSION_TEMPLATES = [
  {
    disaster: "Flood",
    icon: "🌊",
    severityRange: [2, 4],
    peopleRange: [3, 6],
    reward: 10,
  },
  {
    disaster: "Crash",
    icon: "💥",
    severityRange: [3, 5],
    peopleRange: [2, 5],
    reward: 15,
  },
  {
    disaster: "Earthquake",
    icon: "🏚️",
    severityRange: [4, 6],
    peopleRange: [5, 9],
    reward: 25,
  },
  {
    disaster: "Fire",
    icon: "🔥",
    severityRange: [2, 4],
    peopleRange: [2, 5],
    reward: 12,
  },
  {
    disaster: "Storm",
    icon: "🌪️",
    severityRange: [3, 5],
    peopleRange: [3, 7],
    reward: 18,
  },
];

// Event Templates
const EVENTS = [
  {
    name: "Fuel Leaked",
    description:
      "Sabotage or mechanical failure caused a massive leak while you were grounded. Significant fuel loss!",
    probability: 4,
    fuelEffect: -400,
    rescuedEffect: 0,
    reputationEffect: 0,
    fatal: false,
    icon: "⛽",
    type: "warning",
  },
  {
    name: "Terrorist Attack",
    description:
      "A secondary terrorist attack hits the runway. Your immediate response is scrutinized, causing reputation loss.",
    probability: 3,
    fuelEffect: -50,
    rescuedEffect: 0,
    reputationEffect: -50,
    fatal: false,
    icon: "💣",
    type: "danger",
  },
  {
    name: "Bomb Threat",
    description:
      "Authorities ground all flights due to a bomb threat. You lose time finding an alternate runway, costing fuel.",
    probability: 2,
    fuelEffect: -200,
    rescuedEffect: 0,
    reputationEffect: -10,
    fatal: false,
    icon: "🚨",
    type: "warning",
  },
  {
    name: "Plane Damage",
    description:
      "Critical structural damage is discovered on your plane. Continuing is impossible.",
    probability: 1,
    fuelEffect: 0,
    rescuedEffect: 0,
    reputationEffect: -50,
    fatal: true,
    icon: "✈️💔",
    type: "danger",
  },
  {
    name: "Emergency Fuel Drop",
    description: "A nearby military base provides emergency fuel supplies!",
    probability: 2,
    fuelEffect: 500,
    rescuedEffect: 0,
    reputationEffect: 0,
    fatal: false,
    icon: "🛢️",
    type: "good",
  },
  {
    name: "Media Coverage",
    description:
      "Your heroic efforts were featured on the news! Public trust in your mission increases.",
    probability: 2,
    fuelEffect: 0,
    rescuedEffect: 0,
    reputationEffect: 25,
    fatal: false,
    icon: "📺",
    type: "good",
  },
  {
    name: "Volunteer Support",
    description:
      "Local volunteers helped rescue additional people while you were landing!",
    probability: 2,
    fuelEffect: 0,
    rescuedEffect: 2,
    reputationEffect: 10,
    fatal: false,
    icon: "🤝",
    type: "good",
  },
  {
    name: "Nothing Happens",
    description: "The airport is secure. All clear!",
    probability: 5,
    fuelEffect: 0,
    rescuedEffect: 0,
    reputationEffect: 0,
    fatal: false,
    icon: "✅",
    type: "good",
  },
];

// Game State
let gameState = {
  playerName: "Pilot",
  fuel: CONFIG.startFuel,
  reputation: CONFIG.startReputation,
  rescuedPeople: 0,
  currentAirport: null,
  missions: [],
  completedMissions: 0,
  failedMissions: 0,
  isFirstStop: true,
  gameOver: false,
  currentMission: null,
};

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateDistance(airport1, airport2) {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(airport2.lat - airport1.lat);
  const dLon = toRad(airport2.lon - airport1.lon);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(airport1.lat)) *
      Math.cos(toRad(airport2.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function weightedRandomChoice(items, weights) {
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < items.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      return items[i];
    }
  }
  return items[items.length - 1];
}

function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
  // Reset game state
  gameState = {
    playerName: "Pilot",
    fuel: CONFIG.startFuel,
    reputation: CONFIG.startReputation,
    rescuedPeople: 0,
    currentAirport: null,
    missions: [],
    completedMissions: 0,
    failedMissions: 0,
    isFirstStop: true,
    gameOver: false,
    currentMission: null,
  };

  // Shuffle and select airports
  const shuffledAirports = shuffleArray(AIRPORTS);
  gameState.currentAirport = shuffledAirports[0];

  // Create missions
  createMissions(shuffledAirports);

  // Setup event listeners
  setupEventListeners();
}

function createMissions(airports) {
  gameState.missions = [];
  const missionAirports = airports.slice(1, CONFIG.missionsToAssign + 1);

  missionAirports.forEach((airport) => {
    const template = randomChoice(MISSION_TEMPLATES);
    const mission = {
      id: `mission-${airport.ident}`,
      airport: airport,
      disaster: template.disaster,
      icon: template.icon,
      severity: randomInt(template.severityRange[0], template.severityRange[1]),
      peopleInDanger: randomInt(
        template.peopleRange[0],
        template.peopleRange[1]
      ),
      reward: template.reward,
      status: "pending", // pending, completed, failed
    };
    gameState.missions.push(mission);
  });
}

function setupEventListeners() {
  // Start button
  document.getElementById("start-btn").addEventListener("click", startGame);

  // Player name input - enter key
  document.getElementById("player-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      startGame();
    }
  });

  // Refuel button
  document.getElementById("refuel-btn").addEventListener("click", handleRefuel);

  // Mission modal buttons
  document
    .getElementById("accept-mission")
    .addEventListener("click", attemptMission);
  document
    .getElementById("decline-mission")
    .addEventListener("click", declineMission);

  // Result modal continue
  document.getElementById("result-continue").addEventListener("click", () => {
    closeModal("result-modal");
    checkEventAtAirport();
  });

  // Event modal continue
  document.getElementById("event-continue").addEventListener("click", () => {
    closeModal("event-modal");
    if (gameState.gameOver) {
      showGameOver("Fatal Event - Your mission has been terminated!");
    } else {
      updateUI();
    }
  });

  // Help button
  document.getElementById("help-btn").addEventListener("click", () => {
    openModal("help-modal");
  });

  document.getElementById("help-close").addEventListener("click", () => {
    closeModal("help-modal");
  });

  // Restart buttons
  document.getElementById("restart-btn").addEventListener("click", restartGame);
  document
    .getElementById("victory-restart")
    .addEventListener("click", restartGame);
}

// ============================================
// GAME FLOW FUNCTIONS
// ============================================

function startGame() {
  const nameInput = document.getElementById("player-name").value.trim();
  gameState.playerName = nameInput || "Commander";

  // Switch screens
  document.getElementById("welcome-screen").classList.remove("active");

  // Get reference to the game screen
  const gameScreen = document.getElementById("game-screen");
  gameScreen.classList.add("active");

  // Update UI
  document.getElementById("pilot-name-display").textContent =
    gameState.playerName;
  updateUI();

  // *** MODIFICATION: Scroll specifically to the game screen element ***
  gameScreen.scrollIntoView({ behavior: "smooth" });
}

function updateUI() {
  // Update fuel
  const fuelPercent = (gameState.fuel / CONFIG.maxFuel) * 100;
  document.getElementById("fuel-bar").style.width = `${Math.min(
    100,
    fuelPercent
  )}%`;
  document.getElementById("fuel-value").textContent = Math.max(
    0,
    gameState.fuel
  );

  // Fuel bar color based on level
  const fuelBar = document.getElementById("fuel-bar");
  if (gameState.fuel < 500) {
    fuelBar.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
    fuelBar.classList.add("pulse-danger");
  } else if (gameState.fuel < 1000) {
    fuelBar.style.background = "linear-gradient(90deg, #f59e0b, #ef4444)";
    fuelBar.classList.remove("pulse-danger");
  } else {
    fuelBar.style.background = "linear-gradient(90deg, #22c55e, #f59e0b)";
    fuelBar.classList.remove("pulse-danger");
  }

  // Update reputation
  const repPercent = (gameState.reputation / CONFIG.maxReputation) * 100;
  document.getElementById("reputation-bar").style.width = `${Math.min(
    100,
    repPercent
  )}%`;
  document.getElementById("reputation-value").textContent =
    gameState.reputation;

  // Update rescued count
  document.getElementById("rescued-value").textContent =
    gameState.rescuedPeople;

  // Update missions count
  document.getElementById("missions-completed").textContent =
    gameState.completedMissions;
  document.getElementById("missions-total").textContent =
    CONFIG.missionsToAssign;

  // Update current location
  document.getElementById("current-airport-name").textContent =
    gameState.currentAirport.name;
  document.getElementById("current-airport-code").textContent =
    gameState.currentAirport.ident;

  // Update refuel button visibility
  const refuelBtn = document.getElementById("refuel-btn");
  if (
    gameState.reputation >= CONFIG.rechargeCost &&
    gameState.fuel < CONFIG.maxFuel
  ) {
    refuelBtn.style.display = "block";
    refuelBtn.disabled = false;
  } else {
    refuelBtn.style.display = "none";
  }

  // Update airports grid
  updateAirportsGrid();

  // Update missions list
  updateMissionsList();
}

function updateAirportsGrid() {
  const grid = document.getElementById("airports-grid");
  grid.innerHTML = "";

  AIRPORTS.forEach((airport) => {
    if (airport.ident === gameState.currentAirport.ident) return;

    const distance = calculateDistance(gameState.currentAirport, airport);
    const inRange = distance <= gameState.fuel;
    const hasMission = gameState.missions.some(
      (m) => m.airport.ident === airport.ident && m.status === "pending"
    );

    const card = document.createElement("div");
    card.className = `airport-card ${inRange ? "" : "out-of-range"} ${
      hasMission ? "has-mission" : ""
    }`;

    card.innerHTML = `
            <div class="airport-header">
                <span class="airport-name">${airport.name}</span>
                <span class="airport-code-small">${airport.ident}</span>
            </div>
            <div class="airport-distance">
                <span>📏</span>
                <span>${distance} km</span>
            </div>
            ${
              hasMission
                ? '<div class="mission-indicator">🚨 MISSION AVAILABLE</div>'
                : ""
            }
        `;

    if (inRange) {
      card.addEventListener("click", () => flyToAirport(airport, distance));
    }

    grid.appendChild(card);
  });
}

function updateMissionsList() {
  const list = document.getElementById("missions-list");
  list.innerHTML = "";

  gameState.missions.forEach((mission) => {
    const item = document.createElement("div");
    item.className = `mission-item ${mission.status}`;

    let statusClass = "pending";
    let statusText = "PENDING";

    if (mission.status === "completed") {
      statusClass = "completed";
      statusText = "RESCUED";
    } else if (mission.status === "failed") {
      statusClass = "failed";
      statusText = "FAILED";
    }

    item.innerHTML = `
            <span class="mission-icon">${mission.icon}</span>
            <div class="mission-details">
                <div class="mission-type">${mission.disaster} - ${mission.peopleInDanger} people</div>
                <div class="mission-location">${mission.airport.name}</div>
            </div>
            <span class="mission-status ${statusClass}">${statusText}</span>
        `;

    list.appendChild(item);
  });
}

// ============================================
// TRAVEL FUNCTIONS
// ============================================

function flyToAirport(airport, distance) {
  if (distance > gameState.fuel) {
    alert("Not enough fuel to reach this destination!");
    return;
  }

  // Show flying animation
  const overlay = document.getElementById("flying-overlay");
  document.getElementById("flying-info").textContent = `${distance} km journey`;
  overlay.classList.add("active");

  // Animate the journey
  setTimeout(() => {
    // Update game state
    gameState.fuel -= distance;
    gameState.currentAirport = airport;
    gameState.isFirstStop = false;

    overlay.classList.remove("active");

    // Check for fuel depletion
    if (gameState.fuel <= 0) {
      gameState.fuel = 0;
      showGameOver("Your plane ran out of fuel and crashed!");
      return;
    }

    updateUI();

    // Check for mission at this airport
    checkMissionAtAirport();
  }, 2000);
}

// ============================================
// MISSION FUNCTIONS
// ============================================

function checkMissionAtAirport() {
  const mission = gameState.missions.find(
    (m) =>
      m.airport.ident === gameState.currentAirport.ident &&
      m.status === "pending"
  );

  if (mission) {
    gameState.currentMission = mission;
    showMissionModal(mission);
  } else {
    checkEventAtAirport();
  }
}

function showMissionModal(mission) {
  document.getElementById("disaster-icon").textContent = mission.icon;
  document.getElementById("disaster-type").textContent =
    mission.disaster.toUpperCase();
  document.getElementById("people-trapped").textContent =
    mission.peopleInDanger;
  document.getElementById(
    "severity-level"
  ).textContent = `${mission.severity}/10`;
  document.getElementById(
    "mission-reward"
  ).textContent = `+${mission.reward} Trust`;

  openModal("mission-modal");
}

function attemptMission() {
  closeModal("mission-modal");

  const mission = gameState.currentMission;
  const successRoll = randomInt(1, 10);

  if (successRoll >= mission.severity) {
    // Success!
    mission.status = "completed";
    gameState.completedMissions++;
    gameState.rescuedPeople += mission.peopleInDanger;
    gameState.reputation += mission.reward;

    showResultModal(
      true,
      `You successfully rescued ${mission.peopleInDanger} people!`,
      [
        {
          label: "People Rescued",
          value: `+${mission.peopleInDanger}`,
          positive: true,
        },
        { label: "Trust Points", value: `+${mission.reward}`, positive: true },
      ]
    );
  } else {
    // Failure
    mission.status = "failed";
    gameState.failedMissions++;
    const repLoss = Math.floor(mission.reward / 2);
    gameState.reputation -= repLoss;

    showResultModal(
      false,
      "The rescue attempt failed. The situation was too dangerous.",
      [{ label: "Trust Points", value: `-${repLoss}`, positive: false }]
    );
  }

  // Check win condition
  checkWinCondition();
}

function declineMission() {
  closeModal("mission-modal");
  gameState.currentMission = null;
  checkEventAtAirport();
}

function showResultModal(success, message, effects) {
  const header = document.getElementById("result-header");
  const icon = document.getElementById("result-icon");
  const title = document.getElementById("result-title");
  const messageEl = document.getElementById("result-message");
  const effectsContainer = document.getElementById("result-effects");

  header.className = `modal-header ${success ? "success" : "danger"}`;
  icon.textContent = success ? "✅" : "❌";
  title.textContent = success ? "MISSION SUCCESS" : "MISSION FAILED";
  messageEl.textContent = message;

  effectsContainer.innerHTML = effects
    .map(
      (e) => `
        <div class="effect-item ${e.positive ? "positive" : "negative"}">
            <span>${e.label}:</span>
            <span>${e.value}</span>
        </div>
    `
    )
    .join("");

  openModal("result-modal");
}

// ============================================
// EVENT FUNCTIONS
// ============================================

function checkEventAtAirport() {
  if (gameState.isFirstStop) {
    updateUI();
    return;
  }

  // Weighted random event selection
  const weights = EVENTS.map((e) => e.probability);
  const event = weightedRandomChoice(EVENTS, weights);

  showEventModal(event);
}

function showEventModal(event) {
  const header = document.getElementById("event-header");
  const icon = document.getElementById("event-icon");
  const nameEl = document.getElementById("event-name");
  const descEl = document.getElementById("event-description");
  const effectsContainer = document.getElementById("event-effects");

  header.className = `modal-header ${event.type}`;
  icon.textContent = event.icon;
  nameEl.textContent = event.name;
  descEl.textContent = event.description;

  // Build effects display
  const effects = [];
  if (event.fuelEffect !== 0) {
    effects.push({
      label: "Fuel",
      value: `${event.fuelEffect > 0 ? "+" : ""}${event.fuelEffect} km`,
      positive: event.fuelEffect > 0,
    });
  }
  if (event.reputationEffect !== 0) {
    effects.push({
      label: "Trust Points",
      value: `${event.reputationEffect > 0 ? "+" : ""}${
        event.reputationEffect
      }`,
      positive: event.reputationEffect > 0,
    });
  }
  if (event.rescuedEffect !== 0) {
    effects.push({
      label: "Additional Rescued",
      value: `+${event.rescuedEffect}`,
      positive: true,
    });
  }
  if (event.fatal) {
    effects.push({
      label: "FATAL",
      value: "Game Over",
      positive: false,
    });
  }

  effectsContainer.innerHTML =
    effects.length > 0
      ? effects
          .map(
            (e) => `
        <div class="effect-item ${e.positive ? "positive" : "negative"}">
            <span>${e.label}:</span>
            <span>${e.value}</span>
        </div>
    `
          )
          .join("")
      : '<p style="text-align: center; color: var(--text-muted);">No effects</p>';

  // Apply effects
  gameState.fuel = Math.max(0, gameState.fuel + event.fuelEffect);
  gameState.reputation += event.reputationEffect;
  gameState.rescuedPeople += event.rescuedEffect;

  if (event.fatal) {
    gameState.gameOver = true;
  }

  openModal("event-modal");
}

// ============================================
// REFUEL FUNCTION
// ============================================

function handleRefuel() {
  if (gameState.reputation >= CONFIG.rechargeCost) {
    gameState.reputation -= CONFIG.rechargeCost;
    gameState.fuel = Math.min(
      CONFIG.maxFuel,
      gameState.fuel + CONFIG.rechargeGain
    );
    updateUI();

    // Visual feedback
    const btn = document.getElementById("refuel-btn");
    btn.textContent = "✅ Refueled!";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = `🔄 Refuel (-${CONFIG.rechargeCost} Trust = +${CONFIG.rechargeGain}km)`;
      updateUI();
    }, 1500);
  }
}

// ============================================
// WIN/LOSE CONDITIONS
// ============================================

function checkWinCondition() {
  const pendingMissions = gameState.missions.filter(
    (m) => m.status === "pending"
  ).length;

  if (pendingMissions === 0) {
    // All missions attempted
    showVictory();
  }
}

function showVictory() {
  document.getElementById("victory-pilot").textContent = gameState.playerName;
  document.getElementById("victory-rescued").textContent =
    gameState.rescuedPeople;
  document.getElementById("victory-reputation").textContent =
    gameState.reputation;
  document.getElementById("victory-fuel").textContent = `${gameState.fuel} km`;

  openModal("victory-modal");
  gameState.gameOver = true;
}

function showGameOver(reason) {
  document.getElementById("gameover-reason").textContent = reason;
  document.getElementById("final-pilot").textContent = gameState.playerName;
  document.getElementById("final-rescued").textContent =
    gameState.rescuedPeople;
  document.getElementById("final-reputation").textContent =
    gameState.reputation;
  document.getElementById(
    "final-missions"
  ).textContent = `${gameState.completedMissions}/${CONFIG.missionsToAssign}`;

  openModal("gameover-modal");
  gameState.gameOver = true;
}

function restartGame() {
  closeModal("gameover-modal");
  closeModal("victory-modal");

  document.getElementById("game-screen").classList.remove("active");
  document.getElementById("welcome-screen").classList.add("active");
  document.getElementById("player-name").value = "";

  initGame();
}

// ============================================
// MODAL FUNCTIONS
// ============================================

function openModal(modalId) {
  document.getElementById(modalId).classList.add("active");
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove("active");
}

// ============================================
// INITIALIZE GAME ON LOAD
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initGame();
});
