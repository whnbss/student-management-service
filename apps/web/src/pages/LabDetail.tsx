// 课件详情页：LabFrame 壳 + 公式卡 + 教学要点折叠卡 + 错题联动提示
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { findScene } from '@/labs/registry'
import LabFrame from '@/labs/engine/LabFrame'
import Katex from '@/components/Katex'

export default function LabDetail() {
  const { id } = useParams()
  const scene = findScene(id)
  const [sp] = useSearchParams()
  const fromMistake = sp.get('from') === 'mistake'
  const preset = sp.get('preset') ?? undefined

  if (!scene) {
    return (
      <div className="card p-10 text-center text-sm text-slate-400">
        没有找到这个课件
        <div className="mt-3"><Link to="/labs" className="btn-primary !px-4 !py-2 text-xs">← 返回课件列表</Link></div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h1 className="text-xl font-bold">{scene.title}</h1>
        <span className="text-xs px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">{scene.chapter}</span>
        <span className="flex-1" />
        <Link to="/labs" className="text-xs text-primary-600">← 全部课件</Link>
      </div>

      {fromMistake && (
        <div className="card p-3 text-xs text-primary-600 bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800">
          本课件由错题知识点匹配打开，建议结合学生的错因重点讲解。
        </div>
      )}

      <LabFrame key={scene.id} scene={scene} initialPreset={preset} />

      {scene.keyPoints && scene.keyPoints.length > 0 && (
        <details className="card p-4 group">
          <summary className="text-xs font-semibold text-slate-400 cursor-pointer select-none flex items-center gap-1.5">
            <span className="group-open:rotate-90 inline-block transition-transform">▸</span> 教学要点（易错点 · 投影时可直接念）
          </summary>
          <ul className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-300 list-disc pl-5">
            {scene.keyPoints.map((k) => <li key={k}>{k}</li>)}
          </ul>
        </details>
      )}

      {scene.formulas && scene.formulas.length > 0 && (
        <div className="card p-4">
          <div className="text-xs font-semibold text-slate-400 mb-2">本课件核心公式</div>
          <div className="space-y-2 text-sm">
            {scene.formulas.map((f) => (
              <div key={f}><Katex text={`$$${f}$$`} /></div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1">
        {scene.tags.map((t) => (
          <span key={t} className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">#{t}</span>
        ))}
      </div>
    </div>
  )
}
