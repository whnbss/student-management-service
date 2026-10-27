// 拍批流程全局状态：存到模块级 Zustand store（并持久化到 sessionStorage）
// 解决「分析完切到其它页面再回来页面空白」的问题——路由切换不丢状态，
// 分析中途切走再回来也能看到最新进度/结果（分析请求在 store action 里继续跑）
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { post } from '@/lib/api'
import { uploadImage } from '@/lib/image'
import { useAuthStore, useToastStore } from '@/stores/auth'
import type { Student, AiAnalysisResult } from '@workbench/shared'

export type AnalyzeStep = 'pick' | 'uploading' | 'analyzing' | 'review' | 'saving'

interface AnalyzeState {
  step: AnalyzeStep
  studentId: number | null
  files: File[] // 原始文件（仅内存，不持久化；刷新后为空属预期）
  previews: string[] // blob 预览地址（仅内存）
  progress: string
  analysis: AiAnalysisResult | null
  draft: AiAnalysisResult | null
  uploadedPaths: string[]
  aiNote: string
  mistakeChecked: Record<number, boolean>
  logType: string
  nextKey: string

  setStep: (s: AnalyzeStep) => void
  setStudentId: (id: number | null) => void
  addFiles: (files: File[]) => void
  removeFile: (idx: number) => void
  setProgress: (p: string) => void
  setDraft: (updater: (d: AiAnalysisResult | null) => AiAnalysisResult | null) => void
  setMistakeChecked: (v: Record<number, boolean>) => void
  setLogType: (v: string) => void
  setNextKey: (v: string) => void
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
      progress: '',
      analysis: null,
      draft: null,
      uploadedPaths: [],
      aiNote: '',
      mistakeChecked: {},
      logType: '作业',
      nextKey: '',

      setStep: (s) => set({ step: s }),
      setStudentId: (id) => set({ studentId: id }),
      addFiles: (arr) => {
        const { files, previews } = get()
        const nf = [...files, ...arr].slice(0, 9)
        const np = [...previews, ...arr.map((f) => URL.createObjectURL(f))].slice(0, 9)
        set({ files: nf, previews: np })
      },
      removeFile: (idx) => {
        const { files, previews } = get()
        set({ files: files.filter((_, i) => i !== idx), previews: previews.filter((_, i) => i !== idx) })
      },
      setProgress: (p) => set({ progress: p }),
      setDraft: (updater) => set({ draft: updater(get().draft) }),
      setMistakeChecked: (v) => set({ mistakeChecked: v }),
      setLogType: (v) => set({ logType: v }),
      setNextKey: (v) => set({ nextKey: v }),

      start: async () => {
        const { studentId, files } = get()
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
          // 第 3 步：AI 分析
          set({ step: 'analyzing', progress: '智能分析正在识别题目与作答…' })
          const tips = ['智能分析正在识别题目与作答…', '正在逐题判定对错…', '正在归类错因与薄弱点…', '即将完成，正在整理建议…']
          let ti = 0
          const timer = setInterval(() => { ti = (ti + 1) % tips.length; set({ progress: tips[ti] }) }, 4000)
          try {
            const r = await post<{ analysis: AiAnalysisResult; provider: string }>('/api/analyze', {
              student_id: studentId, images: paths,
            })
            clearInterval(timer)
            set({
              analysis: r.analysis,
              draft: r.analysis,
              aiNote: `分析供应商：${r.provider}`,
              mistakeChecked: Object.fromEntries(r.analysis.items.filter((it) => it.verdict === '错' || it.verdict === '部分对').map((it) => [it.no, true])),
              nextKey: r.analysis.next_class_questions.slice(0, 3).join('；'),
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
        const { draft, studentId, uploadedPaths, mistakeChecked, logType, nextKey } = get()
        const show = useToastStore.getState().show
        if (!draft || !studentId) return
        set({ step: 'saving' })
        try {
          const content =
            `【${draft.paper_meta.type}批改】共 ${draft.items.length} 题：` +
            draft.items.map((it) => `第${it.no}题${it.verdict}`).join('、') +
            `。${draft.overall_comment}`
          const r = await post<{ id: number; mistakes_created: number }>(`/api/students/${studentId}/logs`, {
            date: new Date().toISOString().slice(0, 10),
            type: logType,
            content,
            next_class_key: nextKey,
            images: uploadedPaths,
            ai_result: draft,
            create_mistakes: true,
            mistake_nos: draft.items.filter((it) => mistakeChecked[it.no]).map((it) => it.no),
          })
          show(`已保存，自动生成 ${r.mistakes_created} 道错题`)
          get().reset()
          onDone()
        } catch (e: any) {
          show(e.message || '保存失败')
          set({ step: 'review' })
        }
      },

      reset: () =>
        set({
          step: 'pick', studentId: null, files: [], previews: [], progress: '',
          analysis: null, draft: null, uploadedPaths: [], aiNote: '', mistakeChecked: {},
          logType: '作业', nextKey: '',
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
