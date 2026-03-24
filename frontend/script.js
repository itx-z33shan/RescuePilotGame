// ============================================
// RESCUE PILOT - PRO GAME ENGINE v3.0
// ============================================
// FIXES APPLIED:
//  #1  AbortController for listener cleanup
//  #2  Timer interval stored + cleared
//  #3  XSS: DOM elements instead of HTML strings
//  #4  Game-over guard on all actions
//  #5  Active filter tracked + reapplied
//  #6  classList instead of className override
//  #7  animateValue cancellation via Map
//  #8  All async calls awaited
//  #9  Action lock prevents double-click
//  #10 Nearby airports fetched once, shared
//  #11 Dead code removed (calculateDistance)
//  #12 Event effects deferred until Continue
//  #13 Error handling with user feedback
//  #14 Modal open/close stack tracked
//  #15 Null-safe element access
//  #16 Magic numbers → constants
//  #17 Basic ARIA + keyboard support
//  #18 Fatal events converted to heavy penalties
//  #19 Event frequency reduced to 50%
//  #20 Success chance factors in trust+rescued
//  #21 Missions sorted by severity
//  #22 Exploration tracking
//  #23 Tutorial toast on first landing
//  #24 Fuel-after-flight shown on cards
//  #25 Refuel spend tracked for scoring
// ============================================

"use strict";

// ============================================
// CONSTANTS
// ============================================

const API_BASE =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://127.0.0.1:3000/api"
    : "https://rescue-pilot-backend.onrender.com/api";

const C = Object.freeze({
  MAP_CENTER: [50, 10],
  MAP_ZOOM: 5,
  MAP_MIN_ZOOM: 3,
  MAP_MAX_ZOOM: 8,
  FUEL_RANGE_M: 1000,
  ANIM_MS: 300,
  FLY_MS: 2500,
  TOAST_MS: 3000,
  CACHE_TTL_MS: 5000,
  EVENT_CHANCE: 0.5,
  FATAL_FUEL_PENALTY: -500,
  FATAL_REP_PENALTY: -30,
  TRUST_BONUS_DIVISOR: 20,
  TRUST_BONUS_PER: 5,
  RESCUED_BONUS_DIVISOR: 10,
  RESCUED_BONUS_PER: 3,
  SUCCESS_FLOOR: 5,
  SUCCESS_CEIL: 95,
});

// ============================================
// MODULE STATE
// ============================================

let map = null;
let markers = [];
let fuelRangeCircle = null;

// FIX #2: store timer for cleanup
let timerInterval = null;

// FIX #9: action lock
let actionBusy = false;

// FIX #5: active filter
let activeFilter = "all";

// FIX #14: modal stack
let openModals = [];

// FIX #7: animation frame registry
const animFrames = new Map();

// FIX #1: listener controller
let listenerCtrl = null;

// FIX #10: nearby cache
let nearbyCache = null;
let nearbyCacheTime = 0;

// FIX #12: pending event for deferred application
let pendingEvent = null;

// FIX #22: visited airports
let visitedAirports = new Set();

// FIX #25: trust spent tracking
let trustSpentOnRefuel = 0;

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
  settings: { animations: true, particles: true },
};

// ============================================
// HELPERS
// ============================================

// FIX #15: null-safe element getter
const $ = (id) => document.getElementById(id);

// FIX #3: sanitize text for safe display
function sanitize(str) {
  if (typeof str !== "string") return String(str ?? "");
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// FIX #3: create element helper
function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "text") {
      node.textContent = v;
    } else if (k === "html") {
      node.innerHTML = v;
    } else if (k === "class") {
      node.className = v;
    } else if (k === "style") {
      Object.assign(node.style, v);
    } else if (k.startsWith("on")) {
      node.addEventListener(k.slice(2).toLowerCase(), v);
    } else {
      node.setAttribute(k, v);
    }
  }
  for (const child of children) {
    if (typeof child === "string") {
      node.appendChild(document.createTextNode(child));
    } else if (child) {
      node.appendChild(child);
    }
  }
  return node;
}

// FIX #4 + #9: guard helper
function guardAction() {
  if (gameState.gameOver) {
    showToast("Game is over!", "warning");
    return true;
  }
  if (actionBusy) return true;
  return false;
}

async function withLock(fn) {
  if (guardAction()) return;
  actionBusy = true;
  try {
    await fn();
  } finally {
    actionBusy = false;
  }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener("DOMContentLoaded", () => {
  initLoadingScreen();
  initParticles();
  initGame();
});

function initLoadingScreen() {
  const screen = $("loading-screen");
  if (!screen) return;
  const status = screen.querySelector(".loader-status");
  const msgs = [
    "Initializing systems...",
    "Loading flight data...",
    "Calibrating instruments...",
    "Ready for takeoff!",
  ];
  let i = 0;
  const iv = setInterval(() => {
    if (status && i < msgs.length) status.textContent = msgs[i++];
  }, 500);

  setTimeout(() => {
    clearInterval(iv);
    screen.classList.add("fade-out");
    setTimeout(() => {
      screen.style.display = "none";
    }, 500);
  }, 2000);
}

function initParticles() {
  if (!gameState.settings.particles) return;
  const box = $("particles");
  if (!box) return;
  // FIX #21 (CSS): reduced to 25 particles for performance
  const count = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0
    : 25;
  for (let i = 0; i < count; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    p.style.cssText = `
      left:${Math.random() * 100}%;
      top:${Math.random() * 100}%;
      animation-delay:${Math.random() * 5}s;
      animation-duration:${5 + Math.random() * 10}s;
    `;
    box.appendChild(p);
  }
}

function initGame() {
  // FIX #2: clear any running timer
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // Reset all module state
  actionBusy = false;
  activeFilter = "all";
  openModals = [];
  nearbyCache = null;
  nearbyCacheTime = 0;
  pendingEvent = null;
  visitedAirports = new Set();
  trustSpentOnRefuel = 0;

  // Cancel pending animations
  for (const frameId of animFrames.values()) cancelAnimationFrame(frameId);
  animFrames.clear();

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
  markers = [];
  fuelRangeCircle = null;

  setupEventListeners();
}

// ============================================
// EVENT LISTENERS
// ============================================

// FIX #1: AbortController-based cleanup
function setupEventListeners() {
  if (listenerCtrl) listenerCtrl.abort();
  listenerCtrl = new AbortController();
  const sig = { signal: listenerCtrl.signal };

  $("start-btn")?.addEventListener("click", () => startGame(), sig);
  $("player-name")?.addEventListener(
    "keypress",
    (e) => {
      if (e.key === "Enter") startGame();
    },
    sig,
  );

  // Input focus
  const nameInput = $("player-name");
  if (nameInput) {
    nameInput.addEventListener(
      "focus",
      () => nameInput.parentElement?.classList.add("focused"),
      sig,
    );
    nameInput.addEventListener(
      "blur",
      () => nameInput.parentElement?.classList.remove("focused"),
      sig,
    );
  }

  // Game controls — all wrapped in withLock for FIX #9
  $("refuel-btn")?.addEventListener("click", () => withLock(handleRefuel), sig);
  $("accept-mission")?.addEventListener(
    "click",
    () => withLock(attemptMission),
    sig,
  );
  $("decline-mission")?.addEventListener(
    "click",
    () => withLock(declineMission),
    sig,
  );

  // Modal continues
  $("result-continue")?.addEventListener("click", handleResultContinue, sig);
  $("event-continue")?.addEventListener(
    "click",
    () => withLock(handleEventContinue),
    sig,
  );

  // Help
  $("help-btn")?.addEventListener("click", () => openModal("help-modal"), sig);
  $("help-close")?.addEventListener(
    "click",
    () => closeModal("help-modal"),
    sig,
  );

  // Restart
  $("restart-btn")?.addEventListener("click", restartGame, sig);
  $("victory-restart")?.addEventListener("click", restartGame, sig);

  // Map controls
  $("zoom-in")?.addEventListener("click", () => map?.zoomIn(), sig);
  $("zoom-out")?.addEventListener("click", () => map?.zoomOut(), sig);
  $("center-map")?.addEventListener("click", centerMapOnPlayer, sig);

  // Help tabs
  document.querySelectorAll(".help-tab").forEach((tab) => {
    tab.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll(".help-tab")
          .forEach((t) => t.classList.remove("active"));
        document
          .querySelectorAll(".help-content-inner")
          .forEach((c) => c.classList.add("hidden"));
        tab.classList.add("active");
        $(`help-${tab.dataset.tab}`)?.classList.remove("hidden");
      },
      sig,
    );
  });

  // FIX #5: filter buttons track active state
  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener(
      "click",
      () => {
        document
          .querySelectorAll(".filter-btn")
          .forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.filter;
        filterAirports(activeFilter);
      },
      sig,
    );
  });

  // Modal backdrop close
  document.querySelectorAll(".modal-backdrop").forEach((bd) => {
    bd.addEventListener(
      "click",
      (e) => {
        const modal = e.target.closest(".modal");
        if (modal && !modal.classList.contains("no-close")) {
          closeModal(modal.id);
        }
      },
      sig,
    );
  });

  // FIX #17: Escape key closes top modal
  document.addEventListener(
    "keydown",
    (e) => {
      if (e.key === "Escape" && openModals.length > 0) {
        const top = openModals[openModals.length - 1];
        const modalEl = $(top);
        if (modalEl && !modalEl.classList.contains("no-close")) {
          closeModal(top);
        }
      }
    },
    sig,
  );
}

// ============================================
// API
// ============================================

async function apiGet(endpoint) {
  try {
    const r = await fetch(`${API_BASE}${endpoint}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    console.error("API GET Error:", err);
    showToast("Connection error — check server.", "error");
    throw err;
  }
}

async function apiPost(endpoint, data = {}) {
  try {
    const r = await fetch(`${API_BASE}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (err) {
    console.error("API POST Error:", err);
    showToast("Connection error — check server.", "error");
    throw err;
  }
}

// FIX #10: cached nearby airports — single fetch shared by map + grid
async function getNearbyAirports(force = false) {
  const now = Date.now();
  if (!force && nearbyCache && now - nearbyCacheTime < C.CACHE_TTL_MS) {
    return nearbyCache;
  }
  nearbyCache = await apiGet(`/player/${gameState.playerId}/nearby-airports`);
  nearbyCacheTime = now;
  return nearbyCache;
}

// ============================================
// UTILITIES
// ============================================

// FIX #7: cancellable animateValue
function animateValue(element, start, end, duration = C.ANIM_MS) {
  if (!element) return;
  const prev = animFrames.get(element);
  if (prev) cancelAnimationFrame(prev);

  if (typeof start !== "number" || isNaN(start)) start = 0;
  const range = end - start;
  const t0 = performance.now();

  function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    const ease = 1 - Math.pow(1 - p, 3);
    element.textContent = Math.round(start + range * ease);
    if (p < 1) {
      animFrames.set(element, requestAnimationFrame(tick));
    } else {
      animFrames.delete(element);
    }
  }
  animFrames.set(element, requestAnimationFrame(tick));
}

function showLoading(msg = "Loading...") {
  let ov = $("loading-overlay");
  if (!ov) {
    ov = el("div", { id: "loading-overlay", class: "loading-overlay" }, [
      el("div", { class: "loading-spinner" }),
      el("div", { class: "loading-text", text: msg }),
    ]);
    document.body.appendChild(ov);
  }
  const txt = ov.querySelector(".loading-text");
  if (txt) txt.textContent = msg;
  ov.classList.add("active");
}

function hideLoading() {
  $("loading-overlay")?.classList.remove("active");
}

function showToast(message, type = "info", duration = C.TOAST_MS) {
  const container = $("toast-container");
  if (!container) return;

  const icons = { success: "✅", error: "❌", warning: "⚠️", info: "ℹ️" };
  const toast = el("div", { class: `toast toast-${type}`, role: "alert" }, [
    el("span", { class: "toast-icon", text: icons[type] || "ℹ️" }),
    el("span", { class: "toast-message", text: message }),
  ]);
  container.appendChild(toast);

  requestAnimationFrame(() =>
    requestAnimationFrame(() => toast.classList.add("show")),
  );
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function scrollToDashboard() {
  setTimeout(() => {
    document
      .querySelector(".dashboard")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, 300);
}

function formatTime(s) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

function updateFlightTime() {
  if (!gameState.startTime) return;
  const el = $("flight-time");
  if (el)
    el.textContent = formatTime(
      Math.floor((Date.now() - gameState.startTime) / 1000),
    );
}

// FIX #20: success chance influenced by trust + rescued
function displaySuccessChance(mission) {
  let base = Math.max(10, Math.min(90, 100 - mission.severity * 10 + 10));
  const trustBonus =
    Math.floor((gameState.reputation - 50) / C.TRUST_BONUS_DIVISOR) *
    C.TRUST_BONUS_PER;
  const rescuedBonus =
    Math.floor(gameState.rescuedPeople / C.RESCUED_BONUS_DIVISOR) *
    C.RESCUED_BONUS_PER;
  return Math.max(
    C.SUCCESS_FLOOR,
    Math.min(C.SUCCESS_CEIL, base + trustBonus + rescuedBonus),
  );
}

// ============================================
// MAP
// ============================================

function initMap() {
  map = L.map("game-map", {
    center: C.MAP_CENTER,
    zoom: 4,
    minZoom: C.MAP_MIN_ZOOM,
    maxZoom: C.MAP_MAX_ZOOM,
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

  // Remove old markers
  markers.forEach((m) => map.removeLayer(m));
  markers = [];
  if (fuelRangeCircle) map.removeLayer(fuelRangeCircle);

  const cur = gameState.currentAirport;
  if (!cur) return;

  // Fuel range circle
  fuelRangeCircle = L.circle([cur.latitude_deg, cur.longitude_deg], {
    radius: gameState.fuel * C.FUEL_RANGE_M,
    color: "rgba(0, 212, 255, 0.6)",
    fillColor: "rgba(0, 212, 255, 0.1)",
    fillOpacity: 0.3,
    dashArray: "10, 5",
    weight: 2,
  }).addTo(map);

  // Current location marker
  const curIcon = L.divIcon({
    className: "custom-marker marker-current",
    html: "✈️",
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });

  // FIX #3: build popup via DOM
  const curPopup = el("div", { class: "popup-content popup-current" }, [
    el("h4", { text: cur.name }),
    el("span", { class: "popup-code", text: cur.ident }),
    el("div", { class: "popup-you-are-here", text: "📍 YOU ARE HERE" }),
  ]);

  const curMarker = L.marker([cur.latitude_deg, cur.longitude_deg], {
    icon: curIcon,
    zIndexOffset: 1000,
  }).addTo(map);
  curMarker.bindPopup(curPopup);
  markers.push(curMarker);

  map.setView([cur.latitude_deg, cur.longitude_deg], C.MAP_ZOOM);

  const mapFuel = $("map-fuel");
  if (mapFuel) mapFuel.textContent = `${gameState.fuel} km range`;
}

// FIX #10: receives airports array directly (no duplicate fetch)
function updateMapMarkers(airports) {
  if (!map || !airports) return;

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
      icon,
      zIndexOffset: zIndex,
    }).addTo(map);

    // FIX #3: build popup via DOM — no XSS
    const popup = el("div", { class: "popup-content" });
    popup.appendChild(el("h4", { text: airport.name }));
    popup.appendChild(el("span", { class: "popup-code", text: airport.ident }));
    popup.appendChild(
      el("div", { class: "popup-distance", text: `📏 ${airport.distance} km` }),
    );

    // FIX #24: show fuel remaining after flight
    if (airport.inRange) {
      const remain = gameState.fuel - airport.distance;
      popup.appendChild(
        el("div", {
          class: "popup-fuel-remaining",
          text: `⛽ ${remain} km remaining after flight`,
        }),
      );
    }

    if (airport.hasMission && airport.missionInfo) {
      popup.appendChild(
        el("div", {
          class: "popup-mission",
          text: `${airport.missionInfo.icon} ${airport.missionInfo.disaster}`,
        }),
      );
      const details = el("div", { class: "popup-mission-details" });
      details.appendChild(
        el("span", {
          text: `Difficulty: ${airport.missionInfo.severity}/10`,
        }),
      );
      details.appendChild(
        el("span", {
          text: `Reward: +${airport.missionInfo.reward} Trust`,
        }),
      );
      popup.appendChild(details);
    }

    popup.appendChild(
      el("div", {
        class: `popup-status ${airport.inRange ? "in-range" : "out-range"}`,
        text: airport.inRange ? "✅ In Range" : "❌ Out of Range",
      }),
    );

    // FIX #3: safe click handler instead of inline onclick
    const flyBtn = el("button", {
      class: "btn-fly",
      text: airport.inRange ? "✈️ FLY HERE" : "OUT OF RANGE",
    });
    if (!airport.inRange) flyBtn.disabled = true;
    else {
      flyBtn.addEventListener("click", () => {
        map.closePopup();
        flyToAirport(
          {
            ident: airport.ident,
            name: airport.name,
            latitude_deg: airport.latitude_deg,
            longitude_deg: airport.longitude_deg,
          },
          airport.distance,
        );
      });
    }
    popup.appendChild(flyBtn);

    marker.bindPopup(popup);
    markers.push(marker);
  });
}

function centerMapOnPlayer() {
  if (map && gameState.currentAirport) {
    map.setView(
      [
        gameState.currentAirport.latitude_deg,
        gameState.currentAirport.longitude_deg,
      ],
      C.MAP_ZOOM,
    );
  }
}

// ============================================
// GAME START
// ============================================

async function startGame() {
  if (actionBusy) return;
  actionBusy = true;

  const nameVal = $("player-name")?.value.trim();
  gameState.playerName = nameVal || "Commander";

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
    trustSpentOnRefuel = 0;

    // FIX #22: mark starting airport visited
    if (data.currentAirport) visitedAirports.add(data.currentAirport.ident);

    hideLoading();

    // Screen transition
    const welcome = $("welcome-screen");
    const game = $("game-screen");
    if (welcome) {
      welcome.classList.add("fade-out");
      setTimeout(() => {
        welcome.classList.remove("active", "fade-out");
        game?.classList.add("active");

        const pilotDisp = $("pilot-name-display");
        if (pilotDisp) pilotDisp.textContent = gameState.playerName;

        setTimeout(async () => {
          initMap();
          await updateUI();
          scrollToDashboard();

          // FIX #2: store timer reference
          if (timerInterval) clearInterval(timerInterval);
          timerInterval = setInterval(updateFlightTime, 1000);

          showToast(`Welcome, Captain ${gameState.playerName}!`, "success");

          // FIX #23: tutorial toast
          setTimeout(() => {
            showToast(
              "Fly to airports with 🚨 to find rescue missions. Random events may occur on landing!",
              "info",
              6000,
            );
          }, 2000);
        }, 100);
      }, 300);
    }
  } catch (err) {
    hideLoading();
    showToast("Failed to start — check server connection.", "error");
    console.error(err);
  } finally {
    actionBusy = false;
  }
}

// ============================================
// UPDATE UI
// ============================================

async function updateUI() {
  const maxFuel = gameState.config?.max_fuel || 3500;
  const maxRep = gameState.config?.max_reputation || 200;
  const missionsToWin = gameState.config?.missions_to_complete || 6;

  // --- Fuel ---
  const fuelPct = (gameState.fuel / maxFuel) * 100;
  const fuelBar = $("fuel-bar");
  if (fuelBar) {
    fuelBar.style.width = `${Math.min(100, fuelPct)}%`;
    // FIX #6: classList instead of className
    fuelBar.classList.remove("warning", "critical");
  }

  const fuelValEl = $("fuel-value");
  if (fuelValEl) {
    animateValue(
      fuelValEl,
      parseInt(fuelValEl.textContent) || 0,
      gameState.fuel,
    );
  }

  const fuelStatus = $("fuel-status");
  if (fuelBar && fuelStatus) {
    if (gameState.fuel < 500) {
      fuelBar.classList.add("critical");
      fuelStatus.textContent = "CRITICAL";
      fuelStatus.className = "card-badge danger";
    } else if (gameState.fuel < 1000) {
      fuelBar.classList.add("warning");
      fuelStatus.textContent = "LOW";
      fuelStatus.className = "card-badge warning";
    } else {
      fuelStatus.textContent = "GOOD";
      fuelStatus.className = "card-badge success";
    }
  }

  // --- Reputation circle ---
  const repPct = (gameState.reputation / maxRep) * 100;
  const repCircle = $("reputation-circle");
  if (repCircle) {
    const circ = 2 * Math.PI * 45;
    repCircle.style.strokeDasharray = circ;
    repCircle.style.strokeDashoffset = circ - (repPct / 100) * circ;
  }

  const repValEl = $("reputation-value");
  if (repValEl) {
    animateValue(
      repValEl,
      parseInt(repValEl.textContent) || 0,
      gameState.reputation,
    );
  }

  // --- Rescued ---
  const rescValEl = $("rescued-value");
  if (rescValEl) {
    animateValue(
      rescValEl,
      parseInt(rescValEl.textContent) || 0,
      gameState.rescuedPeople,
    );
  }

  // --- Missions ring ---
  const completed = gameState.missions.filter(
    (m) => m.status === "completed",
  ).length;
  gameState.completedMissions = completed;

  const mPct = (completed / missionsToWin) * 100;
  const mCircle = $("missions-circle");
  if (mCircle) {
    const mc = 2 * Math.PI * 40;
    mCircle.style.strokeDasharray = mc;
    mCircle.style.strokeDashoffset = mc - (mPct / 100) * mc;
  }

  const mComp = $("missions-completed");
  const mTotal = $("missions-total");
  if (mComp) mComp.textContent = completed;
  if (mTotal) mTotal.textContent = missionsToWin;

  // --- Location ---
  const airName = $("current-airport-name");
  const airCode = $("current-airport-code");
  if (airName) airName.textContent = gameState.currentAirport?.name || "—";
  if (airCode) airCode.textContent = gameState.currentAirport?.ident || "—";

  const coordLat = $("coord-lat");
  const coordLon = $("coord-lon");
  if (coordLat && gameState.currentAirport) {
    const lat = gameState.currentAirport.latitude_deg;
    coordLat.textContent = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? "N" : "S"}`;
  }
  if (coordLon && gameState.currentAirport) {
    const lon = gameState.currentAirport.longitude_deg;
    coordLon.textContent = `${Math.abs(lon).toFixed(4)}° ${lon >= 0 ? "E" : "W"}`;
  }

  // --- Refuel button ---
  const rechargeCost = gameState.config?.recharge_cost || 20;
  const refuelBtn = $("refuel-btn");
  if (refuelBtn) {
    if (gameState.reputation >= rechargeCost && gameState.fuel < maxFuel) {
      refuelBtn.style.display = "flex";
      refuelBtn.disabled = false;
    } else {
      refuelBtn.style.display = "none";
    }
  }

  // --- Distance ---
  const distEl = $("total-distance");
  if (distEl) distEl.textContent = `${gameState.totalDistance} km`;

  // --- Map & airports: FIX #10 single fetch ---
  updateMap();

  try {
    // Invalidate cache so we get fresh data
    nearbyCache = null;
    const airports = await getNearbyAirports(true);
    updateMapMarkers(airports);
    updateAirportsGrid(airports);
  } catch (err) {
    console.error("Error loading airports:", err);
  }

  updateMissionsList();
}

// ============================================
// AIRPORTS GRID
// ============================================

// FIX #10: receives airports directly
function updateAirportsGrid(airports) {
  const grid = $("airports-grid");
  if (!grid) return;

  grid.innerHTML = "";

  if (!airports || airports.length === 0) {
    grid.appendChild(
      el("div", { class: "loading-text", text: "No airports found." }),
    );
    return;
  }

  airports.forEach((airport, idx) => {
    const card = el("div", {
      class: `airport-card ${airport.inRange ? "" : "out-of-range"} ${airport.hasMission ? "has-mission" : ""}`,
      style: { animationDelay: `${idx * 0.05}s` },
      "data-filter": airport.hasMission
        ? "mission"
        : airport.distance < 500
          ? "nearby"
          : "all",
      role: "button",
      tabindex: airport.inRange ? "0" : "-1",
      "aria-label": `${airport.name} — ${airport.distance} km${airport.hasMission ? " — has mission" : ""}${airport.inRange ? "" : " — out of range"}`,
    });

    const inner = el("div", { class: "airport-card-inner" });

    // Header
    const header = el("div", { class: "airport-header" }, [
      el("span", { class: "airport-name", text: airport.name }),
      el("span", { class: "airport-code-small", text: airport.ident }),
    ]);
    inner.appendChild(header);

    // Distance row — FIX #24: show remaining fuel
    const distRow = el("div", { class: "airport-distance" }, [
      el("span", { class: "distance-icon", text: "📏" }),
      el("span", {
        class: "distance-value",
        text: `${airport.distance} km`,
      }),
    ]);

    if (airport.inRange) {
      const remain = gameState.fuel - airport.distance;
      distRow.appendChild(
        el("span", {
          class: "in-range-badge",
          text: `✓ ${remain} km left`,
        }),
      );
    } else {
      distRow.appendChild(
        el("span", { class: "out-range-badge", text: "✗ Out" }),
      );
    }
    inner.appendChild(distRow);

    // Mission indicator
    if (airport.hasMission && airport.missionInfo) {
      const mi = el("div", { class: "mission-indicator" }, [
        el("span", { class: "mission-icon", text: airport.missionInfo.icon }),
        el("span", {
          class: "mission-type",
          text: airport.missionInfo.disaster,
        }),
      ]);
      const meta = el("div", { class: "mission-meta" }, [
        el("span", {
          class: "difficulty",
          text: `Diff: ${airport.missionInfo.severity}/10`,
        }),
        el("span", {
          class: "reward",
          text: `+${airport.missionInfo.reward} Trust`,
        }),
      ]);
      mi.appendChild(meta);
      inner.appendChild(mi);
    }

    // FIX #22: exploration badge
    if (visitedAirports.has(airport.ident)) {
      inner.appendChild(
        el("span", {
          class: "explored-badge",
          text: "👁 Visited",
        }),
      );
    }

    card.appendChild(inner);

    // Click handler
    if (airport.inRange) {
      const fly = () =>
        flyToAirport(
          {
            ident: airport.ident,
            name: airport.name,
            latitude_deg: airport.latitude_deg,
            longitude_deg: airport.longitude_deg,
          },
          airport.distance,
        );
      card.addEventListener("click", fly);
      // FIX #17: keyboard support
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fly();
        }
      });
    }

    grid.appendChild(card);
  });

  // FIX #5: reapply active filter
  filterAirports(activeFilter);
}

function filterAirports(filter) {
  document.querySelectorAll(".airport-card").forEach((card) => {
    const f = card.dataset.filter;
    const show =
      filter === "all" ||
      f === filter ||
      (filter === "mission" && card.classList.contains("has-mission"));
    card.style.display = show ? "" : "none";
  });
}

// ============================================
// MISSIONS LIST
// ============================================

function updateMissionsList() {
  const list = $("missions-list");
  if (!list) return;
  list.innerHTML = "";

  const missionsToWin = gameState.config?.missions_to_complete || 6;

  // Progress header
  const pct = (gameState.completedMissions / missionsToWin) * 100;
  const remaining = missionsToWin - gameState.completedMissions;

  const progress = el("div", { class: "missions-progress" });
  progress.innerHTML = `
    <div class="progress-header">
      <span class="progress-label">Mission Progress</span>
      <span class="progress-count">${gameState.completedMissions}/${missionsToWin}</span>
    </div>
    <div class="progress-bar-container">
      <div class="progress-bar" style="width:${pct}%" role="progressbar"
           aria-valuenow="${gameState.completedMissions}" aria-valuemin="0"
           aria-valuemax="${missionsToWin}">
        <div class="progress-shimmer"></div>
      </div>
    </div>
    <div class="progress-message">
      ${remaining <= 0 ? "🎉 All missions complete!" : `${remaining} more mission${remaining !== 1 ? "s" : ""} to victory!`}
    </div>
  `;
  list.appendChild(progress);

  // FIX #21: sort by severity (easy first) then status
  const sorted = [...gameState.missions].sort((a, b) => {
    const statusOrder = { pending: 0, completed: 1, failed: 2 };
    const sDiff = statusOrder[a.status] - statusOrder[b.status];
    if (sDiff !== 0) return sDiff;
    return a.severity - b.severity;
  });

  sorted.forEach((mission, idx) => {
    const diffLabel =
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

    const statusIcons = { pending: "⏳", completed: "✅", failed: "❌" };
    const statusLabels = {
      pending: "PENDING",
      completed: "RESCUED",
      failed: "FAILED",
    };

    const item = el("div", {
      class: `mission-item ${mission.status}`,
      style: { animationDelay: `${idx * 0.05}s` },
    });

    item.innerHTML = `
      <span class="mission-icon">${sanitize(mission.icon)}</span>
      <div class="mission-info">
        <div class="mission-title">
          ${sanitize(mission.disaster)}
          ${mission.status === "pending" ? `<span class="difficulty-badge ${diffClass}">${diffLabel}</span>` : ""}
        </div>
        <div class="mission-location">${sanitize(mission.airport.name)}</div>
        <div class="mission-meta">
          <span class="people-count">👥 ${mission.peopleInDanger}</span>
          <span class="reward-amount">🏆 +${mission.reward}</span>
        </div>
      </div>
      <div class="mission-status ${mission.status}">
        <span class="status-icon">${statusIcons[mission.status]}</span>
        <span class="status-text">${statusLabels[mission.status]}</span>
      </div>
    `;

    list.appendChild(item);
  });
}

// ============================================
// TRAVEL
// ============================================

async function flyToAirport(airport, distance) {
  // FIX #4: game-over + busy guard
  if (guardAction()) return;
  if (distance > gameState.fuel) {
    showToast("Not enough fuel!", "error");
    return;
  }

  actionBusy = true;

  // Show flying overlay
  const overlay = $("flying-overlay");
  const fromEl = $("from-airport");
  const toEl = $("to-airport");
  const infoEl = $("flying-info");

  if (fromEl) fromEl.textContent = gameState.currentAirport?.ident || "???";
  if (toEl) toEl.textContent = airport.ident;
  if (infoEl) infoEl.textContent = `${distance} km journey`;
  overlay?.classList.add("active");

  try {
    const result = await apiPost(`/player/${gameState.playerId}/fly`, {
      destination: airport.ident,
      distance,
    });

    setTimeout(async () => {
      gameState.fuel = result.fuel;
      gameState.currentAirport = result.currentAirport;
      gameState.isFirstStop = false;
      gameState.totalDistance += distance;

      // FIX #22: track visited airports
      visitedAirports.add(airport.ident);

      overlay?.classList.remove("active");

      if (result.crashed) {
        gameState.gameOver = true;
        actionBusy = false;
        showGameOver("Your plane ran out of fuel and crashed!");
        return;
      }

      // FIX #8: await updateUI
      await updateUI();
      scrollToDashboard();
      showToast(`Landed at ${airport.name}`, "success");

      actionBusy = false;

      // Check for missions then events
      setTimeout(() => checkMissionAtAirport(), 500);
    }, C.FLY_MS);
  } catch (err) {
    overlay?.classList.remove("active");
    actionBusy = false;
    showToast("Flight failed!", "error");
  }
}

// ============================================
// MISSIONS
// ============================================

async function checkMissionAtAirport() {
  if (gameState.gameOver) return;

  try {
    const result = await apiPost(
      `/player/${gameState.playerId}/check-mission`,
      { airport: gameState.currentAirport.ident },
    );

    if (result.hasMission) {
      gameState.currentMission = result.mission;
      showMissionModal(result.mission);
    } else {
      await checkEventAtAirport();
    }
  } catch (err) {
    // FIX #13: show error feedback
    showToast("Could not check for missions.", "warning");
    await checkEventAtAirport();
  }
}

function showMissionModal(mission) {
  const iconEl = $("disaster-icon");
  const typeEl = $("disaster-type");
  const locEl = $("disaster-location");
  const peopleEl = $("people-trapped");
  const sevEl = $("severity-level");
  const rewEl = $("mission-reward");

  if (iconEl) iconEl.textContent = mission.icon;
  if (typeEl) typeEl.textContent = mission.disaster.toUpperCase();
  if (locEl) locEl.textContent = mission.airport.name;
  if (peopleEl) peopleEl.textContent = mission.peopleInDanger;
  if (sevEl) sevEl.textContent = `${mission.severity}/10`;
  if (rewEl) rewEl.textContent = `+${mission.reward} Trust`;

  // FIX #20: dynamic success chance
  const chance = displaySuccessChance(mission);
  const chanceBar = $("success-chance");
  const chancePct = $("chance-percent");
  if (chanceBar) chanceBar.style.width = `${chance}%`;
  if (chancePct) chancePct.textContent = `${chance}%`;

  openModal("mission-modal");
}

async function attemptMission() {
  closeModal("mission-modal");
  const mission = gameState.currentMission;
  if (!mission) return;

  try {
    showLoading("Attempting rescue...");
    const result = await apiPost(
      `/player/${gameState.playerId}/mission/${mission.id}/attempt`,
    );
    hideLoading();

    // Update local mission status
    const idx = gameState.missions.findIndex((m) => m.id === mission.id);
    if (idx !== -1) {
      gameState.missions[idx].status = result.success ? "completed" : "failed";
    }

    if (result.success) {
      gameState.completedMissions =
        result.completedMissions ?? gameState.completedMissions + 1;
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
          value: remaining > 0 ? String(remaining) : "🎉 DONE!",
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
  } catch (err) {
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
    showToast("Mission skipped (−5 Trust)", "warning");
  } catch (err) {
    console.error(err);
    showToast("Could not skip mission.", "error");
  }

  gameState.currentMission = null;
  await checkEventAtAirport();
}

function showResultModal(success, message, effects) {
  const header = $("result-header");
  if (header)
    header.className = `modal-header ${success ? "success" : "danger"}`;

  const iconEl = $("result-icon");
  const titleEl = $("result-title");
  const msgEl = $("result-message");
  if (iconEl) iconEl.textContent = success ? "✅" : "❌";
  if (titleEl)
    titleEl.textContent = success ? "MISSION SUCCESS!" : "MISSION FAILED";
  if (msgEl) msgEl.textContent = message;

  const container = $("result-effects");
  if (container) {
    container.innerHTML = effects
      .map(
        (e) => `
      <div class="effect-item ${e.positive ? "positive" : "negative"}">
        <span class="effect-label">${sanitize(e.label)}</span>
        <span class="effect-value">${sanitize(String(e.value))}</span>
      </div>`,
      )
      .join("");
  }

  const anim = $("result-animation");
  if (anim) {
    anim.innerHTML = success
      ? '<div class="success-burst">🎉</div>'
      : '<div class="fail-burst">💔</div>';
  }

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

// FIX #19: 50% event chance
async function checkEventAtAirport() {
  if (gameState.gameOver) return;

  if (gameState.isFirstStop) {
    await updateUI();
    return;
  }

  // Reduced frequency — events only fire ~50% of stops
  if (Math.random() > C.EVENT_CHANCE) {
    await updateUI();
    return;
  }

  try {
    const event = await apiGet("/event/random");
    showEventModal(event);
  } catch (err) {
    // FIX #13: user feedback
    showToast("Could not load event.", "warning");
    await updateUI();
  }
}

// FIX #12: effects are DEFERRED until user clicks Continue
function showEventModal(event) {
  // FIX #18: convert fatal → heavy penalties
  if (event.fatal) {
    event.fatal = false;
    event.fuelEffect = Math.min(event.fuelEffect || 0, C.FATAL_FUEL_PENALTY);
    event.reputationEffect = Math.min(
      event.reputationEffect || 0,
      C.FATAL_REP_PENALTY,
    );
    event.name = "⚠️ " + event.name;
    event.description =
      (event.description || "") +
      " Near-catastrophic damage sustained — heavy losses!";
    event.type = "negative";
  }

  // Store for deferred application
  pendingEvent = event;

  const header = $("event-header");
  if (header) {
    const cls =
      event.type === "positive"
        ? "success"
        : event.type === "negative"
          ? "danger"
          : "neutral";
    header.className = `modal-header ${cls}`;
  }

  const iconEl = $("event-icon");
  const nameEl = $("event-name");
  const descEl = $("event-description");
  if (iconEl) iconEl.textContent = event.icon;
  if (nameEl) nameEl.textContent = event.name;
  if (descEl) descEl.textContent = event.description;

  // Build effects display
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

  const container = $("event-effects");
  if (container) {
    container.innerHTML = effects.length
      ? effects
          .map(
            (e) => `
          <div class="effect-item ${e.positive ? "positive" : "negative"}">
            <span class="effect-label">${sanitize(e.label)}:</span>
            <span class="effect-value">${sanitize(String(e.value))}</span>
          </div>`,
          )
          .join("")
      : '<p class="no-effects">No effects</p>';
  }

  // Show modal — effects NOT yet applied
  openModal("event-modal");
}

// FIX #12: apply effects only when user clicks Continue
async function handleEventContinue() {
  closeModal("event-modal");

  if (pendingEvent) {
    try {
      const result = await apiPost(
        `/player/${gameState.playerId}/apply-event`,
        {
          fuelEffect: pendingEvent.fuelEffect,
          reputationEffect: pendingEvent.reputationEffect,
          rescuedEffect: pendingEvent.rescuedEffect,
          fatal: pendingEvent.fatal, // always false now due to FIX #18
        },
      );

      gameState.fuel = result.fuel;
      gameState.reputation = result.reputation;
      gameState.rescuedPeople = result.rescuedPeople;

      if (result.crashed) {
        gameState.gameOver = true;
      }
    } catch (err) {
      showToast("Error applying event effects.", "error");
    }
    pendingEvent = null;
  }

  if (gameState.gameOver) {
    showGameOver("Your plane could not sustain further damage!");
  } else {
    await updateUI();
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

    // FIX #25: track trust spent
    trustSpentOnRefuel += gameState.config?.recharge_cost || 20;

    const btn = $("refuel-btn");
    if (btn) {
      btn.innerHTML =
        '<span class="refuel-icon">✅</span><span class="refuel-text">Refueled!</span>';
      btn.disabled = true;
    }

    showToast("Refueled +1000 km!", "success");
    await updateUI();

    setTimeout(async () => {
      if (btn) {
        btn.innerHTML =
          '<span class="refuel-icon">🔄</span><span class="refuel-text">Refuel (−20 Trust → +1000km)</span>';
      }
      await updateUI();
    }, 2000);
  } catch (err) {
    showToast("Refuel failed!", "error");
  }
}

// ============================================
// GAME END
// ============================================

function showVictory() {
  createConfetti();

  const pilotEl = $("victory-pilot");
  const rescEl = $("victory-rescued");
  const repEl = $("victory-reputation");
  const fuelEl = $("victory-fuel");

  if (pilotEl) pilotEl.textContent = gameState.playerName;
  if (rescEl) rescEl.textContent = gameState.rescuedPeople;
  if (repEl) repEl.textContent = gameState.reputation;
  if (fuelEl) fuelEl.textContent = `${gameState.fuel} km`;

  // FIX #25: show refuel spend
  const spentEl = $("victory-trust-spent");
  if (spentEl) spentEl.textContent = trustSpentOnRefuel;

  openModal("victory-modal");
  gameState.gameOver = true;
}

function showGameOver(reason) {
  const wins = gameState.config?.missions_to_complete || 6;

  const reasonEl = $("gameover-reason");
  const pilotEl = $("final-pilot");
  const rescEl = $("final-rescued");
  const repEl = $("final-reputation");
  const missEl = $("final-missions");

  if (reasonEl) reasonEl.textContent = reason;
  if (pilotEl) pilotEl.textContent = gameState.playerName;
  if (rescEl) rescEl.textContent = gameState.rescuedPeople;
  if (repEl) repEl.textContent = gameState.reputation;
  if (missEl) missEl.textContent = `${gameState.completedMissions}/${wins}`;

  // FIX #25
  const spentEl = $("final-trust-spent");
  if (spentEl) spentEl.textContent = trustSpentOnRefuel;

  openModal("gameover-modal");
  gameState.gameOver = true;
}

function createConfetti() {
  const box = $("confetti");
  if (!box) return;
  box.innerHTML = "";

  // FIX: check reduced motion
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const colors = ["#ff6b35", "#00d4ff", "#00ff88", "#ffd700", "#a855f7"];
  for (let i = 0; i < 80; i++) {
    const piece = document.createElement("div");
    piece.className = "confetti-piece";
    piece.style.cssText = `
      left:${Math.random() * 100}%;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay:${Math.random() * 2}s;
      animation-duration:${2 + Math.random() * 2}s;
    `;
    box.appendChild(piece);
  }
}

function restartGame() {
  closeModal("gameover-modal");
  closeModal("victory-modal");

  const gameScreen = $("game-screen");
  const welcomeScreen = $("welcome-screen");
  if (gameScreen) gameScreen.classList.remove("active");
  if (welcomeScreen) welcomeScreen.classList.add("active");

  const nameInput = $("player-name");
  if (nameInput) nameInput.value = "";

  window.scrollTo({ top: 0, behavior: "smooth" });
  initGame();
}

// ============================================
// MODALS
// ============================================

// FIX #14: stack-tracked open/close + FIX #17: ARIA
function openModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.add("active");
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");

  if (!openModals.includes(modalId)) openModals.push(modalId);
  document.body.style.overflow = "hidden";

  // Focus first interactive element
  setTimeout(() => {
    const focusable = modal.querySelector(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    );
    focusable?.focus();
  }, 100);
}

function closeModal(modalId) {
  const modal = $(modalId);
  if (!modal) return;

  modal.classList.remove("active");
  modal.removeAttribute("aria-modal");

  openModals = openModals.filter((id) => id !== modalId);

  // FIX #16: only unlock body when no modals remain
  if (openModals.length === 0) {
    document.body.style.overflow = "";
  }
}

// ============================================
// GLOBAL EXPORTS (kept for any remaining edge cases)
// ============================================
// flyFromMap is no longer needed — popups use DOM event listeners
