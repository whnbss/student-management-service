// 物理实验室 · 课件列表：年级 Tab 过滤 + 按 年级→章节 分组 + 关键词搜索 + 缩略封面（PhET 首页式）+ 最近使用置顶
import { useEffect, useMemo, useRef, useState } from 'react'
import {FlaskConical, History} from 'lucide-react'
import { Link } from 'react-router-dom'
import { SCENES } from '@/labs/registry'
import { renderThumbnail } from '@/labs/engine/thumbnail'
import type { LabScene } from '@/labs/engine/types'

const GRADES = ['高一', '高二', '高三'] as const
const GRADE_COLOR: Record<string, string> = {
  高一: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  高二: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  高三: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

/** 课件缩略封面：详情页首帧静态渲染（挂载后离屏生成，失败则显示占位） */
function LabThumb({ scene }: { scene: LabScene }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = renderThumbnail(scene)
  }, [scene])
  return (
    <div
      ref={ref}
      className="lab-thumb rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/80 overflow-hidden mb-2 [&>svg]:w-full [&>svg]:h-auto [&>svg]:block"
    />
  )
}

export default function Labs() {
  const [q, setQ] = useState('')
  const [grade, setGrade] = useState<'全部' | (typeof GRADES)[number]>('全部')
  const [recentIds, setRecentIds] = useState<string[]>([])
  useEffect(() => {
    try {
      setRecentIds(JSON.parse(localStorage.getItem('labs-recent') || '[]'))
    } catch {
      /* 忽略 */
    }
  }, [])

  const filtered = useMemo(() => {
    const kw = q.trim().toLowerCase()
    let list = grade === '全部' ? SCENES : SCENES.filter((s) => s.grade === grade)
    if (kw) {
      list = list.filter(
        (s) =>
          s.title.toLowerCase().includes(kw) ||
          s.chapter.toLowerCase().includes(kw) ||
          s.desc.toLowerCase().includes(kw) ||
          s.tags.some((t) => t.toLowerCase().includes(kw))
      )
    }
    return list
  }, [q, grade])

  // 按 年级 → 章节 分组
  const groups = useMemo(() => {
    const map = new Map<string, Map<string, typeof filtered>>()
    for (const g of GRADES) map.set(g, new Map())
    for (const s of filtered) {
      const byChapter = map.get(s.grade)!
      if (!byChapter.has(s.chapter)) byChapter.set(s.chapter, [])
      byChapter.get(s.chapter)!.push(s)
    }
    return [...map.entries()].filter(([, chapters]) => chapters.size > 0)
  }, [filtered])

  // 最近使用（详情页访问时记录，列表页置顶）
  const recent = recentIds
    .map((id) => SCENES.find((s) => s.id === id))
    .filter((s): s is LabScene => !!s && filtered.some((f) => f.id === s.id))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h1 className="text-xl font-bold"><FlaskConical className="w-4 h-4 inline-block align-[-2px]" /> 物理实验室</h1>
        <span className="flex-1" />
        <input
          className="input !w-48 !py-2 text-xs"
          placeholder="搜索课件 / 知识点…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* 年级 Tab 过滤 */}
      <div className="flex gap-1.5">
        {(['全部', ...GRADES] as const).map((g) => (
          <button
            key={g}
            className={`!px-3 !py-1.5 text-xs rounded-full border ${grade === g ? 'bg-primary-600 text-white border-primary-600' : 'btn-outline'}`}
            onClick={() => setGrade(g)}
          >
            {g}
          </button>
        ))}
      </div>

      <p className="text-xs text-slate-400 px-1">
        可拖拽交互的物理课件，课堂投屏演示受力分析、运动过程与图像变化。共 {SCENES.length} 个（持续增加中）。
      </p>

      {/* 最近使用置顶 */}
      {recent.length > 0 && q.trim() === '' && grade === '全部' && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-slate-500 px-1"><History className="w-4 h-4 inline-block align-[-2px]" /> 最近使用</h2>
          <div className="flex gap-2 flex-wrap">
            {recent.map((s) => (
              <Link
                key={s.id}
                to={`/labs/${s.id}`}
                className="card px-3 py-2 text-xs text-primary-600 dark:text-primary-300 hover:border-primary-300"
              >
                {s.title}
              </Link>
            ))}
          </div>
        </section>
      )}

      {groups.map(([g, chapters]) => (
        <section key={g} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 px-1">{g}</h2>
          {[...chapters.entries()].map(([chapter, scenes]) => (
            <div key={chapter}>
              <div className="text-xs text-slate-400 px-1 mb-1.5">{chapter}</div>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3 items-stretch *:flex *:flex-col">
                {scenes.map((s) => (
                  <div key={s.id} className="card p-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors h-full flex flex-col">
                    <Link to={`/labs/${s.id}`} className="block">
                      <LabThumb scene={s} />
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${GRADE_COLOR[s.grade]}`}>{s.grade}</span>
                        <span className="text-sm font-medium">{s.title}</span>
                      </div>
                    </Link>
                    <Link to={`/labs/${s.id}`} className="flex-1">
                      <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
                    </Link>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {s.tags.slice(0, 4).map((t) => (
                        <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">{t}</span>
                      ))}
                    </div>
                    {/* 关键预设直达按钮：进入课件并自动应用该预设 */}
                    {s.presets.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                        {s.presets.slice(0, 3).map((p) => (
                          <Link
                            key={p.name}
                            to={`/labs/${s.id}?preset=${encodeURIComponent(p.name)}`}
                            className="text-[11px] px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50"
                            title="一键进入并应用该预设情景"
                          >
                            ▶ {p.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}

      {filtered.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-400">
          没有匹配「{q}」的课件，换个关键词试试
        </div>
      )}
    </div>
  )
}
