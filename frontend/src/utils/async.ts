/** 异步重试：失败后按指数退避重试，最终失败抛出（调用方负责提示与人工重试） */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: { retries?: number; baseDelay?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 3
  const baseDelay = options.baseDelay ?? 300
  let lastError: unknown
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, baseDelay * Math.pow(2, attempt)))
      }
    }
  }
  throw lastError
}
