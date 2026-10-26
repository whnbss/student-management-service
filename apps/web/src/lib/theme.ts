// 深色模式：偏好存 localStorage('workbench-theme')，默认跟随系统
// - 'dark'  → html 加 dark 类
// - 'light' → html 移除 dark 类
// - 'system'→ 跟随 prefers-color-scheme（并监听系统变化）
export type ThemePref = 'dark' | 'light' | 'system'

const KEY = 'workbench-theme'

export function getThemePref(): ThemePref {
  const v = localStorage.getItem(KEY)
  return v === 'dark' || v === 'light' || v === 'system' ? v : 'system'
}

export function applyTheme(pref?: ThemePref) {
  const p = pref ?? getThemePref()
  const dark =
    p === 'dark' || (p === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function setThemePref(pref: ThemePref) {
  localStorage.setItem(KEY, pref)
  applyTheme(pref)
}

// 应用启动时调用：应用已存偏好，并跟随系统切换
export function initTheme() {
  applyTheme()
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePref() === 'system') applyTheme('system')
  })
}
