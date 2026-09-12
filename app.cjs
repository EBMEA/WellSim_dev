// Passenger entry point for cPanel "Setup Node.js App" (CloudLinux Node.js
// Selector). Set the app's "Application startup file" to  app.cjs
//
// Not used by any other deployment: a VPS runs `node src/server/server.js`
// directly via wellsim.service, and the portable exe has its own entry in
// portable/main.js.
//
// WHY .cjs, AND WHY A DYNAMIC import().
// Passenger does not run the startup file with `node file`; it require()s it
// from its own CommonJS loader. Node 22.12+/24 can require() an ES module,
// BUT NOT one whose import graph contains a top-level await -- and this
// server's graph does (the database boundary is awaited at module load).
// require()ing it throws ERR_REQUIRE_ASYNC_MODULE before a single line of
// ours runs, and Passenger reports that as a bare 503 "Service Unavailable"
// with nothing useful in the browser. That is exactly what happened on
// 12 September 2026 with an ESM app.js in this slot.
//
// package.json sets "type": "module", so a plain app.js would itself be ESM.
// The .cjs extension forces this one file to CommonJS regardless, and inside
// it a dynamic import() is allowed to resolve an async graph -- Passenger
// waits for the app to call listen(), which server.js does once the import
// settles.
//
// PORT AND HOST. server.js reads `process.env.PORT ?? 3355` and binds
// `process.env.HOST ?? '127.0.0.1'`. Passenger sets PORT and patches
// http.Server.listen to intercept the bind, so both defaults are right:
// loopback is what you want on a machine you share with strangers.
//
// DO NOT set WELLSIM_ENABLE_LEGACY_CASE_STORE in the cPanel environment-
// variable panel. Its absence is one of the two independent halves of the
// account containment; the other is the code gate 27ea04e.
// See deploy/SHARED-HOSTING-wellssim.md.

import('./src/server/server.js').catch((err) => {
  // Surface the real reason in the app's stderr log instead of a silent 503.
  console.error('[app.cjs] failed to start WellSim server:', err);
  process.exit(1);
});
