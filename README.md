# opencode-botcf-auth

Bot Compute Fabric ([botcf.com](https://botcf.com)) 插件，用于在 Magpie 和 OpenCode 中接入 BotCF 提供的统一模型聚合网关。

## 功能特性

- **一键配置与登录**：通过在 [botcf.com/console/token](https://botcf.com/console/token) 创建的令牌（`sk-...`）直接登录。
- **令牌级模型与分组范围**：自动遵循令牌在 BotCF 控制台设定的可用模型列表和号池分组，插件仅根据 API Key 动态呈现授权模型。
- **OpenAI 兼容协议**：统一采用 OpenAI 兼容协议（`@ai-sdk/openai-compatible`），由 BotCF 服务端统一进行各模型协议跨转。
- **用量与余额查询**：在 Magpie 供应商卡片中实时查看令牌额度与状态。

## 安装与使用

### 在 Magpie 中使用

#### 方式一：直接通过 GitHub 仓库添加（推荐）
```bash
magpie plugin add github:Raing5Days/opencode-botcf-auth
```

#### 方式二：本地添加
从本地文件夹加载：
```bash
magpie plugin add ./packages/opencode-botcf-auth
```
或者在 Magpie 设置界面的 **Plugins (插件)** 页面点击 **「从本地文件夹添加」**，选择本目录。

### 在 OpenCode 中使用

在 `opencode.json` 中添加插件声明：

```json
{
  "plugin": ["github:Raing5Days/opencode-botcf-auth"]
}
```
