// No-op: #root is position:fixed so modal backdrops (also fixed, z-50)
// already block all background interaction without any overflow toggling.
// Toggling overflow-y was causing scrollTop to reset and the page to jump.
export function useBodyScrollLock() {}
