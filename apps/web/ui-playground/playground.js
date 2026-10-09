import { drawFrame, drawWater, loadAssetBundle, speciesScale, SpriteAnimation } from "../../../src/assets/sprites.js";

const screenNames = ["library", "sonar", "descent", "boss", "results", "profile", "leaderboard"];
const navButtons = [...document.querySelectorAll(".nav-step[data-screen]")];
const profileShortcut = document.querySelector(".profile-shortcut");

function showScreen(name) {
  if (!screenNames.includes(name)) return;
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

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-screen]");
  const link = event.target.closest("[data-go]");
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
    status.textContent = "Choose a PDF file. This prototype checks file type and size only.";
    status.classList.add("error-text");
    return;
  }
  if (file.size >= 5 * 1024 * 1024) {
    status.textContent = "This file is 5 MiB or larger. Choose a smaller PDF.";
    status.classList.add("error-text");
    return;
  }
  status.textContent = `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MiB · ready for a future local extraction flow.`;
  status.classList.remove("error-text");
});

const stages = [
  ["Extracting text", "Reading page text and source locations on this device."],
  ["Generating questions", "Local Ollama drafts three questions for each of three topics."],
  ["Validating sources", "Checking the nine questions, answer keys, and supporting PDF quotes."],
];
let stageIndex = 0;
document.querySelector("#next-stage").addEventListener("click", () => {
  stageIndex = (stageIndex + 1) % stages.length;
  document.querySelector("#sonar-count").textContent = `0${stageIndex + 1} / 03`;
  document.querySelector("#sonar-state").textContent = stages[stageIndex][0];
  document.querySelector("#sonar-detail").textContent = stages[stageIndex][1];
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
    feedback.innerHTML = correct
      ? "Correct · <b>+10 XP</b> and 50 enemy damage. The answer is supported by your saved source document."
      : "Incorrect · The correct answer is <b>Global wind patterns</b>. <div class=\"source-evidence\"><small>WHY THIS IS CORRECT · SAMPLE EXPLANATION</small><p>Prevailing winds transfer energy to the ocean surface and drive large-scale surface currents.</p><small>SUPPORTING PDF QUOTE · PLACEHOLDER</small><blockquote>“The exact supporting passage from the uploaded PDF appears here.”</blockquote></div>";
    const hpId = correct ? "enemy" : "player";
    document.getElementById(`${hpId}-hp`).textContent = "50 / 100 HP";
    document.getElementById(`${hpId}-hp-bar`).style.width = "50%";
    if (assetBundle) sceneEffects = [new SpriteAnimation(assetBundle, correct ? "effects.sonar-hit" : "effects.hull-hit")];
    document.querySelectorAll("[data-answer]").forEach((answer) => { answer.disabled = true; });
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
const cachedScales = { explorer: 1, barreleye: 1, goblinLarge: 1 };
const scenes = [];
const sceneDefinitions = [
  { id: "library-scene", player: true, species: "barreleye" },
  { id: "combat-scene", player: true },
  { id: "boss-scene", species: "goblin" },
  { id: "profile-scene", player: true, playerSize: 92, playerX: 0.5, playerY: 0.56 },
];

function setupScene(canvas, definition) {
  const context = canvas.getContext("2d");
  const player = definition.player ? new SpriteAnimation(assetBundle, "explorer.swim.right") : null;
  const creature = definition.species
    ? new SpriteAnimation(assetBundle, definition.species === "barreleye" ? "barreleye.swim" : "goblin.idle.profile")
    : null;
  return { canvas, context, definition, player, creature };
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
  drawWater(context, assetBundle.images.water, width, height, Math.max(180, Math.min(320, height * 1.1)), 0, 0);
  context.fillStyle = "rgba(23, 68, 100, .20)";
  context.fillRect(0, 0, width, height);
  const scale = Math.min(1, height / 175);
  if (player) {
    player.update(dt);
    const playerScale = definition.playerSize ? definition.playerSize / 104 : scale;
    drawFrame(context, assetBundle, player.frameName,
      width * (definition.playerX ?? 0.39), height * (definition.playerY ?? 0.62), cachedScales.explorer * playerScale);
  }
  if (creature) {
    creature.update(dt);
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
  scenes.forEach((scene) => paintScene(scene, dt));
  requestAnimationFrame(animate);
}

loadAssetBundle("/manifest.json", { atlases: ["explorer", "barreleye", "goblin", "water", "effects"] })
  .then((bundle) => {
    assetBundle = bundle;
    cachedScales.explorer = speciesScale(bundle, "explorer", 104);
    cachedScales.barreleye = speciesScale(bundle, "barreleye", 88);
    cachedScales.goblinLarge = speciesScale(bundle, "goblin", 164);
    sceneDefinitions.forEach((definition) => {
      const canvas = document.getElementById(definition.id);
      if (canvas) scenes.push(setupScene(canvas, definition));
    });
    requestAnimationFrame(animate);
  })
  .catch((error) => {
    console.error("Point Nemo preview sprites could not be loaded.", error);
    document.querySelectorAll(".art-banner, .combat-scene, .boss-visual").forEach((element) => element.classList.add("assets-unavailable"));
  });

const initialScreen = location.hash.slice(1);
showScreen(screenNames.includes(initialScreen) ? initialScreen : "library");
