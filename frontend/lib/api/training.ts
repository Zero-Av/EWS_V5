/**
 * lib/api/training.ts
 * Frontend paths:  /train
 * Backend routes:  POST /train  |  GET /model/info
 */

import { BASE, authHeaders, handleResponse } from "./_core"

// ── Types ────────────────────────────────────────────────────────────────────

export interface ModelMetadata {
  trained_at:   string
  samples:      number
  features:     number
  accuracy:     number
  top_features: Record<string, number>
}

export interface ModelInfoResponse {
  has_model:  boolean
  metadata?:  ModelMetadata
}

// ── Functions ────────────────────────────────────────────────────────────────

export async function trainClassifier(file: File): Promise<{
  status:   string
  metadata: ModelMetadata
}> {
  const fd = new FormData()
  fd.append("file", file)
  const res = await fetch(`${BASE}/train`, {
    method:  "POST",
    headers: authHeaders(),
    body:    fd,
  })
  return handleResponse<{ status: string; metadata: ModelMetadata }>(res)
}

export async function getModelInfo(): Promise<ModelInfoResponse> {
  const res = await fetch(`${BASE}/model/info`, { headers: authHeaders() })
  return handleResponse<ModelInfoResponse>(res)
}
