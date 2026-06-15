"use client"
import { useState, useRef, DragEvent } from "react"
import { UploadCloud, FileSpreadsheet, X } from "lucide-react"

interface FileDropzoneProps {
  file: File | null
  onChange: (f: File | null) => void
  accept?: string
  hint?: string
  label?: string
}

export default function FileDropzone({
  file,
  onChange,
  accept = ".csv",
  hint = "Accepts CSV files",
  label = "Drop file here or click to browse",
}: FileDropzoneProps) {
  const [dragging, setDragging] = useState(false)
  const ref = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) onChange(dropped)
  }

  return (
    <div
      className={`dropzone ${dragging ? "active" : ""}`}
      onDragOver={e => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      onClick={() => !file && ref.current?.click()}
      role="button"
      aria-label={file ? `Selected file: ${file.name}` : label}
      tabIndex={0}
      onKeyDown={e => e.key === "Enter" && !file && ref.current?.click()}
    >
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="sr-only"
        onChange={e => onChange(e.target.files?.[0] ?? null)}
        aria-hidden="true"
        tabIndex={-1}
      />

      {file ? (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileSpreadsheet className="w-5 h-5 text-accent flex-shrink-0" />
            <span className="text-sm font-semibold text-text truncate">{file.name}</span>
            <span className="text-xs text-muted flex-shrink-0">
              ({(file.size / 1024).toFixed(0)} KB)
            </span>
          </div>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onChange(null) }}
            className="flex-shrink-0 p-1 rounded-md text-muted hover:text-red hover:bg-red-50 transition-colors"
            aria-label="Remove selected file"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-2">
          <UploadCloud className="w-8 h-8 text-subtle" aria-hidden="true" />
          <span className="text-sm font-semibold text-muted">{label}</span>
          <span className="text-xs text-subtle">{hint}</span>
        </div>
      )}
    </div>
  )
}
