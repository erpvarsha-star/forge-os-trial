/**
 * Rejects with `Error("<label> timed out")` if `p` hasn't settled in `ms`.
 * Check-in screens used to await network calls with no limit, so one hung
 * request left the button spinning forever on the plant's patchy network.
 */
export class TimeoutError extends Error {
  constructor(label: string) {
    super(`${label} timed out`)
    this.name = 'TimeoutError'
  }
}

export function withTimeout<T>(p: PromiseLike<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError(label)), ms)
    Promise.resolve(p).then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      }
    )
  })
}

export function isTimeoutError(e: unknown): boolean {
  return e instanceof TimeoutError || (e instanceof Error && /timed out$/.test(e.message))
}

export function errorDetail(e: unknown): string {
  if (!e) return ''
  if (typeof e === 'string') return e
  const msg = (e as { message?: unknown }).message
  return typeof msg === 'string' ? msg : ''
}
