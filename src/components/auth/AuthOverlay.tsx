import React, { useState } from 'react';
import {
  Lock,
  User,
  KeyRound,
  ShieldCheck,
  UserPlus,
  LogIn,
  Sparkles,
  HelpCircle,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import { authService, hashString } from '../../services/auth';
import { db } from '../../services/db';
import { UserProfile } from '../../types';

interface AuthOverlayProps {
  onAuthenticated: (user: UserProfile) => void;
  modeInitial?: 'lock' | 'signin' | 'signup' | 'forgot';
}

const AVATAR_PRESETS = [
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4Ij48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjY0IiBmaWxsPSIjOGI1Y2Y2Ii8+PHRleHQgeD0iNTAlIiB5PSI1NCUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWkiIGZvbnQtc2l6ZT0iNDgiIGZvbnQtd2VpZ2h0PSI3MDAiIGZpbGw9IndoaXRlIj5TPC90ZXh0Pjwvc3ZnPg==',
];

export const AuthOverlay: React.FC<AuthOverlayProps> = ({
  onAuthenticated,
  modeInitial = 'lock',
}) => {
  // Current accounts & user
  const accounts = authService.getAccounts();
  const currentUser = authService.getCurrentUser();

  const [viewMode, setViewMode] = useState<'lock' | 'signin' | 'signup' | 'forgot'>(() => {
    if (accounts.length === 0) return 'signup';
    return modeInitial;
  });
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');

  // Sign In Form State
  const [signInUsername, setSignInUsername] = useState<string>(currentUser?.username || '');
  const [signInPassword, setSignInPassword] = useState<string>('');

  // Lock Screen Form State
  const [lockPassword, setLockPassword] = useState<string>('');
  const [rememberMe, setRememberMe] = useState<boolean>(true);

  // Sign Up Form State
  const [fullName, setFullName] = useState<string>('');
  const [signUpUsername, setSignUpUsername] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [signUpPassword, setSignUpPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [signUpPin, setSignUpPin] = useState<string>('1234');
  const [signUpRole, setSignUpRole] = useState<'Student' | 'Parent'>('Student');
  const [parentLinkingCode, setParentLinkingCode] = useState<string>('');
  const [targetExamType, setTargetExamType] = useState<'GATE' | 'CUSTOM'>('GATE');
  const [dailyGoalHours, setDailyGoalHours] = useState<number>(6);
  const [securityQuestion, setSecurityQuestion] = useState<string>('What is your target GATE discipline?');
  const [securityAnswer, setSecurityAnswer] = useState<string>('');
  const [selectedAvatar, setSelectedAvatar] = useState<string>(AVATAR_PRESETS[0] || '👨‍🎓');
  const [studyTarget, setStudyTarget] = useState<string>('Computer Science & Data Science');

  // Forgot Password Form State
  const [forgotUsername, setForgotUsername] = useState<string>('');
  const [forgotAnswer, setForgotAnswer] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');

  // Password strength calculation
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-slate-200' };
    let score = 0;
    if (pass.length >= 6) score++;
    if (pass.length >= 10) score++;
    if (/[A-Z]/.test(pass)) score++;
    if (/[0-9]/.test(pass)) score++;
    if (/[^A-Za-z0-9]/.test(pass)) score++;

    if (score <= 2) return { score: 1, label: 'Weak', color: 'bg-rose-500' };
    if (score <= 4) return { score: 2, label: 'Medium', color: 'bg-amber-500' };
    return { score: 3, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = getPasswordStrength(signUpPassword);
  const [unlockType, setUnlockType] = useState<'password' | 'pin'>('pin');
  const [pinDigits, setPinDigits] = useState<string>('');
  const [forceChangePass, setForceChangePass] = useState<boolean>(false);
  const [forcedNewPass, setForcedNewPass] = useState<string>('');
  const [forcedNewPin, setForcedNewPin] = useState<string>('');

  // --- HANDLERS (async secure hashing) ---
  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const attempt = unlockType === 'pin' ? pinDigits : lockPassword;
    const ok = await authService.unlockWorkspace(attempt);
    if (ok) {
      if (currentUser.mustChangePassword) {
        setForceChangePass(true);
      } else {
        onAuthenticated(currentUser);
      }
    } else {
      setErrorMessage(unlockType === 'pin' ? 'Incorrect 4-Digit PIN.' : 'Incorrect password.');
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    const user = await authService.authenticate(signInUsername, signInPassword, rememberMe);
    if (user) {
      if (user.mustChangePassword) {
        setForceChangePass(true);
      } else {
        onAuthenticated(user);
      }
    } else {
      setErrorMessage('Invalid username, password, or PIN.');
    }
  };

  const handleForcedPasswordChangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (forcedNewPass.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }
    if (!/^\d{4}$/.test(forcedNewPin)) {
      setErrorMessage('4-Digit PIN must be exactly 4 numbers.');
      return;
    }
    const resP = await authService.changePassword(signInPassword || lockPassword, forcedNewPass);
    const resPIN = await authService.changePin(forcedNewPin);
    if (resP.success && resPIN.success) {
      const updated = authService.getCurrentUser();
      setForceChangePass(false);
      onAuthenticated(updated);
    } else {
      setErrorMessage(resP.message || resPIN.message);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const trimmedFullName = fullName.trim();
      const trimmedUsername = signUpUsername.trim();
      const trimmedSecurityAnswer = securityAnswer.trim();

      if (!trimmedFullName) {
        setErrorMessage('Full Name is required.');
        return;
      }

      if (!trimmedUsername) {
        setErrorMessage('Username is required.');
        return;
      }

      if (trimmedUsername.length < 3) {
        setErrorMessage('Username must be at least 3 characters long.');
        return;
      }

      if (!signUpPassword) {
        setErrorMessage('Password is required.');
        return;
      }

      if (signUpPassword.length < 8) {
        setErrorMessage('Password must be at least 8 characters long.');
        return;
      }

      if (signUpPassword !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      if (!/^\d{4}$/.test(signUpPin)) {
        setErrorMessage('Security PIN must be exactly 4 digits.');
        return;
      }

      if (!trimmedSecurityAnswer) {
        setErrorMessage('Security Answer is required for password recovery.');
        return;
      }

      let res: { success: boolean; message: string; user?: UserProfile };

      if (signUpRole === 'Parent') {
        if (!parentLinkingCode.trim()) {
          setErrorMessage('Parent Linking Code is required to create a Parent Viewer profile.');
          return;
        }
        res = await authService.createParentAccount({
          fullName: trimmedFullName,
          username: trimmedUsername,
          password: signUpPassword,
          pin: signUpPin,
          securityQuestion,
          securityAnswer: trimmedSecurityAnswer,
          linkingCode: parentLinkingCode.trim(),
          avatarUrl: selectedAvatar,
        });
      } else {
        res = await authService.createAccount({
          fullName: trimmedFullName,
          username: trimmedUsername,
          email,
          password: signUpPassword,
          pin: signUpPin,
          securityQuestion,
          securityAnswer: trimmedSecurityAnswer,
          avatarUrl: selectedAvatar,
          studyTarget: targetExamType === 'GATE' ? 'GATE 2027 CS & DA' : 'Custom Exam Workspace',
          targetExamType,
          targetExamDate: '2027-02-07',
          dailyGoalHours,
          role: 'Student',
        });
      }

      if (res.success && res.user) {
        try {
          db.initializeExamWorkspace(targetExamType, '2027-02-07', dailyGoalHours);
        } catch (dbErr) {
          console.warn('Workspace initialization warning:', dbErr);
        }
        await authService.authenticate(trimmedUsername, signUpPassword, true);
        setSuccessMessage('Account created successfully! Initializing workspace...');
        const authedUser = res.user;
        setTimeout(() => {
          onAuthenticated(authedUser);
        }, 300);
      } else {
        setErrorMessage(res.message || 'Failed to create account. Please try again.');
      }
    } catch (err: unknown) {
      console.error('Signup error:', err);
      setErrorMessage(err instanceof Error ? err.message : 'An unexpected error occurred during account registration.');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (!forgotUsername || !forgotAnswer || !newPassword) {
      setErrorMessage('Please complete all fields.');
      return;
    }
    if (newPassword.length < 8) {
      setErrorMessage('New password must be at least 8 characters.');
      return;
    }

    const success = await authService.resetPasswordWithSecurityAnswer(forgotUsername, forgotAnswer, newPassword);
    if (success) {
      setSuccessMessage('Password reset successfully! Please sign in.');
      setTimeout(() => {
        setSignInUsername(forgotUsername);
        setViewMode('signin');
      }, 1200);
    } else {
      setErrorMessage('Security answer or username did not match.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 font-sans select-none animate-fadeIn">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-purple-100 overflow-hidden relative">
        {/* Top Decorative Gradient Banner */}
        <div className="h-3 bg-gradient-to-r from-purple-600 via-pink-600 to-rose-500" />

        <div className="p-8">
          {/* Logo & Header */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/25 mb-3 font-extrabold text-2xl">
              S
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">StudyOS Desktop</h1>
            <p className="text-xs font-semibold text-purple-600 mt-0.5 flex items-center justify-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" /> 100% Offline Local Security Architecture
            </p>
          </div>

          {/* Feedback Messages */}
          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2 animate-shake">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* FORCED PASSWORD & PIN CHANGE OVERLAY */}
          {forceChangePass && (
            <form onSubmit={handleForcedPasswordChangeSubmit} className="space-y-4">
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900">
                <div className="flex items-center gap-2 font-bold text-sm mb-1">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span>Mandatory Initial Credentials Change</span>
                </div>
                <p className="text-xs text-amber-700">
                  This account is using initial default security credentials. Please update your password and 4-digit PIN to secure your isolated workspace.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password (Min 6 characters)</label>
                <input
                  type="password"
                  value={forcedNewPass}
                  onChange={(e) => setForcedNewPass(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New 4-Digit Security PIN</label>
                <input
                  type="text"
                  maxLength={4}
                  value={forcedNewPin}
                  onChange={(e) => setForcedNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="1234"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm text-center tracking-widest font-mono text-base focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Save New Credentials & Access Workspace</span>
              </button>
            </form>
          )}

          {/* MODE 1: LOCK SCREEN */}
          {!forceChangePass && viewMode === 'lock' && (
            <form onSubmit={handleUnlock} className="space-y-4">
              <div className="text-center bg-purple-50/60 p-4 rounded-2xl border border-purple-100">
                <div className="relative inline-block mb-2">
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.fullName}
                    className="w-20 h-20 rounded-full object-cover border-4 border-white shadow-md mx-auto"
                  />
                  <div className="absolute bottom-0 right-0 p-1 bg-purple-600 text-white rounded-full border-2 border-white">
                    <Lock className="w-3 h-3" />
                  </div>
                </div>
                <h2 className="text-base font-bold text-slate-900">{currentUser.fullName}</h2>
                <div className="flex items-center justify-center gap-2 text-xs text-slate-500 mt-0.5">
                  <span>@{currentUser.username}</span>
                  <span>•</span>
                  <span className="px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px]">
                    {currentUser.role || 'User'}
                  </span>
                </div>
              </div>

              {/* Unlock Mode Toggle (PIN vs Password) */}
              <div className="flex p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setUnlockType('pin');
                    setErrorMessage('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    unlockType === 'pin' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  4-Digit PIN
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnlockType('password');
                    setErrorMessage('');
                  }}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    unlockType === 'password' ? 'bg-white text-purple-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Account Password
                </button>
              </div>

              {unlockType === 'pin' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 text-center">
                    Enter 4-Digit Security PIN
                  </label>
                  <div className="relative max-w-[200px] mx-auto">
                    <input
                      type="password"
                      maxLength={4}
                      value={pinDigits}
                      onChange={(e) => setPinDigits(e.target.value.replace(/\D/g, ''))}
                      placeholder="••••"
                      required
                      autoFocus
                      className="w-full text-center py-2.5 px-4 text-2xl font-mono tracking-widest rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">Enter Password to Unlock</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={lockPassword}
                      onChange={(e) => setLockPassword(e.target.value)}
                      placeholder="••••••••••••"
                      required
                      autoFocus
                      className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2"
              >
                <span>Unlock Workspace</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between pt-2 text-xs">
                <button
                  type="button"
                  onClick={() => setViewMode('signin')}
                  className="text-purple-600 hover:underline font-semibold"
                >
                  Switch Account / Sign In
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('signup')}
                  className="text-slate-500 hover:text-slate-800 font-medium"
                >
                  Create New Account
                </button>
              </div>
            </form>
          )}

          {/* MODE 2: SIGN IN */}
          {viewMode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-slate-900">Sign In to StudyOS</h2>
                <p className="text-xs text-slate-500">Select an existing account or enter credentials</p>
              </div>

              {/* Account Quick Switcher */}
              {accounts.length > 0 && (
                <div className="mb-4">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2">
                    Quick Account Switcher
                  </span>
                  <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar">
                    {accounts.map((acc) => (
                      <button
                        key={acc.accountId}
                        type="button"
                        onClick={() => {
                          setSignInUsername(acc.username);
                          authService.switchAccount(acc.accountId);
                        }}
                        className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium shrink-0 transition-all ${
                          signInUsername.toLowerCase() === acc.username.toLowerCase()
                            ? 'bg-purple-50 border-purple-300 text-purple-700 font-bold'
                            : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <img src={acc.avatarUrl} alt={acc.fullName} className="w-5 h-5 rounded-full object-cover" />
                        <span>@{acc.username}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                <div className="relative">
                  <input
                    type="text"
                    value={signInUsername}
                    onChange={(e) => setSignInUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    required
                    className="w-full px-3.5 py-2.5 pl-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotUsername(signInUsername);
                      setViewMode('forgot');
                    }}
                    className="text-[11px] font-semibold text-purple-600 hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={signInPassword}
                    onChange={(e) => setSignInPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full px-3.5 py-2.5 pl-10 pr-10 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center space-x-2 text-xs font-medium text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500"
                  />
                  <span>Remember session on this device</span>
                </label>
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>Sign In</span>
              </button>

              <div className="text-center pt-2">
                <p className="text-xs text-slate-500">
                  Don't have a profile yet?{' '}
                  <button
                    type="button"
                    onClick={() => setViewMode('signup')}
                    className="text-purple-600 font-bold hover:underline"
                  >
                    Create Account
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE 3: CREATE ACCOUNT */}
          {viewMode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
              <div className="text-center mb-1">
                <h2 className="text-lg font-bold text-slate-900">Create Offline Profile</h2>
                <p className="text-xs text-slate-500">Your data stays 100% isolated on your local machine</p>
              </div>

              {/* Avatar Photo Selector & Upload */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Profile Photo / Avatar</label>
                <div className="flex items-center space-x-3">
                  <img src={selectedAvatar} alt="Avatar" className="w-12 h-12 rounded-full object-cover border-2 border-purple-500 shadow-sm shrink-0" />
                  <div className="flex flex-col gap-1.5 flex-1">
                    <div className="flex gap-1.5 overflow-x-auto">
                      {AVATAR_PRESETS.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setSelectedAvatar(url)}
                          className={`w-7 h-7 rounded-full overflow-hidden border-2 transition-all ${
                            selectedAvatar === url ? 'border-purple-600 ring-2 ring-purple-600/30' : 'border-transparent opacity-70 hover:opacity-100'
                          }`}
                        >
                          <img src={url} alt={`Preset ${i}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                    <label className="cursor-pointer inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg hover:bg-purple-200 transition-colors w-fit">
                      <span>📁 Upload Photo</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (evt) => {
                              if (evt.target?.result) {
                                setSelectedAvatar(evt.target.result as string);
                              }
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Full Name *</label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. John Doe"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Username *</label>
                  <input
                    type="text"
                    value={signUpUsername}
                    onChange={(e) => setSignUpUsername(e.target.value)}
                    placeholder="e.g. johndoe"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john.doe@gate2027.edu"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">4-Digit Security PIN *</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={signUpPin}
                    onChange={(e) => setSignUpPin(e.target.value.replace(/\D/g, ''))}
                    placeholder="1234"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-center tracking-widest focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Password *</label>
                  <input
                    type="password"
                    value={signUpPassword}
                    onChange={(e) => setSignUpPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Confirm Password *</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                  />
                </div>
              </div>

              {/* Password Strength Indicator */}
              {signUpPassword && (
                <div className="flex items-center space-x-2 text-[11px]">
                  <span className="text-slate-500 font-medium">Strength:</span>
                  <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden flex gap-1">
                    <div className={`h-full flex-1 ${strength.color}`} />
                    <div className={`h-full flex-1 ${strength.score >= 2 ? strength.color : 'bg-slate-200'}`} />
                    <div className={`h-full flex-1 ${strength.score >= 3 ? strength.color : 'bg-slate-200'}`} />
                  </div>
                  <span className="font-bold text-slate-700">{strength.label}</span>
                </div>
              )}

              {/* Account Role & Exam Workspace Selector */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Account Role *</label>
                  <select
                    value={signUpRole}
                    onChange={(e) => setSignUpRole(e.target.value as 'Student' | 'Parent')}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 bg-white"
                  >
                    <option value="Student">Student (Full Access)</option>
                    <option value="Parent">Parent Viewer (Read-Only)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">Target Exam Workspace *</label>
                  <select
                    value={targetExamType}
                    onChange={(e) => setTargetExamType(e.target.value as 'GATE' | 'CUSTOM')}
                    disabled={signUpRole === 'Parent'}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 bg-white disabled:opacity-50"
                  >
                    <option value="GATE">GATE 2027 (CS & DA)</option>
                    <option value="CUSTOM">Custom Exam Workspace</option>
                  </select>
                </div>
              </div>

              {/* Conditional Parent Linking Code Input */}
              {signUpRole === 'Parent' && (
                <div className="bg-purple-50 p-3 rounded-xl border border-purple-200 space-y-1">
                  <label className="block text-[11px] font-bold text-purple-900">
                    Parent Linking Code *
                  </label>
                  <input
                    type="text"
                    value={parentLinkingCode}
                    onChange={(e) => setParentLinkingCode(e.target.value.toUpperCase())}
                    placeholder="e.g. P-X7K9M2"
                    required
                    className="w-full px-3 py-2 rounded-lg border border-purple-300 font-mono font-bold text-purple-900 tracking-wider text-xs uppercase focus:ring-2 focus:ring-purple-600/30 bg-white"
                  />
                  <p className="text-[10px] text-purple-700">
                    Get this code from the Student account under Settings &gt; Parent Viewer Access.
                  </p>
                </div>
              )}

              {/* Security Question */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Security Question (For Password Reset)</label>
                <select
                  value={securityQuestion}
                  onChange={(e) => setSecurityQuestion(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600 bg-white"
                >
                  <option value="What is your target GATE discipline?">What is your target GATE discipline?</option>
                  <option value="What is your favorite Computer Science subject?">What is your favorite CS subject?</option>
                  <option value="What was the name of your first school?">What was the name of your first school?</option>
                  <option value="What is your target GATE rank?">What is your target GATE rank?</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Security Answer *</label>
                <input
                  type="text"
                  value={securityAnswer}
                  onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="Your secret security answer..."
                  required
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2 mt-2"
              >
                <UserPlus className="w-4 h-4" />
                <span>Create Account & Initialize Workspace</span>
              </button>

              <div className="text-center pt-1">
                <p className="text-xs text-slate-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setViewMode('signin')}
                    className="text-purple-600 font-bold hover:underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>
            </form>
          )}

          {/* MODE 4: FORGOT PASSWORD */}
          {viewMode === 'forgot' && (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="text-center mb-2">
                <h2 className="text-lg font-bold text-slate-900">Reset Account Password</h2>
                <p className="text-xs text-slate-500">Verify your security question answer to create a new password</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  value={forgotUsername}
                  onChange={(e) => setForgotUsername(e.target.value)}
                  placeholder="e.g. johndoe"
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Security Question Answer</label>
                <input
                  type="text"
                  value={forgotAnswer}
                  onChange={(e) => setForgotAnswer(e.target.value)}
                  placeholder="Enter answer..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">New Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password..."
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:ring-2 focus:ring-purple-600/20 focus:border-purple-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 px-4 rounded-xl text-white font-bold text-sm bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-600/20 hover:opacity-95 active:scale-98 transition-all flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reset Password</span>
              </button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setViewMode('signin')}
                  className="text-xs text-purple-600 font-bold hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
