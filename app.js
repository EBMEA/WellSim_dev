// Passenger entry point for cPanel "Setup Node.js App" (CloudLinux Node.js
// Selector). Not used by any other deployment: a VPS runs
// `node src/server/server.js` directly via wellsim.service, and the portable
// exe has its own entry in portable/main.js.
//
// WHY THIS FILE EXISTS AT ALL. cPanel asks for an "Application startup file"
// and expects it at the application root, while this project's server lives
// at src/server/server.js. Pointing the field straight at the nested path
// works on some cPanel builds and not others, so this wrapper is the stable
// answer.
//
// IT MUST STAY ESM. package.json sets "type": "module", so a `require()` here
// throws ReferenceError at boot. That failure is reported by Passenger as a
// generic 503 with nothing useful in the browser, and the real error only
// appears in the application's stderr log — a bad half hour if you do not
// know to look. Import, do not require.
//
// PORT AND HOST. server.js reads `process.env.PORT ?? 3355` and binds
// `process.env.HOST ?? '127.0.0.1'`. Passenger sets PORT and patches
// http.Server.listen to intercept the bind, so both defaults are correct
// here — loopback is what you want, because Passenger reaches the app over
// the local socket and nothing should be listening on a public interface of
// a shared machine.
//
// DO NOT set WELLSIM_ENABLE_LEGACY_CASE_STORE in the cPanel environment-
// variable panel. Its absence is one of the two independent halves of the
// account containment; the other is the code gate 27ea04e. See
// deploy/SHARED-HOSTING-wellssim.md.

import './src/server/server.js';
