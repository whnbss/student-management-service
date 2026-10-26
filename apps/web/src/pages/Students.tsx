// 学生列表：搜索/筛选 + 新建/编辑
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post, put } from '@/lib/api'
import { useToastStore } from '@/stores/auth'
import type { Student, Grade, StudentStatus } from '@workbench/shared'

const GRADES: Grade[] = ['高一', '高二', '高三']
const STATUSES: StudentStatus[] = ['在读', '停课', '结课']

const emptyForm = {
  name: '', grade: '' as Grade | '', school: '', textbook: '人教版',
  phone: '', parent_wechat: '', note: '', status: '在读' as StudentStatus,
}

export default function Students() {
  const [list, setList] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [grade, setGrade] = useState('')
  const [status, setStatus] = useState('在读')
  const [editing, setEditing] = useState<typeof emptyForm | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const show = useToastStore((s) => s.show)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setList(await get<Student[]>('/api/students'))
    } catch (e: any) {
      show(e.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }, [show])

  useEffect(() => {
    load()
  }, [load])

  const save = async () => {
    if (!editing?.name.trim()) { show('姓名必填'); return }
    setSaving(true)
    try {
      if (editId) {
        await put(`/api/students/${editId}`, editing)
        show('已保存')
      } else {
        await post('/api/students', editing)
        show('已添加学生')
      }
      setEditing(null)
      setEditId(null)
      load()
    } catch (e: any) {
      show(e.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const filtered = list.filter(
    (s) =>
      (!query || s.name.includes(query) || s.school.includes(query) || s.phone.includes(query)) &&
      (!grade || s.grade === grade) &&
      (!status || s.status === status)
  )

  const statusColor = (st: string) =>
    st === '在读'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
      : st === '停课'
      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
      : 'bg-slate-200 text-slate-500 dark:bg-slate-800'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">学生</h1>
        <button className="btn-primary" onClick={() => { setEditing({ ...emptyForm }); setEditId(null) }}>＋ 新建</button>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-2">
        <input className="input flex-1" placeholder="搜索姓名/学校/电话" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select className="input !w-24" value={grade} onChange={(e) => setGrade(e.target.value)}>
          <option value="">年级</option>
          {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select className="input !w-24" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">状态</option>
          {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3 animate-pulse">
          {[1, 2, 3].map((i) => <div key={i} className="card h-20 bg-slate-200/50 dark:bg-slate-800/50" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-12 text-center">
          <div className="text-4xl mb-3">🎓</div>
          <p className="text-sm text-slate-500">还没有学生，点右上角「＋ 新建」添加第一位学生</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filtered.map((s) => (
            <Link key={s.id} to={`/students/${s.id}`} className="card p-4 flex items-center gap-3 hover:border-primary-300 dark:hover:border-primary-700">
              <div className="w-11 h-11 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-lg font-bold shrink-0">
                {s.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{s.name}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full ${statusColor(s.status)}`}>{s.status}</span>
                </div>
                <div className="text-xs text-slate-400 truncate">{s.grade} {s.school && `· ${s.school}`}</div>
              </div>
              {s.remaining_hours !== undefined && (
                <div className={`text-right shrink-0 num ${s.remaining_hours <= 3 ? 'text-red-500' : 'text-slate-500'}`}>
                  <div className="text-lg font-semibold leading-none">{s.remaining_hours}</div>
                  <div className="text-[10px]">剩余课时{s.remaining_hours <= 3 && ' ⚠️'}</div>
                </div>
              )}
            </Link>
          ))}
        </div>
      )}

      {/* 新建/编辑弹窗 */}
      {editing && (
        <div className="fixed inset-0 z-30 bg-black/40 flex items-end md:items-center justify-center p-0 md:p-6" onClick={() => setEditing(null)}>
          <div className="card w-full max-w-lg p-6 rounded-b-none md:rounded-2xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-semibold text-lg mb-4">{editId ? '编辑学生' : '新建学生'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">姓名 *</label>
                <input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <label className="label">年级</label>
                <select className="input" value={editing.grade} onChange={(e) => setEditing({ ...editing, grade: e.target.value as Grade | '' })}>
                  <option value="">未设</option>
                  {GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="label">状态</label>
                <select className="input" value={editing.status} onChange={(e) => setEditing({ ...editing, status: e.target.value as StudentStatus })}>
                  {STATUSES.map((st) => <option key={st} value={st}>{st}</option>)}
                </select>
              </div>
              <div>
                <label className="label">学校</label>
                <input className="input" value={editing.school} onChange={(e) => setEditing({ ...editing, school: e.target.value })} />
              </div>
              <div>
                <label className="label">教材版本</label>
                <input className="input" value={editing.textbook} onChange={(e) => setEditing({ ...editing, textbook: e.target.value })} />
              </div>
              <div>
                <label className="label">联系方式</label>
                <input className="input num" value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
              </div>
              <div>
                <label className="label">家长微信</label>
                <input className="input" value={editing.parent_wechat} onChange={(e) => setEditing({ ...editing, parent_wechat: e.target.value })} />
              </div>
              <div className="col-span-2">
                <label className="label">备注</label>
                <textarea className="input" rows={2} value={editing.note} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button className="btn-outline flex-1" onClick={() => setEditing(null)}>取消</button>
              <button className="btn-primary flex-1" disabled={saving} onClick={save}>{saving ? '保存中…' : '保存'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
