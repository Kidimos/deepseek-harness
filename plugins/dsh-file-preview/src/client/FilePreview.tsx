/**
 * File tree + preview tool card. It browses the current session workspace
 * through the host /dsh-file-preview routes and previews file contents.
 * Supports source/preview/split modes and saving text files back.
 */
import { useEffect, useState } from 'react'
import type { FilePreviewProps } from './contract.ts'
import { FileIcon, FolderIcon, FolderOpenIcon } from './icons.tsx'
import css from './FilePreview.module.css'

interface TreeEntry {
  name: string
  path: string
  type: 'directory' | 'file' | 'other'
}

interface TreeResponse {
  path: string
  entries: TreeEntry[]
}

interface ReadResponse {
  content: string
  encoding?: 'utf8' | 'base64'
}

interface WriteResponse {
  ok: boolean
}

async function post<T>(route: string, body: unknown): Promise<T> {
  const response = await fetch(route, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(await response.text())
  return await response.json() as T
}

type FileKind = 'markdown' | 'html' | 'code' | 'diff' | 'csv' | 'pdf' | 'office' | 'image' | 'text'

function extOf(path: string): string {
  const index = path.lastIndexOf('.')
  return index === -1 ? '' : path.slice(index).toLowerCase()
}

function getFileKind(path: string): FileKind {
  const ext = extOf(path)
  if (['.md', '.markdown', '.mdown'].includes(ext)) return 'markdown'
  if (['.html', '.htm', '.xhtml'].includes(ext)) return 'html'
  if (['.diff', '.patch'].includes(ext)) return 'diff'
  if (ext === '.csv') return 'csv'
  if (['.pdf'].includes(ext)) return 'pdf'
  if (['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp'].includes(ext)) return 'office'
  if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)) return 'image'
  if (['.js', '.jsx', '.ts', '.tsx', '.json', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp', '.h', '.css', '.scss', '.sh', '.yml', '.yaml', '.toml', '.xml'].includes(ext)) return 'code'
  return 'text'
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** A very small markdown renderer for previews (headings, code, lists, paragraphs). */
function renderMarkdown(markdown: string): string {
  const lines = markdown.split('\n')
  let html = ''
  let inCode = false
  const codeLines: string[] = []
  const flushCode = (): void => {
    if (codeLines.length > 0) {
      html += `<pre><code>${codeLines.join('\n')}</code></pre>`
      codeLines.length = 0
    }
  }
  for (const line of lines) {
    if (line.trimStart().startsWith('```')) {
      if (inCode) {
        flushCode()
        inCode = false
      } else {
        flushCode()
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeLines.push(escapeHtml(line))
      continue
    }
    const trimmed = line.trim()
    if (trimmed === '') {
      html += '<br/>'
      continue
    }
    if (/^#{1,6}\s/.test(trimmed)) {
      const level = trimmed.match(/^#+/)![0]!.length
      html += `<h${level}>${escapeHtml(trimmed.slice(level).trim())}</h${level}>`
      continue
    }
    if (trimmed.startsWith('- ')) {
      html += `<li>${escapeHtml(trimmed.slice(2))}</li>`
      continue
    }
    html += `<p>${escapeHtml(trimmed)}</p>`
  }
  flushCode()
  return html
}

function CsvTable({ text }: { text: string }) {
  const rows = text.split('\n').filter(line => line.trim() !== '').map(line => line.split(','))
  return (
    <div className={css.csvWrap}>
      <table className={css.csvTable}>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td key={cellIndex}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PreviewContent(props: {
  path: string
  content: string
  encoding: 'utf8' | 'base64'
  t: (key: string) => string
}) {
  const { path, content, encoding, t } = props
  const kind = getFileKind(path)
  const ext = extOf(path).replace('.', '')

  if (encoding === 'base64') {
    if (kind === 'image') {
      const mime = ext === 'svg' ? 'image/svg+xml' : `image/${ext}`
      return <img className={css.imagePreview} src={`data:${mime};base64,${content}`} alt={path} />
    }
    if (kind === 'pdf') {
      return <iframe className={css.pdfFrame} src={`data:application/pdf;base64,${content}`} title={path} />
    }
    return <div className={css.hint}>{t('binaryPreviewUnavailable')}</div>
  }

  if (kind === 'markdown') {
    return <div className={css.markdown} dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }} />
  }
  if (kind === 'html') {
    return <iframe className={css.htmlFrame} sandbox="" srcDoc={content} title={path} />
  }
  if (kind === 'csv') {
    return <CsvTable text={content} />
  }
  if (kind === 'diff') {
    return <pre className={`${css.code} ${css.diff}`}>{content}</pre>
  }
  return <pre className={css.code}>{content}</pre>
}

function FileTreeNode(props: {
  key?: string | number
  entry: TreeEntry
  depth: number
  sessionId: string
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  const { entry, depth, sessionId, selectedPath, onSelect } = props
  const [expanded, setExpanded] = useState(false)
  const [children, setChildren] = useState<TreeEntry[] | null>(null)
  const [loading, setLoading] = useState(false)
  const isDirectory = entry.type === 'directory'

  const handleClick = async (): Promise<void> => {
    if (!isDirectory) {
      onSelect(entry.path)
      return
    }
    const next = !expanded
    setExpanded(next)
    if (next && children === null) {
      setLoading(true)
      try {
        const data = await post<TreeResponse>('/dsh-file-preview/tree', { sessionId, path: entry.path })
        setChildren(data.entries)
      } catch {
        setChildren([])
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        className={`${css.treeNode} ${selectedPath === entry.path ? css.activeNode : ''}`}
        style={{ paddingLeft: `${8 + depth * 14}px` }}
        onClick={() => { void handleClick() }}
      >
        <span className={css.treeNodeIcon} aria-hidden>
          {isDirectory ? (expanded ? <FolderOpenIcon /> : <FolderIcon />) : <FileIcon />}
        </span>
        <span className={css.treeNodeName}>{entry.name}</span>
      </button>
      {expanded && loading && <div className={css.treeLoading} style={{ paddingLeft: `${24 + depth * 14}px` }}>…</div>}
      {expanded && children !== null && children.map(child => (
        <FileTreeNode
          key={child.path}
          entry={child}
          depth={depth + 1}
          sessionId={sessionId}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

export function FilePreview({ sessionId, t }: FilePreviewProps) {
  const [rootEntries, setRootEntries] = useState<TreeEntry[]>([])
  const [rootLoading, setRootLoading] = useState(true)
  const [rootError, setRootError] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  const [content, setContent] = useState('')
  const [encoding, setEncoding] = useState<'utf8' | 'base64'>('utf8')
  const [editedContent, setEditedContent] = useState('')
  const [contentLoading, setContentLoading] = useState(false)
  const [contentError, setContentError] = useState('')
  const [mode, setMode] = useState<'preview' | 'source' | 'split'>('preview')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    let disposed = false
    setRootLoading(true)
    setRootError('')
    setSelectedPath(null)
    setContent('')
    setEditedContent('')
    post<TreeResponse>('/dsh-file-preview/tree', { sessionId, path: '.' })
      .then(data => {
        if (!disposed) setRootEntries(data.entries)
      })
      .catch(() => {
        if (!disposed) setRootError(t('error'))
      })
      .finally(() => {
        if (!disposed) setRootLoading(false)
      })
    return () => { disposed = true }
  }, [sessionId])

  const selectFile = async (path: string): Promise<void> => {
    setSelectedPath(path)
    setContentLoading(true)
    setContentError('')
    setSaveError('')
    setContent('')
    setEditedContent('')
    setMode('preview')
    try {
      const data = await post<ReadResponse>('/dsh-file-preview/read', { sessionId, path })
      setContent(data.content)
      const nextEncoding = data.encoding ?? 'utf8'
      setEncoding(nextEncoding)
      if (nextEncoding === 'utf8') setEditedContent(data.content)
    } catch {
      setContentError(t('error'))
    } finally {
      setContentLoading(false)
    }
  }

  const saveFile = async (): Promise<void> => {
    if (selectedPath === null || encoding !== 'utf8') return
    setSaving(true)
    setSaveError('')
    try {
      await post<WriteResponse>('/dsh-file-preview/write', {
        sessionId,
        path: selectedPath,
        content: editedContent,
      })
      setContent(editedContent)
    } catch {
      setSaveError(t('error'))
    } finally {
      setSaving(false)
    }
  }

  const canEdit = selectedPath !== null && encoding === 'utf8'

  return (
    <div className={css.root}>
      <div className={css.treePane}>
        <div className={css.paneHeader}>{t('files')}</div>
        {rootLoading && <div className={css.hint}>{t('loading')}</div>}
        {!rootLoading && rootError !== '' && <div className={css.hint}>{rootError}</div>}
        {!rootLoading && rootError === '' && rootEntries.length === 0 && <div className={css.hint}>{t('empty')}</div>}
        {!rootLoading && rootEntries.map(entry => (
          <FileTreeNode
            key={entry.path}
            entry={entry}
            depth={0}
            sessionId={sessionId}
            selectedPath={selectedPath}
            onSelect={(path) => { void selectFile(path) }}
          />
        ))}
      </div>
      <div className={css.previewPane}>
        <div className={css.previewToolbar}>
          <span className={css.previewPath}>{selectedPath ?? t('preview')}</span>
          {canEdit && (
            <div className={css.modeTabs} role="tablist" aria-label={t('modeTabs')}>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'preview'}
                className={mode === 'preview' ? `${css.modeTab} ${css.activeModeTab}` : css.modeTab}
                onClick={() => setMode('preview')}
              >
                {t('preview')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'source'}
                className={mode === 'source' ? `${css.modeTab} ${css.activeModeTab}` : css.modeTab}
                onClick={() => setMode('source')}
              >
                {t('source')}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'split'}
                className={mode === 'split' ? `${css.modeTab} ${css.activeModeTab}` : css.modeTab}
                onClick={() => setMode('split')}
              >
                {t('split')}
              </button>
            </div>
          )}
          {canEdit && mode !== 'preview' && (
            <button type="button" className={css.saveBtn} disabled={saving} onClick={() => { void saveFile() }}>
              {saving ? t('saving') : t('save')}
            </button>
          )}
        </div>
        {saveError !== '' && <div className={css.saveError}>{saveError}</div>}
        <div className={css.previewBody}>
          {contentLoading && <div className={css.hint}>{t('loading')}</div>}
          {!contentLoading && contentError !== '' && <div className={css.hint}>{contentError}</div>}
          {!contentLoading && contentError === '' && selectedPath !== null && (
            mode === 'source' ? (
              <textarea
                className={css.editor}
                value={editedContent}
                onChange={(event: { target: { value: string } }) => setEditedContent(event.target.value)}
                spellCheck={false}
              />
            ) : mode === 'split' ? (
              <div className={css.split}>
                <textarea
                  className={css.editor}
                  value={editedContent}
                  onChange={(event: { target: { value: string } }) => setEditedContent(event.target.value)}
                  spellCheck={false}
                />
                <div className={css.splitPreview}>
                  <PreviewContent path={selectedPath} content={editedContent} encoding={encoding} t={t} />
                </div>
              </div>
            ) : (
              <div className={css.previewStage}>
                <PreviewContent path={selectedPath} content={content} encoding={encoding} t={t} />
              </div>
            )
          )}
          {!contentLoading && selectedPath === null && (
            <div className={css.hint}>{t('selectFile')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
