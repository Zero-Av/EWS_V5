"use client"
import { useState, useEffect, useCallback, useRef } from "react"
import { getAnalyticsDashboard, getClassifications, getModelInfo } from "@/lib/api"

export interface DashboardData {
  kpis: {
    total_employees: number
    zone_distribution: Record<string, number>
    pct_red: number
    pct_amber: number
    pct_green: number
    avg_sentiment: number
    survey_coverage: number
  } | null
  classifications: any[]
  modelInfo: { has_model: boolean; metadata?: any } | null
  loading: boolean
  lastUpdated: Date | null
  refresh: () => Promise<void>
}

export function useDashboard(autoRefreshMs = 60_000): DashboardData {
  const [kpis,            setKpis]            = useState<DashboardData["kpis"]>(null)
  const [classifications, setClassifications] = useState<any[]>([])
  const [modelInfo,       setModelInfo]       = useState<DashboardData["modelInfo"]>(null)
  const [loading,         setLoading]         = useState(true)
  const [lastUpdated,     setLastUpdated]     = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const load = useCallback(async () => {
    try {
      const [k, c, m] = await Promise.allSettled([
        getAnalyticsDashboard(),
        getClassifications(),
        getModelInfo(),
      ])
      if (k.status === "fulfilled") setKpis(k.value)
      if (c.status === "fulfilled") setClassifications(c.value.classifications ?? [])
      if (m.status === "fulfilled") setModelInfo(m.value)
      setLastUpdated(new Date())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    if (autoRefreshMs > 0) {
      timerRef.current = setInterval(load, autoRefreshMs)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [load, autoRefreshMs])

  return { kpis, classifications, modelInfo, loading, lastUpdated, refresh: load }
}
