// 题目配图展示：figure JSON（svg 内联 / img 上传图）→ 页面内渲染
// svg 外层加白底圆角边框，保证深色模式下线条可读
import { useMemo } from 'react'
import { figureHtml } from '@/lib/figure'

export default function QuestionFigure({ figure, className = '' }: { figure: string | null | undefined; className?: string }) {
  const html = useMemo(() => figureHtml(figure), [figure])
  if (!html) return null
  return (
    <div
      className={`mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white p-2 inline-block max-w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
