"use client"
import { useState, useEffect, useCallback } from "react"
import { getAlerts, acknowledgeAlert } from "@/lib/api"

export interface Alert {
  id: number
  employee_id: string
  message: string
  created_at: string
  acknowledged?: boolean
}

export function useAlerts() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await getAlerts({ acknowledged: false, limit: 20 })
      setAlerts(res.alerts ?? [])
    } catch {
      setAlerts([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const id = setInterval(load, 60_000)   // refresh every minute
    return () => clearInterval(id)
  }, [load])

  const acknowledge = useCallback(async (id: number) => {
    await acknowledgeAlert(id)
    setAlerts(prev => prev.filter(a => a.id !== id))
  }, [])

  return {
    alerts,
    loading,
    unreadCount: alerts.length,
    acknowledge,
    refresh: load,
  }
}
