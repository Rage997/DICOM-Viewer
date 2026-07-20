/**
 * Worker Pool - manages multiple parser workers for parallel processing
 */

import type { DicomFile } from '@/types';
import type { ParseRequest, ParseSuccess, ParseError } from './dicom-parser.worker';

interface WorkerTask {
  id: string;
  fileName: string;
  data: ArrayBuffer;
  resolve: (result: DicomFile) => void;
  reject: (error: Error) => void;
}

/**
 * Pool of Web Workers for DICOM parsing
 */
export class WorkerPool {
  private workers: Worker[] = [];
  private availableWorkers: Worker[] = [];
  private taskQueue: WorkerTask[] = [];
  private pendingTasks = new Map<string, WorkerTask>();
  private taskIdCounter = 0;

  constructor(private workerCount: number = navigator.hardwareConcurrency || 4) {
    this.initializeWorkers();
  }

  /**
   * Initialize worker pool
   */
  private initializeWorkers(): void {
    for (let i = 0; i < this.workerCount; i++) {
      const worker = new Worker(
        new URL('./dicom-parser.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event: MessageEvent<ParseSuccess | ParseError>) => {
        this.handleWorkerMessage(worker, event.data);
      };

      worker.onerror = (error) => {
        console.error('Worker error:', error);
      };

      this.workers.push(worker);
      this.availableWorkers.push(worker);
    }
  }

  /**
   * Handle message from worker
   */
  private handleWorkerMessage(worker: Worker, message: ParseSuccess | ParseError): void {
    const task = this.pendingTasks.get(message.id);
    if (!task) {
      console.warn('Received message for unknown task:', message.id);
      return;
    }

    this.pendingTasks.delete(message.id);

    if ('result' in message) {
      // Success
      task.resolve(message.result);
    } else {
      // Error
      const error = new Error(message.error.message);
      error.name = message.error.code;
      task.reject(error);
    }

    // Worker is now available
    this.availableWorkers.push(worker);

    // Process next task in queue
    this.processNextTask();
  }

  /**
   * Process next task from queue
   */
  private processNextTask(): void {
    if (this.taskQueue.length === 0 || this.availableWorkers.length === 0) {
      return;
    }

    const task = this.taskQueue.shift()!;
    const worker = this.availableWorkers.shift()!;

    this.pendingTasks.set(task.id, task);

    const request: ParseRequest = {
      id: task.id,
      fileName: task.fileName,
      data: task.data,
    };

    worker.postMessage(request, [task.data]); // Transfer ArrayBuffer
  }

  /**
   * Parse DICOM file using worker pool
   */
  async parseDicom(fileName: string, data: ArrayBuffer): Promise<DicomFile> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: `task-${this.taskIdCounter++}`,
        fileName,
        data,
        resolve,
        reject,
      };

      this.taskQueue.push(task);
      this.processNextTask();
    });
  }

  /**
   * Parse multiple DICOM files
   */
  async parseMultiple(
    files: Array<{ fileName: string; data: ArrayBuffer }>,
    onProgress?: (completed: number, total: number) => void
  ): Promise<{
    success: DicomFile[];
    errors: Array<{ file: string; error: Error }>;
  }> {
    let completed = 0;
    const results = await Promise.allSettled(
      files.map(async (file) => {
        try {
          return await this.parseDicom(file.fileName, file.data);
        } finally {
          // Count completions as they settle. Files parse concurrently and
          // resolve out of order, so a per-file array index would make progress
          // jump around and finish at a random value; a shared counter is
          // monotonic and always reaches total (even when a parse fails).
          completed++;
          onProgress?.(completed, files.length);
        }
      })
    );

    const success: DicomFile[] = [];
    const errors: Array<{ file: string; error: Error }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        success.push(result.value);
      } else {
        errors.push({
          file: files[index]?.fileName || 'Unknown',
          error: result.reason,
        });
      }
    });

    return { success, errors };
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      workerCount: this.workerCount,
      availableWorkers: this.availableWorkers.length,
      queuedTasks: this.taskQueue.length,
      pendingTasks: this.pendingTasks.size,
    };
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    this.workers.forEach((worker) => worker.terminate());
    this.workers = [];
    this.availableWorkers = [];
    this.taskQueue = [];
    this.pendingTasks.clear();
  }
}
