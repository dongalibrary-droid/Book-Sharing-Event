const fs = require('node:fs');
const path = require('node:path');

const publicDir = path.resolve(__dirname, '../public');
const source = fs.readFileSync(path.join(publicDir, 'awards-coming-soon.html'), 'utf8');
function section(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  if (from < 0 || to < 0) throw new Error('Missing sample section: ' + start);
  return source.slice(from + start.length, to);
}
const css = section('<style>', '</style>');
const markup = '<aside' + section('<aside', '</aside>') + '</aside>';
const script = section('<script>', '</script>')
  .split('\n').filter(line => !line.includes("document.getElementById('replay')")).join('\n')
  .replaceAll('document.getElementById', 'shadow.getElementById');

// Bundle the approved sample inside a shadow root to avoid host-page CSS collisions.
const bundle = `(function () {
  'use strict';
  if (document.getElementById('donga-awards-coming-soon')) return;
  const base = new URL('.', document.currentScript.src);
  const asset = name => new URL(name, base).href;
  const host = document.createElement('div');
  host.id = 'donga-awards-coming-soon';
  host.style.cssText = 'position:relative;z-index:99998;';
  const shadow = host.attachShadow({mode:'open'});
  const style = document.createElement('style');
  style.textContent = ':host { font-family: "Malgun Gothic", system-ui, sans-serif; letter-spacing:0; }' + ${JSON.stringify(css)}
    .replaceAll('trophy-video-last-frame.png', asset('trophy-video-last-frame.png'));
  shadow.append(style);
  const template = document.createElement('template');
  template.innerHTML = ${JSON.stringify(markup)};
  shadow.append(template.content.cloneNode(true));
  shadow.querySelector('img').src = asset('trophy-video-last-frame.png');
  document.body.append(host);
  ${script.replace("video.src = 'intro-transparent.webm';", "video.src = asset('intro-transparent.webm');")}
}());
`;
fs.writeFileSync(path.join(publicDir, 'awards-coming-soon.js'), bundle);
