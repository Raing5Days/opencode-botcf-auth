// Bot Compute Fabric (botcf.com) as an OpenCode provider plugin and Magpie plugin.
//
// API Keys generated from https://botcf.com/console/token carry user permissions,
// model allowances, and token group routing directly. This plugin provides
// standard OpenAI-compatible gateway routing, dynamic model fetching,
// and token quota / balance monitoring.

const PROVIDER_ID = "botcf"
const BASE_URL = "https://botcf.com/v1"
const OPENAI_COMPATIBLE = "@ai-sdk/openai-compatible"

// BotCF Official Logo SVG as Base64 Data URI
const BOTCF_ICON = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0OCIgaGVpZ2h0PSI0OCIgdmlld0JveD0iMCAwIDYyIDQ4IiByb2xlPSJpbWciIGFyaWEtbGFiZWw9IkJGIiBzdHlsZT0iY29sb3I6I2ZmNmI0YSI+CiAgPHBhdGggZmlsbD0iY3VycmVudENvbG9yIiBkPSJNNyA2aDEyLjFjNy4xIDAgMTEuMiAzLjYgMTEuMiA5LjMgMCAzLjQ1LTEuNjQgNi4yLTQuNTggNy43NCAzLjg2IDEuNSA2LjA4IDQuODIgNi4wOCA5LjI0QzMxLjggMzguNDIgMjcgNDIgMTguNzYgNDJIN1Y2Wm03LjI4IDYuNDh2Ny41aDQuNDhjMy4xMiAwIDQuODYtMS4zOCA0Ljg2LTMuNzYgMC0yLjQyLTEuNzYtMy43NC01LjE4LTMuNzRoLTQuMTZabTAgMTMuN3Y5LjM0aDUuMDhjMy40OCAwIDUuNTYtMS44MiA1LjU2LTQuNTYgMC0zLjAyLTIuMDgtNC43OC01Ljg4LTQuNzhoLTQuNzZaIi8+CiAgPHBhdGggZmlsbD0iY3VycmVudENvbG9yIiBkPSJNNDEuNSA2SDU4djYuOThoLTguODZ2Ny40Nmg3LjcydjYuODRoLTcuNzJWNDJINDEuNVY2WiIvPgo8L3N2Zz4="

// Default fallback models before user sign-in
const DEFAULT_MODELS = {
  "claude-3-5-sonnet-20241022": {
    name: "Claude 3.5 Sonnet",
    limit: { context: 200000, output: 8192 },
    tool_call: true,
    reasoning: true,
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  "claude-3-7-sonnet": {
    name: "Claude 3.7 Sonnet",
    limit: { context: 200000, output: 64000 },
    tool_call: true,
    reasoning: true,
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  "gpt-4o": {
    name: "GPT-4o",
    limit: { context: 128000, output: 16384 },
    tool_call: true,
    modalities: { input: ["text", "image"], output: ["text"] },
  },
  "deepseek-v3": {
    name: "DeepSeek V3",
    limit: { context: 128000, output: 8192 },
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
  },
  "deepseek-r1": {
    name: "DeepSeek R1",
    limit: { context: 128000, output: 32768 },
    tool_call: true,
    reasoning: true,
    modalities: { input: ["text"], output: ["text"] },
  },
  "kimi-k3": {
    name: "Kimi K3",
    limit: { context: 200000, output: 16384 },
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
  },
  "glm-5": {
    name: "GLM-5",
    limit: { context: 128000, output: 16384 },
    tool_call: true,
    modalities: { input: ["text"], output: ["text"] },
  },
}

export const BotCFAuthPlugin = async ({ client }) => ({
  // Provider configuration and default models when not signed in
  config: async (cfg) => {
    cfg.provider ??= {}
    cfg.provider[PROVIDER_ID] ??= {
      name: "BotCF",
      npm: OPENAI_COMPATIBLE,
      api: BASE_URL,
      models: DEFAULT_MODELS,
    }
  },

  auth: {
    provider: PROVIDER_ID,
    icon: BOTCF_ICON,
    maxAccounts: 50,
    methods: [
      {
        type: "api",
        label: "BotCF API Key",
        placeholder: "sk-...",
      },
    ],

    // Per-account request loader
    async loader(getAuth) {
      const auth = await getAuth()
      if (auth?.type !== "api" || !auth?.key) return {}

      return {
        baseURL: BASE_URL,
        apiKey: auth.key,
        async fetch(input, init) {
          const headers = new Headers(init?.headers)
          headers.set("Authorization", `Bearer ${auth.key}`)
          headers.set("x-client-platform", "magpie-opencode-botcf")
          return fetch(input, { ...init, headers })
        },
      }
    },

    // Magpie usage hook: reports remaining balance and quotas
    async usage(getAuth) {
      const auth = await getAuth()
      if (auth?.type !== "api" || !auth?.key) return {}

      try {
        // Query /api/usage first, then fallback to /dashboard/billing/credit_grants
        let usageData = null
        try {
          const resApi = await fetch(`https://botcf.com/api/usage`, {
            headers: { Authorization: `Bearer ${auth.key}` },
          })
          if (resApi.ok) {
            const json = await resApi.json()
            if (json && (json.data || json.total_granted || json.remaining != null)) {
              usageData = json.data || json
            }
          }
        } catch {}

        if (!usageData) {
          const resGrants = await fetch(`${BASE_URL}/dashboard/billing/credit_grants`, {
            headers: { Authorization: `Bearer ${auth.key}` },
          })
          if (resGrants.ok) {
            usageData = await resGrants.json()
          }
        }

        if (usageData) {
          const totalGranted = typeof (usageData.total_granted ?? usageData.total) === "number"
            ? (usageData.total_granted ?? usageData.total)
            : 0
          const totalAvailable = typeof (usageData.total_available ?? usageData.remaining ?? usageData.balance) === "number"
            ? (usageData.total_available ?? usageData.remaining ?? usageData.balance)
            : 0
          const totalUsed = typeof (usageData.total_used ?? usageData.used) === "number"
            ? (usageData.total_used ?? usageData.used)
            : (totalGranted - totalAvailable)

          const isUnlimited = usageData.unlimited_quota === true
          const expiresAt = usageData.expires_at || 0

          // Calculate percent used of total granted limit
          const usedPercent = totalGranted > 0 ? (totalUsed / totalGranted) * 100 : 0

          // Windows:
          // 1. "当前可用额度 / 总上限": reports actual remaining vs key's total allowance limit
          // 2. If token has expiration / reset cycle, report as a window with reset time
          const windows = []

          if (isUnlimited) {
            windows.push({
              name: "令牌额度 (无限)",
              used: 0,
              display: `可用 ¥${totalAvailable.toFixed(2)} (不限额)`,
              unit: "CNY",
            })
          } else {
            windows.push({
              name: "总额度限制",
              used: Math.min(100, Math.max(0, usedPercent)),
              display: `剩余 ¥${totalAvailable.toFixed(2)} / 上限 ¥${totalGranted.toFixed(2)}`,
              amount: totalUsed,
              limit: totalGranted,
              unit: "CNY",
            })
          }

          // Periodic / Expiration window
          if (expiresAt > 0) {
            const expDate = new Date(expiresAt * 1000)
            windows.push({
              name: "周期 / 有效期",
              resetsAt: expDate.toISOString(),
              display: `至 ${expDate.toLocaleDateString()}`,
              unit: "CNY",
              aside: true,
            })
          }

          return {
            plan: isUnlimited ? "BotCF (无上限)" : "BotCF",
            balance: `¥${totalAvailable.toFixed(2)}`,
            until: expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : undefined,
            windows,
          }
        }

        // Fallback to /dashboard/billing/subscription
        const resSub = await fetch(`${BASE_URL}/dashboard/billing/subscription`, {
          headers: { Authorization: `Bearer ${auth.key}` },
        })

        if (!resSub.ok) {
          return {
            error: `Failed to fetch balance (${resSub.status})`,
            windows: [],
          }
        }

        const sub = await resSub.json()
        const total = typeof sub.hard_limit_usd === "number" ? sub.hard_limit_usd : 0

        const resUsage = await fetch(`${BASE_URL}/dashboard/billing/usage?start_date=2024-01-01&end_date=2026-12-31`, {
          headers: { Authorization: `Bearer ${auth.key}` },
        }).catch(() => null)

        let used = 0
        if (resUsage && resUsage.ok) {
          const u = await resUsage.json()
          used = (u?.total_usage ?? 0) / 100.0
        }

        const available = Math.max(0, total - used)
        const percent = total > 0 ? (used / total) * 100 : 0

        return {
          plan: "BotCF",
          balance: `¥${available.toFixed(2)}`,
          windows: [
            {
              name: "总额度限制",
              used: Math.min(100, Math.max(0, percent)),
              display: `剩余 ¥${available.toFixed(2)} / 上限 ¥${total.toFixed(2)}`,
              amount: used,
              limit: total,
              unit: "CNY",
            },
          ],
        }
      } catch (err) {
        return {
          error: `Error querying balance: ${err?.message ?? err}`,
          windows: [],
        }
      }
    },
  },

  // Query models allowed by the specific API Key
  provider: {
    id: PROVIDER_ID,
    async models(provider, { auth } = {}) {
      if (auth?.type !== "api" || !auth?.key) {
        return provider.models
      }

      try {
        const res = await fetch(`${BASE_URL}/models`, {
          headers: { Authorization: `Bearer ${auth.key}` },
        })
        if (!res.ok) {
          return provider.models
        }

        const body = await res.json()
        const modelList = Array.isArray(body?.data) ? body.data : []
        if (modelList.length === 0) {
          return provider.models
        }

        const out = {}
        for (const item of modelList) {
          const id = item?.id
          if (!id) continue

          const fallback = DEFAULT_MODELS[id] || {}

          // Determine capabilities based on model name patterns
          const isReasoning =
            fallback.reasoning ??
            (id.includes("r1") || id.includes("reason") || id.includes("o1") || id.includes("o3") || id.includes("claude-3-7"));
          const hasImage =
            fallback.modalities?.input?.includes("image") ??
            (id.includes("vision") || id.includes("4o") || id.includes("sonnet") || id.includes("gemini") || id.includes("flash"));

          out[id] = {
            id,
            name: id,
            limit: {
              context: fallback.limit?.context ?? 128000,
              output: fallback.limit?.output ?? 16384,
            },
            tool_call: fallback.tool_call ?? true,
            reasoning: isReasoning,
            modalities: {
              input: hasImage ? ["text", "image"] : ["text"],
              output: ["text"],
            },
          }
        }

        return out
      } catch {
        return provider.models
      }
    },
  },
})
