// Loaded in <head> before the stylesheet paints, so a dark-theme user never sees a white flash.
// layout.js changes the choice; this file only applies it. Values: light | dark | system.
(() => {
  let choice = 'system';
  try {
    choice = localStorage.getItem('taskflow.theme') || 'system';
  } catch {
    // blocked storage: follow the system setting
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = choice === 'dark' || (choice === 'system' && prefersDark);
  document.documentElement.classList.toggle('dark', isDark);
})();
