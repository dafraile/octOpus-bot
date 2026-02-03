import fs from "node:fs";
import path from "node:path";
import { resolveStateDir } from "../config/paths.js";
import { normalizeAgentId } from "../routing/session-key.js";

export type AdaptiveInterestLevel = "high" | "medium" | "low" | "none";

const INTERVALS: Record<AdaptiveInterestLevel, { min: number; max: number }> = {
  high: { min: 5, max: 30 },
  medium: { min: 30, max: 120 },
  low: { min: 120, max: 480 },
  none: { min: 480, max: 1440 },
};

const HIBERNATION_THRESHOLD_HOURS = 48;
const WAKE_UP_BOOST_MINUTES = 15;

export type AdaptiveHeartbeatState = {
  lastBeat: number;
  nextBeat: number;
  currentInterval: number;
  interestLevel: AdaptiveInterestLevel;
  interestReason: string;
  interestSince: number;
  lastHumanMessage: number | null;
  lastMoltbookCheck: number | null;
  lastMoltbookPost: number | null;
  pendingReplies: number;
  watchlist: {
    moltbookPostIds: string[];
    pendingTasks: string[];
    activeThreads: string[];
  };
  hibernating: boolean;
  hibernationStarted: number | null;
  history: Array<{
    timestamp: number;
    trigger: string;
    intervalSet: number;
    interestLevel: AdaptiveInterestLevel;
    reason: string;
  }>;
};

export type AdaptiveAssessmentContext = {
  foundReplies: number;
  foundInteresting: boolean;
  foundNothing: boolean;
  error: boolean;
  actions: string[];
};

export type AdaptiveInterestAssessment = {
  level: AdaptiveInterestLevel;
  reason: string;
  interval: number;
  shouldHibernate?: boolean;
};

const STATE_CACHE = new Map<string, AdaptiveHeartbeatState>();

function getHeartbeatPath(agentId: string): string {
  const normalized = normalizeAgentId(agentId || "default") || "default";
  const stateDir = resolveStateDir();
  return path.join(stateDir, "heartbeat", `adaptive-${normalized}.json`);
}

function createInitialState(now: number): AdaptiveHeartbeatState {
  return {
    lastBeat: 0,
    nextBeat: now,
    currentInterval: 60,
    interestLevel: "medium",
    interestReason: "Just started - establishing baseline",
    interestSince: now,
    lastHumanMessage: null,
    lastMoltbookCheck: null,
    lastMoltbookPost: null,
    pendingReplies: 0,
    watchlist: {
      moltbookPostIds: [],
      pendingTasks: [],
      activeThreads: [],
    },
    hibernating: false,
    hibernationStarted: null,
    history: [],
  };
}

function migrateState(raw: Partial<AdaptiveHeartbeatState>, now: number): AdaptiveHeartbeatState {
  return {
    lastBeat: raw.lastBeat ?? 0,
    nextBeat: raw.nextBeat ?? now,
    currentInterval: raw.currentInterval ?? 60,
    interestLevel: raw.interestLevel ?? "medium",
    interestReason: raw.interestReason ?? "Migrated from old format",
    interestSince: raw.interestSince ?? now,
    lastHumanMessage: raw.lastHumanMessage ?? null,
    lastMoltbookCheck: raw.lastMoltbookCheck ?? null,
    lastMoltbookPost: raw.lastMoltbookPost ?? null,
    pendingReplies: raw.pendingReplies ?? 0,
    watchlist: raw.watchlist ?? {
      moltbookPostIds: [],
      pendingTasks: [],
      activeThreads: [],
    },
    hibernating: raw.hibernating ?? false,
    hibernationStarted: raw.hibernationStarted ?? null,
    history: raw.history ?? [],
  };
}

export function loadAdaptiveHeartbeatState(
  agentId: string,
  now = Date.now(),
): AdaptiveHeartbeatState {
  const key = normalizeAgentId(agentId || "default") || "default";
  const cached = STATE_CACHE.get(key);
  if (cached) {
    return cached;
  }

  const filePath = getHeartbeatPath(key);
  let state = createInitialState(now);
  try {
    if (fs.existsSync(filePath)) {
      const raw = fs.readFileSync(filePath, "utf-8");
      const parsed = JSON.parse(raw) as Partial<AdaptiveHeartbeatState>;
      state = migrateState(parsed, now);
    }
  } catch {
    state = createInitialState(now);
  }

  STATE_CACHE.set(key, state);
  return state;
}

export function saveAdaptiveHeartbeatState(agentId: string, state: AdaptiveHeartbeatState): void {
  const key = normalizeAgentId(agentId || "default") || "default";
  STATE_CACHE.set(key, state);
  const filePath = getHeartbeatPath(key);
  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
  } catch {
    // Ignore write failures
  }
}

export function shouldAdaptiveBeat(state: AdaptiveHeartbeatState, now = Date.now()): boolean {
  if (state.hibernating) {
    if (state.lastHumanMessage && state.hibernationStarted) {
      return state.lastHumanMessage > state.hibernationStarted;
    }
    return false;
  }

  if (now >= state.nextBeat) {
    return true;
  }

  if (state.lastHumanMessage) {
    const minutesSinceHuman = (now - state.lastHumanMessage) / 1000 / 60;
    const minutesUntilBeat = (state.nextBeat - now) / 1000 / 60;
    if (minutesSinceHuman < WAKE_UP_BOOST_MINUTES && minutesUntilBeat > 30) {
      return true;
    }
  }

  return false;
}

function getHoursSinceActivity(state: AdaptiveHeartbeatState, now: number): number {
  const activities = [
    state.lastHumanMessage,
    state.lastMoltbookCheck,
    state.lastMoltbookPost,
    state.lastBeat,
  ].filter((t): t is number => t !== null);

  if (activities.length === 0) {
    return 999;
  }

  const mostRecent = Math.max(...activities);
  return (now - mostRecent) / 1000 / 60 / 60;
}

export function assessAdaptiveInterest(
  state: AdaptiveHeartbeatState,
  context: AdaptiveAssessmentContext,
): AdaptiveInterestAssessment {
  const now = Date.now();

  if (context.foundReplies > 0 || context.foundInteresting) {
    return {
      level: "high",
      reason:
        context.foundReplies > 0
          ? `Got ${context.foundReplies} new replies - watching for conversation`
          : "Found something interesting",
      interval: INTERVALS.high.min,
    };
  }

  if (state.watchlist.moltbookPostIds.length > 0) {
    const hoursSincePost = state.lastMoltbookPost
      ? (now - state.lastMoltbookPost) / 1000 / 60 / 60
      : 999;

    if (hoursSincePost < 2) {
      return {
        level: "high",
        reason: `Posted ${Math.round(hoursSincePost * 60)}min ago - watching for engagement`,
        interval: INTERVALS.high.max,
      };
    }
  }

  if (state.lastHumanMessage) {
    const hoursSinceHuman = (now - state.lastHumanMessage) / 1000 / 60 / 60;
    if (hoursSinceHuman < 2) {
      return {
        level: "medium",
        reason: "Human was recently active",
        interval: INTERVALS.medium.min,
      };
    }
  }

  if (state.watchlist.pendingTasks.length > 0) {
    return {
      level: "medium",
      reason: `${state.watchlist.pendingTasks.length} pending tasks`,
      interval: INTERVALS.medium.max,
    };
  }

  if (context.foundNothing && state.lastHumanMessage) {
    const hoursSinceHuman = (now - state.lastHumanMessage) / 1000 / 60 / 60;
    if (hoursSinceHuman < 24) {
      return {
        level: "low",
        reason: "Quiet day, staying available",
        interval: INTERVALS.low.min,
      };
    }
  }

  const hoursSinceAnyActivity = getHoursSinceActivity(state, now);
  if (hoursSinceAnyActivity > HIBERNATION_THRESHOLD_HOURS) {
    return {
      level: "none",
      reason: `No activity for ${Math.round(hoursSinceAnyActivity)}h - consider hibernating`,
      interval: INTERVALS.none.max,
      shouldHibernate: true,
    };
  }

  return {
    level: "low",
    reason: "Nothing specific to watch for",
    interval: INTERVALS.low.max,
  };
}

export function recordAdaptiveBeat(
  agentId: string,
  state: AdaptiveHeartbeatState,
  assessment: AdaptiveInterestAssessment,
  trigger: string,
  now = Date.now(),
): AdaptiveHeartbeatState {
  const levelChanged = state.interestLevel !== assessment.level;

  const nextState: AdaptiveHeartbeatState = {
    ...state,
    lastBeat: now,
    nextBeat: now + assessment.interval * 60 * 1000,
    currentInterval: assessment.interval,
    interestLevel: assessment.level,
    interestReason: assessment.reason,
    interestSince: levelChanged ? now : state.interestSince,
    hibernating: assessment.shouldHibernate ?? false,
    hibernationStarted: assessment.shouldHibernate ? now : null,
    history: [
      ...state.history,
      {
        timestamp: now,
        trigger,
        intervalSet: assessment.interval,
        interestLevel: assessment.level,
        reason: assessment.reason,
      },
    ],
  };

  if (nextState.history.length > 50) {
    nextState.history = nextState.history.slice(-50);
  }

  saveAdaptiveHeartbeatState(agentId, nextState);
  return nextState;
}

export function recordAdaptiveHumanActivity(agentId: string, now = Date.now()): void {
  try {
    const state = loadAdaptiveHeartbeatState(agentId, now);
    state.lastHumanMessage = now;

    if (state.hibernating) {
      state.hibernating = false;
      state.hibernationStarted = null;
      state.interestLevel = "medium";
      state.interestReason = "Woke from hibernation - human is back";
    }

    const minutesUntilBeat = (state.nextBeat - now) / 1000 / 60;
    if (minutesUntilBeat > WAKE_UP_BOOST_MINUTES) {
      state.nextBeat = now + WAKE_UP_BOOST_MINUTES * 60 * 1000;
      state.currentInterval = WAKE_UP_BOOST_MINUTES;
    }

    saveAdaptiveHeartbeatState(agentId, state);
  } catch {
    // Ignore heartbeat state updates
  }
}
