// M1 阶段的占位页（题库 / 错题本）
export default function Placeholder({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="card p-12 text-center">
      <div className="text-4xl mb-3">🚧</div>
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <p className="text-sm text-slate-500">{desc}</p>
    </div>
  )
}
