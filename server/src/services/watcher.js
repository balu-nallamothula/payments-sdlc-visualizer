// Lazy filesystem watcher for live refresh.
// Starts chokidar only when at least one SSE client is subscribed (respecting the
// user's opt-in "auto, with permission" toggle) and stops when the last leaves.

import { EventEmitter } from 'node:events';
import path from 'node:path';
import chokidar from 'chokidar';
import { config, yearDir } from '../config.js';
import { clearCache } from './scanner.js';

class DocsWatcher extends EventEmitter {
  constructor() {
    super();
    this.watcher = null;
    this.subscribers = 0;
  }

  start() {
    if (this.watcher) return;
    // Watch metadata.json changes (state) across the year dir.
    this.watcher = chokidar.watch(yearDir, {
      ignoreInitial: true,
      depth: 6,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      ignored: (p) => p.includes(`${path.sep}.git${path.sep}`) || p.includes('node_modules'),
    });
    const onChange = (type) => (changedPath) => {
      if (!changedPath.endsWith('metadata.json') && !changedPath.endsWith('.md') && !changedPath.endsWith('.json')) {
        return;
      }
      clearCache(); // invalidate scanner cache so re-reads see fresh data
      this.emit('change', {
        type,
        path: path.relative(config.projectDocs, changedPath),
        at: new Date().toISOString(),
      });
    };
    this.watcher.on('add', onChange('add'));
    this.watcher.on('change', onChange('change'));
    this.watcher.on('unlink', onChange('unlink'));
  }

  stop() {
    if (this.watcher) {
      this.watcher.close().catch(() => {});
      this.watcher = null;
    }
  }

  subscribe(listener) {
    this.subscribers += 1;
    if (this.subscribers === 1) this.start();
    this.on('change', listener);
    return () => {
      this.off('change', listener);
      this.subscribers = Math.max(0, this.subscribers - 1);
      if (this.subscribers === 0) this.stop();
    };
  }
}

export const docsWatcher = new DocsWatcher();
