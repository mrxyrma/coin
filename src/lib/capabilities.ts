/**
 * Возможности устройства, от которых зависит, что вообще запускать.
 */

let webglCache: boolean | null = null

/**
 * Есть ли работающий WebGL.
 *
 * Проверяем реальным созданием контекста, а не наличием класса
 * WebGLRenderingContext: в корпоративных сборках браузеров и на старых
 * Android класс есть, а контекст не создаётся. Контекст сразу отпускаем,
 * иначе он занимает один из немногих доступных браузеру слотов.
 */
export function hasWebGL(): boolean {
  if (webglCache !== null) return webglCache
  try {
    const canvas = document.createElement('canvas')
    const gl =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl')
    webglCache = Boolean(gl)
    const lose = (gl as WebGLRenderingContext | null)?.getExtension(
      'WEBGL_lose_context',
    )
    lose?.loseContext()
  } catch {
    webglCache = false
  }
  return webglCache
}

export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
