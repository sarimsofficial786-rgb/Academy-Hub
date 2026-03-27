import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where,
  orderBy 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Class, UserProfile, Student } from '../types';
import { 
  Plus, 
  BookOpen, 
  Clock, 
  DollarSign, 
  Edit2, 
  Trash2, 
  XCircle,
  CheckCircle2,
  Users,
  Calendar,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function ClassesView({ profile }: { profile: UserProfile }) {
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Class | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    timing: '',
    monthlyFee: 0,
    subjects: [] as string[],
    subjectTeacherMap: {} as { [subject: string]: string },
    offDays: [] as string[],
    emergencyOnDates: [] as string[],
    emergencyOffDates: [] as string[],
    capacity: 0
  });

  const [newSubject, setNewSubject] = useState('');
  const [newEmergencyOn, setNewEmergencyOn] = useState('');
  const [newEmergencyOff, setNewEmergencyOff] = useState('');

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];

    const q = isTeacher
      ? query(collection(db, 'classes'), where('__name__', 'in', classIds.length > 0 ? classIds : ['_none_']))
      : query(collection(db, 'classes'), orderBy('name', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    const sUnsubscribe = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'students');
    });

    const tUnsubscribe = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    return () => {
      unsubscribe();
      sUnsubscribe();
      tUnsubscribe();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    
    setIsSaving(true);
    try {
      if (editingClass) {
        await updateDoc(doc(db, 'classes', editingClass.id), formData);
      } else {
        await addDoc(collection(db, 'classes'), formData);
      }
      setIsModalOpen(false);
      setEditingClass(null);
      setFormData({ 
        name: '', 
        timing: '', 
        monthlyFee: 0, 
        subjects: [], 
        subjectTeacherMap: {},
        offDays: [],
        emergencyOnDates: [],
        emergencyOffDates: [],
        capacity: 0
      });
    } catch (error) {
      console.error("Error saving class:", error);
      handleFirestoreError(error, OperationType.WRITE, editingClass ? `classes/${editingClass.id}` : 'classes');
    } finally {
      setIsSaving(false);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'classes', deletingId));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `classes/${deletingId}`);
    }
  };

  const addSubject = () => {
    const subjects = formData.subjects || [];
    if (newSubject.trim() && !subjects.includes(newSubject.trim())) {
      setFormData({ ...formData, subjects: [...subjects, newSubject.trim()] });
      setNewSubject('');
    }
  };

  const removeSubject = (subject: string) => {
    const subjects = formData.subjects || [];
    setFormData({ ...formData, subjects: subjects.filter(s => s !== subject) });
  };

  const toggleOffDay = (day: string) => {
    setFormData(prev => {
      const offDays = prev.offDays || [];
      return {
        ...prev,
        offDays: offDays.includes(day)
          ? offDays.filter(d => d !== day)
          : [...offDays, day]
      };
    });
  };

  const addEmergencyOn = () => {
    const dates = formData.emergencyOnDates || [];
    if (newEmergencyOn && !dates.includes(newEmergencyOn)) {
      setFormData(prev => ({ ...prev, emergencyOnDates: [...dates, newEmergencyOn] }));
      setNewEmergencyOn('');
    }
  };

  const removeEmergencyOn = (date: string) => {
    const dates = formData.emergencyOnDates || [];
    setFormData(prev => ({ ...prev, emergencyOnDates: dates.filter(d => d !== date) }));
  };

  const addEmergencyOff = () => {
    const dates = formData.emergencyOffDates || [];
    if (newEmergencyOff && !dates.includes(newEmergencyOff)) {
      setFormData(prev => ({ ...prev, emergencyOffDates: [...dates, newEmergencyOff] }));
      setNewEmergencyOff('');
    }
  };

  const removeEmergencyOff = (date: string) => {
    const dates = formData.emergencyOffDates || [];
    setFormData(prev => ({ ...prev, emergencyOffDates: dates.filter(d => d !== date) }));
  };

  const canManage = profile.role === 'admin' || profile.permissions.manageClasses;
  const canManageOffDays = profile.role === 'admin' || profile.permissions.manageOffDays;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Classes</h1>
          <p className="text-slate-500">Manage class schedules, fees, and subjects</p>
        </div>
        {canManage && (
          <button 
            onClick={() => {
              setEditingClass(null);
              setFormData({ 
                name: '', 
                timing: '', 
                monthlyFee: 0, 
                subjects: [], 
                offDays: [],
                emergencyOnDates: [],
                emergencyOffDates: [],
                capacity: 0
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Add Class
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {classes.map((cls) => (
          <motion.div 
            key={cls.id}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 hover:shadow-md transition-all group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                <BookOpen className="w-6 h-6" />
              </div>
              {(canManage || canManageOffDays) && (
                <div className="flex items-center gap-1 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingClass(cls);
                      setFormData({
                        name: cls.name,
                        timing: cls.timing,
                        monthlyFee: cls.monthlyFee,
                        subjects: cls.subjects || [],
                        subjectTeacherMap: cls.subjectTeacherMap || {},
                        offDays: cls.offDays || [],
                        emergencyOnDates: cls.emergencyOnDates || [],
                        emergencyOffDates: cls.emergencyOffDates || [],
                        capacity: cls.capacity || 0
                      });
                      setIsModalOpen(true);
                    }}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  {canManage && (
                    <button 
                      onClick={() => handleDelete(cls.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <h3 className="text-xl font-bold text-slate-900 mb-1">{cls.name}</h3>
            
            {/* Occupancy Info */}
            {cls.capacity ? (
              <div className="mb-4">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="text-slate-500 font-medium">Occupancy</span>
                  <span className={cn(
                    "font-bold",
                    (students.filter(s => s.classId === cls.id || s.classId === cls.name).length >= cls.capacity) ? "text-red-600" : "text-indigo-600"
                  )}>
                    {students.filter(s => s.classId === cls.id || s.classId === cls.name).length} / {cls.capacity}
                  </span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (students.filter(s => s.classId === cls.id || s.classId === cls.name).length / cls.capacity) * 100)}%` }}
                    className={cn(
                      "h-full rounded-full transition-all",
                      (students.filter(s => s.classId === cls.id || s.classId === cls.name).length >= cls.capacity) ? "bg-red-500" : "bg-indigo-500"
                    )}
                  />
                </div>
                {cls.capacity - students.filter(s => s.classId === cls.id || s.classId === cls.name).length <= 5 && cls.capacity - students.filter(s => s.classId === cls.id || s.classId === cls.name).length > 0 && (
                  <p className="text-[10px] text-amber-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Only {cls.capacity - students.filter(s => s.classId === cls.id || s.classId === cls.name).length} seats left!
                  </p>
                )}
                {students.filter(s => s.classId === cls.id || s.classId === cls.name).length >= cls.capacity && (
                  <p className="text-[10px] text-red-600 font-bold mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Class is full!
                  </p>
                )}
              </div>
            ) : (
              <div className="mb-4 p-2 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-400 italic">No capacity limit set</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-slate-500 text-sm mb-4">
              <Clock className="w-4 h-4" />
              {cls.timing}
            </div>

            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Monthly Fee</span>
                <span className="font-bold text-slate-900 flex items-center gap-1">
                  <DollarSign className="w-4 h-4" />
                  {cls.monthlyFee}
                </span>
              </div>
              
              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subjects & Teachers</p>
                <div className="flex flex-wrap gap-1.5">
                  {(cls.subjects || [])
                    .filter(s => profile.role === 'admin' || cls.subjectTeacherMap?.[s] === profile.uid || cls.subjectTeacherMap?.[s] === profile.email)
                    .map((s, idx) => (
                    <div key={`${s}-${idx}`} className="flex flex-col px-2 py-1 bg-slate-100 text-slate-600 rounded-md border border-slate-200">
                      <span className="text-xs font-bold">{s}</span>
                      <span className="text-[10px] text-indigo-600 font-medium italic">
                        {cls.subjectTeacherMap?.[s] 
                          ? (teachers.find(t => t.uid === cls.subjectTeacherMap?.[s] || t.email === cls.subjectTeacherMap?.[s])?.name || 'Assign Teacher')
                          : 'Assign Teacher'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Off Days</p>
                <div className="flex flex-wrap gap-1.5">
                  {(cls.offDays || []).length > 0 ? (
                    (cls.offDays || []).map((d, idx) => (
                      <span key={`${d}-${idx}`} className="px-2 py-0.5 bg-red-50 text-red-600 text-xs font-bold rounded-md border border-red-100">
                        {d}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400 italic">No regular off days</span>
                  )}
                </div>
              </div>

              {(cls.emergencyOnDates?.length || 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest">Extra Classes (Special On)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.emergencyOnDates?.map((d, idx) => (
                      <span key={`${d}-${idx}`} className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-md border border-green-100">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {(cls.emergencyOffDates?.length || 0) > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">Special Holidays (Special Off)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {cls.emergencyOffDates?.map((d, idx) => (
                      <span key={`${d}-${idx}`} className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold rounded-md border border-amber-100">
                        {d}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-indigo-600">
                <Users className="w-4 h-4" />
                <span className="text-sm font-bold">View Students</span>
              </div>
              <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingClass ? 'Edit Class' : 'Add New Class'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Class Name</label>
                      <input 
                        required
                        disabled={!canManage}
                        type="text" 
                        placeholder="e.g. Morning Math"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Timing</label>
                      <input 
                        required
                        disabled={!canManage}
                        type="text" 
                        placeholder="e.g. 10:00 AM - 11:30 AM"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        value={formData.timing}
                        onChange={(e) => setFormData({...formData, timing: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Monthly Fee</label>
                      <input 
                        required
                        disabled={!canManage}
                        type="number" 
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        value={formData.monthlyFee}
                        onChange={(e) => setFormData({...formData, monthlyFee: Number(e.target.value)})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Capacity (Max Students)</label>
                      <input 
                        disabled={!canManage}
                        type="number" 
                        placeholder="e.g. 30"
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        value={formData.capacity || ''}
                        onChange={(e) => setFormData({...formData, capacity: Number(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Subjects & Assigned Teachers</label>
                    <div className="flex gap-2 mb-4">
                      <input 
                        disabled={!canManage}
                        type="text" 
                        placeholder="Add subject..."
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                        value={newSubject}
                        onChange={(e) => setNewSubject(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSubject())}
                      />
                      <button 
                        disabled={!canManage}
                        type="button"
                        onClick={addSubject}
                        className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
                      >
                        <Plus className="w-6 h-6" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(formData.subjects || []).map((s, idx) => (
                        <div key={`${s}-${idx}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
                          <div className="flex-1">
                            <span className="text-sm font-bold text-slate-900">{s}</span>
                          </div>
                          <select
                            disabled={!canManage}
                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            value={(() => {
                              const val = formData.subjectTeacherMap?.[s] || '';
                              if (!val) return '';
                              const t = teachers.find(teacher => teacher.uid === val || teacher.email === val);
                              return t?.uid || '';
                            })()}
                            onChange={(e) => {
                              const newMap = { ...formData.subjectTeacherMap, [s]: e.target.value };
                              setFormData({ ...formData, subjectTeacherMap: newMap });
                            }}
                          >
                            <option value="">Assign Teacher</option>
                            {teachers.map(t => (
                              <option key={t.uid} value={t.uid}>{t.name} ({t.email})</option>
                            ))}
                          </select>
                          {canManage && (
                            <button 
                              type="button" 
                              onClick={() => {
                                const newSubjects = formData.subjects.filter(sub => sub !== s);
                                const newMap = { ...formData.subjectTeacherMap };
                                delete newMap[s];
                                setFormData({ ...formData, subjects: newSubjects, subjectTeacherMap: newMap });
                              }} 
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100">
                    <div className="mb-4">
                      <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-indigo-600" />
                        Schedule & Holidays
                      </h3>
                      <p className="text-xs text-slate-500 mt-1">
                        Set regular weekly off days and special dates for holidays or extra classes.
                      </p>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Weekly Off Days</label>
                        <p className="text-[10px] text-slate-400 mb-2 italic">Select days when this class usually does NOT have class.</p>
                        <div className="flex flex-wrap gap-2">
                          {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(day => (
                            <button
                              key={day}
                              type="button"
                              disabled={!canManageOffDays}
                              onClick={() => toggleOffDay(day)}
                              className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                                formData.offDays && formData.offDays.includes(day)
                                  ? "bg-red-50 border-red-200 text-red-600"
                                  : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                              )}
                            >
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                          <label className="block text-xs font-bold text-green-600 uppercase tracking-wider mb-1">Extra Class Dates</label>
                          <p className="text-[10px] text-slate-400 mb-2 italic">Force a class on a regular off day.</p>
                          <div className="flex gap-2 mb-2">
                            <input 
                              disabled={!canManageOffDays}
                              type="date" 
                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
                              value={newEmergencyOn}
                              onChange={(e) => setNewEmergencyOn(e.target.value)}
                            />
                            <button 
                              disabled={!canManageOffDays}
                              type="button"
                              onClick={addEmergencyOn}
                              className="p-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(formData.emergencyOnDates || []).map((date, idx) => (
                              <span key={`${date}-${idx}`} className="flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded-md border border-green-100">
                                {date}
                                {canManageOffDays && (
                                  <button type="button" onClick={() => removeEmergencyOn(date)} className="p-0.5 hover:bg-green-100 rounded-full">
                                    <XCircle className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-amber-600 uppercase tracking-wider mb-1">Special Holiday Dates</label>
                          <p className="text-[10px] text-slate-400 mb-2 italic">Cancel class on a regular class day.</p>
                          <div className="flex gap-2 mb-2">
                            <input 
                              disabled={!canManageOffDays}
                              type="date" 
                              className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50"
                              value={newEmergencyOff}
                              onChange={(e) => setNewEmergencyOff(e.target.value)}
                            />
                            <button 
                              disabled={!canManageOffDays}
                              type="button"
                              onClick={addEmergencyOff}
                              className="p-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-all disabled:opacity-50"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {(formData.emergencyOffDates || []).map((date, idx) => (
                              <span key={`${date}-${idx}`} className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 text-[10px] font-bold rounded-md border border-amber-100">
                                {date}
                                {canManageOffDays && (
                                  <button type="button" onClick={() => removeEmergencyOff(date)} className="p-0.5 hover:bg-amber-100 rounded-full">
                                    <XCircle className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    disabled={isSaving || (!canManage && !canManageOffDays)}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSaving ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      editingClass ? 'Update Class' : 'Save Class'
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {deletingId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl border border-slate-200"
            >
              <div className="flex items-center gap-4 text-red-600 mb-4">
                <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                  <Trash2 className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold">Delete Class?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this class? This action cannot be undone and will affect all students assigned to it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeletingId(null)}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-sm"
                >
                  Delete Class
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
