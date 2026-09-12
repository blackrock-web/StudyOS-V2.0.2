import React, { useState, useEffect, useRef } from 'react';
import {
  FolderTree,
  ChevronRight,
  ChevronDown,
  Plus,
  Trash2,
  GripVertical,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  Edit3,
  Check,
  X,
  Target,
  Layers,
  CornerDownRight,
  RotateCcw,
} from 'lucide-react';
import { TaskItem } from '../../types';
import { GlassCard } from '../shared/GlassCard';
import { db } from '../../services/db';

export interface RoadmapNode {
  id: string;
  title: string;
  type: 'subject' | 'chapter' | 'topic' | 'task';
  parentId?: string | null;
  children: RoadmapNode[];
  order: number;
  completed?: boolean;
  status?: 'Pending' | 'In Progress' | 'Completed';
  targetDate?: string;
  assignedTaskId?: string;
}

function getRoadmapStorageKey(): string {
  return `studyos_roadmap_tree_state_${db.getActiveExamId()}`;
}

export const INITIAL_ROADMAP_TREE: RoadmapNode[] = [
  {
    id: 'tree-sub-algo',
    title: 'Algorithms & Data Structures',
    type: 'subject',
    order: 0,
    status: 'In Progress',
    children: [
      {
        id: 'tree-ch-dp',
        title: 'Dynamic Programming & Recurrences',
        type: 'chapter',
        parentId: 'tree-sub-algo',
        order: 0,
        status: 'In Progress',
        children: [
          {
            id: 'tree-top-memo',
            title: 'Memoization vs Tabulation Paradigms',
            type: 'topic',
            parentId: 'tree-ch-dp',
            order: 0,
            completed: true,
            status: 'Completed',
            children: [],
          },
          {
            id: 'tree-top-mcm',
            title: 'Matrix Chain Multiplication & Optimal BST',
            type: 'topic',
            parentId: 'tree-ch-dp',
            order: 1,
            completed: false,
            status: 'In Progress',
            children: [],
          },
        ],
      },
      {
        id: 'tree-ch-graphs',
        title: 'Graph Algorithms & Shortest Paths',
        type: 'chapter',
        parentId: 'tree-sub-algo',
        order: 1,
        status: 'Pending',
        children: [
          {
            id: 'tree-top-dijkstra',
            title: 'Dijkstra, Bellman-Ford & Floyd-Warshall',
            type: 'topic',
            parentId: 'tree-ch-graphs',
            order: 0,
            completed: false,
            status: 'Pending',
            children: [],
          },
        ],
      },
    ],
  },
  {
    id: 'tree-sub-os',
    title: 'Operating Systems & Concurrency',
    type: 'subject',
    order: 1,
    status: 'In Progress',
    children: [
      {
        id: 'tree-ch-mem',
        title: 'Virtual Memory & Paging',
        type: 'chapter',
        parentId: 'tree-sub-os',
        order: 0,
        status: 'In Progress',
        children: [
          {
            id: 'tree-top-tlb',
            title: 'TLB Hit Ratio & Page Table Walker',
            type: 'topic',
            parentId: 'tree-ch-mem',
            order: 0,
            completed: true,
            status: 'Completed',
            children: [],
          },
        ],
      },
    ],
  },
];

export function loadRoadmapTreeState(): RoadmapNode[] {
  const activeExamId = db.getActiveExamId();
  const key = getRoadmapStorageKey();
  try {
    let saved = localStorage.getItem(key);
    if (!saved && activeExamId === 'GATE2027') {
      saved = localStorage.getItem('studyos_roadmap_tree_state');
      if (saved) {
        localStorage.setItem(key, saved);
      }
    }
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('Failed to restore roadmap tree state', e);
  }
  return activeExamId === 'GATE2027' ? INITIAL_ROADMAP_TREE : [];
}

export function saveRoadmapTreeState(tree: RoadmapNode[]): void {
  const key = getRoadmapStorageKey();
  try {
    localStorage.setItem(key, JSON.stringify(tree));
  } catch (e) {
    console.error('Failed to save roadmap tree state', e);
  }
}

interface RoadmapTreeProps {
  tasks?: TaskItem[];
  onShowNotification?: (msg: string, title?: string) => void;
  draggedTaskId?: string | null;
  setDraggedTaskId?: (id: string | null) => void;
}

export const RoadmapTree: React.FC<RoadmapTreeProps> = ({
  tasks = [],
  onShowNotification,
  draggedTaskId: externalDraggedTaskId,
  setDraggedTaskId: externalSetDraggedTaskId,
}) => {
  const [treeState, setTreeState] = useState<RoadmapNode[]>(loadRoadmapTreeState);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set(['tree-sub-algo', 'tree-ch-dp', 'tree-sub-os', 'tree-ch-mem'])
  );

  // Reload tree state when active exam changes
  useEffect(() => {
    const handleExamChange = () => {
      setTreeState(loadRoadmapTreeState());
    };

    window.addEventListener('studyos_active_exam_changed', handleExamChange);
    window.addEventListener('studyos_db_updated', handleExamChange);
    window.addEventListener('storage', handleExamChange);

    return () => {
      window.removeEventListener('studyos_active_exam_changed', handleExamChange);
      window.removeEventListener('studyos_db_updated', handleExamChange);
      window.removeEventListener('storage', handleExamChange);
    };
  }, []);

  // Local drag-and-drop state
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'inside' | 'above' | 'below' | null>(null);

  // Editing / adding state
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [addChildParentId, setAddChildParentId] = useState<string | null>(null);
  const [newChildTitle, setNewChildTitle] = useState('');
  const [newChildType, setNewChildType] = useState<'subject' | 'chapter' | 'topic' | 'task'>('topic');

  // Save to localStorage whenever treeState updates
  useEffect(() => {
    saveRoadmapTreeState(treeState);
  }, [treeState]);

  const toggleExpand = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleResetTree = () => {
    setTreeState(INITIAL_ROADMAP_TREE);
    saveRoadmapTreeState(INITIAL_ROADMAP_TREE);
    onShowNotification?.('Roadmap tree reset to standard GATE syllabus layout', 'Roadmap Tree');
  };

  // --- Helper to recursively mutate tree ---
  const addChildToNode = (
    nodes: RoadmapNode[],
    parentId: string,
    newNode: RoadmapNode
  ): RoadmapNode[] => {
    return nodes.map((node) => {
      if (node.id === parentId) {
        return {
          ...node,
          children: [...(node.children || []), newNode],
        };
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: addChildToNode(node.children, parentId, newNode),
        };
      }
      return node;
    });
  };

  const deleteNodeFromTree = (nodes: RoadmapNode[], id: string): RoadmapNode[] => {
    return nodes
      .filter((n) => n.id !== id)
      .map((node) => ({
        ...node,
        children: node.children ? deleteNodeFromTree(node.children, id) : [],
      }));
  };

  const updateNodeInTree = (
    nodes: RoadmapNode[],
    id: string,
    updater: (n: RoadmapNode) => RoadmapNode
  ): RoadmapNode[] => {
    return nodes.map((node) => {
      if (node.id === id) {
        return updater(node);
      }
      if (node.children && node.children.length > 0) {
        return {
          ...node,
          children: updateNodeInTree(node.children, id, updater),
        };
      }
      return node;
    });
  };

  // Add Child Handler
  const handleAddChild = (parentId: string | null) => {
    if (!newChildTitle.trim()) return;
    const childNode: RoadmapNode = {
      id: 'node-' + Date.now(),
      title: newChildTitle.trim(),
      type: newChildType,
      parentId: parentId || undefined,
      children: [],
      order: Date.now(),
      status: 'Pending',
      completed: false,
    };

    if (!parentId) {
      setTreeState((prev) => [...prev, childNode]);
    } else {
      setTreeState((prev) => addChildToNode(prev, parentId, childNode));
      setExpandedNodes((prev) => new Set(prev).add(parentId));
    }

    setAddChildParentId(null);
    setNewChildTitle('');
    onShowNotification?.(`Added ${newChildType} node: "${childNode.title}"`, 'Roadmap Tree');
  };

  // Toggle Completion Handler
  const handleToggleCompletion = (nodeId: string) => {
    setTreeState((prev) =>
      updateNodeInTree(prev, nodeId, (n) => {
        const nextComp = !n.completed;
        return {
          ...n,
          completed: nextComp,
          status: nextComp ? 'Completed' : 'In Progress',
        };
      })
    );
  };

  // Delete Node Handler
  const handleDeleteNode = (nodeId: string, title: string) => {
    setTreeState((prev) => deleteNodeFromTree(prev, nodeId));
    onShowNotification?.(`Deleted node "${title}" from tree`, 'Roadmap Tree');
  };

  // Save Edit Handler
  const handleSaveEdit = (nodeId: string) => {
    if (!editingTitle.trim()) return;
    setTreeState((prev) =>
      updateNodeInTree(prev, nodeId, (n) => ({ ...n, title: editingTitle.trim() }))
    );
    setEditingNodeId(null);
    setEditingTitle('');
  };

  // --- Drag and Drop Handlers for Tree Nodes and Tasks ---
  const handleNodeDragStart = (e: React.DragEvent, id: string) => {
    setDraggedNodeId(id);
    e.dataTransfer.setData('text/roadmap-node-id', id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleNodeDragOver = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const currentDraggingTask = externalDraggedTaskId;
    if (!draggedNodeId && !currentDraggingTask) return;

    setDropTargetId(targetNodeId);

    // Determine drop position: inside (center), above (top 30%), below (bottom 30%)
    const bounds = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - bounds.top;
    const ratio = offsetY / bounds.height;

    if (ratio < 0.3) {
      setDropPosition('above');
    } else if (ratio > 0.7) {
      setDropPosition('below');
    } else {
      setDropPosition('inside');
    }
  };

  const handleNodeDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleNodeDrop = (e: React.DragEvent, targetNodeId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const activeTaskDragId = externalDraggedTaskId || e.dataTransfer.getData('text/plain');

    // Case 1: Dragging a task into the tree node
    if (activeTaskDragId && !draggedNodeId) {
      const task = tasks.find((t) => t.id === activeTaskDragId);
      if (task) {
        const newTaskNode: RoadmapNode = {
          id: `node-task-${Date.now()}`,
          title: task.title,
          type: 'task',
          parentId: targetNodeId,
          children: [],
          order: Date.now(),
          completed: task.completed,
          status: task.completed ? 'Completed' : 'Pending',
          assignedTaskId: task.id,
        };
        setTreeState((prev) => addChildToNode(prev, targetNodeId, newTaskNode));
        setExpandedNodes((prev) => new Set(prev).add(targetNodeId));
        onShowNotification?.(`Assigned task "${task.title}" into Roadmap Tree`, 'Roadmap Tree');
      }
      if (externalSetDraggedTaskId) externalSetDraggedTaskId(null);
    }

    // Case 2: Reordering nodes inside tree
    if (draggedNodeId && draggedNodeId !== targetNodeId) {
      // Perform node reparenting or reordering
      setTreeState((prev) => {
        let draggedNode: RoadmapNode | null = null;
        // Extract dragged node
        const extractNode = (nodes: RoadmapNode[]): RoadmapNode[] => {
          return nodes.reduce<RoadmapNode[]>((acc, node) => {
            if (node.id === draggedNodeId) {
              draggedNode = node;
              return acc;
            }
            return [
              ...acc,
              { ...node, children: node.children ? extractNode(node.children) : [] },
            ];
          }, []);
        };

        const cleanedTree = extractNode(prev);
        if (!draggedNode) return prev;

        const validNode: RoadmapNode = draggedNode;
        const nodeToInsert: RoadmapNode = {
          ...validNode,
          parentId: targetNodeId,
        };

        if (dropPosition === 'inside') {
          return addChildToNode(cleanedTree, targetNodeId, nodeToInsert);
        } else {
          // Add as child to root or parent of target
          return cleanedTree.map((node) => {
            if (node.id === targetNodeId) {
              return {
                ...node,
                children: [...(node.children || []), { ...draggedNode!, parentId: node.id }],
              };
            }
            return node;
          });
        }
      });

      onShowNotification?.('Reordered node hierarchy in Roadmap Tree', 'Roadmap Tree');
    }

    setDraggedNodeId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDragEnd = () => {
    setDraggedNodeId(null);
    setDropTargetId(null);
    setDropPosition(null);
  };

  // Render node recursively
  const renderNode = (node: RoadmapNode, depth = 0) => {
    const isExpanded = expandedNodes.has(node.id);
    const isBeingDragged = draggedNodeId === node.id;
    const isDropTarget = dropTargetId === node.id;

    return (
      <div key={node.id} className="relative group">
        {/* Drop Indicator Line Above */}
        {isDropTarget && dropPosition === 'above' && (
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full my-1 animate-pulse shadow-md flex items-center justify-between px-2">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            <span className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
        )}

        <div
          draggable
          onDragStart={(e) => handleNodeDragStart(e, node.id)}
          onDragOver={(e) => handleNodeDragOver(e, node.id)}
          onDragLeave={handleNodeDragLeave}
          onDrop={(e) => handleNodeDrop(e, node.id)}
          onDragEnd={handleDragEnd}
          className={`flex items-center justify-between p-2.5 rounded-xl border transition-all duration-200 select-none ${
            isBeingDragged
              ? 'opacity-40 scale-[0.98] border-dashed border-purple-400 bg-purple-50/50'
              : isDropTarget && dropPosition === 'inside'
              ? 'bg-purple-100/80 border-purple-400 ring-2 ring-purple-400 shadow-md scale-[1.01]'
              : 'bg-white border-slate-200/80 hover:border-purple-300 hover:shadow-xs'
          }`}
          style={{ marginLeft: `${depth * 18}px` }}
        >
          <div className="flex items-center space-x-2.5 min-w-0 flex-1">
            <GripVertical className="w-4 h-4 text-slate-300 hover:text-purple-600 cursor-grab shrink-0" />

            {/* Expand / Collapse icon if has children or expandable */}
            <button
              onClick={() => toggleExpand(node.id)}
              className="p-1 rounded-lg hover:bg-purple-100 text-slate-500 shrink-0"
            >
              {node.children && node.children.length > 0 ? (
                isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-purple-600" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                )
              ) : (
                <CornerDownRight className="w-3.5 h-3.5 text-slate-300" />
              )}
            </button>

            {/* Type badge icon */}
            <span
              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md shrink-0 border ${
                node.type === 'subject'
                  ? 'bg-purple-100 text-purple-800 border-purple-200'
                  : node.type === 'chapter'
                  ? 'bg-pink-100 text-pink-800 border-pink-200'
                  : node.type === 'topic'
                  ? 'bg-indigo-100 text-indigo-800 border-indigo-200'
                  : 'bg-emerald-100 text-emerald-800 border-emerald-200'
              }`}
            >
              {node.type}
            </span>

            {/* Title / Edit input */}
            {editingNodeId === node.id ? (
              <div className="flex items-center space-x-1 flex-1">
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  className="px-2 py-1 text-xs font-bold border border-purple-300 rounded-lg focus:outline-none flex-1 bg-purple-50/50"
                  autoFocus
                />
                <button
                  onClick={() => handleSaveEdit(node.id)}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-md"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => setEditingNodeId(null)}
                  className="p-1 text-rose-600 hover:bg-rose-50 rounded-md"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span
                onClick={() => handleToggleCompletion(node.id)}
                className={`text-xs font-bold cursor-pointer truncate ${
                  node.completed ? 'line-through text-slate-400' : 'text-slate-900'
                }`}
              >
                {node.title}
              </span>
            )}
          </div>

          {/* Right Action buttons */}
          <div className="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition-opacity">
            <button
              onClick={() => handleToggleCompletion(node.id)}
              className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title={node.completed ? 'Mark as pending' : 'Mark as completed'}
            >
              {node.completed ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              ) : (
                <Circle className="w-4 h-4 text-slate-300 hover:text-emerald-500" />
              )}
            </button>

            <button
              onClick={() => {
                setAddChildParentId(node.id);
                setNewChildTitle('');
              }}
              className="p-1.5 rounded-lg hover:bg-purple-100 text-purple-700 transition-colors"
              title="Add child node under this item"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => {
                setEditingNodeId(node.id);
                setEditingTitle(node.title);
              }}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-purple-600"
              title="Rename node"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => handleDeleteNode(node.id, node.title)}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-300 hover:text-rose-600"
              title="Delete node"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Drop Indicator Line Below */}
        {isDropTarget && dropPosition === 'below' && (
          <div className="h-1 bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full my-1 animate-pulse shadow-md flex items-center justify-between px-2">
            <span className="w-2 h-2 rounded-full bg-pink-500" />
            <span className="w-2 h-2 rounded-full bg-purple-500" />
          </div>
        )}

        {/* Add Child Inline Form Modal */}
        {addChildParentId === node.id && (
          <div className="ml-6 my-2 p-3 rounded-2xl bg-purple-50/90 border border-purple-200/90 flex flex-wrap items-center gap-2 shadow-xs">
            <input
              type="text"
              placeholder="Enter child node title..."
              value={newChildTitle}
              onChange={(e) => setNewChildTitle(e.target.value)}
              className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none flex-1 min-w-[200px]"
              autoFocus
            />
            <select
              value={newChildType}
              onChange={(e) => setNewChildType(e.target.value as any)}
              className="px-2 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-bold text-slate-700"
            >
              <option value="chapter">Chapter</option>
              <option value="topic">Topic</option>
              <option value="task">Task</option>
            </select>
            <button
              onClick={() => handleAddChild(node.id)}
              className="px-3 py-1.5 rounded-xl bg-purple-600 text-white font-bold text-xs hover:bg-purple-700 transition-all"
            >
              Add Child
            </button>
            <button
              onClick={() => setAddChildParentId(null)}
              className="px-2 py-1.5 rounded-xl bg-white text-slate-600 border border-slate-200 font-bold text-xs"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Recursive Children rendering */}
        {isExpanded && node.children && node.children.length > 0 && (
          <div className="space-y-1.5 mt-1.5">
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <GlassCard className="p-5 space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-3">
        <div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
            <FolderTree className="w-4 h-4 text-purple-600" /> GATE Roadmap Tree Hierarchy
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Drag & drop nodes or tasks directly into the tree. Exact hierarchy & order automatically persist in local storage.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setAddChildParentId(null);
              const name = prompt('Enter root subject name:');
              if (name && name.trim()) {
                const rootNode: RoadmapNode = {
                  id: 'tree-root-' + Date.now(),
                  title: name.trim(),
                  type: 'subject',
                  children: [],
                  order: Date.now(),
                  status: 'In Progress',
                };
                setTreeState((prev) => [...prev, rootNode]);
                onShowNotification?.(`Added root subject "${name.trim()}"`, 'Roadmap Tree');
              }
            }}
            className="px-3 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-black text-xs flex items-center gap-1 shadow-xs transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> Root Subject
          </button>

          <button
            onClick={handleResetTree}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-purple-200 text-slate-600 hover:bg-purple-50 font-bold text-xs flex items-center gap-1 shadow-2xs"
            title="Reset tree to default seed"
          >
            <RotateCcw className="w-3.5 h-3.5 text-purple-600" /> Reset
          </button>
        </div>
      </div>

      {/* Drop Zone Visual Feedback Hint */}
      {(externalDraggedTaskId || draggedNodeId) && (
        <div className="p-3 rounded-2xl bg-gradient-to-r from-purple-100 via-pink-100 to-indigo-100 border-2 border-dashed border-purple-400 text-xs font-extrabold text-purple-900 flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-pink-600" />
            <span>Drop active task/node onto any parent node to assign or reorder!</span>
          </div>
          <span className="bg-purple-600 text-white text-[10px] px-2 py-0.5 rounded-full font-black">
            Active Dragging
          </span>
        </div>
      )}

      {/* Tree Nodes Body */}
      <div className="space-y-2 min-h-[150px] p-2 rounded-2xl bg-purple-50/30 border border-purple-100">
        {treeState.length === 0 ? (
          <div className="p-6 text-center text-xs font-bold text-slate-400">
            Roadmap tree is currently empty. Click "Root Subject" above to start building.
          </div>
        ) : (
          treeState.map((rootNode) => renderNode(rootNode, 0))
        )}
      </div>
    </GlassCard>
  );
};
