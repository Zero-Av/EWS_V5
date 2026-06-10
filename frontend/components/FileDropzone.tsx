"use client"
import { useRef, useState, DragEvent } from "react"
import { Upload, File, X } from "lucide-react"
import clsx from "clsx"

interface Props {
  onFile:   (f: File) => void
  accept?:  string
  label?:   string
  current?: File | null
}

export default function FileDropzone({ onFile, accept = ".csv", label, current }: Props) {
  const ref   = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) onFile(f)
  }

  return (
    <div>
      {label && <p className="text-xs font-mono text-muted mb-2 uppercase tracking-wider">{label}</p>}

      {current ? (
        <div className="flex items-center gap-3 bg-accent/5 border border-accent/20 rounded-lg px-4 py-3">
          <File className="w-4 h-4 text-accent shrink-0" />
          <span className="font-mono text-sm text-text flex-1 truncate">{current.name}</span>
          <span className="font-mono text-xs text-muted">
            {(current.size / 1024).toFixed(1)} KB
          </span>
          <button
            onClick={() => { onFile(null as any) /* caller handles null */ }}
            className="text-muted hover:text-red transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => ref.current?.click()}
          onDragOver={e => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={handleDrop}
          className={clsx(
            "border-2 border-dashed rounded-xl p-8 cursor-pointer transition-all duration-200",
            "flex flex-col items-center gap-3 text-center",
            drag
              ? "border-accent bg-accent/5 text-accent"
              : "border-border hover:border-border2 text-muted hover:text-text"
          )}
        >
          <Upload className="w-8 h-8" />
          <div>
            <p className="font-mono text-sm">Drop CSV here or click to browse</p>
            <p className="font-mono text-xs mt-1 opacity-60">{accept} files only</p>
          </div>
        </div>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
    </div>
  )
}
