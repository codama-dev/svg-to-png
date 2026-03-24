import { Download, Link2, Lock, Unlock, Upload } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ShareModal, isShareDismissed } from '@/components/ShareModal'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { PageHeader } from '@/pages/PageHeader'

const MAX_DIMENSION = 4096
const SCALE_OPTIONS = ['1', '2', '3', '4']

function parseSvgDimensions(svgText: string): { width: number; height: number } | null {
  const parser = new DOMParser()
  const doc = parser.parseFromString(svgText, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return null

  const w = svg.getAttribute('width')
  const h = svg.getAttribute('height')
  if (w && h) {
    const pw = Number.parseFloat(w)
    const ph = Number.parseFloat(h)
    if (pw > 0 && ph > 0) return { width: Math.round(pw), height: Math.round(ph) }
  }

  const vb = svg.getAttribute('viewBox')
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/)
    if (parts.length === 4) {
      const vw = Number.parseFloat(parts[2])
      const vh = Number.parseFloat(parts[3])
      if (vw > 0 && vh > 0) return { width: Math.round(vw), height: Math.round(vh) }
    }
  }

  return { width: 300, height: 150 }
}

function isSvgValid(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  const parser = new DOMParser()
  const doc = parser.parseFromString(trimmed, 'image/svg+xml')
  return !!doc.querySelector('svg') && !doc.querySelector('parsererror')
}

export function ToolPage() {
  const { t } = useTranslation()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [svgCode, setSvgCode] = useState('')
  const [width, setWidth] = useState(512)
  const [height, setHeight] = useState(512)
  const [lockRatio, setLockRatio] = useState(true)
  const [aspectRatio, setAspectRatio] = useState(1)
  const [bgColor, setBgColor] = useState('#ffffff')
  const [transparent, setTransparent] = useState(true)
  const [scale, setScale] = useState('1')
  const [pngUrl, setPngUrl] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [hasConverted, setHasConverted] = useState(false)
  const [inputMode, setInputMode] = useState<'paste' | 'upload'>('paste')
  const [fileName, setFileName] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)

  const loadSvg = useCallback(
    (text: string, nameHint?: string) => {
      setSvgCode(text)
      if (nameHint) setFileName(nameHint)
      const dims = parseSvgDimensions(text)
      if (dims) {
        setWidth(dims.width)
        setHeight(dims.height)
        setAspectRatio(dims.width / dims.height)
      }
    },
    []
  )

  const handleFileUpload = useCallback(
    (file: File) => {
      if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') return
      const reader = new FileReader()
      reader.onload = e => {
        const text = e.target?.result as string
        if (text) {
          loadSvg(text, file.name)
          setInputMode('upload')
        }
      }
      reader.readAsText(file)
    },
    [loadSvg]
  )

  const handleWidthChange = useCallback(
    (val: string) => {
      const n = Math.min(MAX_DIMENSION, Math.max(1, Number.parseInt(val) || 1))
      setWidth(n)
      if (lockRatio) {
        setHeight(Math.round(n / aspectRatio))
      }
    },
    [lockRatio, aspectRatio]
  )

  const handleHeightChange = useCallback(
    (val: string) => {
      const n = Math.min(MAX_DIMENSION, Math.max(1, Number.parseInt(val) || 1))
      setHeight(n)
      if (lockRatio) {
        setWidth(Math.round(n * aspectRatio))
      }
    },
    [lockRatio, aspectRatio]
  )

  const convert = useCallback(() => {
    if (!isSvgValid(svgCode)) {
      toast.error(t('tool.invalidSvg'))
      return
    }
    setConverting(true)

    const scaleFactor = Number.parseInt(scale)
    const outW = width * scaleFactor
    const outH = height * scaleFactor

    const blob = new Blob([svgCode], { type: 'image/svg+xml;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const img = new Image()

    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) {
        setConverting(false)
        return
      }
      canvas.width = outW
      canvas.height = outH
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        setConverting(false)
        return
      }

      if (!transparent) {
        ctx.fillStyle = bgColor
        ctx.fillRect(0, 0, outW, outH)
      } else {
        ctx.clearRect(0, 0, outW, outH)
      }

      ctx.drawImage(img, 0, 0, outW, outH)
      URL.revokeObjectURL(url)

      canvas.toBlob(
        pngBlob => {
          if (pngBlob) {
            if (pngUrl) URL.revokeObjectURL(pngUrl)
            const newUrl = URL.createObjectURL(pngBlob)
            setPngUrl(newUrl)
          }
          setConverting(false)

          if (!hasConverted && !isShareDismissed()) {
            setHasConverted(true)
            setShareOpen(true)
          }
        },
        'image/png',
        1
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      toast.error(t('tool.invalidSvg'))
      setConverting(false)
    }

    img.src = url
  }, [svgCode, width, height, scale, transparent, bgColor, pngUrl, t, hasConverted])

  const download = useCallback(() => {
    if (!pngUrl) return
    const a = document.createElement('a')
    a.href = pngUrl
    const baseName = fileName ? fileName.replace(/\.svg$/i, '') : 'converted'
    a.download = `${baseName}.png`
    a.click()
  }, [pngUrl, fileName])

  const hasSvg = svgCode.trim().length > 0

  return (
    <div className="space-y-8">
      <PageHeader />

      <div className="mx-auto max-w-5xl px-4">
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column: Input */}
          <Card>
            <CardContent className="space-y-4 p-5">
              {/* Tab toggle: Paste / Upload */}
              <div className="flex gap-2">
                <Button
                  variant={inputMode === 'paste' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setInputMode('paste')}
                >
                  {t('tool.pasteCode')}
                </Button>
                <Button
                  variant={inputMode === 'upload' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setInputMode('upload')
                  }}
                >
                  <Upload className="mr-1.5 size-4" />
                  {t('tool.uploadFile')}
                </Button>
              </div>

              {inputMode === 'paste' ? (
                <Textarea
                  dir="ltr"
                  placeholder="<svg ...>...</svg>"
                  className="min-h-[240px] font-mono text-sm"
                  value={svgCode}
                  onChange={e => loadSvg(e.target.value)}
                />
              ) : (
                <div
                  className={`flex min-h-[240px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    dragOver
                      ? 'border-primary bg-primary/5'
                      : 'border-muted-foreground/25 hover:border-primary/50'
                  }`}
                  onClick={() => fileInputRef.current?.click()}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click()
                  }}
                  onDragOver={e => {
                    e.preventDefault()
                    setDragOver(true)
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setDragOver(false)
                    const file = e.dataTransfer.files[0]
                    if (file) handleFileUpload(file)
                  }}
                >
                  <Upload className="mb-3 size-10 text-muted-foreground" />
                  <p className="text-muted-foreground text-sm">{t('tool.dropSvg')}</p>
                  {fileName && (
                    <p className="mt-2 font-medium text-foreground text-sm">{fileName}</p>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".svg,image/svg+xml"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                    }}
                  />
                </div>
              )}

              {/* SVG Preview */}
              {hasSvg && isSvgValid(svgCode) && (
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs">{t('tool.preview')}</Label>
                  <div
                    className="flex items-center justify-center rounded-lg border bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[size:16px_16px] p-4"
                    style={{ minHeight: 120 }}
                  >
                    <div
                      dir="ltr"
                      className="max-h-[200px] max-w-full [&>svg]:max-h-[200px] [&>svg]:max-w-full"
                      // biome-ignore lint/security/noDangerouslySetInnerHtml: rendering user SVG preview
                      dangerouslySetInnerHTML={{ __html: svgCode }}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Right column: Controls + Output */}
          <div className="space-y-4">
            <Card>
              <CardContent className="space-y-4 p-5">
                {/* Dimensions */}
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="width">{t('tool.width')}</Label>
                    <Input
                      id="width"
                      type="number"
                      min={1}
                      max={MAX_DIMENSION}
                      value={width}
                      onChange={e => handleWidthChange(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="mb-0.5 shrink-0"
                    onClick={() => {
                      setLockRatio(!lockRatio)
                      if (!lockRatio && width > 0 && height > 0) {
                        setAspectRatio(width / height)
                      }
                    }}
                    title={t('tool.lockAspectRatio')}
                  >
                    {lockRatio ? <Lock className="size-4" /> : <Unlock className="size-4" />}
                  </Button>
                  <div className="flex-1 space-y-1.5">
                    <Label htmlFor="height">{t('tool.height')}</Label>
                    <Input
                      id="height"
                      type="number"
                      min={1}
                      max={MAX_DIMENSION}
                      value={height}
                      onChange={e => handleHeightChange(e.target.value)}
                    />
                  </div>
                </div>

                {/* Background color */}
                <div className="space-y-1.5">
                  <Label>{t('tool.backgroundColor')}</Label>
                  <div className="flex items-center gap-3">
                    <label className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={transparent}
                        onChange={e => setTransparent(e.target.checked)}
                        className="size-4 accent-primary"
                      />
                      {t('tool.transparent')}
                    </label>
                    {!transparent && (
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={bgColor}
                          onChange={e => setBgColor(e.target.value)}
                          className="size-8 cursor-pointer rounded border"
                        />
                        <span className="font-mono text-muted-foreground text-xs">{bgColor}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Scale factor */}
                <div className="space-y-1.5">
                  <Label>{t('tool.scaleFactor')}</Label>
                  <Select value={scale} onValueChange={setScale}>
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SCALE_OPTIONS.map(s => (
                        <SelectItem key={s} value={s}>
                          {s}x
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Convert button */}
                <Button
                  className="w-full"
                  size="lg"
                  onClick={convert}
                  disabled={!hasSvg || converting}
                >
                  <Link2 className="mr-2 size-4" />
                  {t('tool.convert')}
                </Button>
              </CardContent>
            </Card>

            {/* PNG Output */}
            {pngUrl && (
              <Card>
                <CardContent className="space-y-3 p-5">
                  <Label className="text-muted-foreground text-xs">PNG</Label>
                  <div className="flex items-center justify-center rounded-lg border bg-[repeating-conic-gradient(#80808020_0%_25%,transparent_0%_50%)] bg-[size:16px_16px] p-4">
                    <img
                      src={pngUrl}
                      alt="Converted PNG"
                      className="max-h-[300px] max-w-full object-contain"
                    />
                  </div>
                  <Button className="w-full" onClick={download}>
                    <Download className="mr-2 size-4" />
                    {t('tool.download')}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Hidden canvas for rendering */}
      <canvas ref={canvasRef} className="hidden" />

      <ShareModal open={shareOpen} onOpenChange={setShareOpen} showDismissOption />
    </div>
  )
}
