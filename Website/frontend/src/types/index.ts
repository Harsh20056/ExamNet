export type Role = 'examiner' | 'moderator' | 'controller' | null;

export type SheetStatus = 'pending' | 'in progress' | 'flagged' | 'final';

export interface RubricCriterion {
  id: string;
  criterion: string;
  points: number;
}

export interface Question {
  id: string;
  questionNumber: number;
  title: string;
  maxMarks: number;
  modelAnswer: string;
  rubric: RubricCriterion[];
}

export interface Exam {
  id: string;
  code: string;
  title: string;
  subject: string;
  totalMarks: number;
  questions: Question[];
  createdAt: string;
}

export interface PageQuestionMapping {
  pageNumber: number;
  questionIds: string[];
}

export interface Mark {
  id: string;
  sheetId: string;
  questionId: string;
  awardedMarks: number;
  maxMarks: number;
  examinerId: string;
  evaluatorRole: 'examiner' | 'moderator';
  feedback?: string;
  timestamp: string;
}

export interface Sheet {
  id: string;
  examId: string;
  candidateAnonymizedId: string;
  status: SheetStatus;
  allocatedExaminerId?: string;
  pageImages: string[];
  pageMap: PageQuestionMapping[];
  totalScore?: number;
  maxPossibleScore: number;
  flagReason?: string;
  moderationScore?: number;
  submittedAt?: string;
  lastUpdated?: string;
}

export interface AICall {
  id: string;
  sheetId: string;
  questionId: string;
  promptType: 'handwriting_ocr' | 'rubric_eval' | 'anomaly_detect';
  suggestedScore: number;
  confidence: number;
  reasoning: string;
  latencyMs: number;
  timestamp: string;
}

export interface Alert {
  id: string;
  type: 'speed_violation' | 'variance_spike' | 'rubric_deviation' | 'duplicate_pattern' | 'unusual_time';
  severity: 'low' | 'medium' | 'high' | 'critical';
  sheetId: string;
  examinerId?: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface ModerationDecision {
  id: string;
  sheetId: string;
  moderatorId: string;
  originalScore: number;
  adjustedScore: number;
  decision: 'accepted' | 'adjusted' | 're_evaluate';
  notes: string;
  timestamp: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  userRole: 'examiner' | 'moderator' | 'controller';
  action: 'LOGIN' | 'START_MARKING' | 'AWARD_MARK' | 'FINALIZE_SHEET' | 'MODERATE_SHEET' | 'TRIGGER_ALERT' | 'EXPORT_RESULTS';
  sheetId?: string;
  details: string;
  ipAddress?: string;
}

export interface ExaminerProfile {
  id: string;
  name: string;
  email: string;
  subject: string;
  assignedSheetsCount: number;
  evaluatedCount: number;
  averageSpeedMins: number;
  status: 'active' | 'idle' | 'flagged';
}
