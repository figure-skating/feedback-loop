interface VideoStorage {
  id: string;
  name: string;
  type: 'reference' | 'user';
  blob: Blob;
  timestamp: number;
}

class VideoStorageService {
  private dbName = 'FeedbackLoopVideos';
  private version = 1;
  private storeName = 'videos';

  private async openDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'id' });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveVideo(file: File, type: 'reference' | 'user'): Promise<string> {
    const db = await this.openDB();
    const id = `${type}_${Date.now()}`;
    
    // Convert File to Blob for storage
    const blob = new Blob([file], { type: file.type });
    
    const videoData: VideoStorage = {
      id,
      name: file.name,
      type,
      blob,
      timestamp: Date.now()
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      // Remove any existing video of this type first
      const index = store.index('type');
      const deleteRequest = index.openCursor(IDBKeyRange.only(type));
      
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          // Now add the new video
          const addRequest = store.add(videoData);
          addRequest.onsuccess = () => {
            resolve(id);
          };
          addRequest.onerror = () => reject(addRequest.error);
        }
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  async getVideo(type: 'reference' | 'user'): Promise<File | null> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('type');
      
      const request = index.get(type);
      
      request.onsuccess = () => {
        const result = request.result as VideoStorage | undefined;
        if (result) {
          // Convert Blob back to File
          const file = new File([result.blob], result.name, { type: result.blob.type });
          resolve(file);
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  async deleteVideo(type: 'reference' | 'user'): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const index = store.index('type');
      
      const deleteRequest = index.openCursor(IDBKeyRange.only(type));
      
      deleteRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };

      deleteRequest.onerror = () => reject(deleteRequest.error);
    });
  }

  async clearAllVideos(): Promise<void> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.clear();
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getStorageSize(): Promise<number> {
    const db = await this.openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      
      const request = store.getAll();
      request.onsuccess = () => {
        const videos = request.result as VideoStorage[];
        const totalSize = videos.reduce((size, video) => size + video.blob.size, 0);
        resolve(totalSize);
      };
      request.onerror = () => reject(request.error);
    });
  }
}

export const videoStorageService = new VideoStorageService();