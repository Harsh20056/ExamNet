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
  sheetId?: string;
  examId: string;
  candidateAnonymizedId: string;
  status: SheetStatus;
  allocatedExaminerId?: string;
  assignedTo?: string;
  pageImages: string[];
  pages?: Array<{
    pageNumber: number;
    fileName?: string;
    mimeType?: string;
    size?: number;
    dataUrl: string;
  }>;
  pageCount?: number;
  pageMap: PageQuestionMapping[];
  totalScore?: number;
  totalMarks?: number;
  maxMarks?: number;
  maxPossibleScore: number;
  flagReason?: string;
  moderationScore?: number;
  submittedAt?: string;
  startedAt?: string;
  completedAt?: string;
  lastUpdated?: string;
  uploadedAt?: string;
  exam?: Exam;
  marks?: Array<{
    qNo: number;
    marks: number;
    comment?: string;
    timeSpentSec?: number;
    markedAt?: string;
  }>;
}

export interface AICall {
  id: string;
  callId?: string;
  sheetId: string;
  questionId?: string;
  qNo?: number;
  promptType?: 'handwriting_ocr' | 'rubric_eval' | 'anomaly_detect';
  suggestedScore?: number;
  suggestedMarks?: number;
  confidence: number;
  reasoning?: string;
  reason?: string;
  latencyMs?: number;
  timestamp?: string;
  matched?: string[];
  missed?: string[];
  transcription?: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical' | string;
  sheetId: string;
  examinerId?: string;
  detectedBy?: string;
  message: string;
  timestamp: string;
  detectedAt?: string;
  resolved: boolean;
  status?: 'pending' | 'resolved' | 'dismissed';
  metadata?: Record<string, any>;
  resolutionNote?: string;
  resolvedBy?: string;
  resolvedAt?: string;
}

export interface ModerationDecision {
  id: string;
  sheetId: string;
  moderatorId?: string;
  originalScore?: number;
  adjustedScore?: number;
  decision?: 'accepted' | 'adjusted' | 're_evaluate' | 'approve' | 'adjust' | 'sendback';
  notes?: string;
  reason?: string;
  timestamp?: string;
  createdAt?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  userId: string;
  actor?: string;
  userRole?: 'examiner' | 'moderator' | 'controller' | string;
  role?: string;
  action: string;
  sheetId?: string;
  details: string;
  ipAddress?: string;
  previousHash?: string;
  blockHash?: string;
  currentHash?: string;
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

declare global {
  interface Window {
    secure?: {
      setMarkingMode: (on: boolean) => void;
      onViolation: (cb: (violation: any) => void) => () => void;
      getVersion: () => string;
    };
  }
}
