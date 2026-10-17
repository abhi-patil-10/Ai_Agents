/**
 * codebase-galaxy.test.js
 * Unit tests for Codebase Galaxy data modeling, layout, and filtering logic.
 * Run with: node --test frontend/tests/codebase-galaxy.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  createGalaxyNode,
  createGalaxyEdge,
  buildGalaxyGraphFromData,
  filterGalaxyGraph,
  getNodeColor,
  EXTENSION_COLORS,
} = require('../assets/js/codebase-galaxy.js');

test('Codebase Galaxy: createGalaxyNode creates file and directory nodes correctly', () => {
  const fileNode = createGalaxyNode('app/routes.py', 'app/routes.py', 'file', {
    changeCount: 8,
    githubUrl: 'https://github.com/foo/bar/blob/main/app/routes.py',
  });

  assert.equal(fileNode.id, 'app/routes.py');
  assert.equal(fileNode.name, 'routes.py');
  assert.equal(fileNode.extension, 'py');
  assert.equal(fileNode.type, 'file');
  assert.equal(fileNode.changeCount, 8);
  assert.equal(fileNode.githubUrl, 'https://github.com/foo/bar/blob/main/app/routes.py');
  assert.equal(fileNode.color, EXTENSION_COLORS.py);
  assert.ok(fileNode.radius > 7);

  const dirNode = createGalaxyNode('app/services', 'app/services', 'directory');
  assert.equal(dirNode.id, 'app/services');
  assert.equal(dirNode.name, 'services');
  assert.equal(dirNode.extension, '');
  assert.equal(dirNode.type, 'directory');
  assert.equal(dirNode.radius, 14);
  assert.equal(dirNode.color, EXTENSION_COLORS.directory);
});

test('Codebase Galaxy: createGalaxyEdge builds structured relationships with evidence', () => {
  const edge1 = createGalaxyEdge('app', 'app/routes.py', 'directory-containment', 1);
  assert.equal(edge1.source, 'app');
  assert.equal(edge1.target, 'app/routes.py');
  assert.equal(edge1.type, 'directory-containment');
  assert.ok(edge1.evidence.includes('contains'));

  const edge2 = createGalaxyEdge('app/a.py', 'app/b.py', 'co-change', 2, 'Modified together in 5 commits');
  assert.equal(edge2.type, 'co-change');
  assert.equal(edge2.weight, 2);
  assert.equal(edge2.evidence, 'Modified together in 5 commits');
});

test('Codebase Galaxy: buildGalaxyGraphFromData builds hierarchy, containment edges, and co-changes', () => {
  const hotFiles = [
    { filename: 'backend/app/routes.py', changes: 12 },
    { filename: 'backend/app/models.py', changes: 8 },
    { filename: 'frontend/index.html', changes: 3 },
  ];
  const commits = [
    { sha: 'c1', message: 'Update backend' },
  ];

  const graph = buildGalaxyGraphFromData(hotFiles, commits, {
    owner: 'testowner',
    repo: 'testrepo',
  });

  assert.ok(Array.isArray(graph.nodes));
  assert.ok(Array.isArray(graph.edges));

  const nodeIds = graph.nodes.map(n => n.id);
  // Root node
  assert.ok(nodeIds.includes('/'));
  // Intermediate directories
  assert.ok(nodeIds.includes('backend'));
  assert.ok(nodeIds.includes('backend/app'));
  assert.ok(nodeIds.includes('frontend'));
  // Files
  assert.ok(nodeIds.includes('backend/app/routes.py'));
  assert.ok(nodeIds.includes('backend/app/models.py'));
  assert.ok(nodeIds.includes('frontend/index.html'));

  // Directory containment edges
  const containment = graph.edges.filter(e => e.type === 'directory-containment');
  assert.ok(containment.some(e => e.source === '/' && e.target === 'backend'));
  assert.ok(containment.some(e => e.source === 'backend' && e.target === 'backend/app'));
  assert.ok(containment.some(e => e.source === 'backend/app' && e.target === 'backend/app/routes.py'));

  // Co-change edges (routes.py and models.py share backend/app and both have changeCount > 0)
  const coChanges = graph.edges.filter(e => e.type === 'co-change');
  assert.ok(coChanges.some(e => (e.source === 'backend/app/routes.py' && e.target === 'backend/app/models.py') ||
                                (e.source === 'backend/app/models.py' && e.target === 'backend/app/routes.py')));
});

test('Codebase Galaxy: buildGalaxyGraphFromData handles empty or missing files gracefully', () => {
  const emptyGraph = buildGalaxyGraphFromData([], []);
  assert.equal(emptyGraph.nodes.length, 1);
  assert.equal(emptyGraph.nodes[0].id, '/');
  assert.equal(emptyGraph.edges.length, 0);
  assert.equal(emptyGraph.isTruncated, false);

  const nullGraph = buildGalaxyGraphFromData(null, null);
  assert.equal(nullGraph.nodes.length, 1);
  assert.equal(nullGraph.isTruncated, false);
});

test('Codebase Galaxy: buildGalaxyGraphFromData enforces max file limit and sets isTruncated flag', () => {
  const manyFiles = [];
  for (let i = 0; i < 200; i++) {
    manyFiles.push({ filename: `src/file_${i}.js`, changes: 1 });
  }

  const graph = buildGalaxyGraphFromData(manyFiles, [], { maxFiles: 50 });
  assert.equal(graph.isTruncated, true);
  // Files capped to 50 + root + directory nodes
  const fileNodes = graph.nodes.filter(n => n.type === 'file');
  assert.equal(fileNodes.length, 50);
});

test('Codebase Galaxy: filterGalaxyGraph filters accurately by search text and file extension', () => {
  const nodes = [
    createGalaxyNode('src/main.js', 'src/main.js', 'file'),
    createGalaxyNode('src/utils.js', 'src/utils.js', 'file'),
    createGalaxyNode('docs/index.html', 'docs/index.html', 'file'),
    createGalaxyNode('src', 'src', 'directory'),
  ];
  const graph = { nodes, edges: [] };

  // Search by text
  const matchMain = filterGalaxyGraph(graph, 'main', 'all');
  assert.equal(matchMain.visibleCount, 1);
  assert.ok(matchMain.matchingNodeIds.has('src/main.js'));

  // Filter by extension
  const matchJs = filterGalaxyGraph(graph, '', 'js');
  assert.ok(matchJs.matchingNodeIds.has('src/main.js'));
  assert.ok(matchJs.matchingNodeIds.has('src/utils.js'));
  assert.ok(matchJs.matchingNodeIds.has('src')); // directories stay accessible
  assert.equal(matchJs.matchingNodeIds.has('docs/index.html'), false);

  // Both query and extension
  const matchUtilsJs = filterGalaxyGraph(graph, 'utils', 'js');
  assert.equal(matchUtilsJs.visibleCount, 1);
  assert.ok(matchUtilsJs.matchingNodeIds.has('src/utils.js'));
});

test('Codebase Galaxy: getNodeColor returns appropriate colors for type and activity modes', () => {
  // Directory color
  assert.equal(getNodeColor('', 'directory'), EXTENSION_COLORS.directory);

  // Known extensions
  assert.equal(getNodeColor('js', 'file'), EXTENSION_COLORS.js);
  assert.equal(getNodeColor('py', 'file'), EXTENSION_COLORS.py);
  assert.equal(getNodeColor('html', 'file'), EXTENSION_COLORS.html);
  assert.equal(getNodeColor('unknownext', 'file'), EXTENSION_COLORS.default);

  // Activity color mode
  assert.equal(getNodeColor('py', 'file', 15, 'activity'), '#f43f5e'); // Burning red (10+)
  assert.equal(getNodeColor('py', 'file', 7, 'activity'), '#fb923c');  // Orange (5-9)
  assert.equal(getNodeColor('py', 'file', 3, 'activity'), '#38bdf8');  // Cyan (2-4)
  assert.equal(getNodeColor('py', 'file', 1, 'activity'), '#818cf8');  // Indigo (1)
});
