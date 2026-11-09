import assert from 'node:assert/strict'
import test from 'node:test'
import { buildVersionPlugin } from '../dist/index.js'

function emit(plugin) {
  const files = []
  plugin.generateBundle.call({ emitFile: (file) => files.push(file) })
  return files
}

test('emits version.json with application and git metadata', () => {
  const plugin = buildVersionPlugin({ application: 'my-app', version: '1.2.3' })
  const files = emit(plugin)

  assert.equal(plugin.name, 'build-version:my-app')
  assert.equal(plugin.apply, 'build')
  assert.equal(files.length, 1)
  assert.equal(files[0].fileName, 'version.json')

  const version = JSON.parse(files[0].source)
  assert.equal(version.application, 'my-app')
  assert.equal(version.version, '1.2.3')
  assert.equal(typeof version.git.dirty, 'boolean')
  assert.match(version.buildTime, /^\d{4}-\d{2}-\d{2}T/)
})

test('reads application and version from package.json by default', () => {
  const plugin = buildVersionPlugin({ cwd: process.cwd() })
  const version = JSON.parse(emit(plugin)[0].source)

  assert.equal(version.application, 'vite-plugin-build-meta-info')
  assert.equal(version.version, '1.0.0')
})

test('supports custom fileName and extra fields', () => {
  const plugin = buildVersionPlugin({
    application: 'app',
    fileName: 'meta/build-info.json',
    extra: { env: 'prod' },
  })
  const files = emit(plugin)

  assert.equal(files[0].fileName, 'meta/build-info.json')
  assert.equal(JSON.parse(files[0].source).env, 'prod')
})

test('degrades gracefully outside a git repository', () => {
  const plugin = buildVersionPlugin({ application: 'app', cwd: '/tmp' })
  const version = JSON.parse(emit(plugin)[0].source)

  assert.equal(version.git.commit, '')
  assert.equal(version.git.dirty, false)
  assert.equal(version.git.commitTime, '')
})

test('can disable git collection', () => {
  const plugin = buildVersionPlugin({ application: 'app', git: false })
  const version = JSON.parse(emit(plugin)[0].source)

  assert.deepEqual(version.git, {
    commit: '',
    shortCommit: '',
    branch: '',
    tag: '',
    dirty: false,
    commitTime: '',
  })
})

test('injects define constant only when enabled', () => {
  assert.equal(buildVersionPlugin({ application: 'app' }).config(), undefined)

  const config = buildVersionPlugin({ application: 'app', define: true }).config()
  assert.deepEqual(Object.keys(config.define), ['__APP_VERSION__'])
  assert.equal(JSON.parse(config.define.__APP_VERSION__).application, 'app')
})
