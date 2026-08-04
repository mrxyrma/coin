import { Suspense, useEffect, useState } from 'react'
import { Canvas, advance, useStore } from '@react-three/fiber'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

import { gsap } from '../lib/scroll'
import { PixelCamera, fovForViewport } from '../lib/pixelCamera'
import { coinPath } from '../lib/useCoinEngine'
import { coinUi, getMetal } from '../lib/coinStore'
import { Coin } from './Coin'
import { Case } from './Case'

/**
 * Нейтральное окружение без сетевых запросов.
 *
 * Металл без env-map выглядит плоской заливкой, а HDRI-пресеты drei тянутся
 * с CDN — это лишний внешний запрос и точка отказа. RoomEnvironment идёт
 * в составе three и даёт достаточную отражающую среду для болванки.
 * На этапе 4 заменяется на HDRI от дизайнера.
 */
function StudioEnvironment() {
  const store = useStore()

  useEffect(() => {
    const { gl, scene } = store.getState()
    const pmrem = new THREE.PMREMGenerator(gl)
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04)
    scene.environment = env.texture
    return () => {
      env.texture.dispose()
      pmrem.dispose()
      scene.environment = null
    }
  }, [store])

  return null
}

/**
 * Рендер из общего тикера.
 *
 * frameloop="never" отключает собственный requestAnimationFrame R3F, и кадр
 * рисуется после того, как Lenis обновил позицию скролла. Иначе сцена
 * отставала бы на кадр и монета «плавала» относительно текста.
 */
function TickerRenderer() {
  useEffect(() => {
    let lastSignature = ''

    const tick = (time: number) => {
      // Вкладка не на экране — GPU можно не трогать вовсе
      if (document.hidden) return

      /*
       * Кадр рисуется, только если что-то реально изменилось. Когда
       * пользователь остановил скролл, сцена статична, и перерисовывать её
       * 60 раз в секунду — впустую греть батарею. В сигнатуру входит всё,
       * от чего зависит картинка: скролл, доворот от клика, металл,
       * размеры окна и номер обмера якорей.
       */
      const signature = `${window.scrollY}|${coinUi.rotY}|${coinUi.nonce}|${getMetal()}|${
        window.innerWidth
      }x${window.innerHeight}|${coinPath.version}`

      if (signature === lastSignature) return
      lastSignature = signature

      advance(time * 1000)
    }

    gsap.ticker.add(tick)
    return () => gsap.ticker.remove(tick)
  }, [])
  return null
}

export function CoinCanvas() {
  // На мобильных ограничиваем плотность жёстче: заливка пикселей —
  // основная нагрузка на интегрированных GPU
  const [dpr] = useState<[number, number]>(() =>
    window.matchMedia('(max-width: 767px)').matches ? [1, 1.5] : [1, 2],
  )

  return (
    <Canvas
      className="coin-canvas"
      frameloop="never"
      dpr={dpr}
      gl={{
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance',
      }}
      camera={{ position: [0, 0, 1000], fov: fovForViewport(800) }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        pointerEvents: 'none',
      }}
    >
      <PixelCamera />
      <TickerRenderer />
      <StudioEnvironment />

      <ambientLight intensity={0.35} />
      <directionalLight position={[400, 600, 900]} intensity={1.6} />
      <directionalLight position={[-500, -200, 400]} intensity={0.5} />

      {/* Летящая монета: металл берёт из стора, его меняют табы */}
      <Coin />
      {/* Вторая монета первого экрана — всегда серебро, стоит на месте.
          Отодвинута вглубь, иначе протыкает золотую в месте перекрытия */}
      <Coin metal="silver" staticAnchor="hero-silver" depth={-0.16} />
      {/* Монета на экране покупки: отдельная, летящая осталась в футляре */}
      <Coin staticAnchor="purchase" />

      {/* Футляр появляется только вместе со своей моделью */}
      <Suspense fallback={null}>
        <Case anchor="case-shell" />
      </Suspense>
    </Canvas>
  )
}

// Для React.lazy: сцена грузится отдельным чанком, текст не ждёт three.js
export default CoinCanvas
