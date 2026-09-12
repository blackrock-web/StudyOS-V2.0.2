import React, { useState, useEffect, useCallback } from 'react';
// useEffect already imported above for reminder bootstrap
import { DesktopFrame } from './components/desktop/DesktopFrame';
import { DesktopSplashScreen } from './components/desktop/DesktopSplashScreen';
import { DesktopErrorBoundary } from './components/desktop/DesktopErrorBoundary';
import { notificationService } from './services/notificationService';
import { syncService } from './services/syncService';
import { workspaceStateService } from './services/workspaceStateService';
import { recoverPendingJournals } from './services/journalService';
import { taskSessionService } from './services/taskSessionService';

// Views
import { SettingsHub } from './components/settings/SettingsHub';
import { ExamManager } from './components/exams/ExamManager';
import { OverviewDashboard } from './components/dashboard/OverviewDashboard';
import { PDFKnowledgeEngine } from './components/pdf/PDFKnowledgeEngine';
import { SyllabusManager } from './components/syllabus/SyllabusManager';
import { StudyResourceGenerator } from './components/resources/StudyResourceGenerator';
import { PlannerHub } from './components/planner/PlannerHub';
import { PlannerView } from './components/planner/PlannerView';
import { LectureTracker } from './components/lectures/LectureTracker';
import { SmartAnalyticsView } from './components/analytics/SmartAnalyticsView';
import { ReportsGenerator } from './components/reports/ReportsGenerator';
import { StudyHubContainer } from './components/studyhub/StudyHubContainer';
import { StudyBrowserView } from './components/browser/StudyBrowserView';
import { ParentProgressView } from './components/parent/ParentProgressView';
import { ContentEngineView } from './components/content/ContentEngineView';
import { PracticeHub } from './components/practice/PracticeHub';
import { AIResultReviewModal } from './components/ai/AIResultReviewModal';
import { authService } from './services/auth';
import { ExamProvider } from './context/ExamContext';

export const App: React.FC = () => {
  const [isBooting, setIsBooting] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      const snap = workspaceStateService.restoreSnapshot();
      return snap?.activeTab || 'dashboard';
    } catch {
      return 'dashboard';
    }
  });

  /** Persist to bell history + fire native OS desktop notification (no browser toasts). */
  const handleShowNotification = useCallback((message: string, title: string = 'System') => {
    notificationService.add(title, message, { native: true });
  }, []);

  // Crash-safe journal recovery once at boot + task session day rollover check
  useEffect(() => {
    try {
      taskSessionService.initDayRolloverCheck();
      const { rolledBack } = recoverPendingJournals();
      if (rolledBack > 0 && typeof console !== 'undefined') {
        console.info(`[StudyOS] Recovered ${rolledBack} incomplete journal transaction(s)`);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // Persist active tab + scroll for post-login workspace restore
  useEffect(() => {
    if (!isBooting) {
      try {
        workspaceStateService.captureSnapshot(activeTab);
      } catch {
        /* ignore */
      }
    }
  }, [activeTab, isBooting]);

  // After boot: schedule offline reminders from planner tasks
  useEffect(() => {
    if (!isBooting) {
      try {
        syncService.rescheduleAllReminders();
        workspaceStateService.restoreSnapshot();
      } catch {
        /* ignore */
      }
    }
  }, [isBooting]);

  const renderActiveView = useCallback(() => {
    const user = authService.getCurrentUser();
    if (user && user.role === 'Parent') {
      return <ParentProgressView onShowNotification={handleShowNotification} />;
    }

    switch (activeTab) {
      case 'parent-progress':
      case 'progress':
        return <ParentProgressView onShowNotification={handleShowNotification} />;

      case 'dashboard':
        return (
          <OverviewDashboard
            onNavigate={setActiveTab}
            onShowNotification={handleShowNotification}
          />
        );

      case 'study-hub':
      case 'study-hub-dashboard':
      case 'subjects':
      case 'notes':
      case 'formula':
        return (
          <StudyHubContainer
            onShowNotification={handleShowNotification}
            activeTab={activeTab}
          />
        );

      case 'pdf':
        return <PDFKnowledgeEngine onShowNotification={handleShowNotification} />;

      case 'content-engine':
      case 'question-bank':
      case 'pyq':
      case 'mock-tests':
        return <ContentEngineView onShowNotification={handleShowNotification} />;

      case 'practice':
      case 'practice-tests':
      case 'test-series':
      case 'test-taking':
        return (
          <PracticeHub
            onShowNotification={handleShowNotification}
            onNavigate={setActiveTab}
          />
        );

      case 'syllabus':
        return (
          <StudyHubContainer
            onShowNotification={handleShowNotification}
            activeTab="subjects"
          />
        );

      case 'lectures':
        return (
          <LectureTracker
            onShowNotification={handleShowNotification}
            onNavigate={setActiveTab}
          />
        );

      case 'focus-mode':
      case 'single-subject-focus':
      case 'planner-hub':
      case 'planner':
      case 'weekly-planner':
      case 'tasks':
      case 'calendar':
      case 'revision-schedule':
        return (
          <PlannerView
            onShowNotification={handleShowNotification}
            activeTab={activeTab}
          />
        );

      case 'analytics':
        // Global Analytics workspace — only reachable via Dashboard top navbar
        return <SmartAnalyticsView onShowNotification={handleShowNotification} />;

      case 'study-browser':
        return <StudyBrowserView onShowNotification={handleShowNotification} />;

      case 'reports':
        return <ReportsGenerator onShowNotification={handleShowNotification} />;

      case 'settings':
      case 'settings-themes':
      case 'settings-version':
      case 'settings-profile':
      case 'profile':
        return (
          <SettingsHub
            activeSection={
              activeTab === 'settings-themes'
                ? 'themes'
                : activeTab === 'settings-version'
                ? 'version'
                : activeTab === 'profile' || activeTab === 'settings-profile'
                ? 'academic-profile'
                : 'academic-profile'
            }
            onShowNotification={handleShowNotification}
            onNavigate={setActiveTab}
          />
        );

      case 'settings-exam-manager':
      case 'exam-manager':
        return (
          <ExamManager
            onShowNotification={handleShowNotification}
            onNavigate={setActiveTab}
          />
        );

      default:
        return (
          <OverviewDashboard
            onNavigate={setActiveTab}
            onShowNotification={handleShowNotification}
          />
        );
    }
  }, [activeTab, handleShowNotification]);

  if (isBooting) {
    return (
      <DesktopSplashScreen
        onComplete={() => setIsBooting(false)}
        onError={(err) => {
          console.error('Boot splash error:', err);
          setIsBooting(false);
        }}
      />
    );
  }

  return (
    <ExamProvider>
      <DesktopErrorBoundary>
        <DesktopFrame
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onShowNotification={handleShowNotification}
        >
          {renderActiveView()}
          <AIResultReviewModal />
        </DesktopFrame>
      </DesktopErrorBoundary>
    </ExamProvider>
  );
};

export default App;
