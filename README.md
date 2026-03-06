# ClawPack

ClawPack 是一个面向 [OpenClaw](https://github.com/openclaw/openclaw) Agent 的应用层打包与分发工具。

它解决的问题很简单：将一个已经调好的 OpenClaw Agent **标准化地导出、导入和验证**。它不是容器，也不是虚拟机，而是建立在这些基础设施之上的应用层分发包。

## 为什么需要 ClawPack

一个 OpenClaw Agent 的可用状态不只是代码或配置，还包括：

- **工作区**（AGENTS.md、SOUL.md、TOOLS.md、技能等）
- **模型提供商配置**（API 密钥、模型偏好）
- **通道配置**（Telegram、Slack、Discord 等）
- **状态与记忆**（会话历史、向量数据库）
- **凭证与运行态信息**

Docker 能分发运行环境，但无法表达"哪些是模板、哪些是状态、哪些需要重新绑定"。ClawPack 补上了这一层。

## 安装

```bash
npm install -g clawpack
```

要求 Node.js >= 20。

## 快速开始

```bash
# 1. 识别当前 OpenClaw 实例
clawpack inspect

# 2. 导出为模板包（可安全分享）
clawpack export -t template -o my-agent.clawpack

# 3. 在另一台机器导入
clawpack import my-agent.clawpack -t ~/.openclaw

# 4. 验证导入结果
clawpack verify
```

## 命令

### `clawpack inspect`

扫描 OpenClaw 实例，报告其结构、敏感数据和推荐的导出类型。

```bash
clawpack inspect                  # 自动检测 ~/.openclaw
clawpack inspect -p /path/to/dir  # 指定路径
clawpack inspect -f json          # JSON 格式输出
```

### `clawpack export`

将实例导出为 `.clawpack` 包。

```bash
clawpack export -t template       # 模板包（排除敏感信息）
clawpack export -t instance       # 实例包（完整迁移）
clawpack export -o out.clawpack   # 指定输出路径
clawpack export -p /path/to/dir   # 指定源路径
```

### `clawpack import`

将 `.clawpack` 包导入目标环境。

```bash
clawpack import my-agent.clawpack              # 还原到 ~/.openclaw
clawpack import my-agent.clawpack -t ./target  # 指定目标目录
```

### `clawpack verify`

检查导入后的实例是否结构完整、基础可用。

```bash
clawpack verify                  # 验证 ~/.openclaw
clawpack verify -p /path/to/dir  # 指定路径
```

## 包类型

| 类型 | 用途 | 包含内容 | 风险等级 |
|------|------|----------|----------|
| **template** | 分享与复用 | 工作区、非敏感配置 | `safe-share` |
| **instance** | 完整迁移 | 配置、工作区、状态、凭证 | `trusted-migration-only` |

模板包会自动排除凭证、会话数据、记忆数据库和 `.env` 文件。

## 包格式

`.clawpack` 文件是一个 gzip 压缩的 tar 归档，包含以下结构：

```
manifest.json       # 包元数据（schema 版本、类型、风险等级等）
config/             # 配置文件
workspace/          # Agent 工作区（AGENTS.md、SOUL.md、技能等）
state/              # 会话与凭证数据（仅 instance 包）
reports/            # 导出报告
```

## 风险等级

| 等级 | 说明 |
|------|------|
| `safe-share` | 无敏感数据，可安全分发 |
| `internal-only` | 可能包含非关键配置，仅限团队内部分享 |
| `trusted-migration-only` | 包含凭证或状态数据，仅限受信任环境导入 |

## 输出格式

所有命令均支持 `-f text`（默认，人类可读）和 `-f json`（机器可读）两种输出格式。

```bash
clawpack inspect -f json | jq '.riskAssessment'
```

## 开发

```bash
git clone https://github.com/Mrxuexi/clawpack.git
cd clawpack
npm install
npm run build
npm test
```

## 许可证

MIT
