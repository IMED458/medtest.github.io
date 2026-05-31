export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: string; // ISO String
  role: 'user' | 'admin';
}

export interface ValidationIssue {
  questionNumber: number;
  questionText?: string;
  issueType: 'missing_correct' | 'multiple_correct' | 'no_answers' | 'empty_question' | 'duplicate_question' | 'broken_format' | 'incomplete';
  message: string;
}

export interface ValidationReport {
  totalQuestions: number;
  correctQuestions: number;
  problematicQuestions: number;
  issues: ValidationIssue[];
}

export interface TestMetadata {
  id: string;
  title: string;
  createdBy: string;
  creatorName?: string;
  createdAt: string; // ISO String
  questionCount: number;
  errorCount: number;
  originalFileName: string;
  validationReport: ValidationReport;
}

export interface Question {
  id: string;
  testId: string;
  questionText: string;
  options: string[];
  correctOptionIndex: number;
  originalIndex: number; // 1-based original index in the text file
}

export interface UserProgress {
  id: string; // "testId_userId"
  testId: string;
  userId: string;
  currentQuestionIndex: number;
  answeredCount: number;
  correctCount: number;
  wrongCount: number;
  updatedAt: string; // ISO string
  timeSpent: number; // in seconds
  isCompleted: boolean;
  wrongQuestions: string[]; // array of question IDs answered incorrectly
  flaggedQuestions: string[]; // array of flagged question IDs
  responses: Record<string, {
    chosenOptionIndex: number;
    isCorrect: boolean;
    timestamp: string;
  }>;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  createdBy: string;
  creatorName?: string;
  createdAt: string; // ISO String
  code: string; // invite.code
}

export interface GroupMember {
  userId: string;
  email: string;
  displayName: string;
  joinedAt: string; // ISO String
  role: 'owner' | 'admin' | 'member';
  nickname?: string; // Optional group-specific nickname
}

export interface GroupTest {
  testId: string;
  sharedBy: string;
  sharedByName?: string;
  sharedAt: string; // ISO String
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  createdAt: number; // UTC timestamp milliseconds
}
