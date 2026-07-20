/**
 * Entry point. For now: a bare title card proving the pipeline runs.
 * Real bootstrapping (new game -> sim -> render) lands with the render layer.
 */
import { Application, Text } from 'pixi.js';

const app = new Application();
await app.init({ background: '#0a0a12', resizeTo: window });
document.body.appendChild(app.canvas);

const title = new Text({
  text: 'MASTER',
  style: { fill: '#e8d8a0', fontFamily: 'monospace', fontSize: 64, letterSpacing: 24 },
});
title.anchor.set(0.5);
title.position.set(app.screen.width / 2, app.screen.height / 2);
app.stage.addChild(title);
