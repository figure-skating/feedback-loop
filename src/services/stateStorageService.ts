import { ManualMarkers, VideoAnalysis } from '../store/analysisStore';
import { JumpMetrics } from './jumpMetricsService';
import { AngleAnalysis } from './angleAnalysisService';

interface StoredState {
  id: string;
  timestamp: number;
  manualMarkers: ManualMarkers | null;
  referenceAnalysis: VideoAnalysis | null;
  userAnalysis: VideoAnalysis | null;
  referenceMetrics: JumpMetrics | null;
  userMetrics: JumpMetrics | null;
  referenceAngles: AngleAnalysis | null;
  userAngles: AngleAnalysis | null;
  referenceVideoPadding: number;
  userVideoPadding: number;
  virtualTimelineDuration: number;
}

class StateStorageService {
  private dbName = 'FeedbackLoopState';
  private version = 1;
  private storeName = 'analysisState';
  private stateKey = 'currentState';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName, { keyPath: 'id' });
        }
      };
    });
  }

  async saveState(state: Omit<StoredState, 'id' | 'timestamp'>): Promise<void> {
    try {
      const db = await this.openDB();
      
      const storedState: StoredState = {
        id: this.stateKey,
        timestamp: Date.now(),
        ...state
      };

      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        
        // Use put to update or create
        const request = store.put(storedState);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          console.error('Failed to save state:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to save state to IndexedDB:', error);
      throw error;
    }
  }

  async loadState(): Promise<StoredState | null> {
    try {
      const db = await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readonly');
        const store = transaction.objectStore(this.storeName);
        const request = store.get(this.stateKey);
        
        request.onsuccess = () => {
          const result = request.result as StoredState | undefined;
          if (result) {
            resolve(result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = () => {
          console.error('Failed to load state:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to load state from IndexedDB:', error);
      return null;
    }
  }

  async clearState(): Promise<void> {
    try {
      const db = await this.openDB();
      
      return new Promise((resolve, reject) => {
        const transaction = db.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.delete(this.stateKey);
        
        request.onsuccess = () => {
          resolve();
        };
        
        request.onerror = () => {
          console.error('Failed to clear state:', request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error('Failed to clear state from IndexedDB:', error);
      throw error;
    }
  }

  // Helper to check if stored state is still valid (not too old)
  isStateValid(state: StoredState, maxAgeMs: number = 24 * 60 * 60 * 1000): boolean {
    const age = Date.now() - state.timestamp;
    return age < maxAgeMs; // Default: 24 hours
  }
}

export const stateStorageService = new StateStorageService();