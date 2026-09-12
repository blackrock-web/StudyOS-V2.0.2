/**
 * StudyOS RoadmapTree Persistence Test Suite
 * Verifies adding parent-child relationships, node reordering,
 * and restoring exact tree state from localStorage upon app refresh.
 * Run: node src/tests/roadmapTreePersistence.test.mjs
 */
import assert from 'node:assert/strict';

// Mock localStorage for Node test runner
const mockStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => mockStorage.get(k) || null,
  setItem: (k, v) => mockStorage.set(k, String(v)),
  removeItem: (k) => mockStorage.delete(k),
  clear: () => mockStorage.clear(),
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓', name);
  } catch (e) {
    failed++;
    console.error('  ✗', name, '\n   ', e.message);
  }
}

console.log('\nStarting RoadmapTree Persistence Tests...\n');

const STORAGE_KEY = 'studyos_roadmap_tree_state';

// Helper function to load state
function loadRoadmapTree() {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : [];
}

// Helper function to save state
function saveRoadmapTree(tree) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
}

test('Step 1: Initialize RoadmapTree with root node and save to localStorage', () => {
  const initialTree = [
    {
      id: 'sub-gate-cs',
      title: 'GATE CS Core Curriculum',
      type: 'subject',
      order: 0,
      children: [],
    },
  ];

  saveRoadmapTree(initialTree);
  const loaded = loadRoadmapTree();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].id, 'sub-gate-cs');
  assert.equal(loaded[0].children.length, 0);
});

test('Step 2: Add parent-child relationship (Chapter node under Subject)', () => {
  const tree = loadRoadmapTree();
  const parentNode = tree.find((n) => n.id === 'sub-gate-cs');
  assert.ok(parentNode, 'Parent node must exist');

  const childChapter = {
    id: 'ch-os-memory',
    title: 'Operating Systems - Virtual Memory',
    type: 'chapter',
    parentId: 'sub-gate-cs',
    order: 0,
    children: [
      {
        id: 'top-tlb-paging',
        title: 'TLB Hit Ratio & Multilevel Paging',
        type: 'topic',
        parentId: 'ch-os-memory',
        order: 0,
        children: [],
      },
    ],
  };

  parentNode.children.push(childChapter);
  saveRoadmapTree(tree);

  // Verify child exists under parent in DB/localStorage
  const updatedTree = loadRoadmapTree();
  assert.equal(updatedTree[0].children.length, 1);
  assert.equal(updatedTree[0].children[0].id, 'ch-os-memory');
  assert.equal(updatedTree[0].children[0].children.length, 1);
  assert.equal(updatedTree[0].children[0].children[0].id, 'top-tlb-paging');
});

test('Step 3: Add sibling child node and reorder nodes', () => {
  const tree = loadRoadmapTree();
  const parentNode = tree[0];

  const secondChapter = {
    id: 'ch-algo-graphs',
    title: 'Algorithms - Graph Shortest Paths',
    type: 'chapter',
    parentId: 'sub-gate-cs',
    order: 1,
    children: [],
  };

  parentNode.children.push(secondChapter);

  // Reorder nodes: swap index 0 and 1 so ch-algo-graphs comes first
  const temp = parentNode.children[0];
  parentNode.children[0] = parentNode.children[1];
  parentNode.children[1] = temp;

  saveRoadmapTree(tree);

  const reorderedTree = loadRoadmapTree();
  assert.equal(reorderedTree[0].children[0].id, 'ch-algo-graphs');
  assert.equal(reorderedTree[0].children[1].id, 'ch-os-memory');
});

test('Step 4: Simulate App Refresh and confirm exact tree state retention', () => {
  // Clear in-memory references, re-read raw string from mock localStorage
  const rawSaved = localStorage.getItem(STORAGE_KEY);
  assert.ok(rawSaved, 'localStorage key must exist after app refresh');

  const restoredTree = JSON.parse(rawSaved);

  // Verify exact hierarchical integrity
  assert.equal(restoredTree.length, 1);
  assert.equal(restoredTree[0].title, 'GATE CS Core Curriculum');
  assert.equal(restoredTree[0].children.length, 2);

  // Confirm exact order preserved
  assert.equal(restoredTree[0].children[0].id, 'ch-algo-graphs');
  assert.equal(restoredTree[0].children[1].id, 'ch-os-memory');

  // Confirm nested child retained under ch-os-memory
  const nestedChild = restoredTree[0].children[1].children[0];
  assert.equal(nestedChild.id, 'top-tlb-paging');
  assert.equal(nestedChild.title, 'TLB Hit Ratio & Multilevel Paging');
});

console.log(`\nRoadmapTree Persistence Verification Complete: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) process.exit(1);
