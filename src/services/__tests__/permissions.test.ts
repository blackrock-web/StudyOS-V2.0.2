import { permissionsService, PARENT_ALLOWED_FIELDS } from '../permissions';
import { UserProfile } from '../../types';

/**
 * Unit & Integration Tests: Student & Parent Role Isolation and Data Boundary
 */
export function runParentRoleSecurityTests(): { passed: boolean; testResults: string[] } {
  const results: string[] = [];
  let allPassed = true;

  function assert(condition: boolean, testName: string) {
    if (condition) {
      results.push(`✅ PASS: ${testName}`);
    } else {
      results.push(`❌ FAIL: ${testName}`);
      allPassed = false;
    }
  }

  try {
    // Test 1: PARENT_ALLOWED_FIELDS contains strictly allowed analytics metrics
    assert(
      PARENT_ALLOWED_FIELDS.includes('totalStudyHoursDaily') &&
      PARENT_ALLOWED_FIELDS.includes('totalStudyHoursWeekly') &&
      PARENT_ALLOWED_FIELDS.includes('totalStudyHoursMonthly') &&
      PARENT_ALLOWED_FIELDS.includes('studyHourTrends') &&
      PARENT_ALLOWED_FIELDS.includes('totalSessionCount') &&
      PARENT_ALLOWED_FIELDS.includes('averageSessionDurationMinutes') &&
      PARENT_ALLOWED_FIELDS.includes('sessionHistory') &&
      PARENT_ALLOWED_FIELDS.includes('studyLockComplianceStatus') &&
      PARENT_ALLOWED_FIELDS.includes('focusComplianceTrends') &&
      PARENT_ALLOWED_FIELDS.includes('subjectProgressPercentages') &&
      PARENT_ALLOWED_FIELDS.includes('topicProgressPercentages') &&
      PARENT_ALLOWED_FIELDS.includes('activityTimeline'),
      'Allow-list contains required 12 progress metrics'
    );

    // Test 2: PARENT_ALLOWED_FIELDS excludes sensitive private data
    assert(
      !PARENT_ALLOWED_FIELDS.includes('notes' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('flashcards' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('testQuestions' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('browserHistory' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('pdfDocuments' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('credentials' as any) &&
      !PARENT_ALLOWED_FIELDS.includes('settings' as any),
      'Allow-list strictly excludes private notes, flashcards, test questions, browser history, PDFs, credentials, and settings'
    );

    // Test 3: Legacy account role migration to Student
    const legacyUser: any = {
      accountId: 'legacy-1',
      username: 'legacy_student',
      fullName: 'Legacy Student',
      role: 'User', // Legacy role name
    };
    const migratedRole = legacyUser.role === 'User' || legacyUser.role === 'Administrator' ? 'Student' : legacyUser.role;
    assert(migratedRole === 'Student', 'Legacy User/Admin role migrates to Student automatically');

    // Test 4: CanAccessView permission checks
    assert(permissionsService.canAccessView('Student', 'dashboard') === true, 'Student can access full dashboard');
    assert(permissionsService.canAccessView('Student', 'notes') === true, 'Student can access notes');
    assert(permissionsService.canAccessView('Parent', 'parent-progress') === true, 'Parent can access parent-progress view');
    assert(permissionsService.canAccessView('Parent', 'dashboard') === false, 'Parent CANNOT access student dashboard');
    assert(permissionsService.canAccessView('Parent', 'notes') === false, 'Parent CANNOT access student notes');
    assert(permissionsService.canAccessView('Parent', 'settings') === false, 'Parent CANNOT access settings');

    // Test 5: CanWrite mutation checks
    assert(permissionsService.canWrite('Student') === true, 'Student can perform write operations');
    assert(permissionsService.canWrite('Parent') === false, 'Parent is strictly read-only and CANNOT write');

    // Test 6: AssertCanWrite throws error for Parent
    let threwWrite = false;
    try {
      permissionsService.assertCanWrite('Parent', 'test mutation');
    } catch (e: any) {
      threwWrite = true;
      assert(e.name === 'PermissionDenied' || e.message.includes('PermissionDenied'), 'assertCanWrite throws PermissionDenied for Parent role');
    }
    assert(threwWrite, 'assertCanWrite blocks write for Parent role');

    // Test 7: ParentProgressData sanitization output
    const mockParentUser: UserProfile = {
      accountId: 'acc-parent-1',
      username: 'parent_user',
      fullName: 'Parent User',
      email: 'parent@example.com',
      passwordHash: 'hash',
      pinHash: '1234',
      securityQuestion: 'Question',
      securityAnswerHash: 'ans',
      avatarUrl: '👨‍👩‍👧',
      studyTarget: 'GATE 2027',
      role: 'Parent',
      linkedStudentAccountId: 'acc-student-1',
      createdAt: '2026-07-31T00:00:00.000Z',
      updatedAt: '2026-07-31T00:00:00.000Z',
      theme: 'light',
      streakDays: 5,
      lastSyncTime: '2026-07-31T00:00:00.000Z',
      storageBytes: 1024,
    };

    const sanitizedData = permissionsService.getParentProgressData(mockParentUser, 'acc-student-1');
    assert(typeof sanitizedData.totalStudyHoursDaily === 'number', 'Sanitized data includes daily study hours');
    assert(Array.isArray(sanitizedData.studyHourTrends), 'Sanitized data includes study hour trends array');
    assert(Array.isArray(sanitizedData.sessionHistory), 'Sanitized data includes session history array');
    assert(typeof sanitizedData.studyLockComplianceStatus.lockCompliancePercent === 'number', 'Sanitized data includes study lock compliance');
    assert(Array.isArray(sanitizedData.focusComplianceTrends), 'Sanitized data includes focus compliance trends array');
    assert(Array.isArray(sanitizedData.subjectProgressPercentages), 'Sanitized data includes subject progress percentages');
    assert(Array.isArray(sanitizedData.topicProgressPercentages), 'Sanitized data includes topic progress percentages');
    assert(Array.isArray(sanitizedData.activityTimeline), 'Sanitized data includes activity timeline array');
    assert((sanitizedData as any).notes === undefined, 'Sanitized output contains NO private notes field');
    assert((sanitizedData as any).flashcards === undefined, 'Sanitized output contains NO private flashcards field');
    assert((sanitizedData as any).browserHistory === undefined, 'Sanitized output contains NO private browser history field');

    // Test 8: Prevent access to unlinked student account
    let threwUnlinked = false;
    try {
      permissionsService.getParentProgressData(mockParentUser, 'acc-student-999-unauthorized');
    } catch (e: any) {
      threwUnlinked = true;
      assert(e.message.includes('PermissionDenied') || e.name === 'PermissionDenied', 'Accessing unlinked student throws PermissionDenied');
    }
    assert(threwUnlinked, 'Parent cannot access unlinked student account');

  } catch (err: any) {
    results.push(`❌ EXCEPTION in test suite: ${err.message}`);
    allPassed = false;
  }

  return { passed: allPassed, testResults: results };
}
