import type { Question } from '../types';

export interface AISuggestionResponse {
  transcription: string;
  confidence: number; // 0 to 100
  matchedPoints: string[];
  missedPoints: string[];
  suggestedMarks: number;
  reason: string;
  cached?: boolean;
}

export interface AIDecisionLog {
  sheetId: string;
  questionId: string;
  action: 'accept' | 'override';
  suggestedMarks: number;
  finalMarks: number;
  overrideNote?: string;
  timestamp: string;
}

// Global flag to test cached or offline behavior
export const USE_CACHED_AI = false;
export const SIMULATE_AI_ERROR = false;

// Pre-computed fallback/cached suggestions per question
const CACHED_RESPONSES: Record<string, AISuggestionResponse> = {
  q1: {
    transcription: 'Amortized time for dynamic array: doubling table size whenever array reaches full capacity. Copy cost follows sum 1 + 2 + 4 + ... + n/2 <= n. Average cost across n insertions is O(1) amortized using aggregate analysis.',
    confidence: 94,
    matchedPoints: [
      'Identified geometric factor 2 resizing',
      'Summed sequence of copy costs: 1 + 2 + ... + n/2 <= n',
      'Accurate aggregate analysis concluding O(1) amortized',
    ],
    missedPoints: [
      'Did not contrast with alternative potential/accounting method',
    ],
    suggestedMarks: 4.5,
    reason: 'Clear formulation of the geometric progression sum and correct O(1) conclusion. Minor deduction for omitting base allocation assumption.',
    cached: true,
  },
  q2: {
    transcription: 'Dijkstras algorithm finds shortest paths from a source in a graph with non-negative weights using greedy approach. With Fibonacci heap: extract min takes O(log V) and decrease key takes O(1) amortized. Overall complexity is O(E + V log V).',
    confidence: 91,
    matchedPoints: [
      'Non-negative weight constraint stated',
      'Greedy relaxation principle described',
      'Fibonacci heap operation breakdown: O(1) decrease-key, O(log V) extract-min',
      'Accurate final asymptotic bound O(E + V log V)',
    ],
    missedPoints: [],
    suggestedMarks: 9.5,
    reason: 'Full technical breakdown of Fibonacci heap priority queue costs. Meets 100% of benchmark rubric items.',
    cached: true,
  },
  q3: {
    transcription: 'BFS uses queue and DFS uses recursion stack. BFS explores level by level and memory is O(b^d). DFS memory is O(b*m). BFS finds shortest path in unweighted graph.',
    confidence: 86,
    matchedPoints: [
      'Queue (BFS) vs Stack (DFS) memory structure identified',
      'Shortest path property in unweighted graphs stated',
    ],
    missedPoints: [
      'Missing comparison on deep or infinite tree search behavior',
    ],
    suggestedMarks: 6.5,
    reason: 'Correct memory formulations and structural distinction; minor omission on edge behavior in infinite depth trees.',
    cached: true,
  },
};

/**
 * Mock AI Evaluation call with a 1.5s simulated network latency
 */
export async function fetchAISuggestion(
  _sheetId: string,
  question: Question
): Promise<AISuggestionResponse> {
  // If cached flag is on, immediately return cached response if available
  if (USE_CACHED_AI && CACHED_RESPONSES[question.id]) {
    return {
      ...CACHED_RESPONSES[question.id],
      cached: true,
    };
  }

  // Simulate network latency of 1.5 seconds
  await new Promise((resolve) => setTimeout(resolve, 1500));

  if (SIMULATE_AI_ERROR) {
    throw new Error('AI Inference Service temporarily unavailable. Please grade manually.');
  }

  // Return realistic tailored mock response if available, or generate dynamic one
  if (CACHED_RESPONSES[question.id]) {
    return {
      ...CACHED_RESPONSES[question.id],
      cached: false,
    };
  }

  // Default dynamic generated suggestion based on question rubric
  const halfPoints = Math.round((question.maxMarks * 0.8) * 2) / 2;
  return {
    transcription: `Handwritten response for Question ${question.questionNumber}: Candidate outlined the mathematical steps, formula definition, and concluding observations aligned with ${question.title}.`,
    confidence: 88,
    matchedPoints: question.rubric.slice(0, 2).map((r) => r.criterion),
    missedPoints: question.rubric.slice(2).map((r) => r.criterion),
    suggestedMarks: Math.min(question.maxMarks, Math.max(0.5, halfPoints)),
    reason: `Evaluated against model answer. Candidate script captured key rubric principles with minor missing details on secondary edge criteria.`,
    cached: false,
  };
}

// In-memory array of logged examiner decisions
export const inMemoryDecisionLogs: AIDecisionLog[] = [];

/**
 * Logs examiner's decision (accept or override) for regulatory compliance and audit tracking
 */
export async function logAIDecision(decision: AIDecisionLog): Promise<{ success: boolean; logId: string }> {
  inMemoryDecisionLogs.push(decision);

  // Also persist to localStorage for audit inspection
  try {
    const existing = JSON.parse(localStorage.getItem('ai_decision_audit_logs') || '[]');
    existing.push(decision);
    localStorage.setItem('ai_decision_audit_logs', JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to write decision log to localStorage', err);
  }

  return { success: true, logId: `log-${Date.now()}` };
}
