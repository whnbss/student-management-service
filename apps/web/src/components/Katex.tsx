// LaTeX 公式渲染组件：支持 $...$ 行内、$$...$$ 块级、\(...\) 与 \[...\]
import { useMemo } from 'react'
import katex from 'katex'
import 'katex/dist/katex.min.css'

function render(tex: string, displayMode: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'html' })
  } catch {
    return tex // 渲染失败时回退原文，不白屏
  }
}

// 将混合文本按公式定界符切分渲染
export default function Katex({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => {
    if (!text) return ''
    // \[...\] 块级定界符先归一为 $$...$$（题库解析中使用 \[ \] 分行推导块时同样正确渲染）
    const src = String(text).replace(/\\\[([\s\S]+?)\\\]/g, (_m, inner) => `$$${inner}$$`)
    const parts: string[] = []
    // 先按 $$ 块级切，再按 $ 或 \( \) 行内切
    const blockRe = /\$\$([\s\S]+?)\$\$/g
    let last = 0
    let m: RegExpExecArray | null
    const pushPlain = (s: string) => {
      if (!s) return
      const inlineRe = /\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)/g
      let l = 0
      let im: RegExpExecArray | null
      while ((im = inlineRe.exec(s))) {
        parts.push(escapeHtml(s.slice(l, im.index)))
        if (im[1] !== undefined) parts.push(render(im[1], false))
        else parts.push(render(im[2], false))
        l = im.index + im[0].length
      }
      parts.push(escapeHtml(s.slice(l)))
    }
    while ((m = blockRe.exec(src))) {
      pushPlain(src.slice(last, m.index))
      parts.push(render(m[1], true))
      last = m.index + m[0].length
    }
    pushPlain(src.slice(last))
    return parts.join('')
  }, [text])
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
