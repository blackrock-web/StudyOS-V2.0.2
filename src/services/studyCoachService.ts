import { db, safeDispatch } from './db';

export interface CoachMessage {
  id: string;
  text: string;
  type: 'break_over' | 'idle_reminder' | 'session_start' | 'session_complete';
}

const BREAK_OVER_MESSAGES: string[] = [
  "Your break is over. Let's get back to studying. Start your next focus session and keep building consistency.",
  "Break time completed! Step back into your study flow and maintain your momentum toward your exam goal.",
  "Time to refocus. Great effort so far! Click start to launch your next focus sprint.",
  "Your break timer has finished. Dedicated practice creates AIR toppers. Begin your session now.",
];

const IDLE_REMINDER_MESSAGES: string[] = [
  "Coach Reminder: You have been on break for 5 minutes. Start your study session to stay on track today!",
  "Still resting? Small daily consistency builds great success. Click start to begin your focus session!",
  "Your study planner is waiting for you. Let's start the next session now and keep building discipline.",
  "Gentle reminder: You are close to your daily study target. Launch your focus session to keep momentum!",
];

const SESSION_START_MESSAGES: string[] = [
  "Welcome to your focus session! Stay locked in and eliminate all distractions.",
  "Focus session started. Dive deep into your study topics with full concentration!",
  "Session active. Step into deep work mode and master your concepts.",
];

const SESSION_COMPLETE_MESSAGES: string[] = [
  "Fantastic focus session completed! Great dedication to your study goals.",
  "Great work! Take a break now, and log a quick reflection note on what you learned.",
  "Session accomplished! Every focused minute brings you closer to GATE AIR success.",
];

class StudyCoachService {
  private currentAudioContext: AudioContext | null = null;
  private activeOscillators: OscillatorNode[] = [];
  private repeatTimer: any = null;
  private isAudioPlaying = false;
  private activeBannerMessage: { text: string; type: string } | null = null;
  private listeners: Set<(banner: { text: string; type: string } | null) => void> = new Set();

  public subscribeBanner(fn: (banner: { text: string; type: string } | null) => void): () => void {
    this.listeners.add(fn);
    fn(this.activeBannerMessage);
    return () => this.listeners.delete(fn);
  }

  private notifyBanner(banner: { text: string; type: string } | null) {
    this.activeBannerMessage = banner;
    this.listeners.forEach((fn) => fn(banner));
  }

  // --- 100% Offline Synthesizer Voice & Mentor Sound Engine ---
  public stopAudio() {
    try {
      this.activeOscillators.forEach((osc) => {
        try {
          osc.stop();
          osc.disconnect();
        } catch {}
      });
      this.activeOscillators = [];

      if (this.currentAudioContext) {
        this.currentAudioContext.close().catch(() => {});
        this.currentAudioContext = null;
      }
    } catch (e) {
      console.warn("Error stopping audio:", e);
    } finally {
      this.isAudioPlaying = false;
    }
  }

  public playMentorVoiceMessage(textMessage: string, onEnded?: () => void) {
    // 1. Prevent overlapping audio
    this.stopAudio();

    const settings = db.getSettings();
    const coachConfig = settings.studyCoachConfig;
    if (coachConfig && (!coachConfig.enabled || coachConfig.muted)) {
      if (onEnded) onEnded();
      return;
    }

    const volumePct = coachConfig?.volume ?? 85;

    // Try local audio file first, fallback to synthesized Web Audio voice cadence
    if (typeof window !== 'undefined') {
      try {
        const audio = new Audio('/sounds/coach_reminder.mp3');
        audio.volume = Math.max(0.05, Math.min(1.0, volumePct / 100));
        audio.onended = () => {
          this.isAudioPlaying = false;
          if (onEnded) onEnded();
        };
        const playPromise = audio.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              this.isAudioPlaying = true;
            })
            .catch(() => {
              // Local audio file not present or autoplay blocked -> synthesize Web Audio voice
              this.synthesizeWebAudioVoice(textMessage, volumePct, onEnded);
            });
          return;
        }
      } catch {
        // Fallthrough to synthesizer
      }
    }

    this.synthesizeWebAudioVoice(textMessage, volumePct, onEnded);
  }

  private synthesizeWebAudioVoice(textMessage: string, volumePct: number, onEnded?: () => void) {
    const masterGainValue = Math.max(0.01, Math.min(1.0, (volumePct / 100) * 0.4));

    try {
      if (typeof window === 'undefined') return;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      const audioCtx = new AudioCtx();
      this.currentAudioContext = audioCtx;
      this.isAudioPlaying = true;

      // Master gain node
      const masterGain = audioCtx.createGain();
      masterGain.gain.setValueAtTime(masterGainValue, audioCtx.currentTime);
      masterGain.connect(audioCtx.destination);

      // Intro Mentor Chime Motif (E4 -> G#4 -> B4 -> E5)
      const chimeNotes = [329.63, 415.3, 493.88, 659.25];
      chimeNotes.forEach((freq, idx) => {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + idx * 0.12);
        gain.gain.setValueAtTime(0, audioCtx.currentTime + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + idx * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + idx * 0.12 + 0.6);

        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(audioCtx.currentTime + idx * 0.12);
        osc.stop(audioCtx.currentTime + idx * 0.12 + 0.6);
        this.activeOscillators.push(osc);
      });

      // Mentor Voice Simulation Cadence (~12-16 seconds of structured speech formants)
      const speechStartTime = audioCtx.currentTime + 0.6;
      const syllablesCount = 32;
      const syllableDuration = 0.42;

      for (let i = 0; i < syllablesCount; i++) {
        const syllableTime = speechStartTime + i * syllableDuration;

        // Base vocal chord fundamental frequency (male/female mentor pitch: ~140-210Hz)
        const baseFreq = 160 + Math.sin(i * 0.6) * 22 + (i % 3 === 0 ? 15 : -10);

        // Vocal Formant 1 (Vowel resonance ~600-800Hz)
        const osc1 = audioCtx.createOscillator();
        const gain1 = audioCtx.createGain();
        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(baseFreq, syllableTime);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq * 1.08, syllableTime + syllableDuration * 0.8);

        // Formant filter
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(650 + (i % 4) * 120, syllableTime);
        filter.Q.setValueAtTime(3.5, syllableTime);

        gain1.gain.setValueAtTime(0.01, syllableTime);
        gain1.gain.linearRampToValueAtTime(0.22, syllableTime + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, syllableTime + syllableDuration - 0.02);

        osc1.connect(filter);
        filter.connect(gain1);
        gain1.connect(masterGain);

        osc1.start(syllableTime);
        osc1.stop(syllableTime + syllableDuration);
        this.activeOscillators.push(osc1);
      }

      // Outro Mentor Confirmation Chime
      const totalDurationSecs = 0.6 + syllablesCount * syllableDuration + 0.5;
      const outroTime = audioCtx.currentTime + totalDurationSecs - 0.6;

      const outroOsc = audioCtx.createOscillator();
      const outroGain = audioCtx.createGain();
      outroOsc.type = 'sine';
      outroOsc.frequency.setValueAtTime(523.25, outroTime); // C5
      outroOsc.frequency.exponentialRampToValueAtTime(659.25, outroTime + 0.3); // E5
      outroGain.gain.setValueAtTime(0, outroTime);
      outroGain.gain.linearRampToValueAtTime(0.25, outroTime + 0.05);
      outroGain.gain.exponentialRampToValueAtTime(0.001, outroTime + 0.8);

      outroOsc.connect(outroGain);
      outroGain.connect(masterGain);
      outroOsc.start(outroTime);
      outroOsc.stop(outroTime + 0.8);
      this.activeOscillators.push(outroOsc);

      // Auto stop after duration
      setTimeout(() => {
        this.isAudioPlaying = false;
        if (onEnded) onEnded();
      }, totalDurationSecs * 1000);

    } catch (err) {
      console.error("Mentor voice synthesis error:", err);
      this.isAudioPlaying = false;
      if (onEnded) onEnded();
    }
  }

  // --- Repeat Reminder Loop (Every 5 minutes until focus session starts) ---
  public startBreakOverReminderLoop() {
    this.cancelReminders();

    // 1. First break over message
    const msg = BREAK_OVER_MESSAGES[Math.floor(Math.random() * BREAK_OVER_MESSAGES.length)] || 'Break is over! Time to get back to focus.';
    this.notifyBanner({ text: msg, type: 'break_over' });
    this.playMentorVoiceMessage(msg);

    // 2. Schedule 5-minute repeating reminders
    const REPEAT_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

    this.repeatTimer = setInterval(() => {
      const repeatMsg = IDLE_REMINDER_MESSAGES[Math.floor(Math.random() * IDLE_REMINDER_MESSAGES.length)] || 'Your break ended. Resume your study timer!';
      this.notifyBanner({ text: repeatMsg, type: 'idle_reminder' });
      this.playMentorVoiceMessage(repeatMsg);
    }, REPEAT_INTERVAL_MS);
  }

  // Immediately cancel all pending repeat reminders and audio
  public cancelReminders() {
    if (this.repeatTimer) {
      clearInterval(this.repeatTimer);
      this.repeatTimer = null;
    }
    this.stopAudio();
    this.notifyBanner(null);
  }

  // --- Lifecycle Handlers ---
  public onFocusSessionStarted() {
    this.cancelReminders();

    const msg = SESSION_START_MESSAGES[Math.floor(Math.random() * SESSION_START_MESSAGES.length)] || 'Focus session started.';
    this.notifyBanner({ text: msg, type: 'session_start' });
    this.playMentorVoiceMessage(msg, () => {
      setTimeout(() => this.notifyBanner(null), 3000);
    });
  }

  public onFocusSessionCompleted(durationMins: number) {
    this.cancelReminders();

    const msg = SESSION_COMPLETE_MESSAGES[Math.floor(Math.random() * SESSION_COMPLETE_MESSAGES.length)] || 'Focus session completed.';
    this.notifyBanner({ text: msg, type: 'session_complete' });
    this.playMentorVoiceMessage(msg, () => {
      setTimeout(() => this.notifyBanner(null), 4000);
    });

    // Trigger automatic Post-Session Reflection Modal
    safeDispatch(
      new CustomEvent('studyos_open_post_session_modal', {
        detail: { durationMins },
      })
    );
  }

  public onBreakEnded() {
    this.startBreakOverReminderLoop();
  }

  public onBreakStarted() {
    this.cancelReminders();
    this.notifyBanner({ text: 'Break mode active. Take a breather and recharge.', type: 'break_started' });
  }

  public dismissBanner() {
    this.notifyBanner(null);
  }
}

export const studyCoachService = new StudyCoachService();
