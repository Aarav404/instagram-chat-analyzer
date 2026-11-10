import { useEffect, useRef, useState } from 'react'
import type { Analysis, AnalysisRequest } from '@/core/types'
import { worker } from '@/lib/worker-client'

export function useAnalysis(request: AnalysisRequest | null, revision: string) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const serial = useRef(0)
  const key = JSON.stringify(request)
  useEffect(() => {
    const current = ++serial.current
    if (!request || !request.conversationIds.length) { setAnalysis(null); setLoading(false); return }
    setLoading(true); setError('')
    const timer = setTimeout(() => {
      worker.call('analyze', request).then((result) => { if (current === serial.current) setAnalysis(result) })
        .catch((e: Error) => { if (current === serial.current) { setError(e.message); setAnalysis(null) } })
        .finally(() => { if (current === serial.current) setLoading(false) })
    }, 150)
    return () => { clearTimeout(timer); serial.current++ }
    // A serialized request provides stable identity for deeply equal filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, revision])
  return { analysis, loading, error }
}
