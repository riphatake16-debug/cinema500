/**
 * شاخهٔ ساکورا برای پس‌زمینهٔ هیرو — دو نسخه برای تم روشن و تاریک.
 * اجرا: node tools/make-sakura.mjs
 */
import { writeFile } from 'node:fs/promises';

const petal = (cx, cy, angle, rx, ry, fill, opacity) =>
  `<ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${rx}" ry="${ry}" fill="${fill}" opacity="${opacity}" transform="rotate(${angle} ${cx.toFixed(1)} ${cy.toFixed(1)})"/>`;

function blossom(x, y, scale, { petalFill, petalEdge, coreFill }) {
  const parts = [];
  const r = 11 * scale;
  for (let i = 0; i < 5; i += 1) {
    parts.push(petal(x + Math.cos((i * 72 - 90) * Math.PI / 180) * r, y + Math.sin((i * 72 - 90) * Math.PI / 180) * r, i * 72 - 90, 7 * scale, 11.5 * scale, petalFill, 0.92));
  }
  for (let i = 0; i < 5; i += 1) {
    const a = (i * 72 - 90) * Math.PI / 180;
    parts.push(petal(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, i * 72 - 90, 4.6 * scale, 7.6 * scale, petalEdge, 0.55));
  }
  parts.push(`<circle cx="${x}" cy="${y}" r="${4.2 * scale}" fill="${coreFill}"/>`);
  for (let i = 0; i < 6; i += 1) {
    const a = i * 60 * Math.PI / 180;
    parts.push(`<circle cx="${(x + Math.cos(a) * 7.4 * scale).toFixed(1)}" cy="${(y + Math.sin(a) * 7.4 * scale).toFixed(1)}" r="${1.5 * scale}" fill="${coreFill}" opacity=".8"/>`);
  }
  return parts.join('');
}

function build({ stroke, petalFill, petalEdge, coreFill, leaf }) {
  const flowers = [
    [92, 96, 1.45], [186, 58, 1.1], [268, 112, 1.3], [352, 46, 0.95],
    [430, 96, 1.2], [512, 58, 1.0], [120, 196, 0.8], [300, 214, 0.7], [468, 188, 0.72]
  ];
  const leaves = [[212, 150, -20], [386, 150, 18], [60, 150, 24]];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 260" width="600" height="260" fill="none">
<g stroke="${stroke}" stroke-width="2.2" stroke-linecap="round" opacity=".75">
<path d="M-8 44C60 26 120 58 178 70c58 12 118 4 172-16 54-20 112-12 162 8"/>
<path d="M92 96c-6 26 4 52 22 74M268 112c10 26 18 52 14 82M430 96c-4 24 6 46 20 66"/>
<path d="M186 58c-10 22-8 44 2 62M352 46c-6 20 0 38 10 52M512 58c4 18 2 34-4 48"/>
<path d="M120 196c-18 4-34 16-44 34M468 188c16 8 28 22 34 40"/>
</g>
${leaves.map(([x, y, a]) => `<path d="M${x} ${y}c14-18 34-22 46-14-8 16-28 26-46 14Z" fill="${leaf}" opacity=".45" transform="rotate(${a} ${x} ${y})"/>`).join('')}
${flowers.map(([x, y, s]) => blossom(x, y, s, { petalFill, petalEdge, coreFill })).join('')}
</svg>
`;
}

const light = build({ stroke: '#b06c85', petalFill: '#ffb3cc', petalEdge: '#f58bab', coreFill: '#e2688f', leaf: '#8fb08a' });
const dark = build({ stroke: '#8c5a6c', petalFill: '#ffc2d6', petalEdge: '#ff9bbd', coreFill: '#ff86ae', leaf: '#5f7a5c' });

await writeFile(new URL('../anime-site/sakura-light.svg', import.meta.url), light);
await writeFile(new URL('../anime-site/sakura-dark.svg', import.meta.url), dark);
console.log('✓ sakura-light.svg + sakura-dark.svg');
