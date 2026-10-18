export type StudentProfile = {
  fullName: string;
  studentId: string;
  course: string;
  section: string;
};

export type ExamQuestion = {
  id: number;
  number: number;
  section: string;
  prompt: string;
  points: number;
  answerKey: string;
  acceptedAnswers: string[];
};

export type AttemptRecord = {
  id: string;
  createdAt: string;
  student: StudentProfile;
  answers: Record<number, string>;
  status: 'in-progress' | 'submitted' | 'manual-review';
  totalScore: number;
  percentage: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
  submittedAt?: string;
  flaggedForReview?: boolean;
};
