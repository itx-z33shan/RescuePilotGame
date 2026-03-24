// ============================================
// RESCUE PILOT - PRO GAME ENGINE v2.0
// ============================================

"use strict";

// API Configuration
const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000/api"
    : "https://your-backend-name.onrender.com/api";

// Map instance
let map = null;
let markers = [];
let fuelRangeCircle = null;
let flightPath = null;

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
  totalDistance: 0,
  startTime: null,
  settings: {
    animations: true,
    particles: true,
  },
};

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initLoadingScreen();
  initParticles();
  initGame();
});

function initLoadingScreen() {
  const loadingScreen = document.getElementById("loading-screen");
  const statusText = loadingScreen.querySelector(".loader-status");

  const messages = [
    "Initializing systems...",
    "Loading flight data...",
    "Calibrating instruments...",
    "Ready for takeoff!",
  ];

  let index = 0;
  const interval = setInterval(() => {
    if (index < messages.length) {
      statusText.textContent = messages[index];
      index++;
    }
  }, 500);

  setTimeout(() => {
    clearInterval(interval);
    loadingScreen.classList.add("fade-out");
    setTimeout(() => {
      loadingScreen.style.display = "none";
    }, 500);
  }, 2000);
}

function initParticles() {
  if (!gameState.settings.particles) return;

  const container = document.getElementById("particles");
  if (!container) return;

  for (let i = 0; i < 50; i++) {
    const particle = document.createElement("div");
    particle.className = "particle";
    particle.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      animation-delay: ${Math.random() * 5}s;
      animation-duration: ${5 + Math.random() * 10}s;
    `;
    container.appendChild(particle);
  }
}

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
    totalDistance: 0,
    startTime: null,
    settings: gameState.settings,
  };

  if (map) {
    map.remove();
    map = null;
  }

  setupEventListeners();
  initHelpTabs();
  initFilterButtons();
}

// ============================================
// EVENT LISTENERS
// ============================================

function setupEventListeners() {
  // Clone to remove old listeners
  const startBtn = document.getElementById("start-btn");
  const newStartBtn = startBtn.cloneNode(true);
  startBtn.parentNode.replaceChild(newStartBtn, startBtn);
  newStartBtn.addEventListener("click", startGame);

  // Enter key to start
  document.getElementById("player-name").addEventListener("keypress", (e) => {
    if (e.key === "Enter") startGame();
  });

  // Input focus effects
  const playerInput = document.getElementById("player-name");
  playerInput.addEventListener("focus", () => {
    playerInput.parentElement.classList.add("focused");
  });
  playerInput.addEventListener("blur", () => {
    playerInput.parentElement.classList.remove("focused");
  });

  // Game controls
  document.getElementById("refuel-btn").addEventListener("click", handleRefuel);
  document
    .getElementById("accept-mission")
    .addEventListener("click", attemptMission);
  document
    .getElementById("decline-mission")
    .addEventListener("click", declineMission);

  // Modal continues
  document
    .getElementById("result-continue")
    .addEventListener("click", handleResultContinue);
  document
    .getElementById("event-continue")
    .addEventListener("click", handleEventContinue);

  // Help
  document
    .getElementById("help-btn")
    .addEventListener("click", () => openModal("help-modal"));
  document
    .getElementById("help-close")
    .addEventListener("click", () => closeModal("help-modal"));

  // Restart buttons
  document.getElementById("restart-btn").addEventListener("click", restartGame);
  document
    .getElementById("victory-restart")
    .addEventListener("click", restartGame);

  // Map controls
  document
    .getElementById("zoom-in")
    ?.addEventListener("click", () => map?.zoomIn());
  document
    .getElementById("zoom-out")
    ?.addEventListener("click", () => map?.zoomOut());
  document
    .getElementById("center-map")
    ?.addEventListener("click", centerMapOnPlayer);

  // Close modals on backdrop click
  document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
    backdrop.addEventListener("click", (e) => {
      const modal = e.target.closest(".modal");
      if (modal && !modal.classList.contains("no-close")) {
        closeModal(modal.id);
      }
    });
  });
}

function initHelpTabs() {
  document.querySelectorAll(".help-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document
        .querySelectorAll(".help-tab")
        .forEach((t) => t.classList.remove("active"));
      document
        .querySelectorAll(".help-content-inner")
        .forEach((c) => c.classList.add("hidden"));

      tab.classList.add("active");
      document
        .getElementById(`help-${tab.dataset.tab}`)
        .classList.remove("hidden");
    });
  });
}

function initFilterButtons() {
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document
        .querySelectorAll(".filter-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      filterAirports(btn.dataset.filter);
    });
  });
}

// ============================================
// API FUNCTIONS
// ============================================

async function apiGet(endpoint) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("API GET Error:", error);
    showToast("Connection error. Please check the server.", "error");
    throw error;
  }
}

async function apiPost(endpoint, data = {}) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error("API POST Error:", error);
    showToast("Connection error. Please check the server.", "error");
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
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(airport1.latitude_deg)) *
      Math.cos(toRad(airport2.latitude_deg)) *
      Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

function toRad(deg) {
  return deg * (Math.PI / 180);
}

function animateValue(element, start, end, duration = 500) {
  const range = end - start;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeProgress = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + range * easeProgress);
    element.textContent = current;

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
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
  if (overlay) overlay.classList.remove("active");
}

function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toast-container");
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type]}</span>
    <span class="toast-message">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 10);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function scrollToDashboard() {
  setTimeout(() => {
    document.querySelector(".dashboard")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, 300);
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function updateFlightTime() {
  if (!gameState.startTime) return;
  const elapsed = Math.floor((Date.now() - gameState.startTime) / 1000);
  document.getElementById("flight-time").textContent = formatTime(elapsed);
}

// ============================================
// MAP FUNCTIONS
// ============================================

function initMap() {
  map = L.map("game-map", {
    center: [50, 10],
    zoom: 4,
    minZoom: 3,
    maxZoom: 8,
    zoomControl: false,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);
}

function updateMap() {
  if (!map) initMap();

  markers.forEach((marker) => map.removeLayer(marker));
  markers = [];

  if (fuelRangeCircle) map.removeLayer(fuelRangeCircle);

  const current = gameState.currentAirport;
  if (!current) return;

  // Fuel range circle
  fuelRangeCircle = L.circle([current.latitude_deg, current.longitude_deg], {
    radius: gameState.fuel * 1000,
    color: "rgba(0, 212, 255, 0.6)",
    fillColor: "rgba(0, 212, 255, 0.1)",
    fillOpacity: 0.3,
    dashArray: "10, 5",
    weight: 2,
  }).addTo(map);

  // Current location marker
  const currentIcon = L.divIcon({
    className: "custom-marker marker-current",
    html: "✈️",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  const currentMarker = L.marker(
    [current.latitude_deg, current.longitude_deg],
    {
      icon: currentIcon,
      zIndexOffset: 1000,
    },
  ).addTo(map);

  currentMarker.bindPopup(`
    <div class="popup-content popup-current">
      <h4>${current.name}</h4>
      <span class="popup-code">${current.ident}</span>
      <div class="popup-you-are-here">📍 YOU ARE HERE</div>
    </div>
  `);

  markers.push(currentMarker);
  map.setView([current.latitude_deg, current.longitude_deg], 5);

  // Update map fuel indicator
  document.getElementById("map-fuel").textContent =
    `${gameState.fuel} km range`;
}

async function updateMapMarkers() {
  if (!map) return;

  try {
    const airports = await apiGet(
      `/player/${gameState.playerId}/nearby-airports`,
    );

    airports.forEach((airport) => {
      let iconClass = "marker-out-range";
      let iconContent = "•";
      let zIndex = 100;

      if (airport.hasMission && airport.inRange) {
        iconClass = "marker-mission";
        iconContent = "🚨";
        zIndex = 500;
      } else if (airport.hasMission) {
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

      const popupContent = `
        <div class="popup-content">
          <h4>${airport.name}</h4>
          <span class="popup-code">${airport.ident}</span>
          <div class="popup-distance">📏 ${airport.distance} km</div>
          ${missionHtml}
          <div class="popup-status ${airport.inRange ? "in-range" : "out-range"}">
            ${airport.inRange ? "✅ In Range" : "❌ Out of Range"}
          </div>
          <button class="btn-fly" 
            onclick="flyFromMap('${airport.ident}', '${airport.name.replace(/'/g, "\\'")}', ${airport.latitude_deg}, ${airport.longitude_deg}, ${airport.distance})"
            ${!airport.inRange ? "disabled" : ""}>
            ${airport.inRange ? "✈️ FLY HERE" : "OUT OF RANGE"}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);
      markers.push(marker);
    });
  } catch (error) {
    console.error("Error updating markers:", error);
  }
}

function flyFromMap(ident, name, lat, lng, distance) {
  map.closePopup();
  flyToAirport(
    { ident, name, latitude_deg: lat, longitude_deg: lng },
    distance,
  );
}

function centerMapOnPlayer() {
  if (map && gameState.currentAirport) {
    map.setView(
      [
        gameState.currentAirport.latitude_deg,
        gameState.currentAirport.longitude_deg,
      ],
      5,
    );
  }
}

// ============================================
// GAME FLOW
// ============================================

async function startGame() {
  const nameInput = document.getElementById("player-name").value.trim();
  gameState.playerName = nameInput || "Commander";

  showLoading("Initializing Mission...");

  try {
    const data = await apiPost("/player", { name: gameState.playerName });

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
    gameState.totalDistance = 0;
    gameState.startTime = Date.now();

    hideLoading();

    // Switch screens with animation
    document.getElementById("welcome-screen").classList.add("fade-out");

    setTimeout(() => {
      document
        .getElementById("welcome-screen")
        .classList.remove("active", "fade-out");
      document.getElementById("game-screen").classList.add("active");

      document.getElementById("pilot-name-display").textContent =
        gameState.playerName;

      setTimeout(() => {
        initMap();
        updateUI();
        scrollToDashboard();

        // Start flight time counter
        setInterval(updateFlightTime, 1000);

        showToast(`Welcome, Captain ${gameState.playerName}!`, "success");
      }, 100);
    }, 300);
  } catch (error) {
    hideLoading();
    showToast("Failed to start game. Check server connection.", "error");
    console.error(error);
  }
}

// ============================================
// UPDATE UI
// ============================================

async function updateUI() {
  const maxFuel = gameState.config?.max_fuel || 3500;
  const maxRep = gameState.config?.max_reputation || 200;
  const missionsToWin = gameState.config?.missions_to_complete || 6;

  // Update fuel
  const fuelPercent = (gameState.fuel / maxFuel) * 100;
  const fuelBar = document.getElementById("fuel-bar");
  fuelBar.style.width = `${Math.min(100, fuelPercent)}%`;

  animateValue(
    document.getElementById("fuel-value"),
    parseInt(document.getElementById("fuel-value").textContent) || 0,
    gameState.fuel,
    300,
  );

  // Fuel status badge
  const fuelStatus = document.getElementById("fuel-status");
  if (gameState.fuel < 500) {
    fuelBar.className = "fuel-bar critical";
    fuelStatus.textContent = "CRITICAL";
    fuelStatus.className = "card-badge danger";
  } else if (gameState.fuel < 1000) {
    fuelBar.className = "fuel-bar warning";
    fuelStatus.textContent = "LOW";
    fuelStatus.className = "card-badge warning";
  } else {
    fuelBar.className = "fuel-bar";
    fuelStatus.textContent = "GOOD";
    fuelStatus.className = "card-badge success";
  }

  // Update reputation with circle
  const repPercent = (gameState.reputation / maxRep) * 100;
  const repCircle = document.getElementById("reputation-circle");
  const circumference = 2 * Math.PI * 45;
  repCircle.style.strokeDasharray = circumference;
  repCircle.style.strokeDashoffset =
    circumference - (repPercent / 100) * circumference;

  animateValue(
    document.getElementById("reputation-value"),
    parseInt(document.getElementById("reputation-value").textContent) || 0,
    gameState.reputation,
    300,
  );

  // Update rescued
  animateValue(
    document.getElementById("rescued-value"),
    parseInt(document.getElementById("rescued-value").textContent) || 0,
    gameState.rescuedPeople,
    300,
  );

  // Update missions circle
  const completed = gameState.missions.filter(
    (m) => m.status === "completed",
  ).length;
  gameState.completedMissions = completed;

  const missionPercent = (completed / missionsToWin) * 100;
  const missionCircle = document.getElementById("missions-circle");
  const missionCircumference = 2 * Math.PI * 40;
  missionCircle.style.strokeDasharray = missionCircumference;
  missionCircle.style.strokeDashoffset =
    missionCircumference - (missionPercent / 100) * missionCircumference;

  document.getElementById("missions-completed").textContent = completed;
  document.getElementById("missions-total").textContent = missionsToWin;

  // Update location
  document.getElementById("current-airport-name").textContent =
    gameState.currentAirport.name;
  document.getElementById("current-airport-code").textContent =
    gameState.currentAirport.ident;

  // Update coordinates
  document.getElementById("coord-lat").textContent =
    `${Math.abs(gameState.currentAirport.latitude_deg).toFixed(4)}° ${gameState.currentAirport.latitude_deg >= 0 ? "N" : "S"}`;
  document.getElementById("coord-lon").textContent =
    `${Math.abs(gameState.currentAirport.longitude_deg).toFixed(4)}° ${gameState.currentAirport.longitude_deg >= 0 ? "E" : "W"}`;

  // Update refuel button
  const rechargeCost = gameState.config?.recharge_cost || 20;
  const refuelBtn = document.getElementById("refuel-btn");
  if (gameState.reputation >= rechargeCost && gameState.fuel < maxFuel) {
    refuelBtn.style.display = "flex";
    refuelBtn.disabled = false;
  } else {
    refuelBtn.style.display = "none";
  }

  // Update total distance
  document.getElementById("total-distance").textContent =
    `${gameState.totalDistance} km`;

  // Update map
  updateMap();
  await updateMapMarkers();
  await updateAirportsGrid();
  updateMissionsList();
}

async function updateAirportsGrid() {
  const grid = document.getElementById("airports-grid");
  grid.innerHTML = '<div class="loading-text">Loading airports...</div>';

  try {
    const airports = await apiGet(
      `/player/${gameState.playerId}/nearby-airports`,
    );
    grid.innerHTML = "";

    airports.forEach((airport, index) => {
      const card = document.createElement("div");
      card.className = `airport-card ${airport.inRange ? "" : "out-of-range"} ${airport.hasMission ? "has-mission" : ""}`;
      card.style.animationDelay = `${index * 0.05}s`;
      card.dataset.filter = airport.hasMission
        ? "mission"
        : airport.distance < 500
          ? "nearby"
          : "all";

      let missionInfo = "";
      if (airport.hasMission && airport.missionInfo) {
        missionInfo = `
          <div class="mission-indicator">
            <span class="mission-icon">${airport.missionInfo.icon}</span>
            <span class="mission-type">${airport.missionInfo.disaster}</span>
            <div class="mission-meta">
              <span class="difficulty">Diff: ${airport.missionInfo.severity}/10</span>
              <span class="reward">+${airport.missionInfo.reward} Trust</span>
            </div>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="airport-card-inner">
          <div class="airport-header">
            <span class="airport-name">${airport.name}</span>
            <span class="airport-code-small">${airport.ident}</span>
          </div>
          <div class="airport-distance">
            <span class="distance-icon">📏</span>
            <span class="distance-value">${airport.distance} km</span>
            ${airport.inRange ? '<span class="in-range-badge">✓ In Range</span>' : '<span class="out-range-badge">✗ Out</span>'}
          </div>
          ${missionInfo}
        </div>
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
            airport.distance,
          ),
        );
      }

      grid.appendChild(card);
    });
  } catch (error) {
    grid.innerHTML = '<div class="error-text">Failed to load airports</div>';
  }
}

function filterAirports(filter) {
  document.querySelectorAll(".airport-card").forEach((card) => {
    if (
      filter === "all" ||
      card.dataset.filter === filter ||
      (filter === "mission" && card.classList.contains("has-mission"))
    ) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}

function updateMissionsList() {
  const list = document.getElementById("missions-list");
  list.innerHTML = "";

  const missionsToWin = gameState.config?.missions_to_complete || 6;

  // Progress header
  const progress = document.createElement("div");
  progress.className = "missions-progress";
  progress.innerHTML = `
    <div class="progress-header">
      <span class="progress-label">Mission Progress</span>
      <span class="progress-count">${gameState.completedMissions}/${missionsToWin}</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width: ${(gameState.completedMissions / missionsToWin) * 100}%">
        <div class="progress-shimmer"></div>
      </div>
    </div>
    <div class="progress-message">
      ${
        gameState.completedMissions >= missionsToWin
          ? "🎉 All missions complete!"
          : `${missionsToWin - gameState.completedMissions} more mission${missionsToWin - gameState.completedMissions !== 1 ? "s" : ""} to victory!`
      }
    </div>
  `;
  list.appendChild(progress);

  // Sort: pending first
  const sorted = [...gameState.missions].sort((a, b) => {
    const order = { pending: 0, completed: 1, failed: 2 };
    return order[a.status] - order[b.status];
  });

  sorted.forEach((mission, index) => {
    const item = document.createElement("div");
    item.className = `mission-item ${mission.status}`;
    item.style.animationDelay = `${index * 0.05}s`;

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

    let statusIcon = "⏳";
    let statusText = "PENDING";
    if (mission.status === "completed") {
      statusIcon = "✅";
      statusText = "RESCUED";
    } else if (mission.status === "failed") {
      statusIcon = "❌";
      statusText = "FAILED";
    }

    item.innerHTML = `
      <span class="mission-icon">${mission.icon}</span>
      <div class="mission-info">
        <div class="mission-title">
          ${mission.disaster}
          ${mission.status === "pending" ? `<span class="difficulty-badge ${diffClass}">${difficulty}</span>` : ""}
        </div>
        <div class="mission-location">${mission.airport.name}</div>
        <div class="mission-meta">
          <span class="people-count">👥 ${mission.peopleInDanger} people</span>
          <span class="reward-amount">🏆 +${mission.reward}</span>
        </div>
      </div>
      <div class="mission-status ${mission.status}">
        <span class="status-icon">${statusIcon}</span>
        <span class="status-text">${statusText}</span>
      </div>
    `;

    list.appendChild(item);
  });
}

// ============================================
// TRAVEL
// ============================================

async function flyToAirport(airport, distance) {
  if (distance > gameState.fuel) {
    showToast("Not enough fuel!", "error");
    return;
  }

  const overlay = document.getElementById("flying-overlay");
  document.getElementById("from-airport").textContent =
    gameState.currentAirport.ident;
  document.getElementById("to-airport").textContent = airport.ident;
  document.getElementById("flying-info").textContent = `${distance} km journey`;
  overlay.classList.add("active");

  try {
    const result = await apiPost(`/player/${gameState.playerId}/fly`, {
      destination: airport.ident,
      distance: distance,
    });

    setTimeout(() => {
      gameState.fuel = result.fuel;
      gameState.currentAirport = result.currentAirport;
      gameState.isFirstStop = false;
      gameState.totalDistance += distance;

      overlay.classList.remove("active");

      if (result.crashed) {
        gameState.gameOver = true;
        showGameOver("Your plane ran out of fuel and crashed!");
        return;
      }

      updateUI();
      scrollToDashboard();
      showToast(`Landed at ${airport.name}`, "success");

      setTimeout(() => checkMissionAtAirport(), 500);
    }, 2500);
  } catch (error) {
    overlay.classList.remove("active");
    showToast("Flight failed!", "error");
  }
}

// ============================================
// MISSIONS
// ============================================

async function checkMissionAtAirport() {
  try {
    const result = await apiPost(
      `/player/${gameState.playerId}/check-mission`,
      {
        airport: gameState.currentAirport.ident,
      },
    );

    if (result.hasMission) {
      gameState.currentMission = result.mission;
      showMissionModal(result.mission);
    } else {
      checkEventAtAirport();
    }
  } catch (error) {
    checkEventAtAirport();
  }
}

function showMissionModal(mission) {
  document.getElementById("disaster-icon").textContent = mission.icon;
  document.getElementById("disaster-type").textContent =
    mission.disaster.toUpperCase();
  document.getElementById("disaster-location").textContent =
    mission.airport.name;
  document.getElementById("people-trapped").textContent =
    mission.peopleInDanger;
  document.getElementById("severity-level").textContent =
    `${mission.severity}/10`;
  document.getElementById("mission-reward").textContent =
    `+${mission.reward} Trust`;

  // Calculate success chance
  const successChance = Math.max(
    10,
    Math.min(90, 100 - mission.severity * 10 + 10),
  );
  document.getElementById("success-chance").style.width = `${successChance}%`;
  document.getElementById("chance-percent").textContent = `${successChance}%`;

  openModal("mission-modal");
}

async function attemptMission() {
  closeModal("mission-modal");
  const mission = gameState.currentMission;

  try {
    showLoading("Attempting rescue...");
    const result = await apiPost(
      `/player/${gameState.playerId}/mission/${mission.id}/attempt`,
    );
    hideLoading();

    // Update local state
    const idx = gameState.missions.findIndex((m) => m.id === mission.id);
    if (idx !== -1) {
      gameState.missions[idx].status = result.success ? "completed" : "failed";
    }

    if (result.success) {
      gameState.completedMissions =
        result.completedMissions || gameState.completedMissions + 1;
      gameState.rescuedPeople += result.peopleRescued;
      gameState.reputation += result.reputationGained;

      const remaining =
        (gameState.config?.missions_to_complete || 6) -
        gameState.completedMissions;

      showResultModal(true, `You rescued ${result.peopleRescued} people!`, [
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
          value: `${result.roll}+1=${result.adjusted_roll} vs ${result.needed}`,
          positive: true,
        },
        {
          label: "Remaining",
          value: remaining > 0 ? remaining : "🎉 DONE!",
          positive: remaining <= 0,
        },
      ]);

      if (result.victory) gameState.gameOver = true;
    } else {
      gameState.failedMissions++;
      gameState.reputation -= result.reputationLost;

      showResultModal(false, "Rescue attempt failed!", [
        {
          label: "Trust Points",
          value: `-${result.reputationLost}`,
          positive: false,
        },
        {
          label: "Dice Roll",
          value: `${result.roll}+1=${result.adjusted_roll} vs ${result.needed}`,
          positive: false,
        },
      ]);
    }
  } catch (error) {
    hideLoading();
    showToast("Mission error!", "error");
  }
}

async function declineMission() {
  closeModal("mission-modal");

  try {
    const result = await apiPost(
      `/player/${gameState.playerId}/mission/${gameState.currentMission.id}/skip`,
    );
    gameState.reputation = result.newReputation;
    showToast("Mission skipped (-5 Trust)", "warning");
  } catch (error) {
    console.error(error);
  }

  gameState.currentMission = null;
  checkEventAtAirport();
}

function showResultModal(success, message, effects) {
  const header = document.getElementById("result-header");
  header.className = `modal-header ${success ? "success" : "danger"}`;
  document.getElementById("result-icon").textContent = success ? "✅" : "❌";
  document.getElementById("result-title").textContent = success
    ? "MISSION SUCCESS!"
    : "MISSION FAILED";
  document.getElementById("result-message").textContent = message;

  const container = document.getElementById("result-effects");
  container.innerHTML = effects
    .map(
      (e) => `
    <div class="effect-item ${e.positive ? "positive" : "negative"}">
      <span class="effect-label">${e.label}</span>
      <span class="effect-value">${e.value}</span>
    </div>
  `,
    )
    .join("");

  // Add animation
  const animation = document.getElementById("result-animation");
  animation.innerHTML = success
    ? '<div class="success-burst">🎉</div>'
    : '<div class="fail-burst">💔</div>';

  openModal("result-modal");
}

function handleResultContinue() {
  closeModal("result-modal");

  if (
    gameState.completedMissions >= (gameState.config?.missions_to_complete || 6)
  ) {
    showVictory();
  } else {
    checkEventAtAirport();
  }
}

// ============================================
// EVENTS
// ============================================

async function checkEventAtAirport() {
  if (gameState.isFirstStop) {
    updateUI();
    return;
  }

  try {
    const event = await apiGet("/event/random");
    await showEventModal(event);
  } catch (error) {
    updateUI();
  }
}

async function showEventModal(event) {
  const header = document.getElementById("event-header");
  header.className = `modal-header ${event.type === "positive" ? "success" : event.type === "negative" ? "danger" : "neutral"}`;

  document.getElementById("event-icon").textContent = event.icon;
  document.getElementById("event-name").textContent = event.name;
  document.getElementById("event-description").textContent = event.description;

  const effects = [];
  if (event.fuelEffect)
    effects.push({
      label: "Fuel",
      value: `${event.fuelEffect > 0 ? "+" : ""}${event.fuelEffect} km`,
      positive: event.fuelEffect > 0,
    });
  if (event.reputationEffect)
    effects.push({
      label: "Trust",
      value: `${event.reputationEffect > 0 ? "+" : ""}${event.reputationEffect}`,
      positive: event.reputationEffect > 0,
    });
  if (event.rescuedEffect)
    effects.push({
      label: "Rescued",
      value: `+${event.rescuedEffect}`,
      positive: true,
    });
  if (event.fatal)
    effects.push({ label: "FATAL", value: "Game Over", positive: false });

  const container = document.getElementById("event-effects");
  container.innerHTML = effects.length
    ? effects
        .map(
          (e) => `
        <div class="effect-item ${e.positive ? "positive" : "negative"}">
          <span>${e.label}:</span><span>${e.value}</span>
        </div>
      `,
        )
        .join("")
    : '<p class="no-effects">No effects</p>';

  // Apply effects
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

    if (result.crashed || event.fatal) gameState.gameOver = true;
  } catch (error) {
    console.error(error);
  }

  openModal("event-modal");
}

function handleEventContinue() {
  closeModal("event-modal");

  if (gameState.gameOver) {
    showGameOver("Fatal event ended your mission!");
  } else {
    updateUI();
  }
}

// ============================================
// REFUEL
// ============================================

async function handleRefuel() {
  try {
    const result = await apiPost(`/player/${gameState.playerId}/refuel`);
    gameState.fuel = result.fuel;
    gameState.reputation = result.reputation;

    const btn = document.getElementById("refuel-btn");
    btn.innerHTML =
      '<span class="refuel-icon">✅</span><span class="refuel-text">Refueled!</span>';
    btn.disabled = true;

    showToast("Refueled +1000 km!", "success");
    updateUI();

    setTimeout(() => {
      btn.innerHTML =
        '<span class="refuel-icon">🔄</span><span class="refuel-text">Refuel (-20 Trust = +1000km)</span>';
      updateUI();
    }, 2000);
  } catch (error) {
    showToast("Refuel failed!", "error");
  }
}

// ============================================
// GAME END
// ============================================

function showVictory() {
  createConfetti();

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
  const wins = gameState.config?.missions_to_complete || 6;

  document.getElementById("gameover-reason").textContent = reason;
  document.getElementById("final-pilot").textContent = gameState.playerName;
  document.getElementById("final-rescued").textContent =
    gameState.rescuedPeople;
  document.getElementById("final-reputation").textContent =
    gameState.reputation;
  document.getElementById("final-missions").textContent =
    `${gameState.completedMissions}/${wins}`;

  openModal("gameover-modal");
  gameState.gameOver = true;
}

function createConfetti() {
  const container = document.getElementById("confetti");
  container.innerHTML = "";

  const colors = ["#ff6b35", "#00d4ff", "#00ff88", "#ffd700", "#a855f7"];

  for (let i = 0; i < 100; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti-piece";
    confetti.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 2}s;
      animation-duration: ${2 + Math.random() * 2}s;
    `;
    container.appendChild(confetti);
  }
}

function restartGame() {
  closeModal("gameover-modal");
  closeModal("victory-modal");

  document.getElementById("game-screen").classList.remove("active");
  document.getElementById("welcome-screen").classList.add("active");
  document.getElementById("player-name").value = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
  initGame();
}

// ============================================
// MODALS
// ============================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove("active");
  document.body.style.overflow = "";
}

// ============================================
// EXPORTS FOR MAP POPUP
// ============================================

window.flyFromMap = flyFromMap;
