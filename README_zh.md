<p align="center">
  <img src="./assets/logo.png" alt="ClawPack" width="200" />
</p>

<h1 align="center">ClawPack</h1>

<p align="center">
  <a href="./README.md">English</a>
</p>

ClawPack 是一个面向 [OpenClaw](https://github.com/openclaw/openclaw) Agent 的应用层打包与分发工具。

它解决的问题很简单：将一个已经调好的 OpenClaw Agent **标准化地导出、导入和验证**。它不是容器，也不是虚拟机，而是建立在这些基础设施之上的应用层分发包。

## 为什么需要 ClawPack

一个 OpenClaw Agent 的可用状态不只是代码或配置，还包括：

```
┌─────────────────────────────────────────────────────┐
│              OpenClaw Agent 实例                      │
│                                                     │
│  ┌─────────────┐       ┌────────────────────────┐   │
│  │  工作区      │       │  模型提供商配置          │   │
│  │  AGENTS.md  │       │  API 密钥、模型偏好      │   │
│  │  SOUL.md    │       └────────────────────────┘   │
│  │  TOOLS.md   │                                    │
│  │  skills/    │       ┌────────────────────────┐   │
│  └─────────────┘       │  通道配置               │   │
│                        │  Telegram / Slack /     │   │
│  ┌─────────────┐       │  Discord               │   │
│  │  状态与记忆  │       └────────────────────────┘   │
│  │  会话历史    │                                    │
│  │  向量数据库  │       ┌────────────────────────┐   │
│  └─────────────┘       │  凭证与运行态信息        │   │
│                        └────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

Docker 能分发运行环境，但无法表达"哪些是模板、哪些是状态、哪些需要重新绑定"。ClawPack 补上了这一层：

```
                 Docker                          ClawPack
            ┌─────────────┐               ┌──────────────────┐
            │  OS + 依赖   │               │  模板 vs 状态 vs  │
            │  运行时      │               │  凭证            │
            │  二进制文件   │               │  ─────────────── │
            └─────────────┘               │  风险检测         │
                                          │  选择性导出       │
           分发的是                        └──────────────────┘
           "怎么运行"
                                          分发的是
                                          "Agent 是什么"
```

## 安装

```bash
npm install -g clawpack
```

要求 Node.js >= 20。

## 快速开始

四个命令构成一条线性工作流：

```
  机器 A                                              机器 B
 ┌────────────────────────────────────┐    ┌─────────────────────────────┐
 │                                    │    │                             │
 │  ① inspect ──▶ ② export           │    │  ③ import ──▶ ④ verify     │
 │     扫描          打包为            │    │     解包          验证      │
 │     & 报告        .clawpack  ──────┼───▶│     & 还原        结构完整性│
 │                                    │    │                             │
 └────────────────────────────────────┘    └─────────────────────────────┘
```

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

```
 ~/.openclaw/
 ├── config/
 ├── workspace/         clawpack inspect
 ├── state/          ─────────────────────▶   报告：
 ├── .env                                     - 结构概览
 └── ...                                      - 发现的敏感数据
                                              - 推荐的包类型
```

```bash
clawpack inspect                  # 自动检测 ~/.openclaw
clawpack inspect -p /path/to/dir  # 指定路径
clawpack inspect -f json          # JSON 格式输出
```

### `clawpack export`

将实例导出为 `.clawpack` 包。

```
 ~/.openclaw/                                my-agent.clawpack
 ├── config/          clawpack export        (gzip 压缩的 tar)
 ├── workspace/    ─────────────────────▶    ┌──────────────┐
 ├── state/           -t template            │ manifest.json│
 ├── .env             -o my-agent.clawpack   │ config/      │
 └── ...                                     │ workspace/   │
                       ▲                     │ reports/     │
                       │                     └──────────────┘
                  敏感信息已排除
                  (template 模式)
```

```bash
clawpack export -t template       # 模板包（排除敏感信息）
clawpack export -t instance       # 实例包（完整迁移）
clawpack export -o out.clawpack   # 指定输出路径
clawpack export -p /path/to/dir   # 指定源路径
```

### `clawpack import`

将 `.clawpack` 包导入目标环境。

```
 my-agent.clawpack                          ~/.openclaw/
 ┌──────────────┐    clawpack import        ├── config/
 │ manifest.json│  ─────────────────────▶   ├── workspace/
 │ config/      │    -t ~/.openclaw         ├── state/
 │ workspace/   │                           └── ...
 │ state/       │
 └──────────────┘
```

```bash
clawpack import my-agent.clawpack              # 还原到 ~/.openclaw
clawpack import my-agent.clawpack -t ./target  # 指定目标目录
```

### `clawpack verify`

检查导入后的实例是否结构完整、基础可用。

```
 ~/.openclaw/
 ├── config/  ✓        clawpack verify
 ├── workspace/  ✓   ─────────────────▶   所有检查通过  ✓
 ├── AGENTS.md  ✓                          - 目录存在
 └── state/  ✓                             - manifest 有效
                                           - 工作区完整
```

```bash
clawpack verify                  # 验证 ~/.openclaw
clawpack verify -p /path/to/dir  # 指定路径
```

## 包类型

```
                          .clawpack
                        ┌───────────┐
                        │           │
                ┌───────┴───┐ ┌────┴──────┐
                │ template  │ │ instance  │
                │ 模板包     │ │ 实例包     │
                └─────┬─────┘ └─────┬─────┘
                      │             │
          ┌───────────┴──┐  ┌──────┴───────────────┐
          │ 工作区        │  │ 工作区                │
          │ 安全配置      │  │ 全部配置               │
          │              │  │ 状态与会话             │
          │ ✗ 密钥       │  │ 凭证与 .env           │
          │ ✗ 会话       │  │                       │
          │ ✗ .env       │  │                       │
          └──────────────┘  └──────────────────────┘
                │                     │
          safe-share           trusted-migration-only
         (可公开分享)           (仅限受信任环境)
```

| 类型 | 用途 | 包含内容 | 风险等级 |
|------|------|----------|----------|
| **template** | 分享与复用 | 工作区、非敏感配置 | `safe-share` |
| **instance** | 完整迁移 | 配置、工作区、状态、凭证 | `trusted-migration-only` |

模板包会自动排除凭证、会话数据、记忆数据库和 `.env` 文件。

## 包格式

`.clawpack` 文件是一个 gzip 压缩的 tar 归档，包含以下结构：

```
my-agent.clawpack (gzip 压缩的 tar)
│
├── manifest.json ─── 包元数据
│                     ├── schema 版本
│                     ├── 包类型 (template / instance)
│                     └── 风险等级
│
├── config/ ───────── 配置文件
│
├── workspace/ ────── Agent 工作区
│                     ├── AGENTS.md
│                     ├── SOUL.md
│                     └── skills/
│
├── state/ ────────── 会话与凭证数据
│                     (仅 instance 包)
│
└── reports/ ──────── 导出报告
```

## 风险等级

```
  safe-share              internal-only           trusted-migration-only
 ┌──────────────┐       ┌──────────────┐        ┌──────────────┐
 │  无敏感数据   │       │  非关键配置   │        │  包含凭证     │
 │  无状态数据   │       │              │        │  状态数据     │
 │              │       │              │        │  会话历史     │
 │  可安全分发   │       │  仅限团队内部 │        │  仅限受信任   │
 │              │       │  分享        │        │  环境导入     │
 └──────────────┘       └──────────────┘        └──────────────┘
    低风险 ◀──────────────────────────────────────▶ 高风险
```

| 等级 | 说明 |
|------|------|
| `safe-share` | 无敏感数据，可安全分发 |
| `internal-only` | 可能包含非关键配置，仅限团队内部分享 |
| `trusted-migration-only` | 包含凭证或状态数据，仅限受信任环境导入 |

## 输出格式

所有命令均支持 `-f text`（默认，人类可读）和 `-f json`（机器可读）两种输出格式。

```
 clawpack inspect -f text          clawpack inspect -f json
 ┌─────────────────────┐           ┌──────────────────────┐
 │  === 扫描报告 ===    │           │ {                    │
 │  路径: ~/.openclaw   │           │   "path": "~/.oc..", │
 │  文件: 42            │           │   "files": 42,       │
 │  风险: safe-share    │           │   "risk": "safe-sh.."│
 └─────────────────────┘           │ }                    │
    人类可读                        └──────────────────────┘
                                      机器可读
```

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

### 项目结构

```
src/
├── cli.ts ─────────── 入口 (commander, 4 个命令)
├── commands/
│   ├── inspect.ts ─── 扫描与报告
│   ├── export.ts ──── 导出为 .clawpack
│   ├── import.ts ──── 从 .clawpack 导入
│   └── verify.ts ──── 结构验证
├── core/
│   ├── scanner.ts ─── 实例检测、敏感数据扫描
│   ├── packer.ts ──── 打包/解包逻辑、排除规则
│   ├── verifier.ts ── 完整性校验
│   └── types.ts ───── 共享类型与常量
└── utils/
    └── output.ts ──── 输出格式化 (text / json)
```

## 许可证

MIT
