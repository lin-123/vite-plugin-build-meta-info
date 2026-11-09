import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Plugin } from 'vite'

export interface BuildVersionGitInfo {
  commit: string
  shortCommit: string
  branch: string
  tag: string
  dirty: boolean
  commitTime: string
}

export interface BuildVersionInfo {
  application: string
  version: string
  git: BuildVersionGitInfo
  buildTime: string
  [key: string]: unknown
}

export interface BuildVersionPluginOptions {
  /** 应用标识，写入 version.json 的 application 字段，默认取 package.json 的 name */
  application?: string
  /** 应用版本号，默认取 package.json 的 version */
  version?: string
  /** 产物文件名，默认 version.json */
  fileName?: string
  /** 采集 Git 信息的工作目录，默认 process.cwd() */
  cwd?: string
  /** 是否采集 Git 信息，默认 true */
  git?: boolean
  /** 是否通过 define 注入全局常量，默认 false */
  define?: boolean
  /** 注入的全局常量名，默认 __APP_VERSION__ */
  defineName?: string
  /** 附加到 version.json 的自定义字段 */
  extra?: Record<string, unknown>
}

interface ResolvedOptions {
  application: string
  version: string
  fileName: string
  cwd: string
  git: boolean
  define: boolean
  defineName: string
  extra?: Record<string, unknown>
}

const EMPTY_GIT: BuildVersionGitInfo = {
  commit: '',
  shortCommit: '',
  branch: '',
  tag: '',
  dirty: false,
  commitTime: '',
}

function git(cwd: string, args: string[]): string {
  try {
    return execFileSync('git', args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
  } catch {
    return ''
  }
}

function readPackageJson(cwd: string): Record<string, unknown> {
  try {
    return JSON.parse(readFileSync(resolve(cwd, 'package.json'), 'utf8'))
  } catch {
    return {}
  }
}

function env(name: string): string {
  return process.env[name]?.trim() ?? ''
}

function collectGitInfo(cwd: string): BuildVersionGitInfo {
  const root = git(cwd, ['rev-parse', '--show-toplevel'])
  if (!root) {
    // 非 git 环境（如 CI 容器内无 .git），退化为环境变量
    const commit = env('GIT_COMMIT') || env('CI_COMMIT_SHA') || env('COMMIT_SHA')
    return {
      ...EMPTY_GIT,
      commit,
      shortCommit: commit.slice(0, 8),
      branch: env('GIT_BRANCH') || env('CI_COMMIT_REF_NAME') || env('BRANCH_NAME'),
    }
  }

  return {
    commit: git(root, ['rev-parse', 'HEAD']),
    shortCommit: git(root, ['rev-parse', '--short=8', 'HEAD']),
    branch: git(root, ['branch', '--show-current']),
    tag: git(root, ['describe', '--tags', '--exact-match']),
    dirty: git(root, ['status', '--porcelain']).length > 0,
    commitTime: git(root, ['log', '-1', '--format=%cI']),
  }
}

function resolveOptions(options: BuildVersionPluginOptions = {}): ResolvedOptions {
  const cwd = options.cwd ?? process.cwd()
  const pkg = readPackageJson(cwd)

  return {
    application: options.application ?? (typeof pkg.name === 'string' ? pkg.name : 'unknown'),
    version: options.version ?? (typeof pkg.version === 'string' ? pkg.version : '0.0.0'),
    fileName: options.fileName ?? 'version.json',
    cwd,
    git: options.git ?? true,
    define: options.define ?? false,
    defineName: options.defineName ?? '__APP_VERSION__',
    extra: options.extra,
  }
}

function createVersionInfo(options: ResolvedOptions): BuildVersionInfo {
  return {
    application: options.application,
    version: options.version,
    git: options.git ? collectGitInfo(options.cwd) : { ...EMPTY_GIT },
    buildTime: new Date().toISOString(),
    ...options.extra,
  }
}

/**
 * 在 Vite 生产构建时输出 version.json，记录 Git 与构建元数据。
 * 任何 Git 命令失败都不会中断构建，缺失字段退化为空值。
 */
export function buildVersionPlugin(options: BuildVersionPluginOptions = {}): Plugin {
  const resolved = resolveOptions(options)
  const versionInfo = createVersionInfo(resolved)

  return {
    name: `build-version:${resolved.application}`,
    apply: 'build',
    config() {
      if (!resolved.define) return undefined
      return {
        define: {
          [resolved.defineName]: JSON.stringify(versionInfo),
        },
      }
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: resolved.fileName,
        source: `${JSON.stringify(versionInfo, null, 2)}\n`,
      })
    },
  }
}

export default buildVersionPlugin
