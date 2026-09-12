export interface WorkspaceSnapshot {
  timestamp: string;
  activeTab: string;
  scrollPositions: Record<string, number>;
  drafts?: Record<string, string>;
  focusElementId?: string;
}

const SNAPSHOT_KEY = 'studyos_workspace_state_snapshot';

class WorkspaceStateService {
  private currentSnapshot: WorkspaceSnapshot | null = null;

  /**
   * Captures the current application workspace layout, scroll positions, and state.
   */
  captureSnapshot(activeTab: string): WorkspaceSnapshot {
    const scrollPositions: Record<string, number> = {};

    // Capture main scrollable containers in the workspace
    const mainContainers = document.querySelectorAll('main, .overflow-y-auto, [data-scroll-container]');
    mainContainers.forEach((container, idx) => {
      const id = container.id || `scroll-container-${idx}`;
      scrollPositions[id] = container.scrollTop;
    });

    // Capture active input if editing
    let focusElementId: string | undefined = undefined;
    if (document.activeElement && document.activeElement.id) {
      focusElementId = document.activeElement.id;
    }

    const snapshot: WorkspaceSnapshot = {
      timestamp: new Date().toISOString(),
      activeTab,
      scrollPositions,
      focusElementId,
    };

    this.currentSnapshot = snapshot;
    try {
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot));
    } catch (e) {
      console.warn('Unable to persist workspace snapshot to localStorage:', e);
    }
    return snapshot;
  }

  /**
   * Restores the captured workspace state layout and scroll positions.
   */
  restoreSnapshot(): WorkspaceSnapshot | null {
    let snapshot = this.currentSnapshot;
    if (!snapshot) {
      try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) snapshot = JSON.parse(raw);
      } catch (e) {
        console.warn('Failed to parse saved workspace snapshot:', e);
      }
    }

    if (!snapshot) return null;

    // Restore scroll positions after DOM paint
    setTimeout(() => {
      if (snapshot?.scrollPositions) {
        Object.entries(snapshot.scrollPositions).forEach(([id, pos]) => {
          const el = document.getElementById(id);
          if (el) {
            el.scrollTop = pos;
          }
        });
      }

      if (snapshot?.focusElementId) {
        const el = document.getElementById(snapshot.focusElementId);
        if (el && typeof el.focus === 'function') {
          el.focus();
        }
      }
    }, 100);
    return snapshot;
  }

  /**
   * Gets the last captured snapshot
   */
  getSnapshot(): WorkspaceSnapshot | null {
    return this.currentSnapshot;
  }
}

export const workspaceStateService = new WorkspaceStateService();
