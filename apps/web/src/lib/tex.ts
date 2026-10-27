// LaTeX → MathML：打印导出专用
// 打印窗口不加载 KaTeX 的 HTML/CSS 渲染（会全是源码），改用 katex.renderToString(output:'mathml')
// 预渲染成 MathML 内联进打印 HTML —— MathML 由浏览器原生渲染，无需字体/网络，自包含离线可用
import katex from 'katex'

function renderMathml(tex: string, displayMode: boolean): string | null {
  try {
    return katex.renderToString(tex, { displayMode, throwOnError: false, output: 'mathml' })
  } catch {
    return null // 渲染失败回退原文
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 与 Katex.tsx 相同的 $…$ / $$…$$ / \(…\) 切分逻辑，把公式段渲染成 MathML，普通文本转义
// 任一公式渲染失败时整段回退为转义原文
export function texToMathml(text: string): string {
  if (!text) return ''
  const parts: string[] = []
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
      const tex = im[1] !== undefined ? im[1] : im[2]
      const html = renderMathml(tex, false)
      if (html === null) { parts.push(escapeHtml(im[0])) } else { parts.push(html) }
      l = im.index + im[0].length
    }
    parts.push(escapeHtml(s.slice(l)))
  }
  while ((m = blockRe.exec(text))) {
    pushPlain(text.slice(last, m.index))
    const html = renderMathml(m[1], true)
    if (html === null) { parts.push(escapeHtml(m[0])) } else { parts.push(html) }
    last = m.index + m[0].length
  }
  pushPlain(text.slice(last))
  return parts.join('')
}
