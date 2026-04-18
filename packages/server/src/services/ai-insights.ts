import type { ProfilesetResult } from '@wow-simc/shared'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'
const GROQ_MODEL = 'llama-3.1-8b-instant'

interface SimContext {
  simType: string
  baseDps?: number
  profilesetResults: ProfilesetResult[]
  characterName?: string
  characterClass?: string
  characterSpec?: string
  instanceNames?: string[]
}

/**
 * Generate AI insights from simulation results using Groq (free tier).
 * Returns null if Groq is not configured or the request fails.
 */
export async function generateInsights(context: SimContext): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return null

  try {
    const prompt = buildPrompt(context)

    const res = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You are a World of Warcraft simulation expert. Analyze SimulationCraft results and give short, actionable gear advice. Be concise (3-5 sentences max). Use item names. No fluff. Answer in the same language the user speaks — if the character name or context suggests French, answer in French.',
          },
          { role: 'user', content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 300,
      }),
    })

    if (!res.ok) {
      console.error(`[ai-insights] Groq API error: ${res.status}`)
      return null
    }

    const data = await res.json() as {
      choices?: Array<{ message?: { content?: string } }>
    }

    return data.choices?.[0]?.message?.content?.trim() ?? null
  } catch (err) {
    console.error('[ai-insights] Failed to generate insights:', err)
    return null
  }
}

function buildPrompt(ctx: SimContext): string {
  const lines: string[] = []

  if (ctx.characterName || ctx.characterClass) {
    lines.push(`Character: ${ctx.characterName ?? ''} ${ctx.characterSpec ?? ''} ${ctx.characterClass ?? ''}`.trim())
  }

  if (ctx.baseDps) {
    lines.push(`Base DPS: ${Math.round(ctx.baseDps).toLocaleString()}`)
  }

  if (ctx.instanceNames?.length) {
    lines.push(`Instances: ${ctx.instanceNames.join(', ')}`)
  }

  if (ctx.simType === 'droptimizer' && ctx.profilesetResults.length > 0) {
    const sorted = [...ctx.profilesetResults].sort((a, b) => (b.dps_delta ?? 0) - (a.dps_delta ?? 0))
    const top5 = sorted.slice(0, 5)
    const worst3 = sorted.filter((r) => (r.dps_delta ?? 0) < 0).slice(-3)

    lines.push('')
    lines.push('Top 5 upgrades:')
    for (const r of top5) {
      lines.push(`  ${r.name}: ${r.dps_delta !== undefined ? (r.dps_delta >= 0 ? '+' : '') + Math.round(r.dps_delta) : '?'} DPS (${r.dps_delta_pct !== undefined ? (r.dps_delta_pct >= 0 ? '+' : '') + r.dps_delta_pct.toFixed(2) + '%' : '?'})`)
    }

    if (worst3.length > 0) {
      lines.push('')
      lines.push('Biggest downgrades:')
      for (const r of worst3) {
        lines.push(`  ${r.name}: ${Math.round(r.dps_delta ?? 0)} DPS`)
      }
    }

    lines.push('')
    lines.push(`Total items simulated: ${ctx.profilesetResults.length}`)
    lines.push(`Items that are upgrades: ${sorted.filter((r) => (r.dps_delta ?? 0) > 0).length}`)
  }

  if (ctx.simType === 'top-gear' && ctx.profilesetResults.length > 0) {
    const sorted = [...ctx.profilesetResults].sort((a, b) => b.mean - a.mean)
    lines.push('')
    lines.push('Gear rankings (top 5):')
    for (const r of sorted.slice(0, 5)) {
      lines.push(`  #${r.rank ?? '-'} ${r.name}: ${Math.round(r.mean).toLocaleString()} DPS${r.dps_delta !== undefined ? ` (${r.dps_delta >= 0 ? '+' : ''}${Math.round(r.dps_delta)})` : ''}`)
    }
  }

  lines.push('')
  lines.push('Give a brief analysis: what should the player prioritize? Which boss/dungeon to farm? Any gear slots that are weak?')

  return lines.join('\n')
}

export function isGroqConfigured(): boolean {
  return !!process.env.GROQ_API_KEY
}
