/**
 * Monokai Surtur skin.
 *
 * The skin is scoped to a body attribute so the stylesheet can override the
 * stock DSH semantic tokens directly. It sets one inline CSS variable for the
 * bundled background art and restores everything on dispose.
 */
import type { Context } from '@deepseek-ai/cordis'
import { MONOKAI_BACKGROUND } from './background-art.generated.ts'
import './monokai.module.css'

const SKIN_OWNER = 'monokai'
const BODY_ATTR = 'data-dsh-monokai'
const BG_VAR = '--dsh-monokai-bg-image'

export function apply(ctx: Context): void {
  const body = document.body
  const hadAttr = body.hasAttribute(BODY_ATTR)
  const previousBg = body.style.getPropertyValue(BG_VAR)
  const previousBgPriority = body.style.getPropertyPriority(BG_VAR)

  body.setAttribute(BODY_ATTR, '')
  body.style.setProperty(BG_VAR, `url("${MONOKAI_BACKGROUND}")`)

  ctx.effect(() => () => {
    if (hadAttr === false) body.removeAttribute(BODY_ATTR)
    if (previousBg === '' && previousBgPriority === '') {
      body.style.removeProperty(BG_VAR)
    } else {
      body.style.setProperty(BG_VAR, previousBg, previousBgPriority)
    }
  }, `ui-skin-${SKIN_OWNER}: background and token overrides`)
}
