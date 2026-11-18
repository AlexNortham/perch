/**
 * Client entry (index.html loads it). Owner: Technical Architect. Builds everything inside #app.
 */
import { startApp } from './app/app';
import { parseScene } from './app/router';

const root = document.getElementById('app');
if (!root) throw new Error('index.html is missing <div id="app">');
startApp(root, parseScene(window.location.search)).catch((err: unknown) => {
  root.textContent = `PERCH failed to start: ${err instanceof Error ? err.message : String(err)}`;
  throw err;
});
