// 课件注册表：新课件在此追加即可出现在列表与搜索中
import type { LabScene } from './engine/types'
import { inclineScene } from './scenes/InclineBalance'
import { hangingScene } from './scenes/HangingRopes'
import { compositionScene } from './scenes/ForceComposition'
import { cartScene } from './scenes/NewtonsCart'
import { elevatorScene } from './scenes/Elevator'
import { freeFallScene } from './scenes/FreeFall'
import { catchUpScene } from './scenes/CatchUp'
import { frictionScene } from './scenes/FrictionForce'
import { pulleyScene } from './scenes/PulleySystem'
import { turntableScene } from './scenes/TurntablePendulum'
import { bridgeScene } from './scenes/Bridge'
import { orbitScene } from './scenes/Orbit'
import { powerScene } from './scenes/PowerLoco'
import { launchScene } from './scenes/AngledLaunch'
import { coulombScene } from './scenes/CoulombLaw'
import { efieldScene } from './scenes/EFieldLines'
import { potentialScene } from './scenes/PotentialEquip'
import { eDeflectionScene } from './scenes/EDeflection'
import { capacitorScene } from './scenes/Capacitor'
import { circuitScene } from './scenes/CircuitOhm'
import { emfScene } from './scenes/EmfInternal'
import { ampereScene } from './scenes/AmpereForce'
import { lorentzScene } from './scenes/LorentzCircle'
import { selectorScene } from './scenes/SelectorCyclotron'
import { combinedScene } from './scenes/CombinedFields'
import { lenzScene } from './scenes/LenzLaw'

export const SCENES: LabScene[] = [
  inclineScene,
  hangingScene,
  compositionScene,
  cartScene,
  elevatorScene,
  freeFallScene,
  catchUpScene,
  frictionScene,
  pulleyScene,
  turntableScene,
  bridgeScene,
  orbitScene,
  powerScene,
  launchScene,
  coulombScene,
  efieldScene,
  potentialScene,
  eDeflectionScene,
  capacitorScene,
  circuitScene,
  emfScene,
  ampereScene,
  lorentzScene,
  selectorScene,
  combinedScene,
  lenzScene,
]

export function findScene(id: string | undefined): LabScene | undefined {
  return SCENES.find((s) => s.id === id)
}

/** 按知识点标签匹配课件（错题联动用） */
export function matchScene(knowledgePoints: string[]): LabScene | undefined {
  for (const kp of knowledgePoints) {
    const hit = SCENES.find(
      (s) => s.tags.includes(kp) || s.title.includes(kp) || s.chapter.includes(kp)
    )
    if (hit) return hit
  }
  // 二次宽松匹配：知识点互含
  for (const kp of knowledgePoints) {
    const hit = SCENES.find((s) => s.tags.some((t) => t.includes(kp) || kp.includes(t)))
    if (hit) return hit
  }
  return undefined
}
