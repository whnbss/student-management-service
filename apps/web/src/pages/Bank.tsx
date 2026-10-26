// 题库页：M3 前为占位，顶部提供「物理实验室」入口卡片（移动端底部 5 Tab 已满，从这里进）
import { Link } from 'react-router-dom'
import { SCENES } from '@/labs/registry'
import Katex from '@/components/Katex'

export default function Bank() {
  return (
    <div className="space-y-4">
      <Link to="/labs" className="card p-5 flex items-center gap-4 hover:border-primary-300 dark:hover:border-primary-700 transition-colors block">
        <div className="text-4xl">🧪</div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold">物理实验室 · 交互课件</div>
          <p className="text-xs text-slate-500 mt-0.5">
            {SCENES.length} 个可拖拽课件：受力分析、运动过程、图像变化，课堂投屏实时演示
          </p>
          <div className="flex flex-wrap gap-1 mt-1.5">
            {SCENES.slice(0, 5).map((s) => (
              <span key={s.id} className="text-[11px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">{s.title.split('·')[0].trim()}</span>
            ))}
          </div>
        </div>
        <span className="text-primary-400">→</span>
      </Link>

      <div className="card p-12 text-center">
        <div className="text-4xl mb-3">🚧</div>
        <h2 className="text-lg font-semibold mb-2">题库</h2>
        <p className="text-sm text-slate-500">M3 里程碑交付：题目标签体系、筛选器与组卷器。</p>
        <p className="text-xs text-slate-400 mt-2">变式题已可从错题本「举一反三」生成并存入题库。</p>
        <div className="mt-4 text-sm text-slate-600 dark:text-slate-300"><Katex text="示例公式：$F = ma$、$v = v_0 + at$" /></div>
      </div>
    </div>
  )
}
