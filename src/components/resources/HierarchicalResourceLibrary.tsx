import React, { useState, useEffect } from 'react';
import {
  FolderTree,
  FileText,
  Search,
  Filter,
  Plus,
  Star,
  Tag,
  BookOpen,
  Eye,
  Trash2,
  Edit3,
  Download,
  Share2,
  Sparkles,
  Paperclip,
  CheckCircle2,
  Image,
  Video,
  Music,
  HelpCircle,
  Layers,
  ChevronRight,
  ChevronDown,
  X,
} from 'lucide-react';
import { db } from '../../services/db';
import { ResourceItem, ResourceType, ExamItem } from '../../types';
import { GlassCard } from '../shared/GlassCard';

interface HierarchicalResourceLibraryProps {
  onShowNotification: (msg: string, title?: string) => void;
  initialExamId?: string;
}

const RESOURCE_TYPES: ResourceType[] = [
  'Notes',
  'PDF',
  'Image',
  'Audio',
  'Video',
  'Flashcards',
  'PYQs',
  'Practice',
  'Formula',
  'Other',
];

const TYPE_ICONS: Record<ResourceType, any> = {
  Notes: FileText,
  PDF: BookOpen,
  Image: Image,
  Audio: Music,
  Video: Video,
  Flashcards: Layers,
  PYQs: HelpCircle,
  Practice: CheckCircle2,
  Formula: Sparkles,
  Other: Paperclip,
};

export const HierarchicalResourceLibrary: React.FC<HierarchicalResourceLibraryProps> = ({
  onShowNotification,
  initialExamId,
}) => {
  const [resources, setResources] = useState<ResourceItem[]>(db.getResources());
  const [exams] = useState<ExamItem[]>(db.getExams());

  // Filter & Search State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedExamId, setSelectedExamId] = useState<string>(initialExamId || 'All');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [selectedTag, setSelectedTag] = useState<string>('All');
  const [onlyFavorites, setOnlyFavorites] = useState<boolean>(false);

  // Selected Resource Modal / Preview Drawer State
  const [previewResource, setPreviewResource] = useState<ResourceItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState<boolean>(false);
  const [editingResource, setEditingResource] = useState<Partial<ResourceItem> | null>(null);

  useEffect(() => {
    const handleUpdate = () => setResources(db.getResources());
    window.addEventListener('studyos_resources_updated', handleUpdate);
    return () => window.removeEventListener('studyos_resources_updated', handleUpdate);
  }, []);

  // Collect all unique tags
  const allTags = Array.from(new Set(resources.flatMap((r) => r.tags || [])));

  const filteredResources = resources.filter((res) => {
    const matchesSearch =
      res.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      res.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (res.tags && res.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())));

    const matchesExam = selectedExamId === 'All' || res.examId === selectedExamId;
    const matchesType = selectedType === 'All' || res.type === selectedType;
    const matchesTag = selectedTag === 'All' || (res.tags && res.tags.includes(selectedTag));
    const matchesFav = !onlyFavorites || res.isFavorite;

    return matchesSearch && matchesExam && matchesType && matchesTag && matchesFav;
  });

  const handleOpenAddModal = () => {
    setEditingResource({
      title: '',
      type: 'Notes',
      examId: exams[0]?.id || 'exam-gate-2027',
      content: '',
      tags: ['Study Notes'],
      isFavorite: false,
    });
    setIsAddModalOpen(true);
  };

  const handleSaveResource = () => {
    if (!editingResource?.title || !editingResource?.content) {
      onShowNotification('Please provide a Title and Content', 'Resource Library');
      return;
    }

    if (editingResource.id) {
      const updated: ResourceItem = {
        ...(editingResource as ResourceItem),
        updatedDate: new Date().toISOString().split('T')[0] || '',
      };
      db.updateResource(updated);
      onShowNotification('Resource updated successfully', 'Resource Library');
    } else {
      const todayStr = new Date().toISOString().split('T')[0] || '';
      const newRes: ResourceItem = {
        id: 'res-' + Date.now(),
        title: editingResource.title,
        type: editingResource.type || 'Notes',
        examId: editingResource.examId || exams[0]?.id || 'exam-gate-2027',
        subjectId: editingResource.subjectId,
        chapterId: editingResource.chapterId,
        topicId: editingResource.topicId,
        content: editingResource.content,
        fileSize: '15 KB',
        tags: editingResource.tags || ['Study Material'],
        isFavorite: editingResource.isFavorite || false,
        createdDate: todayStr,
        updatedDate: todayStr,
      };
      db.addResource(newRes);
      onShowNotification(`Added material: ${newRes.title}`, 'Resource Library');
    }

    setIsAddModalOpen(false);
    setEditingResource(null);
    setResources(db.getResources());
  };

  const handleDeleteResource = (id: string, title: string) => {
    if (confirm(`Delete material "${title}"?`)) {
      db.deleteResource(id);
      setResources(db.getResources());
      if (previewResource?.id === id) setPreviewResource(null);
      onShowNotification('Material removed from local storage', 'Resource Library');
    }
  };

  const handleToggleFavorite = (id: string) => {
    db.toggleFavoriteResource(id);
    setResources(db.getResources());
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar font-sans select-none text-[#1e1b4b]">
      {/* Top Header & Actions */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/80 p-5 rounded-3xl border border-purple-100 shadow-2xs">
        <div className="flex items-center space-x-3">
          <span className="p-2 rounded-2xl bg-purple-100 text-purple-700 border border-purple-200">
            <FolderTree className="w-5 h-5" />
          </span>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">Hierarchical Resource Library</h1>
            <p className="text-xs text-slate-500 font-medium">
              Offline study materials linked to Exam → Subject → Chapter → Topic
            </p>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-[#8b5cf6] via-[#ec4899] to-[#f43f5e] text-white font-extrabold text-xs flex items-center space-x-2 shadow-md hover:opacity-95 transition-all shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Upload / Add Material</span>
        </button>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-3 bg-slate-50/80 p-3 rounded-2xl border border-purple-100">
        <div className="flex items-center space-x-2 w-full lg:w-80 bg-white px-3 py-2 rounded-xl border border-slate-200">
          <Search className="w-4 h-4 text-slate-400 shrink-0" />
          <input
            type="text"
            placeholder="Search notes, formulas, PYQs, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs font-medium bg-transparent focus:outline-none text-slate-800"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
          {/* Exam Filter */}
          <select
            value={selectedExamId}
            onChange={(e) => setSelectedExamId(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-700 focus:outline-none"
          >
            <option value="All">All Exams</option>
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.code} ({ex.title})
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-700 focus:outline-none"
          >
            <option value="All">All Material Types</option>
            {RESOURCE_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Tag Filter */}
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-extrabold text-slate-700 focus:outline-none"
          >
            <option value="All">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>

          {/* Favorites Filter */}
          <button
            onClick={() => setOnlyFavorites(!onlyFavorites)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-extrabold flex items-center space-x-1 transition-all ${
              onlyFavorites
                ? 'bg-amber-100 text-amber-800 border-amber-300'
                : 'bg-white text-slate-600 border-slate-200 hover:text-amber-600'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${onlyFavorites ? 'fill-amber-500 text-amber-500' : ''}`} />
            <span>Starred</span>
          </button>
        </div>
      </div>

      {/* Grid of Materials */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredResources.length === 0 ? (
          <div className="col-span-full p-12 text-center bg-white rounded-3xl border border-dashed border-slate-300 space-y-2">
            <FileText className="w-12 h-12 text-slate-300 mx-auto" />
            <h3 className="text-base font-black text-slate-800">No Study Materials Found</h3>
            <p className="text-xs text-slate-500">Try adjusting your filters or upload a new resource.</p>
          </div>
        ) : (
          filteredResources.map((res) => {
            const IconComp = TYPE_ICONS[res.type] || FileText;
            const linkedExam = exams.find((e) => e.id === res.examId);

            return (
              <GlassCard key={res.id} interactive className="space-y-3 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700">
                        <IconComp className="w-4 h-4" />
                      </span>
                      <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">
                        {res.type}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleFavorite(res.id)}
                      className="text-slate-300 hover:text-amber-500 transition-colors"
                    >
                      <Star className={`w-4 h-4 ${res.isFavorite ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>
                  </div>

                  <h3 className="text-sm font-black text-slate-900 tracking-tight mt-2 line-clamp-2">
                    {res.title}
                  </h3>

                  <p className="text-xs text-slate-600 line-clamp-3 mt-1 font-normal leading-relaxed">
                    {res.content}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-100">
                  {/* Exam Tag */}
                  {linkedExam && (
                    <div className="text-[10px] font-extrabold text-slate-500 flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded-full bg-purple-50 text-purple-800 border border-purple-200">
                        {linkedExam.code}
                      </span>
                      <span>{res.fileSize || 'Text'}</span>
                    </div>
                  )}

                  {/* Tags */}
                  <div className="flex flex-wrap items-center gap-1">
                    {res.tags?.map((t, idx) => (
                      <span
                        key={idx}
                        className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-1 text-xs">
                    <button
                      onClick={() => setPreviewResource(res)}
                      className="font-extrabold text-purple-600 hover:underline flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> Preview
                    </button>

                    <button
                      onClick={() => handleDeleteResource(res.id, res.title)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                      title="Delete Material"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* PREVIEW RESOURCE DRAWER / MODAL */}
      {previewResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-purple-200 p-6 w-full max-w-2xl shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 text-[10px] font-black uppercase">
                  {previewResource.type}
                </span>
                <span className="text-xs font-bold text-slate-400">• Added: {previewResource.createdDate}</span>
              </div>
              <button onClick={() => setPreviewResource(null)} className="text-slate-400 hover:text-slate-600 font-bold">
                <X className="w-5 h-5" />
              </button>
            </div>

            <h2 className="text-lg font-black text-slate-900">{previewResource.title}</h2>

            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs font-normal text-slate-800 leading-relaxed whitespace-pre-wrap max-h-64 overflow-y-auto custom-scrollbar">
              {previewResource.content}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {previewResource.tags?.map((t, idx) => (
                <span key={idx} className="text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full">
                  #{t}
                </span>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setPreviewResource(null)}
                className="px-4 py-2 rounded-xl bg-purple-600 text-white text-xs font-extrabold shadow-md"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT MATERIAL MODAL */}
      {isAddModalOpen && editingResource && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-purple-200 p-6 w-full max-w-xl shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900">Add Study Material</h2>
              <button onClick={() => setIsAddModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-bold">
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs font-semibold text-slate-700">
              <div className="space-y-1">
                <label>Material Title *</label>
                <input
                  type="text"
                  placeholder="e.g. Master Theorem Proof & Formula Notes"
                  value={editingResource.title || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label>Material Type</label>
                  <select
                    value={editingResource.type || 'Notes'}
                    onChange={(e) => setEditingResource({ ...editingResource, type: e.target.value as ResourceType })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:outline-none"
                  >
                    {RESOURCE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label>Linked Exam Workspace</label>
                  <select
                    value={editingResource.examId || exams[0]?.id}
                    onChange={(e) => setEditingResource({ ...editingResource, examId: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:outline-none"
                  >
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.code} ({ex.title})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label>Content / Notes / Formula Body *</label>
                <textarea
                  rows={5}
                  placeholder="Paste or write formulas, summary notes, or problem statements..."
                  value={editingResource.content || ''}
                  onChange={(e) => setEditingResource({ ...editingResource, content: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:outline-none font-mono text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-extrabold"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveResource}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold shadow-md"
              >
                Save Material
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
