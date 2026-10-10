import { type QuestionSet } from "@point-nemo/shared";

export interface RouteQuestion {
  prompt: string;
  options: string[];
  correct: number;
  answer: string;
  explanation: string;
  supportingQuote?: string;
  sourcePage?: number;
}

export interface LessonRecord {
  id: string;
  title: string;
  topics: string[];
  questions: (RouteQuestion | null)[];
  isCustom?: boolean;
  parts?: RouteQuestion[][];
}

export interface RoutePoint {
  x: number;
  y: number;
  label: string;
}

export interface DescentInstance {
  id: string;
  lessonId: string;
  routeNode: number; // 1 = Part 1, 2 = Part 2, 3 = Part 3, 4 = Boss
  routePartAnswered: boolean;
  activeEncounter: boolean;
  bossReached: boolean;
  player: { x: number; y: number; facing: "up" | "down" | "left" | "right" };
  playerHP: number;
  enemyHP: number;
  feedbackHtml?: string;
  feedbackIncorrect?: boolean;
  clearedParts?: number;
  bossScore?: number;
  questionIndex?: number;
  partCorrect?: number;
  selectedOption?: number | null;
  xp?: number;
  state?: "active" | "completed" | "failed";
  bossOrder?: number[];
  bossQuestionIndex?: number;
  bossAnswers?: number[];
  bossStarted?: boolean;
}

export function lessonParts(lesson: LessonRecord): RouteQuestion[][] {
  return lesson.parts ?? [1,2,3].map((node)=>lesson.questions[node] ? [lesson.questions[node]!] : []);
}

export function bossPassScore(total: number): number { return Math.ceil(total * 8 / 9); }

export const BASE_ROUTE_POINTS: RoutePoint[] = [
  { x: 0.5, y: 0.5, label: "POINT NEMO" },
  { x: 0.2, y: 0.22, label: "SURFACE CURRENTS" },
  { x: 0.8, y: 0.22, label: "PRESSURE" },
  { x: 0.2, y: 0.78, label: "HABITATS" },
  { x: 0.8, y: 0.78, label: "LESSON BOSS" },
];

export const INITIAL_LESSON_CATALOG: Record<string, LessonRecord> = {
  "marine-biology": {
    id: "marine-biology",
    title: "Introduction to Marine Biology",
    topics: ["", "Surface currents", "Pressure & adaptation", "Deep-sea habitats", "Lesson boss"],
    questions: [
      null,
      {
        prompt: "What primarily drives the large-scale surface currents in Earth's oceans?",
        options: ["Tides alone", "Global wind patterns", "Deep-sea volcanoes", "Seafloor pressure"],
        correct: 1,
        answer: "Global wind patterns",
        explanation: "Prevailing winds transfer energy to the ocean surface and drive large-scale surface currents.",
        supportingQuote: "Prevailing wind patterns and solar heating transfer kinetic energy to the surface boundary layer, forming the primary engine of large-scale open ocean circulation.",
      },
      {
        prompt: "Which trait helps deep-sea animals tolerate intense water pressure?",
        options: ["Air-filled cavities", "Pressure-balanced tissues", "Thick hollow bones", "A gas-filled swim bladder"],
        correct: 1,
        answer: "Pressure-balanced tissues",
        explanation: "Flexible bodies and pressure-balanced tissues avoid large pressure differentials at depth.",
        supportingQuote: "Abyssal fauna maintain structural integrity through pressure-balanced, lipid-rich cellular membranes and water-saturated musculature.",
      },
      {
        prompt: "What energy source can support life around hydrothermal vents?",
        options: ["Sunlight", "Wind energy", "Chemical compounds", "Surface wave motion"],
        correct: 2,
        answer: "Chemical compounds",
        explanation: "Some vent ecosystems rely on chemosynthesis, which extracts energy from dissolved chemical compounds.",
        supportingQuote: "Chemoautotrophic bacteria oxidize hydrogen sulfide and methane emanating from thermal vents, providing the baseline energy for benthic communities.",
      },
    ],
  },
  "deep-sea-life": {
    id: "deep-sea-life",
    title: "Deep-Sea Life and Adaptations",
    topics: ["", "Pressure tolerance", "Bioluminescence", "Hydrothermal vents", "Lesson boss"],
    questions: [
      null,
      {
        prompt: "Which trait helps deep-sea animals tolerate intense water pressure?",
        options: ["Air-filled cavities", "Pressure-balanced tissues", "Thick hollow bones", "A gas-filled swim bladder"],
        correct: 1,
        answer: "Pressure-balanced tissues",
        explanation: "Flexible bodies and pressure-balanced tissues avoid large pressure differences at depth.",
        supportingQuote: "Without rigid gas compartments, hydrostatic pressure equilibrates naturally throughout bodily fluids.",
      },
      {
        prompt: "What is a common use of bioluminescence in deep-sea animals?",
        options: ["Creating oxygen", "Attracting prey or signaling", "Reducing water pressure", "Warming the surrounding water"],
        correct: 1,
        answer: "Attracting prey or signaling",
        explanation: "Deep-sea species use light to communicate, camouflage via counter-illumination, or draw in prey.",
        supportingQuote: "Photophores emit cold blue-green bioluminescence, critical for mating signals, predator disruption, and lure mechanisms in the aphotic zone.",
      },
      {
        prompt: "What energy source can support life around hydrothermal vents?",
        options: ["Sunlight", "Wind energy", "Chemical compounds", "Surface wave motion"],
        correct: 2,
        answer: "Chemical compounds",
        explanation: "Vent ecosystems rely on chemosynthesis, which uses chemical bond energy rather than sunlight.",
        supportingQuote: "In total darkness, geothermal hydrothermal fluid provides chemical compounds necessary for chemosynthetic primary production.",
      },
    ],
  },
  "ocean-circulation": {
    id: "ocean-circulation",
    title: "Ocean Circulation and Climate",
    topics: ["", "Wind-driven currents", "Ocean gyres", "Tides and mixing", "Lesson boss"],
    questions: [
      null,
      {
        prompt: "What primarily drives the large-scale surface currents in Earth's oceans?",
        options: ["Tides alone", "Global wind patterns", "Deep-sea volcanoes", "Seafloor pressure"],
        correct: 1,
        answer: "Global wind patterns",
        explanation: "Prevailing winds transfer energy to the ocean surface and drive large-scale surface currents.",
        supportingQuote: "Trade winds and mid-latitude westerlies continuously drag across sea surfaces, establishing the planetary current belts.",
      },
      {
        prompt: "What helps form the large circular patterns called ocean gyres?",
        options: ["Wind and Earth's rotation", "Only deep-sea pressure", "Coral growth", "Underwater earthquakes"],
        correct: 0,
        answer: "Wind and Earth's rotation",
        explanation: "Global winds and the Coriolis effect help organize large surface currents into gyres.",
        supportingQuote: "The interaction between continental boundaries, prevailing planetary winds, and the Coriolis deflection shapes circular ocean gyres.",
      },
      {
        prompt: "What can tidal mixing help move through the ocean?",
        options: ["Nutrients and heat", "Only beach sand", "Clouds", "Atmospheric oxygen"],
        correct: 0,
        answer: "Nutrients and heat",
        explanation: "Tidal currents mix stratified ocean layers and redistribute nutrients and heat vertically.",
        supportingQuote: "Internal tides breaking over submarine ridges produce strong turbulent mixing, transporting nutrient-rich deep water toward the photic zone.",
      },
    ],
  },
};

/** Convert a real QuestionSet from Ollama/SQLite into a playable lesson record */
export function questionSetToLessonRecord(qSet: QuestionSet): LessonRecord {
  const topicNames = qSet.topics.map((topic)=>typeof topic==="string" ? topic : topic.name);
  const topics = ["", ...topicNames, "Lesson boss"];
  const questions: (RouteQuestion | null)[] = [null];
  const parts: RouteQuestion[][] = [];

  const qList = qSet.questions || [];
  for (const topic of qSet.topics) {
    const topicQuestions = qList.filter((q)=>typeof topic==="string" ? "topic" in q && q.topic===topic : "topicId" in q && q.topicId===topic.id);
    const difficulties = ["easy","medium","hard"];
    topicQuestions.sort((a,b)=>difficulties.indexOf(a.difficulty)-difficulties.indexOf(b.difficulty));
    const part: RouteQuestion[] = [];
    for (const q of topicQuestions) {
    const correctIdx = q.answerIndex >= 0 && q.answerIndex < q.options.length ? q.answerIndex : 0;
    const answer = q.options[correctIdx] || "";
    const quote = "sourceQuote" in q ? q.sourceQuote : (q.evidence?.[0]?.quote ?? undefined);

    const converted: RouteQuestion = {
      prompt: q.prompt,
      options: q.options,
      correct: correctIdx,
      answer,
      explanation: q.explanation || "Source-grounded concept from document extraction.",
      supportingQuote: quote,
      sourcePage: "sourcePage" in q ? q.sourcePage : q.evidence?.[0]?.pageNumber,
    };
    part.push(converted);
    questions.push(converted);
    }
    parts.push(part);
  }

  const title =
    "documentName" in qSet
      ? qSet.documentName
      : "filename" in qSet && qSet.filename ? qSet.filename : "title" in (qSet as Record<string, unknown>)
      ? String((qSet as Record<string, unknown>).title)
      : "Custom Study Expedition";

  return {
    id: qSet.id,
    title,
    topics,
    questions,
    isCustom: true,
    parts,
  };
}
