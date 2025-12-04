// ============================================
// RESCUE PILOT - GAME ENGINE (API VERSION + MAP)
// ============================================

// API Base URL
const API_BASE = "http://127.0.0.1:3000/api";

// Map instance
let map = null;
let markers = [];
let fuelRangeCircle = null;

// Game State
let gameState = {
  playerId: null,
  playerName: "Pilot",
  fuel: 2500,
  reputation: 100,
  rescuedPeople: 0,
  currentAirport: null,
  missions: [],
  completedMissions: 0,
  failedMissions: 0,
  isFirstStop: true,
  gameOver: false,
  currentMission: null,
  config: null,
  airports: [],
};

// ============================================
// API HELPER FUNCTIONS
// ============================================

async function apiGet(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("API GET Error:", error);
    throw error;
  }
}

async function apiPost(endpoint, data = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("API POST Error:", error);
    throw error;
  }
}

async function apiPut(endpoint, data = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("API PUT Error:", error);
    throw error;
  }
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function calculateDistance(airport1, airport2) {
  const R = 6371;
  const dLat = toRad(airport2.latitude_deg - airport1.latitude_deg);
  const dLon = toRad(airport2.longitude_deg - airport1.longitude_deg);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(airport1.latitude_deg)) *
      Math.cos(toRad(airport2.latitude_deg)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function showLoading(message = "Loading...") {
  let overlay = document.getElementById("loading-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loading-overlay";
    overlay.className = "loading-overlay";
    overlay.innerHTML = `
            <div class="loading-spinner"></div>
            <div class="loading-text">${message}</div>
        `;
    document.body.appendChild(overlay);
  }
  overlay.querySelector(".loading-text").textContent = message;
  overlay.classList.add("active");
}

function hideLoading() {
  const overlay = document.getElementById("loading-overlay");
  if (overlay) {
    overlay.classList.remove("active");
  }
}

function scrollToDashboard() {
  // Wait a bit for the UI to render, then scroll to dashboard
  setTimeout(() => {
    const dashboard = document.querySelector(".dashboard");
    if (dashboard) {
      dashboard.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, 300);
}

function scrollToTop() {
  window.scrollTo({
    top: 0,
    behavior: "smooth",
  });
}

// ============================================
// MAP FUNCTIONS
// ============================================

function initMap() {
  // Initialize map centered on Europe
  map = L.map("game-map", {
    center: [50, 10],
    zoom: 4,
    minZoom: 3,
    maxZoom: 8,
  });

  // Add dark tile layer
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);
}

function updateMap() {
  if (!map) {
    initMap();
  }

  // Clear existing markers
  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  // Remove existing fuel range circle
  if (fuelRangeCircle) {
    map.removeLayer(fuelRangeCircle);
  }

  const currentAirport = gameState.currentAirport;
  if (!currentAirport) return;

  // Add fuel range circle
  const fuelRangeMeters = gameState.fuel * 1000;
  fuelRangeCircle = L.circle(
    [currentAirport.latitude_deg, currentAirport.longitude_deg],
    {
      radius: fuelRangeMeters,
      color: "rgba(0, 212, 255, 0.5)",
      fillColor: "rgba(0, 212, 255, 0.1)",
      fillOpacity: 0.3,
      dashArray: "10, 5",
      weight: 2,
    }
  ).addTo(map);

  // Add current location marker
  const currentIcon = L.divIcon({
    className: "custom-marker marker-current",
    html: "✈️",
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });

  const currentMarker = L.marker(
    [currentAirport.latitude_deg, currentAirport.longitude_deg],
    {
      icon: currentIcon,
      zIndexOffset: 1000,
    }
  ).addTo(map);

  currentMarker.bindPopup(`
        <div class="popup-content popup-current">
            <h4>${currentAirport.name}</h4>
            <span class="popup-code">${currentAirport.ident}</span>
            <div class="popup-you-are-here">📍 YOU ARE HERE</div>
        </div>
    `);

  markers.push(currentMarker);

  // Center map on current location
  map.setView([currentAirport.latitude_deg, currentAirport.longitude_deg], 5);
}

async function updateMapMarkers() {
  if (!map) return;

  try {
    const airports = await apiGet(
      `/player/${gameState.playerId}/nearby-airports`
    );

    // Add markers for each airport
    airports.forEach((airport) => {
      let iconClass = "marker-out-range";
      let iconContent = "•";
      let zIndex = 100;

      if (airport.hasMission && airport.inRange) {
        iconClass = "marker-mission";
        iconContent = "🚨";
        zIndex = 500;
      } else if (airport.hasMission && !airport.inRange) {
        iconClass = "marker-mission marker-mission-far";
        iconContent = "🚨";
        zIndex = 400;
      } else if (airport.inRange) {
        iconClass = "marker-in-range";
        iconContent = "✈";
        zIndex = 300;
      }

      const icon = L.divIcon({
        className: `custom-marker ${iconClass}`,
        html: iconContent,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });

      const marker = L.marker([airport.latitude_deg, airport.longitude_deg], {
        icon: icon,
        zIndexOffset: zIndex,
      }).addTo(map);

      // Create popup content with mission info
      let missionHtml = "";
      if (airport.hasMission && airport.missionInfo) {
        missionHtml = `
                    <div class="popup-mission">
                        ${airport.missionInfo.icon} ${airport.missionInfo.disaster}
                    </div>
                    <div class="popup-mission-details">
                        <span>Difficulty: ${airport.missionInfo.severity}/10</span>
                        <span>Reward: +${airport.missionInfo.reward} Trust</span>
                    </div>
                `;
      }

      let popupContent = `
                <div class="popup-content">
                    <h4>${airport.name}</h4>
                    <span class="popup-code">${airport.ident}</span>
                    <div class="popup-distance">📏 ${airport.distance} km</div>
                    ${missionHtml}
                    <div class="popup-status ${
                      airport.inRange ? "in-range" : "out-range"
                    }">
                        ${
                          airport.inRange
                            ? "✅ In Fuel Range"
                            : "❌ Out of Range"
                        }
                    </div>
                    <button class="btn-fly" 
                            onclick="flyFromMap('${
                              airport.ident
                            }', '${airport.name.replace(/'/g, "\\'")}', ${
        airport.latitude_deg
      }, ${airport.longitude_deg}, ${airport.distance})"
                            ${!airport.inRange ? "disabled" : ""}>
                        ${airport.inRange ? "✈️ FLY HERE" : "OUT OF RANGE"}
                    </button>
                </div>
            `;

      marker.bindPopup(popupContent);
      markers.push(marker);
    });
  } catch (error) {
    console.error("Error updating map markers:", error);
  }
}

// Function called from map popup
function flyFromMap(ident, name, lat, lng, distance) {
  // Close any open popups
  map.closePopup();

  // Fly to the airport
  flyToAirport(
    {
      ident: ident,
      name: name,
      latitude_deg: lat,
      longitude_deg: lng,
    },
    distance
  );
}

// ============================================
// GAME INITIALIZATION
// ============================================

function initGame() {
  gameState = {
    playerId: null,
    playerName: "Pilot",
    fuel: 2500,
    reputation: 100,
    rescuedPeople: 0,
    currentAirport: null,
    missions: [],
    completedMissions: 0,
    failedMissions: 0,
    isFirstStop: true,
    gameOver: false,
    currentMission: null,
    config: null,
    airports: [],
  };

  // Destroy existing map if any
  if (map) {
    map.remove();
    map = null;
  }

  setupEventListeners();
}

function setupEventListeners() {
  // Remove old event listeners by cloning elements
  const startBtn = document.getElementById("start-btn");
  const newStartBtn = startBtn.cloneNode(true);
  startBtn.parentNode.replaceChild(newStartBtn, startBtn);
  newStartBtn.addEventListener("click", startGame);

  document.getElementById("player-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") {
      startGame();
    }
  });

  document.getElementById("refuel-btn").addEventListener("click", handleRefuel);

  document
    .getElementById("accept-mission")
    .addEventListener("click", attemptMission);
  document
    .getElementById("decline-mission")
    .addEventListener("click", declineMission);

  document.getElementById("result-continue").addEventListener("click", () => {
    closeModal("result-modal");
    // Check if won after closing result
    if (
      gameState.completedMissions >=
      (gameState.config?.missions_to_complete || 6)
    ) {
      showVictory();
    } else {
      checkEventAtAirport();
    }
  });

  document.getElementById("event-continue").addEventListener("click", () => {
    closeModal("event-modal");
    if (gameState.gameOver) {
      showGameOver("Fatal Event - Your mission has been terminated!");
    } else {
      updateUI();
    }
  });

  document.getElementById("help-btn").addEventListener("click", () => {
    openModal("help-modal");
  });

  document.getElementById("help-close").addEventListener("click", () => {
    closeModal("help-modal");
  });

  document.getElementById("restart-btn").addEventListener("click", restartGame);
  document
    .getElementById("victory-restart")
    .addEventListener("click", restartGame);
}

// ============================================
// GAME FLOW FUNCTIONS
// ============================================

async function startGame() {
  const nameInput = document.getElementById("player-name").value.trim();
  gameState.playerName = nameInput || "Commander";

  showLoading("Initializing Mission...");

  try {
    // Create player and get game data from backend
    const data = await apiPost("/player", { name: gameState.playerName });

    // Update game state with backend data
    gameState.playerId = data.playerId;
    gameState.fuel = data.fuel;
    gameState.reputation = data.reputation;
    gameState.rescuedPeople = data.rescuedPeople;
    gameState.currentAirport = data.currentAirport;
    gameState.missions = data.missions;
    gameState.config = data.config;
    gameState.isFirstStop = true;
    gameState.completedMissions = 0;
    gameState.failedMissions = 0;

    hideLoading();

    // Switch screens
    document.getElementById("welcome-screen").classList.remove("active");
    document.getElementById("game-screen").classList.add("active");

    // Update UI
    document.getElementById("pilot-name-display").textContent =
      gameState.playerName;

    // Initialize map and update UI
    setTimeout(() => {
      initMap();
      updateUI();
      // Scroll to dashboard section (Fuel, Trust Points, etc.)
      scrollToDashboard();
    }, 100);
  } catch (error) {
    hideLoading();
    alert(
      "Failed to start game. Please make sure the backend server is running."
    );
    console.error(error);
  }
}

// ============================================
// UPDATE UI
// ============================================

async function updateUI() {
  const maxFuel = gameState.config?.max_fuel || 3500;
  const maxReputation = gameState.config?.max_reputation || 200;
  const missionsToComplete = gameState.config?.missions_to_complete || 6;

  // Update fuel
  const fuelPercent = (gameState.fuel / maxFuel) * 100;
  document.getElementById("fuel-bar").style.width = `${Math.min(
    100,
    fuelPercent
  )}%`;
  document.getElementById("fuel-value").textContent = Math.max(
    0,
    gameState.fuel
  );

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
  const repPercent = (gameState.reputation / maxReputation) * 100;
  document.getElementById("reputation-bar").style.width = `${Math.min(
    100,
    repPercent
  )}%`;
  document.getElementById("reputation-value").textContent =
    gameState.reputation;

  // Update rescued count
  document.getElementById("rescued-value").textContent =
    gameState.rescuedPeople;

  // Count completed missions
  const completed = gameState.missions.filter(
    (m) => m.status === "completed"
  ).length;
  gameState.completedMissions = completed;

  // Update missions display - show completed vs required
  document.getElementById("missions-completed").textContent = completed;
  document.getElementById("missions-total").textContent = missionsToComplete;

  // Update current location
  document.getElementById("current-airport-name").textContent =
    gameState.currentAirport.name;
  document.getElementById("current-airport-code").textContent =
    gameState.currentAirport.ident;

  // Update refuel button
  const rechargeCost = gameState.config?.recharge_cost || 20;
  const refuelBtn = document.getElementById("refuel-btn");
  if (gameState.reputation >= rechargeCost && gameState.fuel < maxFuel) {
    refuelBtn.style.display = "block";
    refuelBtn.disabled = false;
  } else {
    refuelBtn.style.display = "none";
  }

  // Update map
  updateMap();
  await updateMapMarkers();

  // Update airports grid
  await updateAirportsGrid();

  // Update missions list
  updateMissionsList();
}

async function updateAirportsGrid() {
  const grid = document.getElementById("airports-grid");
  grid.innerHTML = '<div class="loading-text">Loading airports...</div>';

  try {
    // Get nearby airports from backend
    const airports = await apiGet(
      `/player/${gameState.playerId}/nearby-airports`
    );

    grid.innerHTML = "";

    airports.forEach((airport) => {
      const card = document.createElement("div");
      card.className = `airport-card ${airport.inRange ? "" : "out-of-range"} ${
        airport.hasMission ? "has-mission" : ""
      }`;

      let missionInfo = "";
      if (airport.hasMission && airport.missionInfo) {
        missionInfo = `
                    <div class="mission-indicator">
                        ${airport.missionInfo.icon} ${airport.missionInfo.disaster}
                        <span class="mission-difficulty">Diff: ${airport.missionInfo.severity}/10 | +${airport.missionInfo.reward} Trust</span>
                    </div>
                `;
      }

      card.innerHTML = `
                <div class="airport-header">
                    <span class="airport-name">${airport.name}</span>
                    <span class="airport-code-small">${airport.ident}</span>
                </div>
                <div class="airport-distance">
                    <span>📏</span>
                    <span>${airport.distance} km</span>
                </div>
                ${missionInfo}
            `;

      if (airport.inRange) {
        card.addEventListener("click", () =>
          flyToAirport(
            {
              ident: airport.ident,
              name: airport.name,
              latitude_deg: airport.latitude_deg,
              longitude_deg: airport.longitude_deg,
            },
            airport.distance
          )
        );
      }

      grid.appendChild(card);
    });
  } catch (error) {
    grid.innerHTML = '<div class="loading-text">Failed to load airports</div>';
    console.error(error);
  }
}

function updateMissionsList() {
  const list = document.getElementById("missions-list");
  list.innerHTML = "";

  const missionsToComplete = gameState.config?.missions_to_complete || 6;

  // Add progress header
  const progressHeader = document.createElement("div");
  progressHeader.className = "missions-progress";
  progressHeader.innerHTML = `
        <div class="progress-text">
            Complete <strong>${missionsToComplete}</strong> missions to win!
            <span class="progress-count">(${
              gameState.completedMissions
            }/${missionsToComplete} completed)</span>
        </div>
        <div class="progress-bar-container">
            <div class="progress-bar" style="width: ${
              (gameState.completedMissions / missionsToComplete) * 100
            }%"></div>
        </div>
    `;
  list.appendChild(progressHeader);

  // Sort missions: pending first, then completed, then failed
  const sortedMissions = [...gameState.missions].sort((a, b) => {
    const order = { pending: 0, completed: 1, failed: 2 };
    return order[a.status] - order[b.status];
  });

  sortedMissions.forEach((mission) => {
    const item = document.createElement("div");
    item.className = `mission-item ${mission.status}`;

    let statusClass = "pending";
    let statusText = "PENDING";

    if (mission.status === "completed") {
      statusClass = "completed";
      statusText = "RESCUED ✓";
    } else if (mission.status === "failed") {
      statusClass = "failed";
      statusText = "FAILED ✗";
    }

    // Show difficulty for pending missions
    let difficultyBadge = "";
    if (mission.status === "pending") {
      const difficulty =
        mission.severity <= 3
          ? "Easy"
          : mission.severity <= 5
          ? "Medium"
          : "Hard";
      const diffClass =
        mission.severity <= 3
          ? "easy"
          : mission.severity <= 5
          ? "medium"
          : "hard";
      difficultyBadge = `<span class="difficulty-badge ${diffClass}">${difficulty}</span>`;
    }

    item.innerHTML = `
            <span class="mission-icon">${mission.icon}</span>
            <div class="mission-details">
                <div class="mission-type">
                    ${mission.disaster} - ${mission.peopleInDanger} people
                    ${difficultyBadge}
                </div>
                <div class="mission-location">${mission.airport.name}</div>
                <div class="mission-reward">Reward: +${mission.reward} Trust</div>
            </div>
            <span class="mission-status ${statusClass}">${statusText}</span>
        `;

    list.appendChild(item);
  });
}

// ============================================
// TRAVEL FUNCTIONS
// ============================================

async function flyToAirport(airport, distance) {
  if (distance > gameState.fuel) {
    alert("Not enough fuel to reach this destination!");
    return;
  }

  const overlay = document.getElementById("flying-overlay");
  document.getElementById("flying-info").textContent = `${distance} km journey`;
  overlay.classList.add("active");

  try {
    // Call backend to fly
    const result = await apiPost(`/player/${gameState.playerId}/fly`, {
      destination: airport.ident,
      distance: distance,
    });

    setTimeout(() => {
      gameState.fuel = result.fuel;
      gameState.currentAirport = result.currentAirport;
      gameState.isFirstStop = false;

      overlay.classList.remove("active");

      if (result.crashed) {
        gameState.gameOver = true;
        showGameOver("Your plane ran out of fuel and crashed!");
        return;
      }

      updateUI();

      // Scroll to dashboard section after landing
      scrollToDashboard();

      setTimeout(() => {
        checkMissionAtAirport();
      }, 300);
    }, 2000);
  } catch (error) {
    overlay.classList.remove("active");
    alert("Failed to fly to destination");
    console.error(error);
  }
}

// ============================================
// MISSION FUNCTIONS
// ============================================

async function checkMissionAtAirport() {
  try {
    const result = await apiPost(
      `/player/${gameState.playerId}/check-mission`,
      {
        airport: gameState.currentAirport.ident,
      }
    );

    if (result.hasMission) {
      gameState.currentMission = result.mission;
      showMissionModal(result.mission);
    } else {
      checkEventAtAirport();
    }
  } catch (error) {
    console.error(error);
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

async function attemptMission() {
  closeModal("mission-modal");

  const mission = gameState.currentMission;

  try {
    showLoading("Attempting rescue...");

    const result = await apiPost(
      `/player/${gameState.playerId}/mission/${mission.id}/attempt`
    );

    hideLoading();

    // Update local mission status
    const missionIndex = gameState.missions.findIndex(
      (m) => m.id === mission.id
    );
    if (missionIndex !== -1) {
      gameState.missions[missionIndex].status = result.success
        ? "completed"
        : "failed";
    }

    if (result.success) {
      gameState.completedMissions =
        result.completedMissions || gameState.completedMissions + 1;
      gameState.rescuedPeople += result.peopleRescued;
      gameState.reputation += result.reputationGained;

      const missionsToWin = gameState.config?.missions_to_complete || 6;
      const remaining = missionsToWin - gameState.completedMissions;

      showResultModal(
        true,
        `You successfully rescued ${result.peopleRescued} people!`,
        [
          {
            label: "People Rescued",
            value: `+${result.peopleRescued}`,
            positive: true,
          },
          {
            label: "Trust Points",
            value: `+${result.reputationGained}`,
            positive: true,
          },
          {
            label: "Dice Roll",
            value: `${result.roll}+1 = ${result.adjusted_roll} vs ${result.needed}`,
            positive: true,
          },
          {
            label: "Missions Remaining",
            value: `${remaining > 0 ? remaining : "🎉 COMPLETE!"}`,
            positive: remaining <= 0,
          },
        ]
      );

      // Check for victory
      if (result.victory || gameState.completedMissions >= missionsToWin) {
        gameState.gameOver = true;
      }
    } else {
      gameState.failedMissions++;
      gameState.reputation -= result.reputationLost;

      showResultModal(
        false,
        "The rescue attempt failed. The situation was too dangerous.",
        [
          {
            label: "Trust Points",
            value: `-${result.reputationLost}`,
            positive: false,
          },
          {
            label: "Dice Roll",
            value: `${result.roll}+1 = ${result.adjusted_roll} vs ${result.needed}`,
            positive: false,
          },
        ]
      );
    }
  } catch (error) {
    hideLoading();
    alert("Failed to attempt mission");
    console.error(error);
  }
}

async function declineMission() {
  closeModal("mission-modal");

  // Small reputation penalty for skipping
  try {
    const result = await apiPost(
      `/player/${gameState.playerId}/mission/${gameState.currentMission.id}/skip`
    );
    gameState.reputation = result.newReputation;
  } catch (error) {
    console.error("Error skipping mission:", error);
  }

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

async function checkEventAtAirport() {
  if (gameState.isFirstStop) {
    updateUI();
    return;
  }

  try {
    // Get random event from backend
    const event = await apiGet("/event/random");

    showEventModal(event);
  } catch (error) {
    console.error(error);
    updateUI();
  }
}

async function showEventModal(event) {
  const header = document.getElementById("event-header");
  const icon = document.getElementById("event-icon");
  const nameEl = document.getElementById("event-name");
  const descEl = document.getElementById("event-description");
  const effectsContainer = document.getElementById("event-effects");

  header.className = `modal-header ${event.type}`;
  icon.textContent = event.icon;
  nameEl.textContent = event.name;
  descEl.textContent = event.description;

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

  // Apply event effects via backend
  try {
    const result = await apiPost(`/player/${gameState.playerId}/apply-event`, {
      fuelEffect: event.fuelEffect,
      reputationEffect: event.reputationEffect,
      rescuedEffect: event.rescuedEffect,
      fatal: event.fatal,
    });

    gameState.fuel = result.fuel;
    gameState.reputation = result.reputation;
    gameState.rescuedPeople = result.rescuedPeople;

    if (result.crashed || event.fatal) {
      gameState.gameOver = true;
    }
  } catch (error) {
    console.error(error);
  }

  openModal("event-modal");
}

// ============================================
// REFUEL FUNCTION
// ============================================

async function handleRefuel() {
  try {
    const result = await apiPost(`/player/${gameState.playerId}/refuel`);

    gameState.fuel = result.fuel;
    gameState.reputation = result.reputation;

    updateUI();

    const btn = document.getElementById("refuel-btn");
    btn.textContent = "✅ Refueled!";
    btn.disabled = true;

    setTimeout(() => {
      const rechargeCost = gameState.config?.recharge_cost || 20;
      const rechargeGain = gameState.config?.recharge_gain || 1000;
      btn.textContent = `🔄 Refuel (-${rechargeCost} Trust = +${rechargeGain}km)`;
      updateUI();
    }, 1500);
  } catch (error) {
    alert("Failed to refuel");
    console.error(error);
  }
}

// ============================================
// WIN/LOSE CONDITIONS
// ============================================

function checkWinCondition() {
  const missionsToWin = gameState.config?.missions_to_complete || 6;

  if (gameState.completedMissions >= missionsToWin) {
    showVictory();
    return true;
  }
  return false;
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
  const missionsToWin = gameState.config?.missions_to_complete || 6;

  document.getElementById("gameover-reason").textContent = reason;
  document.getElementById("final-pilot").textContent = gameState.playerName;
  document.getElementById("final-rescued").textContent =
    gameState.rescuedPeople;
  document.getElementById("final-reputation").textContent =
    gameState.reputation;
  document.getElementById(
    "final-missions"
  ).textContent = `${gameState.completedMissions}/${missionsToWin}`;

  openModal("gameover-modal");
  gameState.gameOver = true;
}

function restartGame() {
  closeModal("gameover-modal");
  closeModal("victory-modal");

  document.getElementById("game-screen").classList.remove("active");
  document.getElementById("welcome-screen").classList.add("active");
  document.getElementById("player-name").value = "";

  scrollToTop();

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
