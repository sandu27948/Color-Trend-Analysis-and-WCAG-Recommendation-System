const test = require('node:test');
const assert = require('node:assert/strict');
const { kMeansCluster } = require('./server');

test('kMeansCluster groups colors into the requested number of clusters', () => {
  const colors = ['#FF0000', '#00FF00', '#0000FF', '#FF8800', '#00CCFF', '#8800FF'];
  const result = kMeansCluster(colors, 2);

  assert.equal(result.totalPoints, colors.length);
  assert.equal(result.clusters.length, 2);
  assert.ok(result.iterations >= 1);
  assert.ok(result.clusters.every((cluster) => cluster.members.length > 0));
});
