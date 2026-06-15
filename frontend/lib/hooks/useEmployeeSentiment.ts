"use client"
import { useState, useEffect, useCallback } from "react"
import { getEmployeeSentiment } from "@/lib/api"

export interface SentimentData {
  employee_id: string
  survey_count: number
  history: {
    survey_date: string
    sentiment_score: number
    sentiment_label: string
    comments: string
  }[]
  topic_breakdown: Record<string, number>
  current_sentiment: number
  sentiment_velocity: number
  avg_sentiment: number
}

export function useEmployeeSentiment(employeeId: string | null) {
  const [data,    setData]    = useState<SentimentData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const load = useCallback(async (id: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getEmployeeSentiment(id)
      setData(res as SentimentData)
    } catch (e: any) {
      setError(e.message ?? "Failed to load employee data")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (employeeId) load(employeeId)
    else { setData(null); setError(null) }
  }, [employeeId, load])

  return { data, loading, error, refresh: () => employeeId && load(employeeId) }
}
