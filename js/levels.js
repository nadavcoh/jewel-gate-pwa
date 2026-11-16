/* Level table, from levels/levels.json of nadavcoh/jewel-gate-heatmap.
 * Level = green check marks in the progress bar + 1. Sizes are [rows, cols]; gems can always be rotated.
 * There are NO standard gem sizes: the same crystal has different sizes on different levels.
 * To add a level, add an entry here (and a line to tests/selftest.js if you know its blank-board result).
 * `color` = colour of the gem once found. Measured on real screenshots: octagon (255,0,111), diamond (0,255,4),
 * tall teal (0,255,210) on levels 1 and 3, tall violet (173,84,255) on level 2. Hidden gems are (214,0,255).
 * Found colours of hex and flat were never seen, the ones below are placeholders. */
(function (root) {
  'use strict';
  var HIDDEN = '#d600ff';
  var LEVELS = [
    { level: 1, rows: 4, cols: 4, gems: [
      { class: 'octagon', count: 1, size: [2, 2], color: '#ff006f' },
      { class: 'tall',    count: 2, size: [2, 1], color: '#00ffd2' },
      { class: 'diamond', count: 2, size: [1, 1], color: '#00ff04' } ] },
    { level: 2, rows: 5, cols: 5, gems: [
      { class: 'octagon', count: 1, size: [2, 2], color: '#ff006f' },
      { class: 'tall',    count: 2, size: [3, 1], color: '#ad54ff' },
      { class: 'flat',    count: 1, size: [2, 1], color: '#ffb300' },
      { class: 'diamond', count: 1, size: [1, 1], color: '#00ff04' } ] },
    { level: 3, rows: 6, cols: 6, gems: [
      { class: 'octagon', count: 1, size: [2, 2], color: '#ff006f' },
      { class: 'tall',    count: 2, size: [2, 1], color: '#00ffd2' },
      { class: 'flat',    count: 1, size: [1, 3], color: '#ffb300' },
      { class: 'diamond', count: 2, size: [1, 1], color: '#00ff04' } ] },
    { level: 4, rows: 7, cols: 7, gems: [
      { class: 'octagon', count: 1, size: [3, 3], color: '#ff006f' },
      { class: 'tall',    count: 2, size: [3, 1], color: '#00ffd2' },
      { class: 'flat',    count: 1, size: [2, 1], color: '#ffb300' },
      { class: 'diamond', count: 3, size: [1, 1], color: '#00ff04' } ] },
    { level: 5, rows: 8, cols: 8, gems: [
      { class: 'octagon', count: 1, size: [3, 3], color: '#ff006f' },
      { class: 'hex',     count: 2, size: [2, 3], color: '#3d9bff' },
      { class: 'flat',    count: 2, size: [2, 1], color: '#ffb300' },
      { class: 'diamond', count: 4, size: [1, 1], color: '#00ff04' } ] }
  ];
  var api = { LEVELS: LEVELS, HIDDEN: HIDDEN };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.JGLevels = api;
})(typeof self !== 'undefined' ? self : this);
