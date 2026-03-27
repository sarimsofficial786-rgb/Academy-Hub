import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  where 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';
import { TimetableSlot, Class, UserProfile, UserRole } from '../types';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  Clock, 
  MapPin, 
  User, 
  BookOpen,
  Calendar as CalendarIcon,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
type Day = typeof DAYS[number];

export default function TimetableView({ profile }: { profile: UserProfile }) {
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<TimetableSlot | null>(null);
  const [formData, setFormData] = useState<Partial<TimetableSlot>>({
    day: 'Monday',
    startTime: '09:00',
    endTime: '10:00',
    type: 'lecture'
  });

  const canManage = profile.role === 'admin' || profile.permissions.manageTimetable;

  useEffect(() => {
    const unsubSlots = onSnapshot(collection(db, 'timetable'), (snapshot) => {
      setSlots(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableSlot)));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'timetable'));

    const unsubClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    });

    // Fetch both teachers and admins who might teach
    const unsubTeachers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const allStaff = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as UserProfile))
        .filter(u => u.role === 'teacher' || u.role === 'admin');
      setTeachers(allStaff);
    });

    return () => {
      unsubSlots();
      unsubClasses();
      unsubTeachers();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!formData.classId || !formData.day || !formData.startTime || !formData.endTime) return;
    if (formData.type === 'lecture' && (!formData.subject || !formData.teacherUid)) return;

    try {
      const dataToSave = {
        ...formData,
        subject: formData.type === 'break' ? 'Break' : formData.subject,
        teacherUid: formData.type === 'break' ? null : formData.teacherUid,
      };

      if (editingSlot) {
        await updateDoc(doc(db, 'timetable', editingSlot.id), dataToSave);
      } else {
        await addDoc(collection(db, 'timetable'), dataToSave);
      }
      setIsModalOpen(false);
      setEditingSlot(null);
      setFormData({ day: 'Monday', startTime: '09:00', endTime: '10:00', type: 'lecture' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'timetable');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this slot?')) return;
    try {
      await deleteDoc(doc(db, 'timetable', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'timetable');
    }
  };

  const filteredSlots = slots.filter(slot => {
    if (profile.role === 'student' && profile.studentId) {
      return slot.classId === profile.assignedClassIds[0];
    }
    if (profile.role === 'teacher' && !profile.permissions.manageTimetable) {
      // Teachers see their own slots or slots for classes they are assigned to
      return slot.teacherUid === profile.uid || profile.assignedClassIds.includes(slot.classId);
    }
    if (selectedClassId !== 'all') {
      return slot.classId === selectedClassId;
    }
    return true;
  });

  const getDaySlots = (day: Day) => {
    return filteredSlots
      .filter(s => s.day === day)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Timetable</h1>
          <p className="text-slate-500">Manage and view lecture schedules</p>
        </div>
        <div className="flex items-center gap-3">
          {profile.role !== 'student' && (
            <select
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Classes</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {canManage && (
            <button
              onClick={() => {
                setEditingSlot(null);
                setFormData({ day: 'Monday', startTime: '09:00', endTime: '10:00', type: 'lecture' });
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              <Plus className="w-4 h-4" />
              Add Slot
            </button>
          )}
        </div>
      </div>

      {/* Timetable Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {DAYS.map(day => (
          <div key={day} className="space-y-3">
            <div className="bg-slate-100 p-3 rounded-xl text-center">
              <span className="text-sm font-bold text-slate-700">{day}</span>
            </div>
            <div className="space-y-3">
              {getDaySlots(day).length > 0 ? (
                getDaySlots(day).map(slot => (
                  <motion.div
                    layout
                    key={slot.id}
                    className={cn(
                      "bg-white p-4 rounded-2xl border border-slate-200 shadow-sm relative group",
                      slot.teacherUid === profile.uid && "border-indigo-200 bg-indigo-50/30",
                      slot.type === 'break' && "bg-slate-50 border-dashed border-slate-300"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "text-xs font-bold uppercase tracking-wider",
                          slot.type === 'break' ? "text-slate-500" : "text-indigo-600"
                        )}>
                          {slot.subject}
                        </span>
                        {canManage && (
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => {
                                setEditingSlot(slot);
                                setFormData(slot);
                                setIsModalOpen(true);
                              }}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => handleDelete(slot.id)}
                              className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-slate-500">
                        <Clock className="w-3 h-3" />
                        {slot.startTime} - {slot.endTime}
                      </div>
                      {slot.type === 'lecture' && (
                        <>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <BookOpen className="w-3 h-3" />
                            {classes.find(c => c.id === slot.classId)?.name}
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <User className="w-3 h-3" />
                            {teachers.find(t => t.uid === slot.teacherUid)?.name || 'Unknown Teacher'}
                          </div>
                          {slot.room && (
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                              <MapPin className="w-3 h-3" />
                              Room: {slot.room}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="h-20 border-2 border-dashed border-slate-100 rounded-2xl flex items-center justify-center">
                  <span className="text-[10px] text-slate-300 font-medium">No Lectures</span>
                </div>
              )}
            </div>
          </div>
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
              className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h2 className="text-xl font-bold text-slate-900">
                  {editingSlot ? 'Edit Lecture Slot' : 'Add Lecture Slot'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <AlertCircle className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Slot Type</label>
                    <div className="flex bg-slate-100 p-1 rounded-xl">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'lecture' })}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                          formData.type === 'lecture' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Lecture
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, type: 'break' })}
                        className={cn(
                          "flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all",
                          formData.type === 'break' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        Break
                      </button>
                    </div>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Class</label>
                    <select
                      required
                      value={formData.classId || ''}
                      onChange={(e) => {
                        const classId = e.target.value;
                        const selectedClass = classes.find(c => c.id === classId);
                        setFormData({ ...formData, classId, subject: selectedClass?.subjects[0] || '' });
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">Select Class</option>
                      {classes.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  {formData.type === 'lecture' && (
                    <>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Subject</label>
                        <select
                          required
                          value={formData.subject || ''}
                          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Subject</option>
                          {formData.classId && classes.find(c => c.id === formData.classId)?.subjects.map((s, idx) => (
                            <option key={`${s}-${idx}`} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Teacher</label>
                        <select
                          required
                          value={formData.teacherUid || ''}
                          onChange={(e) => setFormData({ ...formData, teacherUid: e.target.value })}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">Select Teacher</option>
                          {teachers.map(t => (
                            <option key={t.uid} value={t.uid}>{t.name}</option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Day</label>
                    <select
                      required
                      value={formData.day || 'Monday'}
                      onChange={(e) => setFormData({ ...formData, day: e.target.value as Day })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      {DAYS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Room (Optional)</label>
                    <input
                      type="text"
                      value={formData.room || ''}
                      onChange={(e) => setFormData({ ...formData, room: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="e.g. Room 101"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Start Time</label>
                    <input
                      required
                      type="time"
                      value={formData.startTime || ''}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">End Time</label>
                    <input
                      required
                      type="time"
                      value={formData.endTime || ''}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingSlot ? 'Update Slot' : 'Create Slot'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
