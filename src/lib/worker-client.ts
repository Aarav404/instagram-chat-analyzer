import type { ImportProgress, WorkerMethods, WorkerResponse } from '../core/types'

class WorkerClient {
  private worker: Worker | null = null
  private nextId = 0
  private pending = new Map<number, { resolve: (value: unknown) => void; reject: (error: Error) => void; progress?: (p: ImportProgress) => void }>()
  private ensureWorker() {
    if (this.worker) return this.worker
    this.worker = new Worker(new URL('../workers/analysis.worker.ts', import.meta.url), { type: 'module' })
    this.worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const { id, result, error, progress } = event.data
      const pending = this.pending.get(id)
      if (!pending) return
      if (progress) { pending.progress?.(progress); return }
      this.pending.delete(id)
      if (error) pending.reject(new Error(error))
      else pending.resolve(result)
    }
    this.worker.onerror = () => {
      for (const task of this.pending.values()) task.reject(new Error('The analysis worker stopped. Reload the page to reconnect to your saved data.'))
      this.pending.clear()
      this.worker?.terminate(); this.worker = null
    }
    return this.worker
  }
  call<K extends keyof WorkerMethods>(method: K, input: WorkerMethods[K]['input'], progress?: (p: ImportProgress) => void): Promise<WorkerMethods[K]['output']> {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId
      this.pending.set(id, { resolve: resolve as (value: unknown) => void, reject, progress })
      try { this.ensureWorker().postMessage({ id, method, input }) }
      catch (error) { this.pending.delete(id); reject(error) }
    })
  }
  cancelImport() { this.worker?.postMessage({ method: 'cancel' }) }
}
export const worker = new WorkerClient()
