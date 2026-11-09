# vite-plugin-build-meta-info

Vite 插件：在生产构建时输出 `version.json`，记录 Git 提交信息与构建时间，用于线上版本追溯与回滚确认。

## 安装

```bash
npm i -D vite-plugin-build-meta-info
```

## 使用

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { buildVersionPlugin } from 'vite-plugin-build-meta-info'

export default defineConfig({
  plugins: [buildVersionPlugin({ application: 'my-app' })],
})
```

构建后产物目录会多出 `version.json`：

```json
{
  "application": "my-app",
  "version": "1.0.0",
  "git": {
    "commit": "0123456789abcdef0123456789abcdef01234567",
    "shortCommit": "01234567",
    "branch": "main",
    "tag": "v1.0.0",
    "dirty": false,
    "commitTime": "2026-01-01T08:00:00+08:00"
  },
  "buildTime": "2026-01-01T09:00:00.000Z"
}
```

线上确认版本：

```bash
curl https://example.com/version.json
```

## 选项

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `application` | `string` | `package.json` 的 `name` | 应用标识 |
| `version` | `string` | `package.json` 的 `version` | 应用版本号 |
| `fileName` | `string` | `version.json` | 产物文件名，可带子目录 |
| `cwd` | `string` | `process.cwd()` | 采集 Git 信息的工作目录 |
| `git` | `boolean` | `true` | 是否采集 Git 信息 |
| `define` | `boolean` | `false` | 是否通过 `define` 注入全局常量 |
| `defineName` | `string` | `__APP_VERSION__` | 注入的全局常量名 |
| `extra` | `Record<string, unknown>` | - | 附加到 `version.json` 的自定义字段 |

## 运行时读取版本

开启 `define` 后可直接在代码中使用：

```ts
const info = __APP_VERSION__
console.log(info.git.shortCommit)
```

需自行声明类型：

```ts
declare const __APP_VERSION__: import('vite-plugin-build-meta-info').BuildVersionInfo
```

## 容错行为

- 任何 Git 命令失败都不会中断构建，缺失字段退化为空字符串 / `false`。
- 非 Git 环境（如 CI 容器内无 `.git`）会尝试读取 `GIT_COMMIT`、`CI_COMMIT_SHA`、`COMMIT_SHA`、`GIT_BRANCH`、`CI_COMMIT_REF_NAME`、`BRANCH_NAME` 环境变量。
- 插件仅在 `vite build` 时生效（`apply: 'build'`），不影响 dev server。

## License

MIT
