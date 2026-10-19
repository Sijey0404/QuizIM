import { useEffect, useMemo, useState } from 'react';
import './App.css';
import { EXAM_SUBJECT, EXAM_TITLE, TOTAL_POINTS, TOTAL_QUESTIONS, partSections, questions } from './lib/examData';
import { calculateScore, gradeAnswer } from './lib/grading';
import {
  getAdminProfile,
  getAllExamAttemptsFromSupabase,
  isSupabaseConfigured,
  saveStudentAttemptToSupabase,
  signInAdmin,
  supabase,
  updateStudentAttemptInSupabase,
} from './services/supabase';
import type { AttemptRecord, StudentProfile } from './types';

const STUDENT_FORM_KEY = 'quiz-im-profile';
const PROGRESS_KEY = 'quiz-im-progress';
const ATTEMPTS_KEY = 'quiz-im-attempts';
const LAST_RESULT_KEY = 'quiz-im-last-result';
const REVIEW_POLICY_KEY = 'quiz-im-review-policy';

const emptyProfile: StudentProfile = {
  fullName: '',
  studentId: '',
  course: '',
  section: '',
};

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
};

const writeStorage = (key: string, value: unknown) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
};

const getDefaultProgress = () => ({
  currentQuestion: 1,
  answers: {} as Record<number, string>,
});

const makeAttemptId = () =>
  `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function App() {
  const [view, setView] = useState<'student' | 'exam' | 'review' | 'results' | 'admin'>('student');
  const [profile, setProfile] = useState<StudentProfile>(() => readStorage(STUDENT_FORM_KEY, emptyProfile));
  const [progress] = useState<Record<string, unknown>>(() => readStorage(PROGRESS_KEY, getDefaultProgress()));
  const [currentQuestion, setCurrentQuestion] = useState<number>(Number((progress as { currentQuestion?: number })?.currentQuestion ?? 1));
  const [answers, setAnswers] = useState<Record<number, string>>(() => (progress as { answers?: Record<number, string> })?.answers ?? {});
  const [result, setResult] = useState<AttemptRecord | null>(() => readStorage(LAST_RESULT_KEY, null));
  const [attemptId, setAttemptId] = useState<string | null>(() => readStorage('quiz-im-attempt-id', null));
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [adminCreds, setAdminCreds] = useState({ email: '', password: '' });
  const [adminProfile, setAdminProfile] = useState<{ id: string; full_name: string; role: 'admin' } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminCourseFilter, setAdminCourseFilter] = useState('all');
  const [adminSectionFilter, setAdminSectionFilter] = useState('all');
  const [sortMode, setSortMode] = useState('date-desc');
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [feedbackPolicy, setFeedbackPolicy] = useState<'immediate' | 'after-period'>(() => readStorage(REVIEW_POLICY_KEY, 'immediate'));
  const [attemptsSnapshot, setAttemptsSnapshot] = useState<AttemptRecord[]>(() => readStorage(ATTEMPTS_KEY, []));

  const currentQuestionData = questions[currentQuestion - 1];
  const answeredQuestions = Object.values(answers).filter((value) => value && value.trim()).length;
  const unansweredQuestions = TOTAL_QUESTIONS - answeredQuestions;
  const allAttempts = attemptsSnapshot;
  const isAdminAuthenticated = adminProfile !== null;

  const adminFilterOptions = useMemo(
    () => Array.from(new Set(allAttempts.map((attempt) => attempt.student.course))).sort(),
    [allAttempts],
  );
  const adminSectionOptions = useMemo(
    () => Array.from(new Set(allAttempts.map((attempt) => attempt.student.section))).sort(),
    [allAttempts],
  );

  const filteredAttempts = useMemo(() => {
    const query = adminSearch.toLowerCase();

    return [...allAttempts]
      .filter((attempt) => {
        const matchesQuery =
          !query ||
          attempt.student.fullName.toLowerCase().includes(query) ||
          attempt.student.studentId.toLowerCase().includes(query);
        const matchesCourse = adminCourseFilter === 'all' || attempt.student.course === adminCourseFilter;
        const matchesSection = adminSectionFilter === 'all' || attempt.student.section === adminSectionFilter;
        return matchesQuery && matchesCourse && matchesSection;
      })
      .sort((left, right) => {
        switch (sortMode) {
          case 'name-asc':
            return left.student.fullName.localeCompare(right.student.fullName);
          case 'score-desc':
            return right.totalScore - left.totalScore;
          case 'score-asc':
            return left.totalScore - right.totalScore;
          case 'date-asc':
            return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
          case 'date-desc':
          default:
            return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
        }
      });
  }, [adminCourseFilter, adminSearch, adminSectionFilter, allAttempts, sortMode]);

  const selectedAttempt =
    filteredAttempts.find((attempt) => attempt.id === selectedAttemptId) ?? filteredAttempts[0] ?? null;

  useEffect(() => {
    writeStorage(STUDENT_FORM_KEY, profile);
  }, [profile]);

  useEffect(() => {
    let active = true;
    window.localStorage.removeItem('quiz-im-admin-auth');

    const restoreAdminSession = async () => {
      try {
        if (!supabase) return;

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) return;

        const restoredProfile = await getAdminProfile(data.session.user.id);
        if (active) setAdminProfile(restoredProfile);
      } catch {
        await supabase?.auth.signOut();
      } finally {
        if (active) setAuthLoading(false);
      }
    };

    void restoreAdminSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const progressState = { currentQuestion, answers };
    writeStorage(PROGRESS_KEY, progressState);
  }, [answers, currentQuestion]);

  useEffect(() => {
    if (selectedAttemptId === null && filteredAttempts[0]) {
      setSelectedAttemptId(filteredAttempts[0].id);
    }
  }, [filteredAttempts, selectedAttemptId]);

  useEffect(() => {
    if (result) {
      writeStorage(LAST_RESULT_KEY, result);
    }
  }, [result]);

  useEffect(() => {
    writeStorage(REVIEW_POLICY_KEY, feedbackPolicy);
  }, [feedbackPolicy]);

  useEffect(() => {
    if (attemptId) {
      writeStorage('quiz-im-attempt-id', attemptId);
    } else {
      window.localStorage.removeItem('quiz-im-attempt-id');
    }
  }, [attemptId]);

  useEffect(() => {
    if (!isAdminAuthenticated || !supabase) {
      return;
    }

    const loadRemoteAttempts = async () => {
      try {
        const remoteAttempts = await getAllExamAttemptsFromSupabase();
        const localAttempts = readStorage<AttemptRecord[]>(ATTEMPTS_KEY, []);
        const mergedAttempts = [...localAttempts, ...remoteAttempts].reduce<AttemptRecord[]>((accumulator, attempt) => {
          const exists = accumulator.some((item) => item.id === attempt.id);
          if (!exists) {
            accumulator.push(attempt);
          }
          return accumulator;
        }, []);

        setAttemptsSnapshot(mergedAttempts);
        writeStorage(ATTEMPTS_KEY, mergedAttempts);
      } catch (error) {
        console.error('Unable to load attempts from Supabase:', error);
      }
    };

    void loadRemoteAttempts();
  }, [isAdminAuthenticated]);

  const canStartExam = Boolean(profile.fullName && profile.studentId && profile.course && profile.section);

  const handleStartExam = async () => {
    if (!canStartExam) return;

    const nextAttemptId = makeAttemptId();
    setAttemptId(nextAttemptId);

    try {
      if (supabase) {
        const savedAttempt = await saveStudentAttemptToSupabase(profile, 0, 0, undefined, {
          id: nextAttemptId,
          status: 'in_progress',
          startedAt: new Date().toISOString(),
        });

        if (savedAttempt?.id) {
          setAttemptId(String(savedAttempt.id));
        }
      }
    } catch (error) {
      console.error('Unable to save student record before the exam begins:', error);
    }

    setView('exam');
  };

  const handleAnswerChange = (questionNumber: number, value: string) => {
    setAnswers((previous) => ({ ...previous, [questionNumber]: value }));
  };

  const handleQuestionJump = (questionNumber: number) => setCurrentQuestion(questionNumber);

  const handleSubmitAttempt = async () => {
    setLoading(true);

    const mergedAnswers = questions.map((question) => ({
      questionId: question.id,
      answer: answers[question.number] ?? '',
      isCorrect: gradeAnswer(answers[question.number] ?? '', question.acceptedAnswers),
    }));

    const summary = calculateScore(mergedAnswers);
    const nextAttempt: AttemptRecord = {
      id: attemptId ?? makeAttemptId(),
      createdAt: new Date().toISOString(),
      student: profile,
      answers: Object.fromEntries(questions.map((question) => [question.number, answers[question.number] ?? ''])),
      status: 'submitted',
      totalScore: summary.correct,
      percentage: summary.percentage,
      correctCount: summary.correct,
      incorrectCount: summary.incorrect,
      unansweredCount: summary.unanswered,
      submittedAt: new Date().toISOString(),
      flaggedForReview: false,
    };

    try {
      if (attemptId) {
        await updateStudentAttemptInSupabase(attemptId, profile, summary.correct, summary.percentage, 'submitted');
      } else {
        await saveStudentAttemptToSupabase(profile, summary.correct, summary.percentage, undefined, {
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error('Unable to save exam attempt to Supabase:', error);
    }

    const existingAttempts = readStorage<AttemptRecord[]>(ATTEMPTS_KEY, []);
    const nextAttempts = [...existingAttempts, nextAttempt];
    writeStorage(ATTEMPTS_KEY, nextAttempts);
    writeStorage(LAST_RESULT_KEY, nextAttempt);
    setResult(nextAttempt);
    setAttemptsSnapshot(nextAttempts);
    setSelectedAttemptId(nextAttempt.id);
    setView('results');
    setAttemptId(null);
    window.localStorage.removeItem(PROGRESS_KEY);
    window.localStorage.removeItem('quiz-im-attempt-id');
    setLoading(false);
  };

  const handleAdminLogin = async () => {
    setAuthLoading(true);
    setAuthError('');

    try {
      const signedInProfile = await signInAdmin(adminCreds.email.trim(), adminCreds.password);
      setAdminProfile(signedInProfile);
      setAdminCreds((current) => ({ ...current, password: '' }));
      setView('admin');
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleAdminLogout = async () => {
    await supabase?.auth.signOut();
    setAdminProfile(null);
    setAuthError('');
    setView('student');
  };

  const handleFlagReview = (attemptIdToUpdate: string) => {
    const nextAttempts = attemptsSnapshot.map((attempt) =>
      attempt.id === attemptIdToUpdate
        ? { ...attempt, flaggedForReview: !attempt.flaggedForReview }
        : attempt,
    );
    setAttemptsSnapshot(nextAttempts);
    writeStorage(ATTEMPTS_KEY, nextAttempts);
  };

  const exportCsv = () => {
    if (!filteredAttempts.length) return;

    const csvRows = [
      ['Name', 'Student ID', 'Course / Section', 'Score', 'Percentage', 'Submitted At'],
      ...filteredAttempts.map((attempt) => [
        attempt.student.fullName,
        attempt.student.studentId,
        `${attempt.student.course} / ${attempt.student.section}`,
        attempt.totalScore,
        `${attempt.percentage}%`,
        attempt.submittedAt ?? attempt.createdAt,
      ]),
    ];

    const csv = csvRows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'student-results.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const classAverage = filteredAttempts.length
    ? filteredAttempts.reduce((sum, attempt) => sum + attempt.totalScore, 0) / filteredAttempts.length
    : 0;
  const highestScore = filteredAttempts.length ? Math.max(...filteredAttempts.map((attempt) => attempt.totalScore)) : 0;
  const lowestScore = filteredAttempts.length ? Math.min(...filteredAttempts.map((attempt) => attempt.totalScore)) : 0;
  const scoreCounts = Array.from({ length: 11 }, (_, index) => {
    const bucketStart = index * 5;
    const bucketEnd = bucketStart + 4;
    const count = filteredAttempts.filter((attempt) => {
      const score = attempt.totalScore;
      return score >= bucketStart && score <= bucketEnd;
    }).length;

    return { bucketStart, bucketEnd, count };
  });

  const renderStudentForm = () => (
    <div className="page-card">
      <div className="page-header">
        <span className="eyebrow">Student Registration</span>
        <h1>{EXAM_TITLE}</h1>
      </div>
      <div className="student-grid">
        <div className="student-panel">
          <label>
            Full Name
            <input
              value={profile.fullName}
              onChange={(event) => setProfile((previous) => ({ ...previous, fullName: event.target.value }))}
              placeholder="Enter your full name"
            />
          </label>
          <label>
            Student ID Number
            <input
              value={profile.studentId}
              onChange={(event) => setProfile((previous) => ({ ...previous, studentId: event.target.value }))}
              placeholder="e.g., 2024-001"
            />
          </label>
          <label>
            Course and Section
            <input
              value={profile.course}
              onChange={(event) => setProfile((previous) => ({ ...previous, course: event.target.value }))}
              placeholder="e.g., BSIT 2A"
            />
          </label>
          <label>
            Section
            <input
              value={profile.section}
              onChange={(event) => setProfile((previous) => ({ ...previous, section: event.target.value }))}
              placeholder="Section"
            />
          </label>
          <button className="primary-button" type="button" onClick={handleStartExam} disabled={!canStartExam}>
            Start Examination
          </button>
        </div>
        <div className="info-panel">
          <h3>Examination Overview</h3>
          <ul>
            <li>Subject: {EXAM_SUBJECT}</li>
            <li>Total Questions: {TOTAL_QUESTIONS}</li>
            <li>Total Points: {TOTAL_POINTS}</li>
            <li>Passing requirement: 30 Points</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderExam = () => (
    <div className="page-card exam-card">
      <div className="exam-header">
        <div>
          <span className="eyebrow">Student Exam</span>
          <h2>{EXAM_TITLE}</h2>
        </div>
        <div className="exam-meta">
          <span>{profile.fullName}</span>
          <span>Question {currentQuestion} of {TOTAL_QUESTIONS}</span>
        </div>
      </div>

      <div className="exam-progress">
        <div className="progress-bar">
          <span style={{ width: `${(currentQuestion / TOTAL_QUESTIONS) * 100}%` }} />
        </div>
      </div>

      <div className="exam-body">
        <aside className="question-nav">
          {questions.map((question) => (
            <button
              key={question.id}
              type="button"
              className={`nav-button ${currentQuestion === question.number ? 'active' : ''} ${answers[question.number]?.trim() ? 'filled' : ''}`}
              onClick={() => handleQuestionJump(question.number)}
            >
              {question.number}
            </button>
          ))}
        </aside>

        <section className="question-panel">
          <div className="question-header">
            <span className="chip">{currentQuestionData.section}</span>
            <span className="chip subtle">1 point</span>
          </div>
          <p className="instruction-text">
            Answer all 50 questions by writing the correct MySQL SQL command or syntax. Each question is worth 1 point. Use proper SQL keywords, table names, column names, data types, and syntax. Review your answers before submitting.
          </p>
          <h3>
            Question {currentQuestionData.number}: {currentQuestionData.prompt.replace(/`/g, '')}
          </h3>
          <textarea
            value={answers[currentQuestionData.number] ?? ''}
            onChange={(event) => handleAnswerChange(currentQuestionData.number, event.target.value)}
            placeholder="Type SQL syntax here..."
            rows={6}
          />
          <div className="question-controls">
            <button type="button" onClick={() => setCurrentQuestion((value) => Math.max(1, value - 1))} disabled={currentQuestion === 1}>
              Previous
            </button>
            <button type="button" onClick={() => setCurrentQuestion((value) => Math.min(TOTAL_QUESTIONS, value + 1))} disabled={currentQuestion === TOTAL_QUESTIONS}>
              Next
            </button>
            <button type="button" className="primary-button" onClick={() => setView('review')}>
              Review Submission
            </button>
          </div>
        </section>
      </div>
    </div>
  );

  const renderReview = () => (
    <div className="page-card">
      <div className="page-header review-header">
        <span className="eyebrow">Review Before Submission</span>
        <h2>Ready to submit your examination?</h2>
      </div>
      <div className="review-summary">
        <div>
          <strong>{answeredQuestions}</strong>
          <span>Answered</span>
        </div>
        <div>
          <strong>{unansweredQuestions}</strong>
          <span>Unanswered</span>
        </div>
        <div>
          <strong>{TOTAL_QUESTIONS}</strong>
          <span>Total Questions</span>
        </div>
      </div>

      <div className="review-list">
        {partSections.map((section) => {
          const sectionQuestions = questions.filter((question) => question.section === section);

          return (
            <div className="review-section" key={section}>
              <h3>{section}</h3>
              {sectionQuestions.map((question) => (
                <div key={question.id} className="review-item">
                  <span>
                    Q{question.number}
                  </span>
                  <button type="button" onClick={() => { setCurrentQuestion(question.number); setView('exam'); }}>
                    {answers[question.number]?.trim() ? 'Edit answer' : 'Answer now'}
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      <div className="review-actions">
        <button type="button" onClick={() => setView('exam')}>Back to Exam</button>
        <button
          type="button"
          className="primary-button"
          onClick={() => setShowConfirm(true)}
          disabled={loading}
        >
          {loading ? 'Submitting...' : 'Submit Examination'}
        </button>
      </div>

      {showConfirm && (
        <div className="confirmation-dialog">
          <div>
            <h3>Confirm final submission</h3>
            <p>You are about to submit {answeredQuestions} answered questions and leave {unansweredQuestions} unanswered. This action cannot be undone.</p>
            <div className="dialog-actions">
              <button type="button" onClick={() => setShowConfirm(false)}>Cancel</button>
              <button type="button" className="primary-button" onClick={handleSubmitAttempt}>Confirm Submission</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderResults = () => {
    if (!result) {
      return (
        <div className="page-card empty-state">
          <h2>No submission found.</h2>
          <button className="primary-button" type="button" onClick={() => setView('student')}>
            Return to start
          </button>
        </div>
      );
    }

    return (
      <div className="page-card result-card">
        <div className="page-header">
          <span className="eyebrow">Submission Complete</span>
          <h2>Examination results</h2>
        </div>
        <div className="result-grid">
          <div className="result-panel">
            <p><strong>Student:</strong> {result.student.fullName}</p>
            <p><strong>Student ID:</strong> {result.student.studentId}</p>
            <p><strong>Course & Section:</strong> {result.student.course} / {result.student.section}</p>
            <p><strong>Submission date:</strong> {new Date(result.submittedAt ?? result.createdAt).toLocaleString()}</p>
            <p><strong>Status:</strong> {result.status}</p>
          </div>
          <div className="score-panel">
            <div className="score-value">{result.totalScore}/{TOTAL_QUESTIONS}</div>
            <div className="score-percent">{result.percentage}%</div>
            <div className="score-breakdown">
              <span>Correct: {result.correctCount}</span>
              <span>Incorrect: {result.incorrectCount}</span>
              <span>Unanswered: {result.unansweredCount}</span>
            </div>
          </div>
        </div>

        <div className="feedback-policy">
          <h3>Instructor feedback policy</h3>
          <p>
            {feedbackPolicy === 'immediate'
              ? 'Detailed answer review is available immediately to students after submission.'
              : 'Detailed answer review is withheld until the end of the examination period.'}
          </p>
        </div>
      </div>
    );
  };

  const renderAdmin = () => {
    if (authLoading) {
      return (
        <div className="page-card empty-state" role="status">
          <p>Checking administrator session...</p>
        </div>
      );
    }

    if (!isAdminAuthenticated) {
      return (
        <div className="page-card admin-card">
          <div className="page-header">
            <span className="eyebrow">Administrator Login</span>
            <h2>Secure dashboard access</h2>
          </div>
          <form className="admin-login-grid" onSubmit={(event) => { event.preventDefault(); void handleAdminLogin(); }}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={adminCreds.email}
                onChange={(event) => setAdminCreds({ ...adminCreds, email: event.target.value })}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={adminCreds.password}
                onChange={(event) => setAdminCreds({ ...adminCreds, password: event.target.value })}
              />
            </label>
            {authError && <p className="admin-error" role="alert">{authError}</p>}
            {!isSupabaseConfigured && <p className="admin-error" role="alert">Configure the Supabase project URL and anon key to enable administrator login.</p>}
            <button className="primary-button" type="submit" disabled={authLoading || !isSupabaseConfigured}>
              {authLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      );
    }

    return (
      <div className="page-card admin-dashboard">
        <div className="page-header admin-header">
          <div>
            <span className="eyebrow">Administrator Dashboard</span>
            <h2>Examination results</h2>
            <p>Signed in as {adminProfile?.full_name}</p>
          </div>
          <button type="button" onClick={handleAdminLogout}>Log out</button>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <span>Submitted</span>
            <strong>{filteredAttempts.length}</strong>
          </div>
          <div className="stat-card">
            <span>Average</span>
            <strong>{classAverage.toFixed(1)}</strong>
          </div>
          <div className="stat-card">
            <span>Highest</span>
            <strong>{highestScore}</strong>
          </div>
          <div className="stat-card">
            <span>Lowest</span>
            <strong>{lowestScore}</strong>
          </div>
        </div>

        <div className="dashboard-controls">
          <input
            value={adminSearch}
            onChange={(event) => setAdminSearch(event.target.value)}
            placeholder="Search by name or student ID"
          />
          <select value={adminCourseFilter} onChange={(event) => setAdminCourseFilter(event.target.value)}>
            <option value="all">All courses</option>
            {adminFilterOptions.map((course) => (
              <option key={course} value={course}>{course}</option>
            ))}
          </select>
          <select value={adminSectionFilter} onChange={(event) => setAdminSectionFilter(event.target.value)}>
            <option value="all">All sections</option>
            {adminSectionOptions.map((section) => (
              <option key={section} value={section}>{section}</option>
            ))}
          </select>
          <select value={sortMode} onChange={(event) => setSortMode(event.target.value)}>
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="name-asc">Name A-Z</option>
            <option value="score-desc">Highest score</option>
            <option value="score-asc">Lowest score</option>
          </select>
          <button type="button" onClick={exportCsv}>Export CSV</button>
        </div>

        <div className="dashboard-panel">
          <div className="distribution-panel">
            <h3>Score distribution</h3>
            <div className="distribution-list">
              {scoreCounts.map((bucket) => (
                <div className="distribution-item" key={`${bucket.bucketStart}-${bucket.bucketEnd}`}>
                  <span>{bucket.bucketStart}-{bucket.bucketEnd}</span>
                  <div className="distribution-track">
                    <span style={{ width: `${(bucket.count / Math.max(filteredAttempts.length, 1)) * 100}%` }} />
                  </div>
                  <strong>{bucket.count}</strong>
                </div>
              ))}
            </div>
          </div>

          <div className="table-panel">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>ID</th>
                  <th>Course</th>
                  <th>Score</th>
                  <th>%</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.map((attempt) => (
                  <tr key={attempt.id} onClick={() => setSelectedAttemptId(attempt.id)} className={selectedAttempt?.id === attempt.id ? 'selected-row' : ''}>
                    <td>{attempt.student.fullName}</td>
                    <td>{attempt.student.studentId}</td>
                    <td>{attempt.student.course}/{attempt.student.section}</td>
                    <td>{attempt.totalScore}</td>
                    <td>{attempt.percentage}%</td>
                    <td>{new Date(attempt.submittedAt ?? attempt.createdAt).toLocaleDateString()}</td>
                    <td>{attempt.flaggedForReview ? 'Manual review' : 'Submitted'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {selectedAttempt && (
          <div className="selected-attempt-panel">
            <div className="selected-attempt-header">
              <div>
                <h3>{selectedAttempt.student.fullName}</h3>
                <p>{selectedAttempt.student.studentId} • {selectedAttempt.student.course}/{selectedAttempt.student.section}</p>
              </div>
              <button type="button" onClick={() => handleFlagReview(selectedAttempt.id)}>
                {selectedAttempt.flaggedForReview ? 'Unflag review' : 'Flag manual review'}
              </button>
            </div>

            <div className="answer-breakdown">
              {questions.map((question) => {
                const answer = selectedAttempt.answers[question.number] ?? '';
                const isCorrect = gradeAnswer(answer, question.acceptedAnswers);
                return (
                  <div className="breakdown-row" key={question.id}>
                    <span>Q{question.number}</span>
                    <p>{answer || 'Unanswered'}</p>
                    <span className={isCorrect ? 'tag correct' : 'tag incorrect'}>{isCorrect ? 'Correct' : 'Incorrect'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="policy-toggle">
          <label>
            Student review policy
            <select value={feedbackPolicy} onChange={(event) => setFeedbackPolicy(event.target.value as 'immediate' | 'after-period')}>
              <option value="immediate">Allow immediate review</option>
              <option value="after-period">Require end-of-period review</option>
            </select>
          </label>
        </div>
      </div>
    );
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-block">
          <span className="brand-mark">IM</span>
          <div>
            <strong>Information Management</strong>
            <small>MySQL Examination System</small>
          </div>
        </div>
        <nav className="topbar-actions">
          <button type="button" onClick={() => setView('student')}>Student</button>
          <button type="button" onClick={() => setView('admin')}>Admin</button>
          {result && <button type="button" onClick={() => setView('results')}>Results</button>}
        </nav>
      </header>

      {view === 'student' && renderStudentForm()}
      {view === 'exam' && renderExam()}
      {view === 'review' && renderReview()}
      {view === 'results' && renderResults()}
      {view === 'admin' && renderAdmin()}
    </div>
  );
}

export default App;
