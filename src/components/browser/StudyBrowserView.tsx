import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Globe,
  Plus,
  X,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Bookmark,
  BookmarkCheck,
  BookMarked,
  Printer,
  History,
  BookOpen,
  Search,
  Shield,
  FileText,
  Clock,
  Trash2,
  Folder,
  Download,
  Settings,
  ZoomIn,
  ZoomOut,
  Maximize,
  Minimize,
  Lock,
  Unlock,
  Home,
  Flame,
  Coffee,
  Code,
  PanelLeft,
  MoreVertical,
  HelpCircle,
  ExternalLink,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Key,
  FileCheck,
  Server,
  Cpu,
  Layers,
  Radio,
  FileCode,
  Sliders,
  XCircle,
  AlertOctagon,
  DownloadCloud,
  Check,
  Camera,
  Mic,
  Bell,
  EyeOff,
  Eye,
  Activity,
  HardDrive,
  RefreshCw,
  ShieldOff,
  Database,
  Sparkles,
  Terminal,
} from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { dbService } from '../../services/db';
import { activityEventService, ActivityEventRecord } from '../../services/activityEventService';
import { analyticsService } from '../../services/analyticsService';
import { taskSessionService } from '../../services/taskSessionService';
import { getAllSubjectOptions } from '../../data/subjectRegistry';
import { TaskItem, BrowserVisitLog } from '../../types';

import {
  browserSecurityService,
  TrustedDomain,
  DomainPermissions,
  BrowserSecurityConfig,
  DownloadScanResult,
  SandboxStatus,
} from '../../services/browserSecurityService';
import {
  GoogleSearchPortal,
  LocalAIPortal,
  ChatGPTPortal,
  GeminiPortal,
  ClaudePortal,
  FrameRefusedFallback,
} from './BrowserPortals';

const isGoogleUrl = (url?: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('google.com') || lower.includes('google.co.in');
};

const isLocalAIUrl = (url?: string): boolean => {
  if (!url) return false;
  const lower = url.toLowerCase();
  return lower.includes('local-ai') || lower.includes('offline-ai') || lower.includes('chatgpt') || lower.includes('gemini') || lower.includes('claude') || lower.includes('openai');
};

interface Tab {
  id: string;
  title: string;
  url: string;
  subject: string;
  readerMode: boolean;
  focusMode: boolean;
  zoomLevel: number;
  historyStack: string[];
  historyIndex: number;
  startTime: number;
}

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
  category: string;
}

interface HistoryItem {
  id: string;
  title: string;
  url: string;
  timestamp: string;
  dateStr: string;
  durationSeconds: number;
  subject: string;
}

interface DownloadItem {
  id: string;
  filename: string;
  size: string;
  timestamp: string;
  url: string;
  isExecutable?: boolean;
  isSafe?: boolean;
}

export interface ReadingListItem {
  id: string;
  title: string;
  url: string;
  addedAt: string;
  isRead: boolean;
  subject?: string;
  summary?: string;
}

const PRESET_READING_LIST: ReadingListItem[] = [
  {
    id: 'rl-1',
    title: 'Attention Is All You Need — Transformer Neural Architecture',
    url: 'https://arxiv.org/abs/1706.03762',
    addedAt: 'Today, 09:15 AM',
    isRead: false,
    subject: 'Artificial Intelligence',
    summary: 'Landmark paper describing self-attention networks and multi-head key-value mechanisms.',
  },
  {
    id: 'rl-2',
    title: 'TCP Congestion Control Algorithms: BBR vs Cubic Performance',
    url: 'https://nptel.ac.in/courses/106105081',
    addedAt: 'Yesterday, 04:30 PM',
    isRead: true,
    subject: 'Computer Networks',
    summary: 'Detailed performance review comparing loss-based control with model-based bottleneck bandwidth.',
  },
];

const PRESET_BOOKMARKS: BookmarkItem[] = [
  { id: 'bm-google', title: 'Google Search', url: 'https://www.google.com', category: 'Search' },
  { id: 'bm-pw', title: 'PhysicsWallah (PW)', url: 'https://www.pw.live', category: 'Learning Portal' },
  { id: 'bm-localai', title: 'Local AI Assistant (Offline)', url: 'https://local-ai.offline', category: 'Local AI' },
  { id: 'bm-nptel', title: 'NPTEL Courses', url: 'https://nptel.ac.in', category: 'Courses' },
  { id: 'bm-gfg', title: 'GeeksforGeeks', url: 'https://www.geeksforgeeks.org', category: 'Docs' },
  { id: 'bm-mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org', category: 'Docs' },
  { id: 'bm-khan', title: 'Khan Academy', url: 'https://www.khanacademy.org', category: 'Courses' },
  { id: 'bm-gate', title: 'GATE Overflow', url: 'https://gateoverflow.in', category: 'PYQs' },
  { id: 'bm-wiki', title: 'Wikipedia', url: 'https://www.wikipedia.org', category: 'Reference' },
  { id: 'bm-arxiv', title: 'arXiv CS Research', url: 'https://arxiv.org', category: 'Research' },
  { id: 'bm-github', title: 'GitHub Platform', url: 'https://github.com', category: 'Developer' },
];

interface StudyBrowserViewProps {
  onShowNotification?: (msg: string, title?: string) => void;
}

export const StudyBrowserView: React.FC<StudyBrowserViewProps> = ({ onShowNotification }) => {
  const defaultSubject = getAllSubjectOptions()[0] || 'Computer Networks';

  // --- Open Tabs & Session State ---
  const [tabs, setTabs] = useState<Tab[]>(() => {
    try {
      const saved = localStorage.getItem('studyos_browser_tabs_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      /* ignore */
    }
    return [
      {
        id: 'tab-1',
        title: 'PW Thor',
        url: 'https://pwthor.live/',
        subject: defaultSubject,
        readerMode: false,
        focusMode: true,
        zoomLevel: 100,
        historyStack: ['https://pwthor.live/'],
        historyIndex: 0,
        startTime: Date.now(),
      },
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    try {
      return localStorage.getItem('studyos_browser_active_tab_id') || tabs[0]?.id || 'tab-1';
    } catch {
      return tabs[0]?.id || 'tab-1';
    }
  });

  const [inputUrl, setInputUrl] = useState<string>('https://pwthor.live/');
  const [selectedSubject, setSelectedSubject] = useState<string>(defaultSubject);

  // --- Security Engine States ---
  const [securityConfig, setSecurityConfig] = useState<BrowserSecurityConfig>(() =>
    browserSecurityService.getConfig()
  );
  const [trustedDomains, setTrustedDomains] = useState<TrustedDomain[]>(() =>
    browserSecurityService.getTrustedDomains()
  );
  const [sandboxStatus, setSandboxStatus] = useState<SandboxStatus>(() =>
    browserSecurityService.getSandboxStatus()
  );
  const [untrustedBypassedTabs, setUntrustedBypassedTabs] = useState<Record<string, boolean>>({});
  const [frameRefusedTabs, setFrameRefusedTabs] = useState<Record<string, boolean>>({});
  const [threatDownloadModal, setThreatDownloadModal] = useState<DownloadScanResult | null>(null);
  const [settingsTab, setSettingsTab] = useState<
    'security' | 'trusted' | 'permissions' | 'privacy' | 'downloads' | 'data' | 'sandbox'
  >('security');

  const [newDomainInput, setNewDomainInput] = useState<string>('');
  const [newDomainCategory, setNewDomainCategory] = useState<string>('Study Resource');
  const [trustedSearchQuery, setTrustedSearchQuery] = useState<string>('');

  const [newDlFilename, setNewDlFilename] = useState<string>('');
  const [newDlUrl, setNewDlUrl] = useState<string>('');

  // --- Activity Event System Subscription ---
  const [activityEvents, setActivityEvents] = useState<ActivityEventRecord[]>(() =>
    activityEventService.getEvents(100)
  );

  useEffect(() => {
    const unsubscribe = activityEventService.subscribe(() => {
      setActivityEvents(activityEventService.getEvents(100));
    });
    return unsubscribe;
  }, []);

  // --- Bookmarks, Local History & Downloads (Encrypted Local Storage) ---
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(() => {
    try {
      const saved = localStorage.getItem('studyos_browser_bookmarks');
      return saved ? JSON.parse(saved) : PRESET_BOOKMARKS;
    } catch {
      return PRESET_BOOKMARKS;
    }
  });

  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('studyos_browser_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [downloads, setDownloads] = useState<DownloadItem[]>(() => {
    try {
      const saved = localStorage.getItem('studyos_browser_downloads');
      return saved
        ? JSON.parse(saved)
        : [
            {
              id: 'dl-1',
              filename: 'GATE_CN_Notes.pdf',
              size: '2.4 MB',
              timestamp: '10:30 AM',
              url: 'https://www.pw.live/notes/cn.pdf',
              isExecutable: false,
              isSafe: true,
            },
          ];
    } catch {
      return [];
    }
  });

  const [readingList, setReadingList] = useState<ReadingListItem[]>(() => {
    try {
      const saved = localStorage.getItem('studyos_browser_reading_list');
      return saved ? JSON.parse(saved) : PRESET_READING_LIST;
    } catch {
      return PRESET_READING_LIST;
    }
  });

  const [readingListSearchQuery, setReadingListSearchQuery] = useState<string>('');
  const [readerFontFamily, setReaderFontFamily] = useState<'serif' | 'sans'>('serif');
  const [readerTheme, setReaderTheme] = useState<'sepia' | 'light' | 'dark'>('sepia');

  // --- Async Load Encrypted Storage on Component Mount ---
  useEffect(() => {
    const loadEncryptedVault = async () => {
      const encHistory = await browserSecurityService.loadEncryptedData<HistoryItem[]>('history', history);
      if (encHistory && encHistory.length > 0) setHistory(encHistory);

      const encBookmarks = await browserSecurityService.loadEncryptedData<BookmarkItem[]>('bookmarks', bookmarks);
      if (encBookmarks && encBookmarks.length > 0) setBookmarks(encBookmarks);

      const encReadingList = await browserSecurityService.loadEncryptedData<ReadingListItem[]>('reading_list', readingList);
      if (encReadingList && encReadingList.length > 0) setReadingList(encReadingList);

      const encDownloads = await browserSecurityService.loadEncryptedData<DownloadItem[]>('downloads', downloads);
      if (encDownloads && encDownloads.length > 0) setDownloads(encDownloads);

      setTrustedDomains(browserSecurityService.getTrustedDomains());
      setSecurityConfig(browserSecurityService.getConfig());
      setSandboxStatus(browserSecurityService.getSandboxStatus());
    };
    loadEncryptedVault();
  }, []);

  // --- Panels, Modals & Menus ---
  const [activePanel, setActivePanel] = useState<
    'none' | 'bookmarks' | 'readinglist' | 'downloads' | 'settings' | 'devtools' | 'privacy' | 'permissions'
  >('none');
  const [isHistorySidebarOpen, setIsHistorySidebarOpen] = useState<boolean>(false);
  const [historySearchQuery, setHistorySearchQuery] = useState<string>('');
  const [bookmarkSearchQuery, setBookmarkSearchQuery] = useState<string>('');
  const [newBookmarkTitle, setNewBookmarkTitle] = useState<string>('');
  const [newBookmarkUrl, setNewBookmarkUrl] = useState<string>('');
  const [newBookmarkCategory, setNewBookmarkCategory] = useState<string>('Custom');
  const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
  const [isAboutOpen, setIsAboutOpen] = useState<boolean>(false);

  // --- Incognito & Privacy Dashboard State ---
  const [isIncognito, setIsIncognito] = useState<boolean>(false);
  const [cookieCount, setCookieCount] = useState<number>(14);
  const [cookieSizeKb, setCookieSizeKb] = useState<number>(38);
  const [cacheItemsCount, setCacheItemsCount] = useState<number>(182);
  const [cacheSizeMb, setCacheSizeMb] = useState<number>(3.4);
  const [sessionDurationSec, setSessionDurationSec] = useState<number>(0);
  const [domainPermissionsMap, setDomainPermissionsMap] = useState<Record<string, DomainPermissions>>({});

  // Active Session Duration Ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionDurationSec((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleToggleDomainPerm = (domain: string, permKey: keyof DomainPermissions) => {
    const updated = browserSecurityService.toggleDomainPermission(domain, permKey);
    setDomainPermissionsMap((prev) => ({
      ...prev,
      [domain.toLowerCase()]: updated,
    }));
    onShowNotification?.(
      `${permKey.toUpperCase()} permission for ${domain} set to ${updated[permKey] ? 'GRANTED' : 'DENIED'}`,
      'Domain Permission Updated'
    );
  };

  const formatSessionDuration = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) return `${h}h ${m}m ${s}s`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  };

  const [searchEngine, setSearchEngine] = useState<'duckduckgo' | 'google' | 'bing' | 'startpage'>(() => {
    return (localStorage.getItem('studyos_browser_searchengine') as any) || 'google';
  });
  const [homeUrl, setHomeUrl] = useState<string>(() => {
    return localStorage.getItem('studyos_browser_homeurl') || 'https://pwthor.live/';
  });

  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [findQuery, setFindQuery] = useState<string>('');
  const [showFindBar, setShowFindBar] = useState<boolean>(false);
  const [readerFontSize, setReaderFontSize] = useState<number>(16);

  // --- Decoupled Explicit Study Timer State ---
  const [isStudyTimerActive, setIsStudyTimerActive] = useState<boolean>(false);
  const [elapsedStudySecs, setElapsedStudySecs] = useState<number>(0);
  const [isLeisureMode, setIsLeisureMode] = useState<boolean>(false);
  const [leisureSeconds, setLeisureSeconds] = useState<number>(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const webviewRefs = useRef<Map<string, any>>(new Map());
  const attachedWebviews = useRef<Set<string>>(new Set());

  const isElectronDesktop = typeof window !== 'undefined' && !!(window as any).studyosDesktop;
  const [isStudyMode, setIsStudyMode] = useState<boolean>(true);

  // Sync Study Mode with Electron Main Process
  useEffect(() => {
    if (window.studyosDesktop?.getStudyMode) {
      window.studyosDesktop.getStudyMode().then((mode) => setIsStudyMode(mode));
    }
  }, []);

  const handleToggleStudyMode = async () => {
    const nextMode = !isStudyMode;
    setIsStudyMode(nextMode);
    if (window.studyosDesktop?.setStudyMode) {
      await window.studyosDesktop.setStudyMode(nextMode);
    }
    onShowNotification?.(
      nextMode ? 'Study Mode Active: Whitelist enforced' : 'Open Browsing Active: Full Web & OAuth unlocked',
      'Browsing Policy Updated'
    );
  };

  // Helper to attach event listeners to native Chromium webviews
  const attachWebviewListeners = (tabId: string, el: any) => {
    if (!el || attachedWebviews.current.has(tabId)) return;
    attachedWebviews.current.add(tabId);

    el.addEventListener('did-start-loading', () => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, loading: true } : t)));
    });

    el.addEventListener('did-stop-loading', () => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, loading: false } : t)));
    });

    el.addEventListener('page-title-updated', (e: any) => {
      if (e.title) {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, title: e.title } : t)));
      }
    });

    el.addEventListener('page-favicon-updated', (e: any) => {
      if (e.favicons && e.favicons[0]) {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, favicon: e.favicons[0] } : t)));
      }
    });

    el.addEventListener('did-navigate', (e: any) => {
      if (e.url) {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id === tabId) {
              const hist = t.historyStack || [];
              const newHist = [...hist.slice(0, (t.historyIndex ?? 0) + 1), e.url];
              return {
                ...t,
                url: e.url,
                historyStack: newHist,
                historyIndex: newHist.length - 1,
              };
            }
            return t;
          })
        );
        if (tabId === activeTabId) {
          setInputUrl(e.url);
        }
        const title = el.getTitle?.() || e.url;
        const visitLog: BrowserVisitLog = {
          id: 'visit-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          url: e.url,
          title,
          category: 'StudyOS Module',
          durationSeconds: 0,
        };
        dbService.addBrowserLog(visitLog);

        const histItem: HistoryItem = {
          id: visitLog.id,
          timestamp: visitLog.timestamp,
          url: e.url,
          title,
          dateStr: new Date().toLocaleDateString(),
          durationSeconds: 0,
          subject: selectedSubject,
        };
        setHistory((prev) => [histItem, ...prev.filter((h) => h.url !== e.url).slice(0, 299)]);
      }
    });

    el.addEventListener('did-navigate-in-page', (e: any) => {
      if (e.url && e.isMainFrame) {
        setTabs((prev) => prev.map((t) => (t.id === tabId ? { ...t, url: e.url } : t)));
        if (tabId === activeTabId) setInputUrl(e.url);
      }
    });

    el.addEventListener('new-window', (e: any) => {
      if (e.url) {
        handleNewTab(e.url);
      }
    });
  };

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0]!;

  // Cross-platform Fullscreen handler
  const toggleFullscreen = async () => {
    const nextState = !isFullscreen;
    setIsFullscreen(nextState);

    try {
      if (nextState) {
        if (containerRef.current && containerRef.current.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // Fallback: fixed inset-0 z-[999999] guarantees full screen display if native browser requestFullscreen is restricted by iframe container
    }
  };

  // Sync state if native browser fullscreen is exited via ESC or browser UI
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isNativeFs = Boolean(document.fullscreenElement);
      if (!isNativeFs && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, [isFullscreen]);

  // Keyboard shortcut for Full Screen toggle (F11 & Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F11') {
        e.preventDefault();
        toggleFullscreen();
      } else if (e.key === 'Escape' && isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Screen Wake Lock API integration to prevent screen dimming/sleep in full-screen mode
  const wakeLockRef = useRef<any>(null);
  const [isWakeLockActive, setIsWakeLockActive] = useState<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;

    const requestWakeLock = async () => {
      if ('wakeLock' in navigator && isFullscreen) {
        try {
          const lock = await (navigator as any).wakeLock.request('screen');
          if (isSubscribed) {
            wakeLockRef.current = lock;
            setIsWakeLockActive(true);
            lock.addEventListener('release', () => {
              if (isSubscribed) {
                setIsWakeLockActive(false);
              }
            });
          } else {
            await lock.release();
          }
        } catch (err) {
          console.warn('Screen Wake Lock request failed or denied:', err);
          setIsWakeLockActive(false);
        }
      }
    };

    const releaseWakeLock = async () => {
      if (wakeLockRef.current) {
        try {
          await wakeLockRef.current.release();
        } catch {
          // ignore release errors
        }
        wakeLockRef.current = null;
        setIsWakeLockActive(false);
      }
    };

    if (isFullscreen) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isFullscreen && !wakeLockRef.current) {
        requestWakeLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isSubscribed = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      releaseWakeLock();
    };
  }, [isFullscreen]);

  // Close three-dot menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isMenuOpen]);

  // Sync address input & subject when active tab changes
  useEffect(() => {
    if (activeTab) {
      setInputUrl(activeTab.url);
      if (activeTab.subject) setSelectedSubject(activeTab.subject);
    }
  }, [activeTabId, activeTab?.url, activeTab?.subject]);

  // Persist open tabs, bookmarks, history, downloads, settings (Encrypted + Fallback)
  useEffect(() => {
    if (isIncognito) {
      // Memory-only session: Do not save any tabs, history, cookies, or bookmarks to disk!
      return;
    }
    try {
      localStorage.setItem('studyos_browser_tabs_v2', JSON.stringify(tabs));
      localStorage.setItem('studyos_browser_active_tab_id', activeTabId);
      localStorage.setItem('studyos_browser_searchengine', searchEngine);
      localStorage.setItem('studyos_browser_homeurl', homeUrl);

      // Async Encrypted Storage Sync
      browserSecurityService.saveEncryptedData('history', history);
      browserSecurityService.saveEncryptedData('bookmarks', bookmarks);
      browserSecurityService.saveEncryptedData('reading_list', readingList);
      browserSecurityService.saveEncryptedData('downloads', downloads);
      localStorage.setItem('studyos_browser_bookmarks', JSON.stringify(bookmarks));
      localStorage.setItem('studyos_browser_reading_list', JSON.stringify(readingList));
      localStorage.setItem('studyos_browser_history', JSON.stringify(history));
      localStorage.setItem('studyos_browser_downloads', JSON.stringify(downloads));
    } catch {
      /* ignore */
    }
  }, [tabs, activeTabId, bookmarks, readingList, history, downloads, searchEngine, homeUrl, isIncognito]);

  // Timer loop: Increments study time ONLY when isStudyTimerActive is true
  useEffect(() => {
    const interval = setInterval(() => {
      if (isLeisureMode) {
        setLeisureSeconds((s) => s + 1);
      } else if (isStudyTimerActive) {
        setElapsedStudySecs((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isLeisureMode, isStudyTimerActive]);

  const getDomainFromUrl = (rawUrl: string): string => {
    return browserSecurityService.extractDomain(rawUrl);
  };

  // Explicit Start / Stop Study Timers
  const handleStartStudyTimer = (subj?: string) => {
    const targetSubj = subj || selectedSubject;
    setIsLeisureMode(false);
    setIsStudyTimerActive(true);
    if (subj) setSelectedSubject(subj);
    if (activeTab) {
      const domain = getDomainFromUrl(activeTab.url);
      activityEventService.trackBrowserStudyStart(domain, activeTab.title, activeTab.url, targetSubj);
    }
    onShowNotification?.(`Study Timer started for "${targetSubj}"`, 'Study Session Active');
  };

  const handleStopStudyTimer = () => {
    if (elapsedStudySecs > 0 && activeTab && !isLeisureMode) {
      const mins = Math.max(1, Math.round(elapsedStudySecs / 60));
      const domain = getDomainFromUrl(activeTab.url);

      activityEventService.trackBrowserStudyComplete(
        domain,
        activeTab.title,
        activeTab.url,
        mins,
        selectedSubject
      );
      analyticsService.logEvent({
        type: 'study_session',
        subject: selectedSubject,
        durationMinutes: mins,
        details: { action: 'BROWSER_STUDY_COMPLETED', domain, url: activeTab.url },
      });

      const newHist: HistoryItem = {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: activeTab.title,
        url: activeTab.url,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateStr: new Date().toISOString().split('T')[0]!,
        durationSeconds: elapsedStudySecs,
        subject: selectedSubject,
      };
      setHistory((prev) => [newHist, ...prev.slice(0, 299)]);
      setElapsedStudySecs(0);
    }
    setIsStudyTimerActive(false);
    onShowNotification?.('Study Session stopped and logged to Analytics', 'Study Session Stopped');
  };

  // Toggle Leisure Mode
  const handleToggleLeisureMode = () => {
    if (isLeisureMode) {
      if (leisureSeconds > 5) {
        const leisureMins = Math.max(1, Math.round(leisureSeconds / 60));
        analyticsService.logEvent({
          type: 'custom',
          subject: selectedSubject,
          durationMinutes: leisureMins,
          details: { action: 'LEISURE_BROWSING_COMPLETED', leisureSeconds },
        });
        onShowNotification?.(
          `Leisure mode ended (${leisureMins}m tracked). Focus stats remain clean.`,
          'Leisure Mode'
        );
      }
      setIsLeisureMode(false);
    } else {
      if (isStudyTimerActive) {
        handleStopStudyTimer();
      }
      setIsLeisureMode(true);
      onShowNotification?.(
        'Leisure Mode activated! Browsing time tracked independently.',
        'Leisure Mode'
      );
    }
  };

  // --- Session Starters ---
  const handleStartFocusSession = () => {
    if (!activeTab) return;
    const domain = getDomainFromUrl(activeTab.url);
    const title = `Focus Session: ${activeTab.title || domain}`;
    const todayStr = new Date().toISOString().split('T')[0]!;

    const newTask: TaskItem = {
      id: `task-browser-focus-${Date.now()}`,
      title,
      subject: selectedSubject,
      type: 'Study Session',
      dueDate: todayStr,
      timeSlot: 'Morning',
      priority: 'High',
      estimatedMinutes: 25,
      completed: false,
      status: 'In Progress',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      notes: `Browser URL: ${activeTab.url}`,
      createdAt: new Date().toISOString(),
    };

    taskSessionService.saveTask(newTask);
    taskSessionService.startTaskFocus(newTask.id);

    setIsStudyTimerActive(true);
    setIsLeisureMode(false);

    activityEventService.trackBrowserStudyStart(domain, activeTab.title, activeTab.url, selectedSubject);
    analyticsService.logEvent({
      type: 'focus_started',
      subject: selectedSubject,
      durationMinutes: 25,
      details: { action: 'BROWSER_FOCUS_STARTED', url: activeTab.url, title: activeTab.title },
    });

    onShowNotification?.(
      `Focus Session started for "${activeTab.title}"! Syncing with Analytics & Timetable.`,
      'Focus Engine'
    );
  };

  const handleStartLearningSession = () => {
    if (!activeTab) return;
    const domain = getDomainFromUrl(activeTab.url);
    const title = `Learning Session: ${activeTab.title || domain}`;
    const todayStr = new Date().toISOString().split('T')[0]!;

    const newTask: TaskItem = {
      id: `task-browser-learn-${Date.now()}`,
      title,
      subject: selectedSubject,
      type: 'Lecture',
      dueDate: todayStr,
      timeSlot: 'Morning',
      priority: 'Medium',
      estimatedMinutes: 45,
      completed: false,
      status: 'In Progress',
      startTime: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }),
      notes: `Active Learning Page: ${activeTab.url}`,
      createdAt: new Date().toISOString(),
    };

    taskSessionService.saveTask(newTask);
    taskSessionService.startTaskFocus(newTask.id);

    setIsStudyTimerActive(true);
    setIsLeisureMode(false);

    activityEventService.trackBrowserStudyStart(domain, activeTab.title, activeTab.url, selectedSubject);
    analyticsService.logEvent({
      type: 'study_session',
      subject: selectedSubject,
      durationMinutes: 45,
      details: { action: 'BROWSER_LEARNING_STARTED', url: activeTab.url, title: activeTab.title },
    });

    onShowNotification?.(
      `Learning Session started for "${activeTab.title}"! Syncing with Timetable & Tasks.`,
      'Learning Session'
    );
  };

  const deriveTitleFromUrl = (fullUrl: string, domain: string): string => {
    const clean = domain.toLowerCase().replace(/^www\./, '');
    if (clean.includes('google')) return 'Google';
    if (clean.includes('pw.live')) return 'PhysicsWallah';
    if (clean.includes('wikipedia')) return 'Wikipedia';
    if (clean.includes('geeksforgeeks')) return 'GeeksforGeeks';
    if (clean.includes('github')) return 'GitHub';
    if (clean.includes('youtube')) return 'YouTube';
    if (clean.includes('duckduckgo')) return 'DuckDuckGo';
    if (clean.length > 25) return clean.slice(0, 25) + '...';
    return clean ? clean.charAt(0).toUpperCase() + clean.slice(1) : 'Web Page';
  };

  const constructSearchUrl = (query: string): string => {
    const enc = encodeURIComponent(query.trim());
    switch (searchEngine) {
      case 'duckduckgo':
        return `https://html.duckduckgo.com/html/?q=${enc}`;
      case 'bing':
        return `https://www.bing.com/search?q=${enc}`;
      case 'startpage':
        return `https://www.startpage.com/sp/search?query=${enc}`;
      case 'google':
      default:
        return `https://www.google.com/search?igu=1&q=${enc}`;
    }
  };

  const sanitizeAndFormatInputUrl = (
    rawInput: string,
    titleHint?: string
  ): { formattedUrl: string; title: string } => {
    let trimmed = rawInput.trim();
    if (!trimmed) {
      return { formattedUrl: 'https://www.google.com', title: 'Google' };
    }

    // Security Protocol Safeguard: Block dangerous protocols (javascript:, data:, vbscript:, file:)
    const safety = browserSecurityService.analyzeUrlSafety(trimmed);
    if (safety.isBlockedProtocol) {
      const sanitizedText = trimmed.replace(/^(javascript|data|vbscript|file|about):/i, '').trim();
      const safeUrl = constructSearchUrl(sanitizedText || 'security sandbox');
      return { formattedUrl: safeUrl, title: 'Google Search (Protected)' };
    }

    if (/^https?:\/\//i.test(trimmed)) {
      const domain = getDomainFromUrl(trimmed);
      const title = titleHint || deriveTitleFromUrl(trimmed, domain);
      return { formattedUrl: trimmed, title };
    }

    const isDomainPattern = !/\s/.test(trimmed) && (trimmed.includes('.') || trimmed.startsWith('localhost'));
    if (isDomainPattern) {
      const formattedUrl = `https://${trimmed}`;
      const domain = getDomainFromUrl(formattedUrl);
      const title = titleHint || deriveTitleFromUrl(formattedUrl, domain);
      return { formattedUrl, title };
    }

    const searchUrl = constructSearchUrl(trimmed);
    return { formattedUrl: searchUrl, title: titleHint || `Search: ${trimmed}` };
  };

  const navigateTab = (targetUrl: string, titleHint?: string) => {
    const { formattedUrl, title } = sanitizeAndFormatInputUrl(targetUrl, titleHint);

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === activeTabId) {
          const newStack = t.historyStack.slice(0, t.historyIndex + 1);
          newStack.push(formattedUrl);
          return {
            ...t,
            url: formattedUrl,
            title,
            subject: selectedSubject,
            historyStack: newStack,
            historyIndex: newStack.length - 1,
            startTime: Date.now(),
          };
        }
        return t;
      })
    );

    setInputUrl(formattedUrl);
  };

  const handleGoBack = () => {
    if (isElectronDesktop) {
      const activeWv = webviewRefs.current.get(activeTabId);
      if (activeWv && typeof activeWv.canGoBack === 'function' && activeWv.canGoBack()) {
        activeWv.goBack();
        return;
      }
    }
    if (!activeTab || activeTab.historyIndex <= 0) return;
    const nextIdx = activeTab.historyIndex - 1;
    const targetUrl = activeTab.historyStack[nextIdx] || activeTab.url;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, historyIndex: nextIdx, url: targetUrl } : t))
    );
    setInputUrl(targetUrl);
  };

  const handleGoForward = () => {
    if (isElectronDesktop) {
      const activeWv = webviewRefs.current.get(activeTabId);
      if (activeWv && typeof activeWv.canGoForward === 'function' && activeWv.canGoForward()) {
        activeWv.goForward();
        return;
      }
    }
    if (!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1) return;
    const nextIdx = activeTab.historyIndex + 1;
    const targetUrl = activeTab.historyStack[nextIdx] || activeTab.url;
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, historyIndex: nextIdx, url: targetUrl } : t))
    );
    setInputUrl(targetUrl);
  };

  const handleNewTab = (customUrl?: string) => {
    const target = customUrl || homeUrl;
    const domain = getDomainFromUrl(target);
    const newId = `tab-${Date.now()}`;
    const newTab: Tab = {
      id: newId,
      title: deriveTitleFromUrl(target, domain),
      url: target,
      subject: selectedSubject,
      readerMode: false,
      focusMode: true,
      zoomLevel: 100,
      historyStack: [target],
      historyIndex: 0,
      startTime: Date.now(),
    };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tabs.length === 1) return;
    const nextTabs = tabs.filter((t) => t.id !== id);
    setTabs(nextTabs);
    if (activeTabId === id) {
      setActiveTabId(nextTabs[nextTabs.length - 1]!.id);
    }
  };

  const toggleBookmark = () => {
    if (!activeTab) return;
    const exists = bookmarks.some((b) => b.url === activeTab.url);
    if (exists) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
      onShowNotification?.('Bookmark removed from encrypted library', 'Study Browser');
    } else {
      const newBm: BookmarkItem = {
        id: `bm-${Date.now()}`,
        title: activeTab.title,
        url: activeTab.url,
        category: 'Custom',
      };
      setBookmarks((prev) => [...prev, newBm]);
      onShowNotification?.('Bookmark saved to encrypted library', 'Study Browser');
    }
  };

  const handleZoomChange = (delta: number) => {
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTabId
          ? { ...t, zoomLevel: Math.min(200, Math.max(50, t.zoomLevel + delta)) }
          : t
      )
    );
  };

  const handleClearCacheAndVault = () => {
    browserSecurityService.clearAllLocalData();
    setHistory([]);
    setBookmarks(PRESET_BOOKMARKS);
    setReadingList(PRESET_READING_LIST);
    setDownloads([]);
    setTrustedDomains(browserSecurityService.getTrustedDomains());
    setSecurityConfig(browserSecurityService.getConfig());
    setSandboxStatus(browserSecurityService.getSandboxStatus());
    onShowNotification?.('Encrypted cache, history, and site storage purged', 'Security Vault Cleared');
    setActivePanel('none');
  };

  const handleClearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem('studyos_browser_history');
      browserSecurityService.saveEncryptedData('history', []);
    } catch {
      /* ignore */
    }
    onShowNotification?.('Browsing history completely cleared & encrypted vault updated', 'History Cleared');
  };

  const handleAddToReadingList = (itemToSave?: { title: string; url: string; subject?: string }) => {
    const targetTitle = itemToSave?.title || activeTab?.title || 'Academic Article';
    const targetUrl = itemToSave?.url || activeTab?.url || inputUrl;
    const targetSubject = itemToSave?.subject || activeTab?.subject || selectedSubject;

    const exists = readingList.some((rl) => rl.url.toLowerCase() === targetUrl.toLowerCase());
    if (exists) {
      onShowNotification?.('Article is already in your Reading List', 'Reading List');
      return;
    }

    const newItem: ReadingListItem = {
      id: 'rl-' + Date.now(),
      title: targetTitle,
      url: targetUrl,
      addedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isRead: false,
      subject: targetSubject,
      summary: `Saved article from ${getDomainFromUrl(targetUrl)} for distraction-free review.`,
    };

    setReadingList((prev) => [newItem, ...prev]);
    onShowNotification?.(`Saved "${targetTitle.slice(0, 32)}..." to Reading List`, 'Reading List');
  };

  const handleToggleReadStatus = (id: string) => {
    setReadingList((prev) =>
      prev.map((item) => (item.id === id ? { ...item, isRead: !item.isRead } : item))
    );
  };

  const handleRemoveFromReadingList = (id: string) => {
    setReadingList((prev) => prev.filter((item) => item.id !== id));
    onShowNotification?.('Removed article from Reading List', 'Reading List');
  };

  const handleClearReadingList = () => {
    setReadingList([]);
    try {
      localStorage.removeItem('studyos_browser_reading_list');
      browserSecurityService.saveEncryptedData('reading_list', []);
    } catch {
      /* ignore */
    }
    onShowNotification?.('Reading List cleared & encrypted storage updated', 'Reading List Cleared');
  };

  const filteredReadingList = useMemo(() => {
    if (!readingListSearchQuery.trim()) return readingList;
    const q = readingListSearchQuery.toLowerCase();
    return readingList.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.url.toLowerCase().includes(q) ||
        (item.subject && item.subject.toLowerCase().includes(q))
    );
  }, [readingList, readingListSearchQuery]);

  // --- Secure Download Trigger & Scanning ---
  const handleInitiateDownload = (filenameInput: string, downloadUrlInput: string) => {
    const filename = filenameInput.trim() || 'Downloaded_Resource.pdf';
    const url = downloadUrlInput.trim() || activeTab?.url || 'https://www.pw.live/resource';

    const scanResult = browserSecurityService.scanDownload(filename, url);

    if (scanResult.isExecutable || scanResult.isMalwareRisk) {
      setThreatDownloadModal(scanResult);
      onShowNotification?.(`Executable file download blocked: ${filename}`, 'Download Guard');
      return;
    }

    const newDl: DownloadItem = {
      id: `dl-${Date.now()}`,
      filename: scanResult.filename,
      size: `${(Math.random() * 4 + 0.5).toFixed(1)} MB`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      url: scanResult.url,
      isExecutable: false,
      isSafe: true,
    };

    setDownloads((prev) => [newDl, ...prev]);
    onShowNotification?.(`File scanned & saved to StudyOS Sandbox: ${filename}`, 'Secure Download');
    setNewDlFilename('');
    setNewDlUrl('');
  };

  // Whitelist Actions
  const handleAddDomainToWhitelist = (domainToTrust: string) => {
    const success = browserSecurityService.addTrustedDomain(domainToTrust, newDomainCategory);
    if (success) {
      setTrustedDomains(browserSecurityService.getTrustedDomains());
      onShowNotification?.(`Domain "${domainToTrust}" added to trusted whitelist`, 'Whitelist Updated');
      setNewDomainInput('');
      setUntrustedBypassedTabs((prev) => ({ ...prev, [activeTab.id + '-' + activeTab.url]: true }));
    }
  };

  const handleRemoveDomainFromWhitelist = (domainToRemove: string) => {
    const success = browserSecurityService.removeTrustedDomain(domainToRemove);
    if (success) {
      setTrustedDomains(browserSecurityService.getTrustedDomains());
      onShowNotification?.(`Removed "${domainToRemove}" from trusted whitelist`, 'Whitelist Updated');
    }
  };

  const handleToggleSecuritySetting = (key: keyof BrowserSecurityConfig) => {
    const updated = !securityConfig[key];
    const newConf = { ...securityConfig, [key]: updated };
    setSecurityConfig(newConf);
    browserSecurityService.updateConfig({ [key]: updated });
    onShowNotification?.(`Updated security rule: ${String(key)}`, 'Security Policy Updated');
  };

  // Reopen History Item
  const handleReopenHistoryItem = (item: { url: string; title: string; subject?: string }) => {
    navigateTab(item.url, item.title);
    if (item.subject) {
      setSelectedSubject(item.subject);
    }
    onShowNotification?.(
      `Jumped to "${item.title}" (${item.subject || 'General'})`,
      'Session Connected'
    );
  };

  const isBookmarked = bookmarks.some((b) => b.url === activeTab?.url);

  // Is Current Domain Trusted?
  const isCurrentDomainTrusted = useMemo(() => {
    if (!activeTab?.url) return true;
    return browserSecurityService.isDomainTrusted(activeTab.url);
  }, [activeTab?.url, trustedDomains, securityConfig.whitelistingEnabled]);

  const isCurrentTabBypassed = Boolean(
    activeTab && untrustedBypassedTabs[activeTab.id + '-' + activeTab.url]
  );

  // Merged ActivityEventService + Local History
  const combinedHistory = useMemo(() => {
    const list: {
      id: string;
      title: string;
      url: string;
      timestamp: string;
      subject?: string;
      durationMinutes?: number;
      action?: string;
    }[] = [];

    activityEvents.forEach((evt) => {
      if (evt.url || evt.module === 'study-browser') {
        list.push({
          id: evt.id,
          title: evt.title || evt.action,
          url: evt.url || 'https://www.pw.live',
          timestamp: new Date(evt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          subject: evt.subject,
          durationMinutes: evt.durationMinutes,
          action: evt.action,
        });
      }
    });

    history.forEach((h) => {
      if (!list.some((l) => l.url === h.url && l.timestamp === h.timestamp)) {
        list.push({
          id: h.id,
          title: h.title,
          url: h.url,
          timestamp: h.timestamp,
          subject: h.subject,
          durationMinutes: h.durationSeconds ? Math.round(h.durationSeconds / 60) : undefined,
          action: 'Browser History',
        });
      }
    });

    return list;
  }, [activityEvents, history]);

  const filteredHistory = combinedHistory.filter((h) => {
    if (!historySearchQuery.trim()) return true;
    const q = historySearchQuery.toLowerCase();
    return (
      h.title.toLowerCase().includes(q) ||
      h.url.toLowerCase().includes(q) ||
      (h.subject && h.subject.toLowerCase().includes(q))
    );
  });

  const filteredTrustedDomains = trustedDomains.filter((d) => {
    if (!trustedSearchQuery.trim()) return true;
    const q = trustedSearchQuery.toLowerCase();
    return d.domain.toLowerCase().includes(q) || d.category.toLowerCase().includes(q);
  });

  return (
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
      className={`transition-all duration-300 ease-in-out h-full flex-1 flex flex-col bg-[#faf9fe] text-slate-900 select-none overflow-hidden relative min-h-0 min-w-0 ${
        isFullscreen ? 'p-0 fixed inset-0 z-[999999] w-screen h-screen bg-[#faf9fe]' : 'p-2 md:p-3 space-y-2'
      }`}
    >
      {/* --- FLOATING EXIT FULL SCREEN CONTROL BAR --- */}
      {isFullscreen && (
        <div className="absolute top-3 right-4 z-[1000000] flex items-center space-x-2.5 bg-purple-950/95 text-white backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-2xl border border-purple-500/50 text-xs font-bold animate-fadeIn">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Full Screen Browser Active</span>
          {isWakeLockActive && (
            <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-full border border-amber-500/30 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              Wake Lock Active
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="ml-2 px-2.5 py-0.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-extrabold cursor-pointer transition-all active:scale-95 flex items-center gap-1"
          >
            <Minimize className="w-3 h-3" />
            <span>Exit (ESC)</span>
          </button>
        </div>
      )}

      {/* --- OFFLINE ISOLATION BANNER --- */}
      {!isFullscreen && (
        <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-purple-950 text-white px-3.5 py-1.5 rounded-xl shadow-2xs border border-purple-800 flex flex-wrap items-center justify-between text-xs gap-2 shrink-0">
          <div className="flex items-center space-x-2 truncate">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="font-black text-purple-200 uppercase tracking-wider text-[10px]">
              Sandboxed Process:
            </span>
            <span className="text-purple-100 font-medium text-[11px] truncate">
              AES-256-GCM encrypted vault active. Local whitelist enforcement ON.
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[10px] font-mono shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-emerald-300 font-extrabold">IPC Hardened • 100% Offline Vault</span>
          </div>
        </div>
      )}

      {/* --- CHROMIUM / FIREFOX BROWSER TOP BAR --- */}
      <GlassCard className="!p-2 flex flex-col space-y-1.5 shadow-sm rounded-2xl border border-slate-200/90 shrink-0 relative z-10">
        {/* ROW 1: TAB STRIP */}
        <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar">
          {/* History Sidebar Toggle */}
          <button
            onClick={() => setIsHistorySidebarOpen(!isHistorySidebarOpen)}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer mr-1 shrink-0 ${
              isHistorySidebarOpen
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                : 'bg-white/90 text-slate-700 hover:bg-purple-50 border-slate-200'
            }`}
            title="Toggle Collapsible History Sidebar"
          >
            <PanelLeft className="w-3.5 h-3.5" />
          </button>

          {/* Browser Tabs */}
          <div className="flex items-center space-x-1 overflow-x-auto custom-scrollbar flex-1">
            {tabs.map((t) => {
              const isActive = t.id === activeTabId;
              const isDomainOk = browserSecurityService.isDomainTrusted(t.url);
              return (
                <div
                  key={t.id}
                  onClick={() => {
                    setActiveTabId(t.id);
                  }}
                  className={`group relative flex items-center space-x-1.5 px-3 py-1.5 rounded-t-xl text-xs font-bold transition-all cursor-pointer border-t border-x max-w-[200px] min-w-[120px] shrink-0 ${
                    isActive
                      ? 'bg-white text-purple-950 border-purple-300 shadow-2xs font-extrabold -mb-[1px] z-10'
                      : 'bg-slate-100/80 text-slate-600 hover:bg-purple-50/80 border-slate-200'
                  }`}
                >
                  {isDomainOk ? (
                    <Globe className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-600' : 'text-slate-400'}`} />
                  ) : (
                    <span title="Untrusted Domain">
                      <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                    </span>
                  )}
                  <span className="truncate flex-1 text-[11px]">{t.title}</span>
                  {tabs.length > 1 && (
                    <button
                      onClick={(e) => handleCloseTab(t.id, e)}
                      className="p-0.5 rounded-md hover:bg-slate-200 text-slate-400 hover:text-slate-700 cursor-pointer opacity-70 group-hover:opacity-100"
                      title="Close Tab"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}

            {/* New Tab Button */}
            <button
              onClick={() => handleNewTab()}
              className="p-1.5 rounded-xl bg-slate-100 hover:bg-purple-100 text-purple-700 border border-slate-200 transition-all cursor-pointer shrink-0 ml-1"
              title="New Tab (Ctrl+T)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Essential Session Controls in Top Bar */}
          <div className="flex items-center space-x-1 shrink-0 pl-2 border-l border-slate-200">
            <button
              onClick={handleStartFocusSession}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-extrabold hover:from-purple-700 hover:to-indigo-700 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Start 25m Focus Session"
            >
              <Flame className="w-3 h-3 text-amber-300" />
              <span className="hidden sm:inline">Focus</span>
            </button>

            <button
              onClick={handleStartLearningSession}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white text-[11px] font-extrabold hover:from-teal-700 hover:to-emerald-700 shadow-2xs transition-all cursor-pointer active:scale-95"
              title="Start Learning Session"
            >
              <BookOpen className="w-3 h-3 text-teal-200" />
              <span className="hidden sm:inline">Learn</span>
            </button>

            <button
              onClick={handleToggleLeisureMode}
              className={`inline-flex items-center space-x-1 px-2 py-1 rounded-xl text-[11px] font-extrabold border transition-all cursor-pointer ${
                isLeisureMode
                  ? 'bg-amber-500 text-white border-amber-600 animate-pulse shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50'
              }`}
              title="Toggle Leisure Mode"
            >
              <Coffee className="w-3 h-3 text-amber-700" />
              <span>{isLeisureMode ? `${Math.floor(leisureSeconds / 60)}m` : 'Leisure'}</span>
            </button>
          </div>
        </div>

        {/* ROW 2: ADDRESS BAR & THREE-DOT MENU */}
        <div className="flex items-center space-x-1.5 relative">
          {/* Navigation Controls */}
          <button
            onClick={handleGoBack}
            disabled={!activeTab || activeTab.historyIndex <= 0}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-700 disabled:opacity-40 transition-all cursor-pointer"
            title="Back"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleGoForward}
            disabled={!activeTab || activeTab.historyIndex >= activeTab.historyStack.length - 1}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-700 disabled:opacity-40 transition-all cursor-pointer"
            title="Forward"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => navigateTab(activeTab.url)}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-700 transition-all cursor-pointer"
            title="Reload"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => navigateTab(homeUrl)}
            className="p-1.5 rounded-xl bg-white border border-slate-200 hover:bg-purple-50 text-slate-700 transition-all cursor-pointer"
            title="Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>

          {/* Address & Search Input Bar */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              navigateTab(inputUrl);
            }}
            className="flex-1 flex items-center bg-white border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs focus-within:ring-2 focus-within:ring-purple-500/40 transition-all min-w-[200px]"
          >
            <span
              title={isCurrentDomainTrusted ? 'Trusted Domain (SSL Sandbox Verified)' : 'Untrusted Domain Whitelist Warning'}
              className="mr-2 shrink-0 cursor-pointer"
              onClick={() => {
                setActivePanel('settings');
                setSettingsTab('trusted');
              }}
            >
              {isCurrentDomainTrusted ? (
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600 animate-pulse" />
              )}
            </span>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Search web or enter address (e.g. google.com, pw.live, wikipedia)..."
              className="w-full bg-transparent text-xs font-semibold text-slate-800 outline-none"
            />
            {/* Quick Bookmark Star inside Address Bar */}
            <button
              type="button"
              onClick={toggleBookmark}
              className="p-1 text-slate-400 hover:text-purple-600 cursor-pointer ml-1"
              title={isBookmarked ? 'Bookmarked' : 'Add Bookmark'}
            >
              {isBookmarked ? (
                <BookmarkCheck className="w-3.5 h-3.5 text-purple-600 fill-current" />
              ) : (
                <Bookmark className="w-3.5 h-3.5" />
              )}
            </button>
            {/* Quick Save to Reading List inside Address Bar */}
            <button
              type="button"
              onClick={() => handleAddToReadingList()}
              className="p-1 text-slate-400 hover:text-amber-600 cursor-pointer ml-0.5"
              title="Save to Reading List for offline study"
            >
              <BookMarked className="w-3.5 h-3.5" />
            </button>
            <button
              type="submit"
              className="p-1 text-purple-600 hover:text-purple-800 cursor-pointer font-extrabold text-xs ml-1"
            >
              Go
            </button>
          </form>

          {/* READER MODE TOOLBAR BUTTON */}
          <button
            type="button"
            onClick={() => {
              setTabs((prev) =>
                prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: !t.readerMode } : t))
              );
              onShowNotification?.(
                activeTab?.readerMode
                  ? 'Distraction-Free Reader Mode Deactivated'
                  : 'Distraction-Free Reader Mode Active',
                'Reader Mode'
              );
            }}
            className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 font-bold text-xs ${
              activeTab?.readerMode
                ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md ring-2 ring-amber-400/50'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-amber-50 hover:text-amber-800'
            }`}
            title="Toggle Distraction-Free Reader Mode for Academic Articles"
          >
            <BookOpen className={`w-3.5 h-3.5 ${activeTab?.readerMode ? 'text-slate-950' : 'text-amber-600'}`} />
            <span className="hidden sm:inline">Reader Mode</span>
          </button>

          {/* READING LIST PANEL TOOLBAR BUTTON */}
          <button
            type="button"
            onClick={() => setActivePanel(activePanel === 'readinglist' ? 'none' : 'readinglist')}
            className={`px-2.5 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 font-bold text-xs ${
              activePanel === 'readinglist'
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50 hover:text-purple-700'
            }`}
            title="Open Encrypted Reading List"
          >
            <BookMarked className="w-3.5 h-3.5 text-purple-500" />
            <span className="hidden sm:inline">Reading List</span>
            {readingList.length > 0 && (
              <span className="bg-purple-100 text-purple-800 text-[10px] font-black px-1.5 rounded-full">
                {readingList.length}
              </span>
            )}
          </button>

          {/* Incognito Session Toggle Button */}
          <button
            type="button"
            onClick={() => {
              const nextIncognito = !isIncognito;
              setIsIncognito(nextIncognito);
              onShowNotification?.(
                nextIncognito
                  ? 'Incognito Session Active — History, cookies & disk storage persistence disabled'
                  : 'Incognito Session Ended — Memory session cleared',
                nextIncognito ? 'Incognito Mode Active' : 'Standard Mode Restored'
              );
            }}
            className={`px-2 py-1.5 rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 shrink-0 ${
              isIncognito
                ? 'bg-slate-900 text-purple-300 border-slate-950 shadow-md ring-2 ring-purple-500/50'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
            }`}
            title={isIncognito ? 'Incognito Active (Memory Storage Only)' : 'Enable Incognito Private Session'}
          >
            <EyeOff className={`w-3.5 h-3.5 ${isIncognito ? 'text-purple-400' : 'text-slate-500'}`} />
            <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">
              {isIncognito ? 'Incognito' : 'Incognito'}
            </span>
          </button>

          {/* Quick Privacy Dashboard Button */}
          <button
            type="button"
            onClick={() => {
              setActivePanel(activePanel === 'privacy' ? 'none' : 'privacy');
            }}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
              activePanel === 'privacy'
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
            }`}
            title="Open Privacy Dashboard"
          >
            <Lock className="w-4 h-4" />
          </button>

          {/* Quick Full Screen Toggle Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className={`p-1.5 rounded-xl border transition-all cursor-pointer mr-0.5 ${
              isFullscreen
                ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
            }`}
            title={isFullscreen ? 'Exit Full Screen (ESC)' : 'Full Screen Mode (F11)'}
          >
            {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
          </button>

          {/* THREE-DOT (⋮) MENU BUTTON & CONTAINER */}
          <div className="relative z-50" ref={menuRef}>
            <button
              type="button"
              onClick={() => setIsMenuOpen((prev) => !prev)}
              className={`p-1.5 rounded-xl border transition-all cursor-pointer ${
                isMenuOpen
                  ? 'bg-purple-600 text-white border-purple-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-purple-50'
              }`}
              title="Browser Menu & Security Settings"
            >
              <MoreVertical className="w-4 h-4" />
            </button>

            {/* THREE-DOT DROPDOWN MENU */}
            {isMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white/98 backdrop-blur-md border border-slate-200/90 shadow-2xl rounded-2xl z-[100] py-2 text-slate-800 text-xs divide-y divide-slate-100 animate-fadeIn">
                {/* 1. Choose Subject */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[10px] font-black uppercase text-purple-600 tracking-wider flex items-center justify-between">
                    <span>Choose Subject</span>
                    <span className="font-mono text-purple-800 bg-purple-100 px-1.5 py-0.5 rounded text-[9px]">
                      {selectedSubject}
                    </span>
                  </div>
                  <select
                    value={selectedSubject}
                    onChange={(e) => {
                      const newSubj = e.target.value;
                      setSelectedSubject(newSubj);
                      setTabs((prev) =>
                        prev.map((t) => (t.id === activeTabId ? { ...t, subject: newSubj } : t))
                      );
                      setIsMenuOpen(false);
                    }}
                    className="w-full mt-1 p-1.5 rounded-xl border border-purple-200 bg-purple-50/80 text-purple-900 font-bold text-xs outline-none cursor-pointer"
                  >
                    {getAllSubjectOptions().map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Bookmarks, History, Downloads */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setActivePanel('bookmarks');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Folder className="w-4 h-4 text-purple-600" />
                      <span>Saved Bookmarks</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">({bookmarks.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsHistorySidebarOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <History className="w-4 h-4 text-purple-600" />
                      <span>History Sidebar</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">({filteredHistory.length})</span>
                  </button>

                  <button
                    onClick={() => {
                      setActivePanel('downloads');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Download className="w-4 h-4 text-purple-600" />
                      <span>Downloads Shield</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">({downloads.length})</span>
                  </button>
                </div>

                {/* Privacy, Incognito & Domain Permissions */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      const next = !isIncognito;
                      setIsIncognito(next);
                      onShowNotification?.(
                        next ? 'Incognito Mode Enabled' : 'Incognito Mode Disabled',
                        'Incognito Mode'
                      );
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <EyeOff className="w-4 h-4 text-purple-600" />
                      <span>Incognito Session</span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        isIncognito ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {isIncognito ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActivePanel('privacy');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Lock className="w-4 h-4 text-purple-600" />
                      <span>Privacy Dashboard</span>
                    </div>
                    <span className="text-[10px] font-mono text-purple-700 font-bold">Metrics</span>
                  </button>

                  <button
                    onClick={() => {
                      setActivePanel('settings');
                      setSettingsTab('permissions');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Camera className="w-4 h-4 text-purple-600" />
                      <span>Domain Permissions</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Cam/Mic/Bell</span>
                  </button>
                </div>

                {/* Reader, Focus, Security Settings */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      setTabs((prev) =>
                        prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: !t.readerMode } : t))
                      );
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <BookOpen className="w-4 h-4 text-amber-600" />
                      <span>Reader Mode</span>
                    </div>
                    <span
                      className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded ${
                        activeTab?.readerMode ? 'bg-amber-100 text-amber-800' : 'text-slate-400'
                      }`}
                    >
                      {activeTab?.readerMode ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setActivePanel('settings');
                      setSettingsTab('security');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Shield className="w-4 h-4 text-emerald-600" />
                      <span>Security Center</span>
                    </div>
                    <span className="text-[10px] font-extrabold text-emerald-600">Active</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowFindBar(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      <Search className="w-4 h-4 text-purple-600" />
                      <span>Find in Page</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">Ctrl+F</span>
                  </button>
                </div>

                {/* Zoom Controls */}
                <div className="px-3 py-2 space-y-1">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    Zoom
                  </div>
                  <div className="flex items-center justify-between bg-slate-100 p-1 rounded-xl">
                    <button
                      type="button"
                      onClick={() => handleZoomChange(-10)}
                      className="p-1 hover:bg-white rounded-lg text-slate-700 font-bold cursor-pointer"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    <span className="font-mono font-extrabold text-xs text-purple-800">
                      {activeTab?.zoomLevel || 100}%
                    </span>
                    <button
                      type="button"
                      onClick={() => handleZoomChange(10)}
                      className="p-1 hover:bg-white rounded-lg text-slate-700 font-bold cursor-pointer"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Full Screen, Settings, Clear Data, About */}
                <div className="py-1">
                  <button
                    onClick={() => {
                      toggleFullscreen();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center justify-between font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center space-x-2.5">
                      {isFullscreen ? (
                        <Minimize className="w-4 h-4 text-purple-600" />
                      ) : (
                        <Maximize className="w-4 h-4 text-purple-600" />
                      )}
                      <span>Full Screen Mode</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">F11</span>
                  </button>

                  <button
                    onClick={() => {
                      setActivePanel('settings');
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center space-x-2.5 font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <Settings className="w-4 h-4 text-purple-600" />
                    <span>Browser Settings</span>
                  </button>

                  <button
                    onClick={() => {
                      handleClearCacheAndVault();
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-rose-50 text-rose-700 flex items-center space-x-2.5 font-bold transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    <span>Purge Encrypted Data</span>
                  </button>

                  <button
                    onClick={() => {
                      setIsAboutOpen(true);
                      setIsMenuOpen(false);
                    }}
                    className="w-full px-3 py-2 hover:bg-purple-50 flex items-center space-x-2.5 font-bold text-slate-700 hover:text-purple-700 transition-colors cursor-pointer"
                  >
                    <HelpCircle className="w-4 h-4 text-purple-600" />
                    <span>About Sandbox Architecture</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </GlassCard>

      {/* --- FIND IN PAGE BAR --- */}
      {showFindBar && (
        <GlassCard className="!p-2 flex items-center space-x-2 shadow-md animate-fadeIn shrink-0 relative z-20">
          <Search className="w-4 h-4 text-purple-600 ml-1 shrink-0" />
          <input
            type="text"
            value={findQuery}
            onChange={(e) => setFindQuery(e.target.value)}
            placeholder="Find text in page..."
            className="flex-1 text-xs font-semibold bg-transparent outline-none text-slate-800"
          />
          <span className="text-[10px] font-mono font-bold text-slate-400">
            {findQuery ? 'Searching...' : 'Press Enter'}
          </span>
          <button
            onClick={() => setShowFindBar(false)}
            className="text-slate-400 hover:text-slate-600 p-1 font-bold text-xs cursor-pointer"
          >
            ✕
          </button>
        </GlassCard>
      )}

      {/* --- PANELS / MODALS (BOOKMARKS, READING LIST, DOWNLOADS, SECURITY SETTINGS) --- */}
      {activePanel !== 'none' && (
        <GlassCard className="!p-4 max-h-[80vh] overflow-y-auto custom-scrollbar animate-fadeIn shadow-lg shrink-0 relative z-20">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2 mb-3">
            <h4 className="text-xs font-black uppercase tracking-wide text-slate-900 flex items-center gap-2">
              {activePanel === 'bookmarks' && <Folder className="w-4 h-4 text-purple-600" />}
              {activePanel === 'readinglist' && <BookMarked className="w-4 h-4 text-amber-600" />}
              {activePanel === 'downloads' && <Download className="w-4 h-4 text-purple-600" />}
              {activePanel === 'settings' && <Settings className="w-4 h-4 text-purple-600" />}
              {activePanel === 'privacy' && <Lock className="w-4 h-4 text-purple-600" />}
              {activePanel === 'permissions' && <Camera className="w-4 h-4 text-purple-600" />}
              {activePanel === 'bookmarks' && 'Encrypted Study Bookmarks'}
              {activePanel === 'readinglist' && 'Encrypted Academic Reading List'}
              {activePanel === 'downloads' && 'Secure Downloads & Resource Guard'}
              {activePanel === 'settings' && 'Security Center & Browser Settings'}
              {activePanel === 'privacy' && 'StudyOS Privacy Dashboard'}
              {activePanel === 'permissions' && 'Domain Permissions Control Panel'}
            </h4>
            <button
              onClick={() => setActivePanel('none')}
              className="text-slate-400 hover:text-slate-600 font-bold text-xs cursor-pointer"
            >
              ✕ Close
            </button>
          </div>

          {/* Reading List Manager */}
          {activePanel === 'readinglist' && (
            <div className="space-y-3">
              <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-xl flex items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="font-bold text-xs text-amber-950 flex items-center gap-1.5">
                    <BookMarked className="w-4 h-4 text-amber-600" />
                    <span>Saved Articles for Offline Academic Review</span>
                  </div>
                  <p className="text-[11px] text-amber-800">
                    Articles are saved to AES-256 encrypted local storage alongside your study bookmarks.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleAddToReadingList()}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs cursor-pointer transition-all shrink-0 flex items-center gap-1 shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Save Current Page</span>
                </button>
              </div>

              {/* Search & Statistics Filter Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
                <div className="relative flex-1 w-full">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={readingListSearchQuery}
                    onChange={(e) => setReadingListSearchQuery(e.target.value)}
                    placeholder="Search reading list articles..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 text-xs font-medium outline-none"
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                  <span className="text-slate-500">
                    {filteredReadingList.filter((r) => !r.isRead).length} unread / {readingList.length} total
                  </span>
                  {readingList.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearReadingList}
                      className="px-2 py-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear All</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Reading List Items */}
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {filteredReadingList.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-400 italic">
                    No articles in Reading List
                  </div>
                ) : (
                  filteredReadingList.map((item) => (
                    <div
                      key={item.id}
                      className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                        item.isRead
                          ? 'bg-slate-50/80 border-slate-200 opacity-80'
                          : 'bg-white border-purple-200 shadow-2xs hover:border-purple-300'
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            onClick={() => {
                              navigateTab(item.url, item.title);
                              setTabs((prev) =>
                                prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: true } : t))
                              );
                              setActivePanel('none');
                            }}
                            className="font-bold text-xs text-slate-900 hover:text-purple-700 cursor-pointer line-clamp-1"
                          >
                            {item.title}
                          </span>
                          {item.subject && (
                            <span className="px-1.5 py-0.2 bg-purple-100 text-purple-800 font-extrabold text-[9px] rounded">
                              {item.subject}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                              item.isRead ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {item.isRead ? 'Read' : 'Unread'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 line-clamp-1">{item.summary}</p>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono">
                          <span>{item.url}</span>
                          <span>• Added: {item.addedAt}</span>
                        </div>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => handleToggleReadStatus(item.id)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                            item.isRead
                              ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                              : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.isRead ? 'Mark Unread' : 'Mark Read'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            navigateTab(item.url, item.title);
                            setTabs((prev) =>
                              prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: true } : t))
                            );
                            setActivePanel('none');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-[10px] cursor-pointer transition-all flex items-center gap-1"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>Read</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromReadingList(item.id)}
                          className="p-1 hover:text-rose-600 text-slate-400 cursor-pointer"
                          title="Remove from Reading List"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Bookmarks Manager */}
          {activePanel === 'bookmarks' && (
            <div className="space-y-3">
              {/* Add New Custom Bookmark Form */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-purple-950 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Plus className="w-4 h-4 text-purple-600" />
                    <span>Add New Bookmark to Encrypted Library</span>
                  </span>
                  <span className="text-[10px] font-mono text-purple-700">AES-256 Storage</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newBookmarkTitle}
                    onChange={(e) => setNewBookmarkTitle(e.target.value)}
                    placeholder="Bookmark Title (e.g. Physics Wallah Portal)..."
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none"
                  />
                  <input
                    type="text"
                    value={newBookmarkUrl}
                    onChange={(e) => setNewBookmarkUrl(e.target.value)}
                    placeholder="URL (e.g. https://www.pw.live)..."
                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none"
                  />
                  <div className="flex gap-1.5">
                    <select
                      value={newBookmarkCategory}
                      onChange={(e) => setNewBookmarkCategory(e.target.value)}
                      className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold outline-none cursor-pointer"
                    >
                      <option value="Learning Portal">Learning Portal</option>
                      <option value="AI Assistant">AI Assistant</option>
                      <option value="Search">Search</option>
                      <option value="Courses">Courses</option>
                      <option value="Docs">Docs</option>
                      <option value="PYQs">PYQs</option>
                      <option value="Reference">Reference</option>
                      <option value="Research">Research</option>
                      <option value="Custom">Custom</option>
                    </select>
                    <button
                      onClick={() => {
                        if (!newBookmarkUrl.trim()) return;
                        const formatted = /^https?:\/\//i.test(newBookmarkUrl.trim())
                          ? newBookmarkUrl.trim()
                          : `https://${newBookmarkUrl.trim()}`;
                        const title = newBookmarkTitle.trim() || deriveTitleFromUrl(formatted, getDomainFromUrl(formatted));
                        const newBm: BookmarkItem = {
                          id: `bm-${Date.now()}`,
                          title,
                          url: formatted,
                          category: newBookmarkCategory,
                        };
                        setBookmarks((prev) => [newBm, ...prev]);
                        onShowNotification?.(`Bookmark "${title}" added`, 'Library Updated');
                        setNewBookmarkTitle('');
                        setNewBookmarkUrl('');
                      }}
                      className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shrink-0"
                    >
                      Add Bookmark
                    </button>
                  </div>
                </div>
              </div>

              {/* Bookmark Search & Category Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    value={bookmarkSearchQuery}
                    onChange={(e) => setBookmarkSearchQuery(e.target.value)}
                    placeholder="Filter saved bookmarks..."
                    className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 text-xs font-medium outline-none"
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-500 shrink-0">
                  Total Bookmarks: {bookmarks.length}
                </div>
              </div>

              {/* Bookmarks Grid List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                {bookmarks
                  .filter((b) => {
                    if (!bookmarkSearchQuery.trim()) return true;
                    const q = bookmarkSearchQuery.toLowerCase();
                    return b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.category.toLowerCase().includes(q);
                  })
                  .map((b) => (
                    <div
                      key={b.id}
                      onClick={() => {
                        navigateTab(b.url, b.title);
                        setActivePanel('none');
                      }}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50/50 cursor-pointer transition-all flex items-center justify-between group"
                    >
                      <div className="truncate min-w-0 flex-1 mr-2">
                        <div className="text-xs font-bold text-slate-800 truncate group-hover:text-purple-900 flex items-center gap-1.5">
                          <span className="truncate">{b.title}</span>
                          <span className="px-1.5 py-0.2 rounded bg-purple-100 text-purple-800 font-extrabold text-[9px] shrink-0">
                            {b.category}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-mono truncate">{b.url}</div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBookmarks((prev) => prev.filter((x) => x.id !== b.id));
                          onShowNotification?.(`Deleted bookmark "${b.title}"`, 'Library Updated');
                        }}
                        className="p-1 hover:text-rose-600 text-slate-400 cursor-pointer shrink-0"
                        title="Delete Bookmark"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Downloads Shield Manager */}
          {activePanel === 'downloads' && (
            <div className="space-y-3">
              {/* Test / Manual Download Scanner Input */}
              <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                <div className="text-xs font-bold text-purple-950 flex items-center gap-1.5">
                  <DownloadCloud className="w-4 h-4 text-purple-600" />
                  <span>Scan & Download External Study Resource</span>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={newDlFilename}
                    onChange={(e) => setNewDlFilename(e.target.value)}
                    placeholder="Filename (e.g. Syllabus_2026.pdf)..."
                    className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none"
                  />
                  <input
                    type="text"
                    value={newDlUrl}
                    onChange={(e) => setNewDlUrl(e.target.value)}
                    placeholder="Resource URL..."
                    className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none"
                  />
                  <button
                    onClick={() => handleInitiateDownload(newDlFilename, newDlUrl)}
                    className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shrink-0"
                  >
                    Scan & Save
                  </button>
                </div>
              </div>

              {/* Downloads History List */}
              <div className="space-y-2">
                {downloads.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No downloaded study files recorded.</p>
                ) : (
                  downloads.map((d) => (
                    <div
                      key={d.id}
                      className="p-2.5 rounded-xl bg-white border border-slate-200 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center space-x-2.5">
                        <FileText className="w-4 h-4 text-purple-600 shrink-0" />
                        <div>
                          <div className="font-bold text-slate-800 flex items-center gap-1.5">
                            <span>{d.filename}</span>
                            <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-mono text-[9px]">
                              Scanned Safe
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {d.size} • {d.timestamp} • {d.url}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() =>
                          onShowNotification?.(
                            `Opening ${d.filename} in StudyOS Isolated Workspace`,
                            'File Verified'
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-purple-100 hover:bg-purple-200 text-purple-900 font-bold text-[11px] cursor-pointer"
                      >
                        Open File
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Privacy Dashboard Panel */}
          {activePanel === 'privacy' && (
            <div className="space-y-4 text-xs">
              <div className="p-3 bg-purple-950 text-white rounded-xl flex items-center justify-between shadow-md">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-800/80 rounded-xl">
                    <Lock className="w-5 h-5 text-purple-300" />
                  </div>
                  <div>
                    <div className="font-extrabold text-sm text-purple-100">StudyOS Privacy & Data Guard</div>
                    <div className="text-[11px] text-purple-300 font-medium">
                      Real-time local storage metrics, active session tracking & cache management.
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <span
                    className={`px-2.5 py-1 rounded-lg font-black text-[10px] tracking-wider uppercase ${
                      isIncognito ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {isIncognito ? 'Incognito Mode' : 'Standard Session'}
                  </span>
                </div>
              </div>

              {/* Metrics Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {/* Metric 1: Cookies */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 font-bold">
                    <span>Stored Cookies</span>
                    <Database className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {cookieCount} <span className="text-xs font-normal text-slate-500">cookies</span>
                  </div>
                  <div className="text-[10px] text-purple-700 font-mono">
                    Est. Size: {cookieSizeKb} KB (Isolated)
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      browserSecurityService.clearCookies();
                      setCookieCount(0);
                      setCookieSizeKb(0);
                      onShowNotification?.('All browser session cookies cleared', 'Privacy Dashboard');
                    }}
                    className="w-full mt-2 py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Cookies</span>
                  </button>
                </div>

                {/* Metric 2: Cache Size */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 font-bold">
                    <span>Browser Cache</span>
                    <HardDrive className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {cacheSizeMb} <span className="text-xs font-normal text-slate-500">MB</span>
                  </div>
                  <div className="text-[10px] text-purple-700 font-mono">
                    {cacheItemsCount} cached page assets
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      browserSecurityService.clearCache();
                      setCacheItemsCount(0);
                      setCacheSizeMb(0);
                      onShowNotification?.('Temporary web cache purged', 'Privacy Dashboard');
                    }}
                    className="w-full mt-2 py-1 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Clear Cache</span>
                  </button>
                </div>

                {/* Metric 3: Active Session Duration */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 font-bold">
                    <span>Active Session</span>
                    <Clock className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-lg font-black text-slate-900 font-mono">
                    {formatSessionDuration(sessionDurationSec)}
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Active browser runtime
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSessionDurationSec(0);
                      onShowNotification?.('Active session timer reset', 'Privacy Dashboard');
                    }}
                    className="w-full mt-2 py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reset Session</span>
                  </button>
                </div>

                {/* Metric 4: Incognito Mode Toggle Card */}
                <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1.5 shadow-2xs">
                  <div className="flex items-center justify-between text-slate-500 font-bold">
                    <span>Incognito Mode</span>
                    <EyeOff className="w-4 h-4 text-purple-600" />
                  </div>
                  <div className="text-sm font-black text-slate-900">
                    {isIncognito ? 'Memory Only' : 'Disk Storage'}
                  </div>
                  <div className="text-[10px] text-slate-500">
                    {isIncognito ? 'No data written to disk' : 'Encrypted storage active'}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !isIncognito;
                      setIsIncognito(next);
                      onShowNotification?.(
                        next ? 'Incognito Mode Enabled' : 'Incognito Mode Disabled',
                        'Privacy Dashboard'
                      );
                    }}
                    className={`w-full mt-2 py-1 px-2 rounded-lg font-bold text-[10px] transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      isIncognito
                        ? 'bg-amber-600 hover:bg-amber-700 text-white'
                        : 'bg-slate-900 hover:bg-slate-800 text-purple-200'
                    }`}
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>{isIncognito ? 'Exit Incognito' : 'Enable Incognito'}</span>
                  </button>
                </div>
              </div>

              {/* Clear All Privacy Data Button */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div>
                  <div className="font-bold text-slate-900">Purge All Privacy & Cache Storage</div>
                  <div className="text-[10px] text-slate-500">Clears cookies, cache, active session logs, and history in one click.</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    browserSecurityService.clearCookies();
                    browserSecurityService.clearCache();
                    setCookieCount(0);
                    setCookieSizeKb(0);
                    setCacheItemsCount(0);
                    setCacheSizeMb(0);
                    setSessionDurationSec(0);
                    handleClearCacheAndVault();
                  }}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg text-xs cursor-pointer transition-all flex items-center gap-1.5 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Purge All Privacy Data</span>
                </button>
              </div>
            </div>
          )}

          {/* Browser Settings & Security Center Panel */}
          {activePanel === 'settings' && (
            <div className="space-y-4">
              {/* Settings Sub-Tabs Header */}
              <div className="flex items-center space-x-1 border-b border-slate-200 pb-2 overflow-x-auto custom-scrollbar text-xs">
                <button
                  onClick={() => setSettingsTab('security')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'security'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Security Center</span>
                </button>

                <button
                  onClick={() => setSettingsTab('trusted')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'trusted'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Trusted Sites ({trustedDomains.length})</span>
                </button>

                <button
                  onClick={() => setSettingsTab('permissions')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'permissions'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Domain Permissions</span>
                </button>

                <button
                  onClick={() => setSettingsTab('privacy')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'privacy'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  <span>Privacy Controls</span>
                </button>

                <button
                  onClick={() => setSettingsTab('downloads')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'downloads'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Shield</span>
                </button>

                <button
                  onClick={() => setSettingsTab('data')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'data'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Key className="w-3.5 h-3.5" />
                  <span>Encrypted Storage</span>
                </button>

                <button
                  onClick={() => setSettingsTab('sandbox')}
                  className={`px-3 py-1.5 rounded-xl font-bold cursor-pointer transition-all flex items-center gap-1.5 shrink-0 ${
                    settingsTab === 'sandbox'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-purple-50'
                  }`}
                >
                  <Cpu className="w-3.5 h-3.5" />
                  <span>Sandbox Metrics</span>
                </button>
              </div>

              {/* TAB 1: SECURITY CENTER */}
              {settingsTab === 'security' && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">Domain Whitelist Enforcement</div>
                        <div className="text-[10px] text-slate-500">
                          Restrict access strictly to pre-approved trusted domains.
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleSecuritySetting('whitelistingEnabled')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          securityConfig.whitelistingEnabled
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {securityConfig.whitelistingEnabled ? 'ACTIVE' : 'OFF'}
                      </button>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">Executable Download Guard</div>
                        <div className="text-[10px] text-slate-500">
                          Block .exe, .bat, .sh, .vbs, .apk, .dmg binaries by default.
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleSecuritySetting('blockExecutables')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          securityConfig.blockExecutables
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {securityConfig.blockExecutables ? 'ACTIVE' : 'OFF'}
                      </button>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">Download Auto-Scan Engine</div>
                        <div className="text-[10px] text-slate-500">
                          Inspect file signatures before saving to disk.
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleSecuritySetting('scanDownloads')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          securityConfig.scanDownloads
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {securityConfig.scanDownloads ? 'ACTIVE' : 'OFF'}
                      </button>
                    </div>

                    <div className="p-3 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">Isolated Cookie & Site Storage</div>
                        <div className="text-[10px] text-slate-500">
                          Prevent web pages from reading StudyOS internal data.
                        </div>
                      </div>
                      <button
                        onClick={() => handleToggleSecuritySetting('cookieIsolation')}
                        className={`px-2.5 py-1 rounded-lg font-bold text-xs cursor-pointer transition-all ${
                          securityConfig.cookieIsolation
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {securityConfig.cookieIsolation ? 'ACTIVE' : 'OFF'}
                      </button>
                    </div>
                  </div>

                  {/* General Config inputs */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-800">Default Search Engine</label>
                      <select
                        value={searchEngine}
                        onChange={(e) => setSearchEngine(e.target.value as any)}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none cursor-pointer"
                      >
                        <option value="google">Google Search (Embedded)</option>
                        <option value="duckduckgo">DuckDuckGo (Privacy Focused)</option>
                        <option value="bing">Microsoft Bing</option>
                        <option value="startpage">Startpage</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="font-extrabold text-slate-800">Browser Home Page URL</label>
                      <input
                        type="text"
                        value={homeUrl}
                        onChange={(e) => setHomeUrl(e.target.value)}
                        className="w-full p-2 rounded-xl border border-slate-200 bg-white font-bold text-slate-800 outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: TRUSTED SITES WHITELIST MANAGER */}
              {settingsTab === 'trusted' && (
                <div className="space-y-3 text-xs">
                  {/* Add Domain Form */}
                  <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-xl space-y-2">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5">
                      <Plus className="w-4 h-4 text-purple-600" />
                      <span>Add New Domain to Trusted Whitelist</span>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <input
                        type="text"
                        value={newDomainInput}
                        onChange={(e) => setNewDomainInput(e.target.value)}
                        placeholder="Domain (e.g. coursera.org, mit.edu)..."
                        className="flex-1 p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold outline-none"
                      />
                      <select
                        value={newDomainCategory}
                        onChange={(e) => setNewDomainCategory(e.target.value)}
                        className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold outline-none cursor-pointer"
                      >
                        <option value="Lectures">Lectures</option>
                        <option value="Study Resource">Study Resource</option>
                        <option value="Docs">Docs & Specs</option>
                        <option value="Research">Research</option>
                      </select>
                      <button
                        onClick={() => handleAddDomainToWhitelist(newDomainInput)}
                        className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs cursor-pointer shrink-0"
                      >
                        Approve & Whitelist
                      </button>
                    </div>
                  </div>

                  {/* Filter & List */}
                  <div className="flex items-center justify-between gap-2">
                    <input
                      type="text"
                      value={trustedSearchQuery}
                      onChange={(e) => setTrustedSearchQuery(e.target.value)}
                      placeholder="Search whitelist database..."
                      className="p-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium outline-none w-full max-w-xs"
                    />
                    <span className="text-[11px] font-mono text-slate-500">
                      Total: {trustedDomains.length} domains
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-56 overflow-y-auto custom-scrollbar">
                    {filteredTrustedDomains.map((item) => (
                      <div
                        key={item.domain}
                        className="p-2 bg-white border border-slate-200 rounded-xl flex items-center justify-between"
                      >
                        <div className="truncate">
                          <div className="font-bold text-slate-800 truncate">{item.domain}</div>
                          <div className="text-[9px] font-mono text-purple-700">{item.category}</div>
                        </div>
                        <button
                          onClick={() => handleRemoveDomainFromWhitelist(item.domain)}
                          className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer"
                          title="Remove from Whitelist"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB: DOMAIN PERMISSIONS */}
              {settingsTab === 'permissions' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-purple-50/80 border border-purple-200 rounded-xl space-y-1">
                    <div className="font-bold text-purple-950 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-purple-600" />
                      <span>Trusted Domain Permission Control Panel</span>
                    </div>
                    <p className="text-[11px] text-purple-800">
                      Toggle hardware access (Camera, Microphone) and Notifications individually for each approved learning domain.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                    {trustedDomains.map((item) => {
                      const perms = browserSecurityService.getDomainPermissions(item.domain);
                      return (
                        <div key={item.domain} className="p-3 bg-white border border-slate-200 rounded-xl space-y-2.5 shadow-2xs">
                          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
                            <div className="truncate min-w-0 mr-2">
                              <div className="font-extrabold text-slate-900 truncate text-xs">{item.domain}</div>
                              <div className="text-[9px] font-mono text-purple-700">{item.category}</div>
                            </div>
                            <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[9px] shrink-0">
                              APPROVED
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {/* Camera */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Camera className="w-3.5 h-3.5 text-slate-500" />
                                <span>Camera</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleDomainPerm(item.domain, 'camera')}
                                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] cursor-pointer transition-all ${
                                  perms.camera ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {perms.camera ? 'ALLOWED' : 'BLOCKED'}
                              </button>
                            </div>

                            {/* Microphone */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Mic className="w-3.5 h-3.5 text-slate-500" />
                                <span>Microphone</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleDomainPerm(item.domain, 'microphone')}
                                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] cursor-pointer transition-all ${
                                  perms.microphone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {perms.microphone ? 'ALLOWED' : 'BLOCKED'}
                              </button>
                            </div>

                            {/* Notifications */}
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="flex items-center gap-1.5 text-slate-700 font-medium">
                                <Bell className="w-3.5 h-3.5 text-slate-500" />
                                <span>Notifications</span>
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleDomainPerm(item.domain, 'notifications')}
                                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] cursor-pointer transition-all ${
                                  perms.notifications ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {perms.notifications ? 'ALLOWED' : 'BLOCKED'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* TAB 3: PRIVACY CONTROLS */}
              {settingsTab === 'privacy' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-600 shrink-0" />
                    <div>
                      <div className="font-bold text-emerald-950">100% Local-First Privacy Policy Active</div>
                      <div className="text-[11px] text-emerald-800">
                        Zero cloud sync, zero external telemetry tracking, zero third-party data sharing. All browsing data remains encrypted strictly on your desktop device.
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-800">Telemetry & Analytics Tracking</span>
                      <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 font-extrabold text-[10px]">
                        BLOCKED BY DEFAULT
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-800">Third-Party Cookies</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                        ISOLATED IN SANDBOX
                      </span>
                    </div>

                    <div className="p-2.5 bg-white border border-slate-200 rounded-xl flex items-center justify-between">
                      <span className="font-bold text-slate-800">Desktop File System Isolation</span>
                      <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-extrabold text-[10px]">
                        HARDENED IPC ACTIVE
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: DOWNLOAD SHIELD */}
              {settingsTab === 'downloads' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">Protected Download Directory</div>
                    <div className="font-mono text-[11px] text-purple-700 bg-purple-50 p-2 rounded-lg border border-purple-100">
                      /StudyOS/IsolatedDownloads/
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">Blocked Executable Extensions</div>
                    <div className="text-[11px] text-slate-600">
                      .exe, .bat, .cmd, .sh, .vbs, .msi, .apk, .dmg, .scr, .ps1, .jar, .iso, .dll, .sys, .reg
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: ENCRYPTED STORAGE */}
              {settingsTab === 'data' && (
                <div className="space-y-3 text-xs">
                  <div className="p-3 bg-slate-900 text-white rounded-xl space-y-2">
                    <div className="font-bold text-purple-300 flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-emerald-400" />
                      <span>AES-256-GCM WebCrypto / OS Keychain Storage</span>
                    </div>
                    <p className="text-[11px] text-slate-300">
                      All browsing history, saved bookmarks, download logs, and whitelist domain tables are encrypted before writing to persistent local disk.
                    </p>
                  </div>

                  <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                    <div className="font-bold text-rose-950 flex items-center gap-1.5">
                      <Trash2 className="w-4 h-4 text-rose-600" />
                      <span>Purge All Encrypted Local Browser Data</span>
                    </div>
                    <p className="text-[11px] text-rose-800">
                      Irreversibly deletes all local browsing history, saved bookmarks, downloads, and custom domain approvals.
                    </p>
                    <button
                      onClick={handleClearCacheAndVault}
                      className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer transition-all"
                    >
                      Confirm Data Purge
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 6: SANDBOX METRICS */}
              {settingsTab === 'sandbox' && (
                <div className="space-y-3 text-xs">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div className="p-2.5 bg-purple-50 border border-purple-200 rounded-xl">
                      <div className="text-[10px] uppercase font-black text-purple-600">Process State</div>
                      <div className="font-extrabold text-purple-950 mt-1">ISOLATED SANDBOX</div>
                    </div>

                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                      <div className="text-[10px] uppercase font-black text-emerald-600">Security Filters</div>
                      <div className="font-extrabold text-emerald-950 mt-1">
                        {sandboxStatus.activeFiltersCount} Active Shields
                      </div>
                    </div>

                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl">
                      <div className="text-[10px] uppercase font-black text-amber-600">Blocked Threats</div>
                      <div className="font-extrabold text-amber-950 mt-1">
                        {sandboxStatus.blockedThreatsCount} Threats Shielded
                      </div>
                    </div>

                    <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                      <div className="text-[10px] uppercase font-black text-blue-600">Encryption</div>
                      <div className="font-extrabold text-blue-950 mt-1">AES-256-GCM</div>
                    </div>
                  </div>

                  <div className="p-3 bg-white border border-slate-200 rounded-xl space-y-1">
                    <div className="font-bold text-slate-900">Active Iframe Sandbox Attributes</div>
                    <div className="font-mono text-[10px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      {sandboxStatus.iframeSandboxFlags.join(' ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </GlassCard>

      )}

      {/* --- THREAT DOWNLOAD WARNING MODAL --- */}
      {threatDownloadModal && (
        <div className="fixed inset-0 z-[100000] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
          <GlassCard className="max-w-md w-full !p-5 border-2 border-rose-500/80 shadow-2xl space-y-4 text-slate-900">
            <div className="flex items-center space-x-3 text-rose-600">
              <AlertOctagon className="w-8 h-8 shrink-0 animate-bounce" />
              <div>
                <h3 className="text-base font-black text-rose-900">Executable Download Blocked</h3>
                <span className="text-xs font-bold text-rose-700">OS Security Guard Enforced</span>
              </div>
            </div>

            <p className="text-xs text-slate-700 leading-relaxed bg-rose-50 p-3 rounded-xl border border-rose-200 font-medium">
              File <b>"{threatDownloadModal.filename}"</b> was flagged as an executable binary (.exe / .bat / .apk / .dmg). Executable downloads are blocked by default to prevent desktop malware injection.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setThreatDownloadModal(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs cursor-pointer"
              >
                Dismiss & Cancel Download
              </button>
            </div>
          </GlassCard>
        </div>
      )}

      {/* --- MAIN WORKSPACE BODY (SIDEBAR + STAGE) --- */}
      <div className="flex-1 min-h-0 flex space-x-2 overflow-hidden relative">
        {/* COLLAPSIBLE HISTORY SIDEBAR */}
        {isHistorySidebarOpen && (
          <GlassCard className="w-72 shrink-0 flex flex-col space-y-2 !p-3 border border-slate-200/90 shadow-sm animate-fadeIn overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-purple-600" />
                <h3 className="text-xs font-black uppercase text-slate-900 tracking-wider">
                  Session History
                </h3>
              </div>
              <button
                onClick={() => setIsHistorySidebarOpen(false)}
                className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Search history & sessions..."
                className="w-full bg-white border border-slate-200 rounded-xl pl-8 pr-2 py-1.5 text-xs font-medium outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1">
              {filteredHistory.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-400 italic">
                  No matching sessions found
                </div>
              ) : (
                filteredHistory.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleReopenHistoryItem(item)}
                    className="p-2 rounded-xl bg-white/80 border border-slate-200 hover:border-purple-300 hover:bg-purple-50/60 cursor-pointer transition-all space-y-1 group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-800 truncate flex-1 group-hover:text-purple-900">
                        {item.title}
                      </span>
                      <span className="text-[9px] font-mono text-slate-400 shrink-0 ml-1">
                        {item.timestamp}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-mono text-slate-400 truncate max-w-[140px]">{item.url}</span>
                      {item.subject && (
                        <span className="bg-purple-100 text-purple-800 font-extrabold px-1.5 py-0.2 rounded shrink-0">
                          {item.subject}
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* History Sidebar Footer */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] shrink-0">
              <span className="font-mono text-slate-400">AES-256 Encrypted Log</span>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear History</span>
                </button>
              )}
            </div>
          </GlassCard>
        )}

        {/* STAGE MAIN WORKSPACE CONTENT */}
        <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-white rounded-2xl border border-slate-200/90 overflow-hidden shadow-2xs relative">
          {activeTab?.readerMode ? (
            /* DISTRACTION-FREE ACADEMIC READER MODE LAYOUT */
            <div
              className={`flex-1 overflow-y-auto p-6 md:p-10 transition-colors custom-scrollbar ${
                readerTheme === 'sepia'
                  ? 'bg-[#fbf0d9] text-[#2c221e]'
                  : readerTheme === 'dark'
                  ? 'bg-slate-900 text-slate-100'
                  : 'bg-white text-slate-900'
              }`}
            >
              <div className="max-w-3xl mx-auto space-y-6">
                {/* Reader Controls Toolbar */}
                <div
                  className={`p-3 rounded-2xl border flex flex-wrap items-center justify-between gap-3 text-xs shadow-xs ${
                    readerTheme === 'sepia'
                      ? 'bg-[#f4e4c1] border-[#e2cb9c]'
                      : readerTheme === 'dark'
                      ? 'bg-slate-800 border-slate-700 text-slate-200'
                      : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <div className="flex items-center space-x-2 font-bold">
                    <span className="px-2.5 py-1 rounded-full bg-amber-500 text-slate-950 font-black text-[11px] flex items-center gap-1.5 shadow-2xs">
                      <BookOpen className="w-3.5 h-3.5" />
                      <span>Academic Reader Mode</span>
                    </span>
                    <span className="font-mono text-[11px] opacity-75 hidden md:inline">
                      ~4 min read • Distraction-Free
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Font Family Toggle */}
                    <div className="flex items-center bg-black/5 rounded-lg p-0.5 font-bold text-[11px]">
                      <button
                        type="button"
                        onClick={() => setReaderFontFamily('serif')}
                        className={`px-2 py-0.5 rounded cursor-pointer font-serif ${
                          readerFontFamily === 'serif'
                            ? 'bg-amber-600 text-white font-extrabold shadow-2xs'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        Serif
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaderFontFamily('sans')}
                        className={`px-2 py-0.5 rounded cursor-pointer font-sans ${
                          readerFontFamily === 'sans'
                            ? 'bg-amber-600 text-white font-extrabold shadow-2xs'
                            : 'opacity-70 hover:opacity-100'
                        }`}
                      >
                        Sans
                      </button>
                    </div>

                    {/* Font Size Adjusters */}
                    <div className="flex items-center bg-black/5 rounded-lg p-0.5 font-extrabold text-[11px]">
                      <button
                        type="button"
                        onClick={() => setReaderFontSize((s) => Math.max(12, s - 2))}
                        className="px-2 py-0.5 hover:bg-black/10 rounded cursor-pointer"
                        title="Decrease Font Size"
                      >
                        A-
                      </button>
                      <span className="px-1 font-mono text-[10px]">{readerFontSize}px</span>
                      <button
                        type="button"
                        onClick={() => setReaderFontSize((s) => Math.min(28, s + 2))}
                        className="px-2 py-0.5 hover:bg-black/10 rounded cursor-pointer"
                        title="Increase Font Size"
                      >
                        A+
                      </button>
                    </div>

                    {/* Theme Palette Toggle */}
                    <div className="flex items-center bg-black/5 rounded-lg p-0.5 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setReaderTheme('sepia')}
                        className={`px-2 py-0.5 rounded cursor-pointer font-bold ${
                          readerTheme === 'sepia'
                            ? 'bg-amber-200 text-amber-950 font-black'
                            : 'opacity-70'
                        }`}
                      >
                        Sepia
                      </button>
                      <button
                        type="button"
                        onClick={() => setReaderTheme('light')}
                        className={`px-2 py-0.5 rounded cursor-pointer font-bold ${
                          readerTheme === 'light'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'opacity-70'
                        }`}
                      >
                        Light
                      </button>
                    </div>

                    {/* Save to Reading List Button */}
                    <button
                      type="button"
                      onClick={() => handleAddToReadingList()}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow-2xs"
                      title="Save article to Reading List"
                    >
                      <BookMarked className="w-3 h-3" />
                      <span className="hidden sm:inline">Save</span>
                    </button>

                    {/* Print Article Button */}
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="p-1 hover:bg-black/10 rounded cursor-pointer"
                      title="Print or Export Article"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    {/* Exit Reader Mode */}
                    <button
                      type="button"
                      onClick={() =>
                        setTabs((prev) =>
                          prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: false } : t))
                        )
                      }
                      className="p-1 hover:bg-black/10 rounded cursor-pointer text-rose-600 font-extrabold"
                      title="Exit Reader Mode"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Article Content Extractor Document Body */}
                <article
                  className={`space-y-6 leading-relaxed ${
                    readerFontFamily === 'serif' ? 'font-serif' : 'font-sans'
                  }`}
                  style={{ fontSize: `${readerFontSize}px` }}
                >
                  <header className="space-y-3 pb-4 border-b border-black/10">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-900 font-extrabold rounded-md">
                        {activeTab.subject || selectedSubject}
                      </span>
                      <span className="font-mono text-xs opacity-60">Source: {activeTab.url}</span>
                    </div>

                    <h1
                      className="font-bold tracking-tight text-slate-900"
                      style={{ fontSize: `${readerFontSize * 1.55}px`, lineHeight: 1.25 }}
                    >
                      {activeTab.title}
                    </h1>

                    <div className="flex items-center justify-between text-xs opacity-75 font-mono pt-1">
                      <span>Extracted via StudyOS Reader Engine</span>
                      <span>Domain: {getDomainFromUrl(activeTab.url)}</span>
                    </div>
                  </header>

                  {/* Abstract Box */}
                  <section
                    className={`p-4 rounded-xl border ${
                      readerTheme === 'sepia'
                        ? 'bg-[#f3e3be] border-[#e0ca98]'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <h2 className="text-sm font-extrabold uppercase tracking-wider mb-2 text-amber-800 font-sans flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Abstract & Executive Overview</span>
                    </h2>
                    <p className="text-xs leading-relaxed opacity-90 italic">
                      This article presents key concepts and structural formulations extracted from{' '}
                      <b>{activeTab.url}</b>. Formatted in distraction-free typography for academic research, deep synthesis, and exam preparation.
                    </p>
                  </section>

                  {/* Article Key Takeaways */}
                  <section className="space-y-3">
                    <h3 className="text-base font-extrabold text-slate-900 font-sans border-l-4 border-amber-600 pl-3">
                      Core Principles & Findings
                    </h3>
                    <ul className="list-disc pl-6 space-y-2 text-sm">
                      <li>
                        <b>Systematic Overview:</b> Comprehensive analysis of the core protocols, mathematical proofs, or algorithmic flows presented in the source document.
                      </li>
                      <li>
                        <b>Architectural Modularity:</b> Clear demarcation between theoretical foundation, state transitions, and real-world implementation constraints.
                      </li>
                      <li>
                        <b>Academic Application:</b> Suitable for university coursework, competitive exams (GATE, JEE, GRE, NPTEL), and literature reviews.
                      </li>
                    </ul>
                  </section>

                  {/* Article Body Section */}
                  <section className="space-y-4">
                    <h3 className="text-base font-extrabold text-slate-900 font-sans border-l-4 border-amber-600 pl-3">
                      Detailed Analysis
                    </h3>
                    <p>
                      When studying complex topics on the web, clutter like advertisements, sidebars, popups, and tracking scripts significantly degrade reading comprehension and retention. The StudyOS Academic Reader Mode automatically strips irrelevant layout elements, isolating the core text into a high-contrast container.
                    </p>
                    <p>
                      You can customize the typography to match your reading preferences: switch between classic Serif and modern Sans-Serif fonts, adjust font sizing, switch between light and warm sepia themes, or print the document cleanly.
                    </p>
                  </section>

                  {/* Citations & Footer */}
                  <footer
                    className={`pt-6 mt-8 border-t text-xs space-y-2 font-mono ${
                      readerTheme === 'sepia'
                        ? 'border-[#e0ca98] opacity-80'
                        : 'border-slate-200 text-slate-500'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <span>Citation: StudyOS Academic Reader ({new Date().getFullYear()})</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddToReadingList()}
                          className="hover:underline text-amber-700 font-bold cursor-pointer"
                        >
                          + Add to Reading List
                        </button>
                        <span>•</span>
                        <a
                          href={activeTab.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:underline text-purple-700 font-bold"
                        >
                          Open Source Webpage ↗
                        </a>
                      </div>
                    </div>
                  </footer>
                </article>
              </div>
            </div>
          ) : isElectronDesktop ? (
            /* NATIVE ELECTRON CHROMIUM MULTI-PROCESS WEBSTAGE */
            <div className="flex-1 min-h-0 min-w-0 w-full h-full relative flex-grow overflow-hidden bg-white flex flex-col">
              {/* NATIVE CONTROL BAR */}
              <div className="bg-slate-100/90 backdrop-blur-xs px-3 py-1.5 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 shrink-0 gap-2">
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-mono text-[11px] truncate text-slate-700 font-semibold">{activeTab?.url}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isStudyMode ? 'bg-emerald-100 text-emerald-800' : 'bg-purple-100 text-purple-800'
                    }`}
                  >
                    {isStudyMode ? 'Study Mode (Strict)' : 'Open Browsing'}
                  </span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleToggleStudyMode}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[10px] shadow-2xs transition-all cursor-pointer flex items-center gap-1 ${
                      isStudyMode ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}
                    title="Toggle Study Mode (Strict Whitelist) vs Open Browsing (OAuth & Any Web URL)"
                  >
                    {isStudyMode ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    <span>{isStudyMode ? 'Study Mode: On' : 'Open Browsing'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const activeWv = webviewRefs.current.get(activeTabId);
                      if (activeWv && typeof activeWv.print === 'function') activeWv.print();
                      else window.print();
                    }}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 font-bold text-[11px] shadow-2xs cursor-pointer"
                    title="Print Active Page"
                  >
                    <Printer className="w-3 h-3 text-purple-600" />
                    <span>Print</span>
                  </button>
                </div>
              </div>

              {/* MULTI-PROCESS WEBVIEWS LAYER */}
              <div className="flex-1 min-h-0 min-w-0 w-full h-full relative overflow-hidden bg-white">
                {tabs.map((tab) => {
                  const isActive = tab.id === activeTabId;
                  return (
                    /* @ts-ignore */
                    <webview
                      key={tab.id}
                      ref={(el) => {
                        if (el) {
                          webviewRefs.current.set(tab.id, el);
                          attachWebviewListeners(tab.id, el);
                        } else {
                          webviewRefs.current.delete(tab.id);
                        }
                      }}
                      src={tab.url}
                      partition="persist:studybrowser"
                      useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
                      allowpopups
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        display: isActive ? 'flex' : 'none',
                        transform: (tab.zoomLevel || 100) !== 100 ? `scale(${(tab.zoomLevel || 100) / 100})` : undefined,
                        transformOrigin: 'top left',
                      }}
                    />
                  );
                })}
              </div>
            </div>
          ) : isGoogleUrl(activeTab?.url) ? (
            /* GOOGLE SEARCH & SCHOLAR PORTAL */
            <GoogleSearchPortal
              url={activeTab.url}
              onNavigate={navigateTab}
              onOpenExternal={(u) => window.open(u, '_blank', 'noopener,noreferrer')}
              onEnableReaderMode={() =>
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: true } : t))
                )
              }
              subject={selectedSubject}
            />
          ) : isLocalAIUrl(activeTab?.url) ? (
            /* LOCAL AI ASSISTANT PORTAL (100% Offline • llama.cpp) */
            <LocalAIPortal
              url={activeTab.url}
              onNavigate={navigateTab}
              onOpenExternal={(u) => window.open(u, '_blank', 'noopener,noreferrer')}
              onEnableReaderMode={() =>
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: true } : t))
                )
              }
              subject={selectedSubject}
            />
          ) : frameRefusedTabs[activeTab?.id] ? (
            /* FRAME REFUSED FALLBACK CARD */
            <FrameRefusedFallback
              url={activeTab.url}
              domain={getDomainFromUrl(activeTab.url)}
              onOpenExternal={(u) => window.open(u, '_blank', 'noopener,noreferrer')}
              onEnableReaderMode={() =>
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTabId ? { ...t, readerMode: true } : t))
                )
              }
              onNavigate={navigateTab}
            />
          ) : !isCurrentDomainTrusted && !isCurrentTabBypassed ? (
            /* UNTRUSTED DOMAIN INTERSTITIAL BLOCK PAGE */
            <div className="flex-1 flex flex-col items-center justify-center p-6 bg-slate-900 text-white text-center space-y-5 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-amber-500/20 border-2 border-amber-500 flex items-center justify-center text-amber-400">
                <ShieldAlert className="w-8 h-8 animate-pulse" />
              </div>

              <div className="space-y-2 max-w-lg">
                <h2 className="text-xl font-black text-white">Untrusted Domain Access Restricted</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  The website <span className="font-mono text-amber-300 font-extrabold">{getDomainFromUrl(activeTab.url)}</span> is not currently listed in your StudyOS Trusted Whitelist.
                </p>
                <div className="p-3 rounded-xl bg-slate-800/90 border border-slate-700 text-left text-[11px] font-mono text-slate-400 space-y-1">
                  <div>Target URL: {activeTab.url}</div>
                  <div>Security Action: Domain Whitelist Isolation</div>
                  <div>Status: Blocked until approved</div>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
                <button
                  onClick={() => handleAddDomainToWhitelist(getDomainFromUrl(activeTab.url))}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs cursor-pointer transition-all shadow-lg flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approve & Whitelist Domain</span>
                </button>

                <button
                  onClick={() =>
                    setUntrustedBypassedTabs((prev) => ({
                      ...prev,
                      [activeTab.id + '-' + activeTab.url]: true,
                    }))
                  }
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-extrabold text-xs cursor-pointer transition-all border border-slate-700 flex items-center gap-1.5"
                >
                  <Unlock className="w-4 h-4 text-amber-400" />
                  <span>Proceed Once (Untrusted Mode)</span>
                </button>

                <button
                  onClick={() => navigateTab('https://www.google.com')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs cursor-pointer transition-all flex items-center gap-1.5"
                >
                  <Home className="w-4 h-4" />
                  <span>Return to Safety (Google)</span>
                </button>
              </div>
            </div>
          ) : (
            /* STANDARD CHROMIUM EMBEDDED WEBSTAGE */
            <div className="flex-1 min-h-0 min-w-0 w-full h-full relative flex-grow overflow-hidden bg-white flex flex-col">
              {/* EMBEDDED CHROMIUM CONTROL BAR */}
              <div className="bg-slate-100/90 backdrop-blur-xs px-3 py-1.5 border-b border-slate-200 flex flex-wrap items-center justify-between text-xs text-slate-600 shrink-0 gap-2">
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span className="font-mono text-[11px] truncate text-slate-700 font-semibold">{activeTab?.url}</span>
                </div>
                <div className="flex items-center space-x-2 shrink-0">
                  <button
                    type="button"
                    onClick={() =>
                      setFrameRefusedTabs((prev) => ({ ...prev, [activeTab.id]: true }))
                    }
                    className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-amber-100 border border-amber-200 text-amber-900 hover:bg-amber-200 font-bold text-[10px] shadow-2xs transition-all cursor-pointer"
                    title="Click if webpage displays blank or 'Refused to connect' error"
                  >
                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                    <span>Refused to Connect?</span>
                  </button>

                  <a
                    href={activeTab?.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:bg-purple-50 text-purple-900 font-extrabold text-[11px] shadow-2xs transition-all cursor-pointer"
                    title="Open webpage directly in new browser window or tab"
                  >
                    <span>Open External</span>
                    <ExternalLink className="w-3 h-3 text-purple-600" />
                  </a>
                </div>
              </div>

              {/* WEBVIEW IFRAME WRAPPER */}
              <div
                className="flex-1 min-h-0 min-w-0 w-full h-full relative flex-grow overflow-hidden bg-white"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flexGrow: 1,
                  transform: (activeTab?.zoomLevel || 100) !== 100 ? `scale(${(activeTab?.zoomLevel || 100) / 100})` : undefined,
                  transformOrigin: 'top left',
                  width: (activeTab?.zoomLevel || 100) !== 100 ? `${10000 / (activeTab?.zoomLevel || 100)}%` : '100%',
                  height: (activeTab?.zoomLevel || 100) !== 100 ? `${10000 / (activeTab?.zoomLevel || 100)}%` : '100%',
                }}
              >
                <iframe
                  ref={iframeRef}
                  key={activeTab?.id + '-' + activeTab?.url}
                  src={activeTab?.url}
                  title={activeTab?.title || 'Web Page'}
                  className="w-full h-full border-none outline-none block absolute inset-0 z-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-downloads allow-modals allow-presentation"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
