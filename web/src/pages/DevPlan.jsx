import React, { Suspense } from 'react';
import { hydrateConfig } from '../devplan/config.js';
import { apiClient } from '../api/client.js';

// Reproduce the standalone board's boot ordering: hydrate the config store from
// the server BEFORE the board's modules (derive.js et al.) are first imported, so
// every module that reads SYSTEMS / SPRINTS / etc. at import time sees hydrated
// values. This page must statically import ONLY config.js — never derive.js or
// DevPlanApp.jsx at top level — so hydration wins the race.
const Board = React.lazy(async () => {
  try { hydrateConfig(await apiClient.devplanConfig()); }
  catch { /* offline → bundled defaults */ }
  return import('../devplan/DevPlanApp.jsx'); // default export = the board root
});

export function DevPlanPage() {
  return (
    <div className="devplan-root">
      <Suspense fallback={<div className="page-sub">Loading board…</div>}>
        <Board />
      </Suspense>
    </div>
  );
}
