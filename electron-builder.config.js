/**
 * @type {import('electron-builder').Configuration}
 */
module.exports = {
  appId: 'com.kanban-agent.app',
  productName: 'Kanban Agent',
  directories: {
    buildResources: 'build',
    output: 'release'
  },
  files: [
    'out/**/*',
    'node_modules/**/*',
    '!node_modules/**/README*',
    '!node_modules/**/CHANGELOG*',
    '!node_modules/**/test/**',
    '!node_modules/**/tests/**',
    '!node_modules/**/*.md'
  ],
  extraResources: [
    {
      from: 'dist/cli/',
      to: 'bin/',
      filter: ['**/*']
    }
  ],
  mac: {
    icon: 'build/icon.icns',
    category: 'public.app-category.developer-tools',
    target: [
      {
        target: 'dmg',
        arch: ['arm64']
      }
    ],
    darkModeSupport: true,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: 'build/entitlements.mac.plist',
    entitlementsInherit: 'build/entitlements.mac.plist'
  },
  dmg: {
    contents: [
      {
        x: 130,
        y: 220
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications'
      }
    ],
    window: {
      width: 540,
      height: 380
    }
  },
  afterPack: './scripts/after-pack.js'
}
