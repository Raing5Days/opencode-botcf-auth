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
        // Fetch both user account usage and specific token attributes in parallel
        const [resUser, resToken] = await Promise.all([
          fetch(`https://botcf.com/api/usage`, {
            headers: { Authorization: `Bearer ${auth.key}` },
          }).catch(() => null),
          fetch(`https://botcf.com/api/usage/token`, {
            headers: { Authorization: `Bearer ${auth.key}` },
          }).catch(() => null),
        ])

        let userData = null
        if (resUser && resUser.ok) {
          const json = await resUser.json()
          if (json && (json.data || json.balance != null)) {
            userData = json.data || json
          }
        }

        let tokenData = null
        if (resToken && resToken.ok) {
          const json = await resToken.json()
          if (json && json.data) {
            tokenData = json.data
          }
        }

        // 1. Account-level balance (actual money available in user wallet)
        const userBalance = typeof (userData?.balance ?? userData?.remaining ?? userData?.total_available) === "number"
          ? (userData?.balance ?? userData?.remaining ?? userData?.total_available)
          : null

        // 2. Token properties
        const tokenName = tokenData?.name || ""
        const isUnlimited = tokenData?.unlimited_quota === true
        const expiresAt = tokenData?.expires_at || userData?.expires_at || 0
        const tokenTotal = typeof tokenData?.total === "number" ? tokenData.total : 0
        const tokenUsed = typeof tokenData?.used === "number" ? tokenData.used : 0

        // If userBalance could not be determined, fallback to standard OpenAI billing
        if (userBalance == null && !tokenData) {
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
          return {
            plan: "BotCF",
            balance: `¥${available.toFixed(2)}`,
            windows: [
              {
                name: "可用额度",
                balance: available,
                unit: "CNY",
              },
            ],
          }
        }

        const windows = []
        const currentBalance = userBalance ?? 0

        if (isUnlimited) {
          // Token is unlimited: constrained only by account wallet balance
          // Report as a prepaid wallet window so Magpie displays real balance without fake used%
          windows.push({
            name: "账户可用余额",
            balance: currentBalance,
            unit: "CNY",
          })
        } else if (tokenTotal > 0) {
          // Token has a specific quota cap
          // The token's own remaining allowance
          const tokenRemain = Math.max(0, tokenTotal - tokenUsed)
          // Actual available allowance is constrained by both token quota and user balance
          const actualAvailable = Math.min(currentBalance, tokenRemain)
          const usedPercent = Math.min(100, Math.max(0, (tokenUsed / tokenTotal) * 100))

          windows.push({
            name: "令牌额度上限",
            used: usedPercent,
            amount: tokenUsed,
            limit: tokenTotal,
            display: `可用 ¥${actualAvailable.toFixed(2)} (上限 ¥${tokenTotal.toFixed(2)})`,
            unit: "CNY",
          })
        } else {
          windows.push({
            name: "账户可用余额",
            balance: currentBalance,
            unit: "CNY",
          })
        }

        // Periodic / Expiration window (if token expires or resets at a specific time)
        if (expiresAt > 0) {
          const expDate = new Date(expiresAt * 1000)
          windows.push({
            name: "周期 / 有效期",
            resetsAt: expDate.toISOString(),
            display: `至 ${expDate.toLocaleDateString()}`,
            aside: true,
          })
        }

        return {
          plan: isUnlimited ? "BotCF" : "BotCF (限额)",
          user: tokenName || undefined,
          balance: `¥${currentBalance.toFixed(2)}`,
          until: expiresAt > 0 ? new Date(expiresAt * 1000).toISOString() : undefined,
          windows,
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
