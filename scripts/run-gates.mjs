// Import node:test modules in this process: no test worker subprocesses,
// network, browser, server, package installation, or runtime dependencies.
await import('../tests/core.test.mjs');
await import('../tests/storage.test.mjs');
await import('../tests/demo.test.mjs');
await import('../tests/evolution.test.mjs');
await import('../tests/prototype.test.mjs');
