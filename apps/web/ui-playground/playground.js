import { drawFrame, drawWater, loadAssetBundle, speciesScale, SpriteAnimation } from "../../../src/assets/sprites.js";
import "../src/styles/pixel-ocean.css";

import oceanMapUrl from "../../../assets/maps/point-nemo-abyss-ocean.png";

const screenNames = ["library", "sonar", "seas", "descent", "boss", "results", "profile", "leaderboard"];
const navButtons = [...document.querySelectorAll(".nav-step[data-screen]")];
const profileShortcut = document.querySelector(".profile-shortcut");
let routeNode = 1;
let routePartAnswered = false;
let activeEncounter = false;
let bossReached = false;
let worldMapImage;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
const heldMovementKeys = new Set();
const worldPlayer = { x: 0.5, y: 0.57, facing: "up", moving: false };
const marineBiologyTopics = ["", "Surface currents", "Pressure & adaptation", "Deep-sea habitats", "Lesson boss"];
const routePoints = [
  { x: 0.5, y: 0.5, label: "POINT NEMO" },
  { x: 0.2, y: 0.22, label: "SURFACE CURRENTS" },
  { x: 0.8, y: 0.22, label: "PRESSURE" },
  { x: 0.2, y: 0.78, label: "HABITATS" },
  { x: 0.8, y: 0.78, label: "LESSON BOSS" },
];
const routeQuestions = [
  null,
  {
    prompt: "What primarily drives the large-scale surface currents in Earth's oceans?",
    options: ["Tides alone", "Global wind patterns", "Deep-sea volcanoes", "Seafloor pressure"],
    correct: 1,
    answer: "Global wind patterns",
    explanation: "Prevailing winds transfer energy to the ocean surface and drive large-scale surface currents.",
  },
  {
    prompt: "Which trait helps deep-sea animals tolerate intense water pressure?",
    options: ["Air-filled cavities", "Pressure-balanced tissues", "Thick hollow bones", "A gas-filled swim bladder"],
    correct: 1,
    answer: "Pressure-balanced tissues",
    explanation: "Flexible bodies and pressure-balanced tissues avoid large pressure differences at depth.",
  },
  {
    prompt: "What energy source can support life around hydrothermal vents?",
    options: ["Sunlight", "Wind energy", "Chemical compounds", "Surface wave motion"],
    correct: 2,
    answer: "Chemical compounds",
    explanation: "Some vent ecosystems rely on chemosynthesis, which uses energy from chemical compounds.",
  },
];

const lessonCatalog = {
  "marine-biology": {
    title: "Introduction to Marine Biology",
    topics: marineBiologyTopics,
    questions: routeQuestions,
  },
  "deep-sea-life": {
    title: "Deep-Sea Life and Adaptations",
    topics: ["", "Pressure tolerance", "Bioluminescence", "Hydrothermal vents", "Lesson boss"],
    questions: [
      null,
      { prompt: "Which trait helps deep-sea animals tolerate intense water pressure?", options: ["Air-filled cavities", "Pressure-balanced tissues", "Thick hollow bones", "A gas-filled swim bladder"], correct: 1, answer: "Pressure-balanced tissues", explanation: "Flexible bodies and pressure-balanced tissues avoid large pressure differences at depth." },
      { prompt: "What is a common use of bioluminescence in deep-sea animals?", options: ["Creating oxygen", "Attracting prey or signaling", "Reducing water pressure", "Warming the surrounding water"], correct: 1, answer: "Attracting prey or signaling", explanation: "Some deep-sea species use light to communicate, camouflage, or draw in prey." },
      { prompt: "What energy source can support life around hydrothermal vents?", options: ["Sunlight", "Wind energy", "Chemical compounds", "Surface wave motion"], correct: 2, answer: "Chemical compounds", explanation: "Some vent ecosystems rely on chemosynthesis, which uses energy from chemical compounds." },
    ],
  },
  "ocean-circulation": {
    title: "Ocean Circulation and Climate",
    topics: ["", "Wind-driven currents", "Ocean gyres", "Tides and mixing", "Lesson boss"],
    questions: [
      null,
      { prompt: "What primarily drives the large-scale surface currents in Earth's oceans?", options: ["Tides alone", "Global wind patterns", "Deep-sea volcanoes", "Seafloor pressure"], correct: 1, answer: "Global wind patterns", explanation: "Prevailing winds transfer energy to the ocean surface and drive large-scale surface currents." },
      { prompt: "What helps form the large circular patterns called ocean gyres?", options: ["Wind and Earth's rotation", "Only deep-sea pressure", "Coral growth", "Underwater earthquakes"], correct: 0, answer: "Wind and Earth's rotation", explanation: "Global winds and the Coriolis effect help organize large surface currents into gyres." },
      { prompt: "What can tidal mixing help move through the ocean?", options: ["Nutrients and heat", "Only beach sand", "Clouds", "Atmospheric oxygen"], correct: 0, answer: "Nutrients and heat", explanation: "Tidal currents mix ocean layers and can redistribute nutrients and heat." },
    ],
  },
};

let routeTopics = marineBiologyTopics;
let currentRouteQuestions = routeQuestions;
let activeLessonId = null;
let activeInstanceId = null;
let descentInstanceNumber = 1;
const descentInstances = new Map();
const activeInstanceByLesson = new Map();
descentInstances.set("PN-001", {
  id: "PN-001", lessonId: "marine-biology", routeNode: 1, routePartAnswered: false,
  activeEncounter: false, bossReached: false, player: { x: 0.5, y: 0.57, facing: "up" },
  playerHP: 100, enemyHP: 100, feedbackHtml: "",
});
activeInstanceByLesson.set("marine-biology", "PN-001");

function saveCurrentInstance() {
  if (!activeInstanceId) return;
  descentInstances.set(activeInstanceId, {
    ...descentInstances.get(activeInstanceId),
    routeNode, routePartAnswered, activeEncounter, bossReached,
    player: { x: worldPlayer.x, y: worldPlayer.y, facing: worldPlayer.facing },
    playerHP: Number.parseInt(document.querySelector("#player-hp").textContent, 10),
    enemyHP: Number.parseInt(document.querySelector("#enemy-hp").textContent, 10),
    feedbackHtml: document.querySelector("#answer-feedback").hidden ? "" : document.querySelector("#answer-feedback").innerHTML,
    feedbackIncorrect: document.querySelector("#answer-feedback").classList.contains("incorrect"),
  });
}

function updateSeaCards() {
  Object.keys(lessonCatalog).forEach((lessonId) => {
    const instanceId = activeInstanceByLesson.get(lessonId);
    const resumeButton = document.querySelector(`[data-sea-action="resume"][data-sea-id="${lessonId}"]`);
    const status = document.querySelector(`[data-sea-status="${lessonId}"]`);
    resumeButton.disabled = !instanceId;
    status.textContent = instanceId ? `Active descent · ${instanceId}` : "No active descent";
  });
  const marineRun = activeInstanceByLesson.get("marine-biology") ?? "—";
  document.querySelectorAll("[data-library-active-id]").forEach((element) => { element.textContent = marineRun; });
}

function startLessonInstance(lessonId, action) {
  const lesson = lessonCatalog[lessonId];
  if (!lesson) return;
  saveCurrentInstance();
  let instance = action === "resume" ? descentInstances.get(activeInstanceByLesson.get(lessonId)) : null;
  if (!instance) {
    descentInstanceNumber += 1;
    const id = `PN-${String(descentInstanceNumber).padStart(3, "0")}`;
    instance = {
      id, lessonId, routeNode: 1, routePartAnswered: false, activeEncounter: false,
      bossReached: false, player: { x: 0.5, y: 0.57, facing: "up" }, playerHP: 100, enemyHP: 100, feedbackHtml: "",
    };
    descentInstances.set(id, instance);
    activeInstanceByLesson.set(lessonId, id);
  }
  activeInstanceId = instance.id;
  activeLessonId = lessonId;
  routeTopics = lesson.topics;
  currentRouteQuestions = lesson.questions;
  routePoints[1].label = lesson.topics[1].toUpperCase();
  routePoints[2].label = lesson.topics[2].toUpperCase();
  routePoints[3].label = lesson.topics[3].toUpperCase();
  routeNode = instance.routeNode;
  routePartAnswered = instance.routePartAnswered;
  activeEncounter = instance.activeEncounter;
  bossReached = instance.bossReached;
  worldPlayer.x = instance.player.x;
  worldPlayer.y = instance.player.y;
  worldPlayer.facing = instance.player.facing;
  document.querySelector("#player-hp").textContent = `${instance.playerHP ?? 100} / 100 HP`;
  document.querySelector("#enemy-hp").textContent = `${instance.enemyHP ?? 100} / 100 HP`;
  document.querySelector("#player-hp-bar").style.width = `${instance.playerHP ?? 100}%`;
  document.querySelector("#enemy-hp-bar").style.width = `${instance.enemyHP ?? 100}%`;
  const feedback = document.querySelector("#answer-feedback");
  feedback.innerHTML = instance.feedbackHtml ?? "";
  feedback.hidden = !instance.feedbackHtml;
  feedback.classList.toggle("incorrect", Boolean(instance.feedbackIncorrect));
  sceneEffects = [];
  document.querySelectorAll("[data-answer]").forEach((answer) => { answer.disabled = instance.routePartAnswered; });
  heldMovementKeys.clear();
  document.querySelector("#descent-lesson-title").textContent = lesson.title;
  document.querySelectorAll("[data-instance-id]").forEach((element) => { element.textContent = instance.id; });
  updateSeaCards();
  updateRoute();
  showScreen("descent");
}

function updateRoute() {
  document.querySelectorAll("[data-route-node]").forEach((node) => {
    const index = Number(node.dataset.routeNode);
    const stopLabels = ["Point Nemo", routeTopics[1], routeTopics[2], routeTopics[3], "Lesson boss"];
    node.querySelector("b").textContent = stopLabels[index];
    node.classList.toggle("current", index === routeNode);
    node.classList.toggle("complete", index < routeNode);
    node.classList.toggle("locked", index > routeNode);
  });
  document.querySelector("#route-part-label").textContent = routeTopics[routeNode];
  document.querySelector("#route-position").textContent = activeEncounter
    ? `ENCOUNTER · ${routeTopics[routeNode].toUpperCase()}`
    : routeNode === 4 ? "FINAL TARGET · LESSON BOSS" : `NEXT TARGET · PART ${routeNode} OF 3`;
  document.querySelector("#route-status").textContent = activeEncounter
    ? `Encounter reached: ${routeTopics[routeNode]}. Answer the preview question, then clear this part to unlock the next target.`
    : routeNode === 4
      ? "All three lesson parts are clear. Swim to the Goblin Shark marker for the final boss."
      : `Swim to the highlighted ${routeTopics[routeNode]} enemy marker. Later encounters stay locked until this part is cleared.`;
  document.querySelector("#encounter-content").hidden = !activeEncounter;
  document.querySelector("#clear-part").disabled = !routePartAnswered || routeNode > 3;
  const bossNav = document.querySelector('.nav-step[data-screen="boss"]');
  bossNav.disabled = !bossReached;
  bossNav.setAttribute("aria-disabled", String(!bossReached));
  document.querySelector("#descent-stage-label").textContent = `· ${routeNode < 4 ? `Part ${routeNode} of 3` : "Final battle"}`;
  if (routeNode < 4) {
    const question = currentRouteQuestions[routeNode];
    document.querySelector("#route-question-title").textContent = question.prompt;
    document.querySelector(".question-meta span:last-child").textContent = `TOPIC · ${routeTopics[routeNode].toUpperCase()}`;
    document.querySelectorAll("[data-answer]").forEach((answer, index) => {
      answer.dataset.answer = index === question.correct ? "correct" : "wrong";
      answer.innerHTML = `<kbd>${String.fromCharCode(65 + index)}</kbd> ${question.options[index]}`;
    });
  }
  saveCurrentInstance();
}

document.querySelector("#clear-part").addEventListener("click", () => {
  if (!routePartAnswered || routeNode > 3) return;
  routeNode += 1;
  activeEncounter = false;
  routePartAnswered = false;
  document.querySelector("#answer-feedback").hidden = true;
  document.querySelectorAll("[data-answer]").forEach((answer) => { answer.disabled = false; });
  document.querySelector("#player-hp").textContent = "100 / 100 HP";
  document.querySelector("#enemy-hp").textContent = "100 / 100 HP";
  document.querySelector("#player-hp-bar").style.width = "100%";
  document.querySelector("#enemy-hp-bar").style.width = "100%";
  updateRoute();
});
function showScreen(name) {
  if (!screenNames.includes(name)) return;
  if (name === "descent" && !activeInstanceId) {
    showScreen("seas");
    return;
  }
  if (name === "boss" && !bossReached) {
    document.querySelector("#route-status").textContent = "Swim to the final boss marker after clearing all three topic encounters.";
    return;
  }
  document.querySelectorAll(".screen").forEach((screen) => {
    const active = screen.id === name;
    screen.hidden = !active;
    screen.classList.toggle("active", active);
  });
  navButtons.forEach((button) => {
    const active = button.dataset.screen === name;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  profileShortcut.classList.toggle("current-page", name === "profile");
  if (name === "profile") profileShortcut.setAttribute("aria-current", "page");
  else profileShortcut.removeAttribute("aria-current");
  history.replaceState(null, "", `#${name}`);
}

const movementCodes = new Set(["KeyW", "KeyA", "KeyS", "KeyD"]);
document.addEventListener("keydown", (event) => {
  if (!movementCodes.has(event.code) || document.querySelector("#descent").hidden || activeEncounter || bossReached) return;
  event.preventDefault();
  heldMovementKeys.add(event.code);
});
document.addEventListener("keyup", (event) => heldMovementKeys.delete(event.code));
window.addEventListener("blur", () => heldMovementKeys.clear());

function updateWorldMovement(dt) {
  if (document.querySelector("#descent").hidden || activeEncounter || bossReached || routeNode < 1 || routeNode > 4) {
    worldPlayer.moving = false;
    return;
  }
  let dx = Number(heldMovementKeys.has("KeyD")) - Number(heldMovementKeys.has("KeyA"));
  let dy = Number(heldMovementKeys.has("KeyS")) - Number(heldMovementKeys.has("KeyW"));
  const length = Math.hypot(dx, dy);
  worldPlayer.moving = length > 0;
  if (!length) return;
  dx /= length;
  dy /= length;
  worldPlayer.x = Math.max(0.045, Math.min(0.955, worldPlayer.x + dx * dt * 0.22));
  worldPlayer.y = Math.max(0.045, Math.min(0.955, worldPlayer.y + dy * dt * 0.22));
  saveCurrentInstance();
  if (Math.abs(dx) > Math.abs(dy)) worldPlayer.facing = dx < 0 ? "left" : "right";
  else worldPlayer.facing = dy < 0 ? "up" : "down";

  const target = routePoints[routeNode];
  if (Math.hypot(worldPlayer.x - target.x, worldPlayer.y - target.y) < 0.065) {
    heldMovementKeys.clear();
    worldPlayer.moving = false;
    if (routeNode < 4) {
      activeEncounter = true;
      updateRoute();
    } else {
      bossReached = true;
      updateRoute();
      showScreen("boss");
    }
  }
}

document.addEventListener("click", (event) => {
  const seaAction = event.target.closest("[data-sea-action]");
  const nav = event.target.closest("[data-screen]");
  const link = event.target.closest("[data-go]");
  if (seaAction) {
    startLessonInstance(seaAction.dataset.seaId, seaAction.dataset.seaAction);
    return;
  }
  if (nav) showScreen(nav.dataset.screen);
  if (link) showScreen(link.dataset.go);
});

const fileInput = document.querySelector("#pdf-file");
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  const status = document.querySelector("#file-status");
  if (!file) return;
  const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  if (!isPdf) {
    status.textContent = "Choose a PDF file. This preview checks its extension/type only.";
    status.classList.add("error-text");
    return;
  }
  status.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MiB · selected for preview only; no extraction is performed.`;
  status.classList.remove("error-text");
});

const stages = [
  ["Extracting text", "Reading page text and source locations on this device."],
  ["Generating questions", "Local Ollama drafts three questions for each of three topics."],
  ["Validating sources", "Checking the nine questions, answer keys, and supporting PDF quotes."],
];
let stageIndex = 0;
document.querySelector("#next-stage").addEventListener("click", () => {
  if (stageIndex === stages.length - 1) {
    showScreen("seas");
    return;
  }
  stageIndex = (stageIndex + 1) % stages.length;
  document.querySelector("#sonar-count").textContent = `0${stageIndex + 1} / 03`;
  document.querySelector("#sonar-state").textContent = stages[stageIndex][0];
  document.querySelector("#sonar-detail").textContent = stages[stageIndex][1];
  document.querySelector("#next-stage").innerHTML = stageIndex === stages.length - 1 ? "Choose your sea →" : "Advance preview state →";
  document.querySelectorAll("#stage-list li").forEach((item, index) => {
    item.classList.toggle("current", index === stageIndex);
    item.classList.toggle("done", index < stageIndex);
  });
});

let sceneEffects = [];
document.querySelectorAll("[data-answer]").forEach((button) => {
  button.addEventListener("click", () => {
    const correct = button.dataset.answer === "correct";
    const feedback = document.querySelector("#answer-feedback");
    feedback.hidden = false;
    feedback.classList.toggle("incorrect", !correct);
    const currentQuestion = currentRouteQuestions[routeNode];
    feedback.innerHTML = correct
      ? "Correct · <b>+10 sample XP</b> and 50 enemy damage. This is a demo question, not extracted PDF content."
      : `Incorrect · The correct answer is <b>${currentQuestion.answer}</b>. <div class="source-evidence"><small>WHY THIS IS CORRECT · SAMPLE EXPLANATION</small><p>${currentQuestion.explanation}</p><small>SUPPORTING PDF QUOTE · PLACEHOLDER</small><blockquote>“The exact supporting passage from the uploaded PDF appears here.”</blockquote></div>`;
    const hpId = correct ? "enemy" : "player";
    document.getElementById(`${hpId}-hp`).textContent = "50 / 100 HP";
    document.getElementById(`${hpId}-hp-bar`).style.width = "50%";
    if (assetBundle && !reducedMotion.matches) sceneEffects = [new SpriteAnimation(assetBundle, correct ? "effects.sonar-hit" : "effects.hull-hit")];
    document.querySelectorAll("[data-answer]").forEach((answer) => { answer.disabled = true; });
    routePartAnswered = true;
    document.querySelector("#clear-part").disabled = false;
    saveCurrentInstance();
  });
});

let themeTransitionTimer;
document.querySelector("#theme-toggle").addEventListener("click", (event) => {
  const light = document.documentElement.dataset.theme !== "light";
  document.documentElement.classList.add("theme-transitioning");
  clearTimeout(themeTransitionTimer);
  document.documentElement.dataset.theme = light ? "light" : "dark";
  event.currentTarget.setAttribute("aria-label", light ? "Switch to dark mode" : "Switch to light mode");
  event.currentTarget.textContent = light ? "☾" : "☼";
  themeTransitionTimer = setTimeout(() => document.documentElement.classList.remove("theme-transitioning"), 500);
});

let assetBundle;
const cachedScales = { explorer: 1, barreleye: 1, gulper: 1, goblinLarge: 1, fringehead: 1, buoy: 1 };
const scenes = [];
const sceneDefinitions = [
  { id: "library-scene", player: true, species: "barreleye" },
  { id: "combat-scene", player: true, species: "barreleye" },
  { id: "boss-scene", species: "goblin" },
  { id: "profile-scene", player: true, playerSize: 92, playerX: 0.5, playerY: 0.56 },
  { id: "descent-route-scene", route: true, player: true },
];

function setupScene(canvas, definition) {
  const context = canvas.getContext("2d");
  const player = definition.player && !definition.route ? new SpriteAnimation(assetBundle, "explorer.swim.right") : null;
  const creature = definition.species
    ? new SpriteAnimation(assetBundle, definition.species === "barreleye" ? "barreleye.swim" : "goblin.idle.profile")
    : null;
  const routePlayer = definition.route ? new SpriteAnimation(assetBundle, "explorer.idle.up") : null;
  const routeCreatures = definition.route
    ? ["barreleye.swim", "gulper.swim", "fringehead.swim", "goblin.idle.profile"].map((animation) => new SpriteAnimation(assetBundle, animation))
    : null;
  return { canvas, context, definition, player, creature, routePlayer, routeCreatures };
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load image asset: ${url}`));
    image.src = url;
  });
}

function paintRouteMap(scene, dt, width, height) {
  const context = scene.context;
  context.imageSmoothingEnabled = false;
  context.drawImage(worldMapImage, 0, 0, width, height);
  const points = routePoints.map((point) => ({ x: point.x * width, y: point.y * height }));
  for (let index = 1; index < points.length; index += 1) {
    context.beginPath();
    context.moveTo(points[index - 1].x, points[index - 1].y);
    context.lineTo(points[index].x, points[index].y);
    context.setLineDash([5, 7]);
    context.lineWidth = Math.max(2, width * 0.004);
    context.strokeStyle = index < routeNode ? "rgba(126, 221, 255, .86)" : index === routeNode ? "rgba(220, 249, 255, .94)" : "rgba(134, 180, 210, .28)";
    context.stroke();
  }
  context.setLineDash([]);

  const creatureSizes = [cachedScales.barreleye, cachedScales.gulper, cachedScales.fringehead, cachedScales.goblinLarge];
  for (let markerIndex = 1; markerIndex <= 4; markerIndex += 1) {
    const marker = points[markerIndex];
    const animation = scene.routeCreatures[markerIndex - 1];
    const scale = Math.max(0.42, Math.min(1, width / 650));
    animation.update(reducedMotion.matches ? 0 : dt);
    context.save();
    context.globalAlpha = markerIndex < routeNode ? 0.38 : markerIndex === routeNode ? 1 : 0.55;
    context.beginPath();
    context.arc(marker.x, marker.y, Math.max(24, width * 0.048), 0, Math.PI * 2);
    context.fillStyle = markerIndex === routeNode ? "rgba(90, 201, 245, .42)" : "rgba(6, 28, 50, .52)";
    context.strokeStyle = markerIndex === routeNode ? "#d7f6ff" : "rgba(181, 222, 242, .65)";
    context.lineWidth = markerIndex === routeNode ? 3 : 1;
    context.fill();
    context.stroke();
    drawFrame(context, assetBundle, animation.frameName, marker.x, marker.y, creatureSizes[markerIndex - 1] * scale * 0.66);
    context.font = "bold 9px Courier New, monospace";
    context.textAlign = "center";
    context.textBaseline = "top";
    context.fillStyle = "#eef9ff";
    context.fillText(routePoints[markerIndex].label, marker.x, marker.y + width * 0.055);
    context.restore();
  }

  scene.routePlayer.play(`explorer.${worldPlayer.moving && !reducedMotion.matches ? "swim" : "idle"}.${worldPlayer.facing}`);
  scene.routePlayer.update(reducedMotion.matches ? 0 : dt);
  const explorerScale = cachedScales.explorer * width * 0.15 / 104;
  context.save();
  context.globalAlpha = 1;
  scene.routePlayer.draw(context, Math.round(worldPlayer.x * width), Math.round(worldPlayer.y * height), explorerScale);
  context.restore();
}

function paintScene(scene, dt) {
  const { canvas, context, definition, player, creature } = scene;
  if (!canvas.clientWidth || !canvas.clientHeight) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.clearRect(0, 0, width, height);
  if (definition.route) {
    paintRouteMap(scene, dt, width, height);
    return;
  }
  drawWater(context, assetBundle.images.water, width, height, Math.max(180, Math.min(320, height * 1.1)), 0, 0);
  context.fillStyle = "rgba(23, 68, 100, .20)";
  context.fillRect(0, 0, width, height);
  const scale = Math.min(1, height / 175);
  if (player) {
    player.update(reducedMotion.matches ? 0 : dt);
    const playerScale = definition.playerSize ? definition.playerSize / 104 : scale;
    const playerX = width * (definition.playerX ?? 0.39);
    const playerY = height * (definition.playerY ?? 0.62);
    drawFrame(context, assetBundle, player.frameName,
      playerX, playerY, cachedScales.explorer * playerScale);
  }
  if (creature) {
    creature.update(reducedMotion.matches ? 0 : dt);
    const size = definition.species === "barreleye" ? cachedScales.barreleye : cachedScales.goblinLarge;
    drawFrame(context, assetBundle, creature.frameName, width * (player ? 0.74 : 0.56), height * 0.56, size * scale);
  }
  sceneEffects = sceneEffects.filter((effect) => !effect.finished);
  sceneEffects.forEach((effect) => {
    effect.update(dt);
    drawFrame(context, assetBundle, effect.frameName, width * 0.73, height * 0.55, Math.max(.5, height / 180));
  });
}

let previousFrame = 0;
function animate(time) {
  const dt = previousFrame ? Math.min((time - previousFrame) / 1000, 0.05) : 0;
  previousFrame = time;
  updateWorldMovement(dt);
  scenes.forEach((scene) => paintScene(scene, dt));
  requestAnimationFrame(animate);
}

Promise.all([
  loadAssetBundle("/manifest.json", { atlases: ["explorer", "barreleye", "gulper", "goblin", "fringehead", "buoy", "water", "effects"] }),
  loadImage(oceanMapUrl),
])
  .then(([bundle, mapImage]) => {
    assetBundle = bundle;
    worldMapImage = mapImage;
    cachedScales.explorer = speciesScale(bundle, "explorer", 104);
    cachedScales.barreleye = speciesScale(bundle, "barreleye", 88);
    cachedScales.gulper = speciesScale(bundle, "gulper", 88);
    cachedScales.goblinLarge = speciesScale(bundle, "goblin", 164);
    cachedScales.fringehead = speciesScale(bundle, "fringehead", 84);
    cachedScales.buoy = speciesScale(bundle, "buoy", 80);
    sceneDefinitions.forEach((definition) => {
      const canvas = document.getElementById(definition.id);
      if (canvas) scenes.push(setupScene(canvas, definition));
    });
    requestAnimationFrame(animate);
  })
  .catch((error) => {
    console.error("Point Nemo preview sprites could not be loaded.", error);
    document.querySelectorAll(".art-banner, .combat-scene, .boss-visual, .route-scene").forEach((element) => element.classList.add("assets-unavailable"));
  });

const initialScreen = location.hash.slice(1);
updateSeaCards();
updateRoute();
showScreen(screenNames.includes(initialScreen) ? initialScreen : "library");
