// 图片处理：上传前前端压缩（长边 1280px、quality 0.7），用 canvas 实现，无外部依赖
// 参数比早期版本（1600/0.8）更保守：实测部分公司网关对大请求体响应慢甚至超时，控制体积也节省 AI 费用
export async function compressImage(file: File, maxSide = 1280, quality = 0.7): Promise<Blob> {
  // 非图片或 gif 不压缩（gif 压缩会丢帧）
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close?.()
    return file // 已足够小，直接上传
  }
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
      'image/jpeg',
      quality
    )
  })
}

// 上传单个图片到后端，返回相对路径（/uploads/...）
export async function uploadImage(file: File, studentId: number | string, token: string): Promise<string> {
  const blob = await compressImage(file)
  const fd = new FormData()
  // P2-73：字段放在 file 之前（后端已改为顺序无关，这里双保险）
  fd.append('student_id', String(studentId))
  fd.append('file', new File([blob], `photo.jpg`, { type: blob.type || 'image/jpeg' }))
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data?.path) throw new Error(data?.error || '图片上传失败')
  return data.path as string
}
