import * as THREE from 'three'

/**
 * Временные текстуры сторон монеты — до получения модели от дизайнера.
 *
 * Рисуются в canvas, чтобы уже сейчас было видно, какой стороной монета
 * повёрнута, и можно было настраивать обороты по скроллу. Концентрические
 * кольца имитируют гильоширование: на них хорошо читается игра света
 * при повороте.
 */
export function makeFaceTexture(label: string, metal: 'gold' | 'silver') {
  const size = 512
  const c = document.createElement('canvas')
  c.width = c.height = size
  const ctx = c.getContext('2d')!
  const r = size / 2

  const base = metal === 'gold' ? '#d9b45b' : '#c9ccd1'
  const light = metal === 'gold' ? '#f7e6a8' : '#f2f4f6'
  const dark = metal === 'gold' ? '#8a6a20' : '#8d9298'

  const g = ctx.createLinearGradient(0, 0, size, size)
  g.addColorStop(0, light)
  g.addColorStop(0.5, base)
  g.addColorStop(1, dark)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)

  // Гильош-заглушка: концентрические кольца
  ctx.strokeStyle = 'rgba(0,0,0,.16)'
  ctx.lineWidth = 1
  for (let i = 8; i < r - 8; i += 5) {
    ctx.beginPath()
    ctx.arc(r, r, i, 0, Math.PI * 2)
    ctx.stroke()
  }

  ctx.strokeStyle = 'rgba(0,0,0,.5)'
  ctx.lineWidth = 6
  ctx.beginPath()
  ctx.arc(r, r, r - 16, 0, Math.PI * 2)
  ctx.stroke()

  ctx.fillStyle = 'rgba(0,0,0,.65)'
  ctx.font = `600 ${size * 0.11}px system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, r, r)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}
