import './styles/sections.css'

import { Suspense, lazy } from 'react'

import { useCoinEngine } from './lib/useCoinEngine'
import { CoinDebug } from './dev/CoinDebug'
import { VariantBadge } from './ui/VariantBadge'

import { Hero } from './sections/Hero'
import { Meaning } from './sections/Meaning'
import { Appearance } from './sections/Appearance'
import { Uniqueness } from './sections/Uniqueness'
import { Packaging } from './sections/Packaging'
import { PackagingPremium } from './sections/PackagingPremium'
import { Purchase } from './sections/Purchase'
import { Footer } from './sections/Footer'

/**
 * three.js — самая тяжёлая часть бандла. Отдельным чанком, чтобы текст
 * и вёрстка рисовались, не дожидаясь загрузки и компиляции WebGL.
 */
const CoinCanvas = lazy(() => import('./three/CoinCanvas'))

const debugCoin =
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('coin') === 'debug'

export default function App() {
  const { webgl } = useCoinEngine()

  return (
    <>
      {/* Без WebGL монету рисует CSS — сцену не грузим вообще */}
      {webgl && (
        <Suspense fallback={null}>
          <CoinCanvas />
        </Suspense>
      )}
      {debugCoin && <CoinDebug />}
      {/* Временная метка на время выбора модели — убрать после решения */}
      <VariantBadge />

      <main className="page">
        <Hero />
        <Meaning />
        <Appearance />
        <Uniqueness />
        <Packaging />
        <PackagingPremium />
        <Purchase />
        <Footer />
      </main>
    </>
  )
}
