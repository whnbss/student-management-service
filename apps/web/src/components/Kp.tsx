// 知识点联动组件：知识点 chip 全站可点（matchScene 命中课件则渲染为链接，直达课件演示）
import { Link } from 'react-router-dom'
import { matchScene } from '@/labs/registry'

const CHIP_CLS =
  'text-[11px] px-2 py-0.5 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300'
const CHIP_LINK_CLS = `${CHIP_CLS} underline decoration-dotted underline-offset-2 hover:bg-primary-100 dark:hover:bg-primary-900/60`

/** 知识点标签组：命中课件的可点（直达 /labs/:id?from=mistake），未命中为静态标签 */
export function KpChips({ kps }: { kps: string[] }) {
  if (!kps.length) return null
  return (
    <div className="flex flex-wrap gap-1">
      {kps.map((k) => {
        const scene = matchScene([k])
        return scene ? (
          <Link key={k} to={`/labs/${scene.id}?from=mistake`} className={CHIP_LINK_CLS} title={`打开课件演示：${scene.title}`}>
            {k}
          </Link>
        ) : (
          <span key={k} className={CHIP_CLS}>{k}</span>
        )
      })}
    </div>
  )
}

// 「下次课重点」是自由文本（如「矢量三角形/分离临界条件」），按分隔符切词，命中课件的词渲染为链接
const SEP = /([、，,;；/·\s]+)/

/** 自由文本中的知识点关键词可点化：分隔符切词 → matchScene 命中则链接 */
export function NextKeyText({ text }: { text: string }) {
  const parts = text.split(SEP).filter((p) => p !== undefined && p !== '')
  return (
    <>
      {parts.map((p, i) => {
        if (SEP.test(p)) return <span key={i}>{p}</span>
        const scene = p.trim().length >= 2 ? matchScene([p.trim()]) : undefined
        return scene ? (
          <Link
            key={i}
            to={`/labs/${scene.id}?from=plan`}
            className="underline decoration-dotted underline-offset-2 hover:text-primary-700 dark:hover:text-primary-300"
            title={`打开课件演示：${scene.title}`}
          >
            {p}
          </Link>
        ) : (
          <span key={i}>{p}</span>
        )
      })}
    </>
  )
}
