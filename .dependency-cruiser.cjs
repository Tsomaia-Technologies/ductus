/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-apps-to-core-internals',
      comment:
        'Apps must import from the ductus package only, not packages/core/src internals',
      from: { path: '^apps/' },
      to: { path: '^packages/core/src/' },
      severity: 'error',
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
  },
}
