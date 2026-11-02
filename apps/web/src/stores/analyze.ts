// 拍批流程全局状态：存到模块级 Zustand store（并持久化到 sessionStorage）
// 解决「分析完切到其它页面再回来页面空白」的问题——路由切换不丢状态，
// 分析中途切走再回来也能看到最新进度/结果（分析请求在 store action 里继续跑）
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { post, del } from '@/lib/api'
import { uploadImage } from '@/lib/image'
import { useAuthStore, useToastStore } from '@/stores/auth'
import type { Student, AiAnalysisResult } from '@workbench/shared'
import { todayLocal } from '@workbench/shared'

export type AnalyzeStep = 'pick' | 'uploading' | 'analyzing' | 'review' | 'saving'
// C2：图片角色 —— paper=试卷题目页（转录原题+独立求解），sheet=答题卡作答页（读取学生作答）
export type ImageRole = 'paper' | 'sheet'

interface AnalyzeState {
  step: AnalyzeStep
  studentId: number | null
  files: File[] // 原始文件（仅内存，不持久化；刷新后为空属预期）
  previews: string[] // blob 预览地址（仅内存）
  roles: ImageRole[] // 每张图的角色（与 files/previews 对齐）
  progress: string
  analysis: AiAnalysisResult | null
  draft: AiAnalysisResult | null
  uploadedPaths: string[]
  aiNote: string
  mistakeChecked: Record<number, boolean>
  logType: string
  nextKey: string
  ignored: number[] // D1：被教师删除/忽略的题号（不参与保存）

  setStep: (s: AnalyzeStep) => void
  setStudentId: (id: number | null) => void
  addFiles: (files: File[], role?: ImageRole) => void
  removeFile: (idx: number) => void
  setRole: (idx: number, role: ImageRole) => void
  setProgress: (p: string) => void
  setDraft: (updater: (d: AiAnalysisResult | null) => AiAnalysisResult | null) => void
  setMistakeChecked: (v: Record<number, boolean>) => void
  setLogType: (v: string) => void
  setNextKey: (v: string) => void
  ignoreItem: (no: number) => void // D1：逐题删除/忽略
  restoreItem: (no: number) => void // D1：撤销忽略
  discardAll: () => Promise<void> // D1：放弃本次分析（清草稿+删已上传图片）回到拍照步骤
  start: () => Promise<void> // 上传 + AI 分析
  save: (onDone: () => void) => Promise<void> // 确认保存入库
  reset: () => void
}

export const useAnalyzeStore = create<AnalyzeState>()(
  persist(
    (set, get) => ({
      step: 'pick',
      studentId: null,
      files: [],
      previews: [],
      roles: [],
      progress: '',
      analysis: null,
      draft: null,
      uploadedPaths: [],
      aiNote: '',
      mistakeChecked: {},
      logType: '作业',
      nextKey: '',
      ignored: [],

      setStep: (s) => set({ step: s }),
      setStudentId: (id) => set({ studentId: id }),
      addFiles: (arr, role) => {
        const { files, previews, roles } = get()
        const nf = [...files, ...arr].slice(0, 9)
        const np = [...previews, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9)
        const nr = [...roles, ...arr.map(() => role || 'paper')].slice(0, 9)
        set({ files: nf, previews: np, roles: nr })
      },
      removeFile: (idx) => {
        const { files, previews, roles } = get()
        set({ files: files.filter((_, i) => i !== idx), previews: previews.filter((_, i) => i !== idx), roles: roles.filter((_, i) => i !== idx) })
      },
      setRole: (idx, role) => {
        set({ roles: get().roles.map((r, i) => (i === idx ? role : r)) })
      },
      setProgress: (p) => set({ progress: p }),
      setDraft: (updater) => set({ draft: updater(get().draft) }),
      setMistakeChecked: (v) => set({ mistakeChecked: v }),
      setLogType: (v) => set({ logType: v }),
      setNextKey: (v) => set({ nextKey: v }),
      // D1：逐题删除/忽略——被忽略的题在保存时不会入库（错题/原题入库都只看保留的题）
      ignoreItem: (no) => set({ ignored: [...new Set([...get().ignored, no])] }),
      restoreItem: (no) => set({ ignored: get().ignored.filter((n) => n !== no) }),
      // D1：放弃本次分析——删掉本次已上传的服务器图片（尽力而为，失败不阻塞），再完全重置前端状态
      discardAll: async () => {
        const { uploadedPaths } = get()
        for (const p of uploadedPaths) {
          try { await del(`/api/upload?path=${encodeURIComponent(p)}`) } catch { /* 尽力清理，失败不阻塞 */ }
        }
        get().reset()
      },

      start: async () => {
        const { studentId, files, roles } = get()
        const show = useToastStore.getState().show
        const token = useAuthStore.getState().token
        if (!studentId) { show('请先选择学生'); return }
        if (!files.length) { show('请先拍照或选择图片'); return }
        try {
          // 第 2 步：压缩上传
          set({ step: 'uploading' })
          const paths: string[] = []
          for (let i = 0; i < files.length; i++) {
            set({ progress: `正在压缩上传第 ${i + 1}/${files.length} 张…` })
            paths.push(await uploadImage(files[i], studentId, token!))
          }
          set({ uploadedPaths: paths })
          // 第 3 步：AI 分析（C2 两阶段：试卷转录 → 独立求解 → 答题卡读取 → 逐题比对）
          const hasSheet = roles.includes('sheet')
          const hasPaper = roles.includes('paper')
          set({ step: 'analyzing', progress: hasPaper && hasSheet ? '正在逐题转录试卷原题…' : '智能分析正在识别题目与作答…' })
          const tips = hasPaper && hasSheet
            ? ['正在逐题转录试卷原题…', '系统正在独立求解试卷（得出标准答案）…', '正在读取答题卡上的学生作答…', '正在逐题比对：标准答案 vs 学生作答…', '正在归类错因与薄弱点…']
            : ['智能分析正在识别题目与作答…', '正在逐题判定对错…', '正在归类错因与薄弱点…', '即将完成，正在整理建议…']
          let ti = 0
          const timer = setInterval(() => { ti = (ti + 1) % tips.length; set({ progress: tips[ti] }) }, 6000)
          try {
            const r = await post<{ analysis: AiAnalysisResult; provider: string }>('/api/analyze', {
              student_id: studentId,
              // C2：带角色上传（paper=试卷页 / sheet=答题卡页）；旧后端兼容由字段结构保证
              images: paths.map((p, i) => ({ path: p, role: roles[i] || 'paper' })),
            })
            clearInterval(timer)
            set({
              analysis: r.analysis,
              draft: r.analysis,
              aiNote: `分析供应商：${r.provider}`,
              mistakeChecked: Object.fromEntries(r.analysis.items.filter((it) => it.verdict === '错' || it.verdict === '部分对').map((it) => [it.no, true])),
              nextKey: r.analysis.next_class_questions.slice(0, 3).join('；'),
              ignored: [], // D1：新分析开始时清空上一次的忽略记录，避免残留
              step: 'review',
            })
          } catch (e) {
            clearInterval(timer)
            throw e
          }
        } catch (e: any) {
          show(e.message || '分析失败')
          set({ step: 'pick' })
        }
      },

      save: async (onDone) => {
        const { draft, studentId, uploadedPaths, mistakeChecked, logType, nextKey, ignored } = get()
        const show = useToastStore.getState().show
        if (!draft || !studentId) return
        // D1：只保存保留的题——被忽略的题从分析结果里剔除，错题/原题入库/记录内容都只看保留题
        const keptItems = draft.items.filter((it) => !ignored.includes(it.no))
        const keptDraft: AiAnalysisResult = { ...draft, items: keptItems }
        set({ step: 'saving' })
        try {
          const content =
            `【${keptDraft.paper_meta.type}批改】共 ${keptItems.length} 题：` +
            keptItems.map((it) => `第${it.no}题${it.verdict}`).join('、') +
            `。${keptDraft.overall_comment}`
          const r = await post<{ id: number; mistakes_created: number; bank_questions_created: number }>(`/api/students/${studentId}/logs`, {
            date: todayLocal(),
            type: logType,
            content,
            next_class_key: nextKey,
            images: uploadedPaths,
            ai_result: keptDraft,
            create_mistakes: true,
            mistake_nos: keptItems.filter((it) => mistakeChecked[it.no]).map((it) => it.no),
            // B4 原题还原：勾选入错题本的原题同步存入题库（source=photo），变式题仍走「举一反三」
            photo_bank: true,
            photo_bank_nos: keptItems.filter((it) => mistakeChecked[it.no] && it.stem).map((it) => it.no),
          })
          show(`已保存，生成 ${r.mistakes_created} 道错题${r.bank_questions_created ? `、${r.bank_questions_created} 道原题入库` : ''}`)
          get().reset()
          onDone()
        } catch (e: any) {
          show(e.message || '保存失败')
          set({ step: 'review' })
        }
      },

      reset: () =>
        set({
          step: 'pick', studentId: null, files: [], previews: [], roles: [], progress: '',
          analysis: null, draft: null, uploadedPaths: [], aiNote: '', mistakeChecked: {},
          logType: '作业', nextKey: '', ignored: [],
        }),
    }),
    {
      name: 'workbench-analyze',
      storage: createJSONStorage(() => sessionStorage),
      // files/previews 是 File/blob 对象，不可序列化，不持久化（刷新后回 pick 属预期）
      partialize: (s) =>
        Object.fromEntries(Object.entries(s).filter(([k]) => !['files', 'previews'].includes(k))) as AnalyzeState,
      // 恢复时防御：分析中/保存中状态刷新后请求已丢失，回退到可恢复的界面
      onRehydrateStorage: () => (state) => {
        if (!state) return
        if (state.step === 'uploading' || state.step === 'analyzing') {
          useAnalyzeStore.setState({ step: state.analysis ? 'review' : 'pick' })
        } else if (state.step === 'saving') {
          useAnalyzeStore.setState({ step: state.analysis ? 'review' : 'pick' })
        }
      },
    }
  )
)
