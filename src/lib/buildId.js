// Visible build identifier so we can tell, on the device, whether the running
// app is the latest deploy (removes the "did the new code even activate?"
// ambiguity that the service-worker update cycle creates). __BUILD_ID__ is
// injected by Vite at build time (see vite.config.js); falls back to 'dev'
// outside a Vite build (e.g. unit tests).
export const BUILD_ID =
  typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
