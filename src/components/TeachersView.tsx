import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  doc, 
  query, 
  where,
  orderBy,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Class, Permissions } from '../types';
import { 
  Plus, 
  ShieldCheck, 
  Edit2, 
  Trash2, 
  CheckCircle2, 
  XCircle, 
  Mail, 
  Phone, 
  BookOpen,
  Lock,
  Unlock,
  ChevronRight,
  ChevronDown,
  UserCircle,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { isAfter, subDays } from 'date-fns';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_TEACHER_PERMISSIONS: Permissions = {
  viewDashboard: true,
  viewStudents: true,
  addStudents: false,
  editStudents: false,
  deleteStudents: false,
  viewClasses: true,
  manageClasses: false,
  markTodayAttendance: true,
  editTodayAttendance: true,
  viewAttendanceHistory: true,
  managePastAttendance: false,
  useUnifiedMode: false,
  manageFees: false,
  viewReports: true,
  exportReports: false,
  manageTeachers: false,
  createStudentLogin: false,
  manageOffDays: false,
  manageFinance: false,
  manageTimetable: false,
};

export default function TeachersView({ profile, onImpersonate }: { profile: UserProfile, onImpersonate: (p: UserProfile) => void }) {
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState<UserProfile | null>(null);
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    tempPassword: '',
    assignedClassIds: [] as string[],
    permissions: { ...DEFAULT_TEACHER_PERMISSIONS }
  });

  useEffect(() => {
    const q = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as any as UserProfile)));
      setLoading(false);
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const bUnsubscribe = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    return () => {
      unsubscribe();
      bUnsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Clean up assignedClassIds before saving to remove any stale/deleted class IDs
      const cleanedFormData = {
        ...formData,
        assignedClassIds: (formData.assignedClassIds || []).filter(id => classes.some(b => b.id === id))
      };

      if (editingTeacher) {
        // Use the document ID (id) for updates, as uid might be empty for pre-created teachers
        const docId = (editingTeacher as any).id || editingTeacher.uid;
        if (!docId) throw new Error("No document ID found for update");
        await updateDoc(doc(db, 'users', docId), cleanedFormData);
      } else {
        // Create a pre-profile for the teacher
        // They will be linked by email when they sign in
        const newTeacherProfile = {
          ...cleanedFormData,
          uid: '', // Will be filled on first login
          role: 'teacher',
          status: 'active',
          joinedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'users'), newTeacherProfile);
      }
      setIsModalOpen(false);
      setEditingTeacher(null);
      setFormData({
        name: '',
        email: '',
        phone: '',
        tempPassword: '',
        assignedClassIds: [] as string[],
        permissions: { ...DEFAULT_TEACHER_PERMISSIONS }
      });
    } catch (error) {
      const docId = editingTeacher ? ((editingTeacher as any).id || editingTeacher.uid) : 'users';
      handleFirestoreError(error, editingTeacher ? OperationType.UPDATE : OperationType.CREATE, editingTeacher ? `users/${docId}` : 'users');
    }
  };

  const togglePermission = (key: keyof Permissions) => {
    setFormData(prev => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key]
      }
    }));
  };

  const toggleClass = (classId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedClassIds: prev.assignedClassIds.includes(classId)
        ? prev.assignedClassIds.filter(id => id !== classId)
        : [...prev.assignedClassIds, classId]
    }));
  };

  const canManage = profile.role === 'admin';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Teachers & Permissions</h1>
          <p className="text-slate-500">Manage teacher access and assigned classes</p>
        </div>
        {canManage && (
          <button 
            onClick={() => {
              setEditingTeacher(null);
              setFormData({
                name: '',
                email: '',
                phone: '',
                tempPassword: '',
                assignedClassIds: [],
                permissions: { ...DEFAULT_TEACHER_PERMISSIONS }
              });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Add Teacher
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4">
        {teachers.map((teacher) => (
          <div key={teacher.uid} className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-2xl flex items-center justify-center">
                  <ShieldCheck className="w-7 h-7 text-indigo-600" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-slate-900">{teacher.name}</h3>
                    {teacher.joinedAt && isAfter(new Date(teacher.joinedAt), subDays(new Date(), 7)) && (
                      <span className="flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full animate-pulse">
                        <Sparkles className="w-3 h-3" />
                        NEW
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-3 mt-1">
                    <span className="flex items-center gap-1 text-xs text-slate-500">
                      <Mail className="w-3 h-3" /> {teacher.email}
                    </span>
                    {teacher.phone && (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Phone className="w-3 h-3" /> {teacher.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">Assigned Classes</p>
                  <p className="text-sm font-bold text-slate-900">{(teacher.assignedClassIds || []).filter(id => classes.some(b => b.id === id)).length} Classes</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onImpersonate(teacher)}
                      className="p-2.5 bg-amber-50 text-amber-600 rounded-xl hover:bg-amber-100 transition-all border border-amber-100"
                      title="Login As Teacher"
                    >
                      <UserCircle className="w-5 h-5" />
                    </button>
                    <button 
                      onClick={() => {
                        setEditingTeacher(teacher);
                        setFormData({
                          name: teacher.name,
                          email: teacher.email,
                          phone: teacher.phone || '',
                          tempPassword: teacher.tempPassword || '',
                          assignedClassIds: (teacher.assignedClassIds || []).filter(id => classes.some(b => b.id === id)),
                          permissions: teacher.permissions || { ...DEFAULT_TEACHER_PERMISSIONS }
                        });
                        setIsModalOpen(true);
                      }}
                      className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-all border border-indigo-100"
                    >
                      <Edit2 className="w-5 h-5" />
                    </button>
                  </div>
                )}
                <button 
                  onClick={() => setExpandedTeacher(expandedTeacher === ((teacher as any).id || teacher.uid) ? null : ((teacher as any).id || teacher.uid))}
                  className="p-2.5 bg-slate-50 text-slate-600 rounded-xl hover:bg-slate-100 transition-all border border-slate-100"
                >
                  {expandedTeacher === ((teacher as any).id || teacher.uid) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <AnimatePresence>
              {expandedTeacher === ((teacher as any).id || teacher.uid) && (
                <motion.div 
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-t border-slate-100 bg-slate-50/50 p-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <ChevronRight className="w-4 h-4 text-indigo-600" />
                        Assigned Classes
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const validClassIds = (teacher.assignedClassIds || []).filter(id => classes.some(b => b.id === id));
                          return validClassIds.length > 0 ? (
                            validClassIds.map((id, idx) => {
                              const cls = classes.find(b => b.id === id);
                              return (
                                <span key={`${id}-${idx}`} className="px-3 py-1.5 bg-white border border-slate-200 text-slate-700 text-sm font-semibold rounded-xl shadow-sm">
                                  {cls?.name || 'Unknown Class'}
                                </span>
                              );
                            })
                          ) : (
                            <p className="text-sm text-slate-500 italic">No classes assigned yet.</p>
                          );
                        })()}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <Lock className="w-4 h-4 text-indigo-600" />
                        Login Credentials
                      </h4>
                      <div className="bg-white p-4 rounded-xl border border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Email:</span>
                          <span className="text-xs font-mono font-bold text-slate-900">{teacher.email}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Password:</span>
                          <span className="text-xs font-mono font-bold text-indigo-600">
                            {teacher.tempPassword || 'Not set'}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 italic mt-2">
                          * Admins can view and change these credentials.
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-indigo-600" />
                        Active Permissions
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {Object.entries(teacher.permissions || {}).map(([key, value]) => (
                          value && (
                            <div key={key} className="flex items-center gap-2 text-xs font-medium text-slate-600 bg-white p-2 rounded-lg border border-slate-100">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </div>
                          )
                        ))}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ))}

        {teachers.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 border-dashed">
            <ShieldCheck className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-500 font-medium">No teachers registered yet.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Edit Teacher Permissions</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-8">
                {/* Basic Info */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Name</label>
                    <input 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      placeholder="Teacher Name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input 
                      required
                      type="email"
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500" 
                      value={formData.email}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                      placeholder="teacher@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input 
                      type="tel" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.phone}
                      onChange={(e) => setFormData({...formData, phone: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input 
                        type="text" 
                        className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={formData.tempPassword}
                        onChange={(e) => setFormData({...formData, tempPassword: e.target.value})}
                        placeholder="Login Password"
                      />
                    </div>
                  </div>
                </div>

                {/* Class Assignment */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Assign Classes</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {classes.map(cls => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => toggleClass(cls.id)}
                        className={cn(
                          "p-3 rounded-xl border text-sm font-semibold transition-all text-left flex items-center justify-between",
                          (formData.assignedClassIds || []).includes(cls.id)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        {cls.name}
                        {(formData.assignedClassIds || []).includes(cls.id) && <CheckCircle2 className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Permissions Grid */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wider">Custom Permissions</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {Object.keys(DEFAULT_TEACHER_PERMISSIONS).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePermission(key as keyof Permissions)}
                        className={cn(
                          "p-4 rounded-xl border text-sm font-semibold transition-all text-left flex items-center justify-between group",
                          formData.permissions[key as keyof Permissions]
                            ? "bg-green-50 border-green-200 text-green-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        )}
                      >
                        <div className="flex flex-col">
                          <span>{key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}</span>
                        </div>
                        <div className={cn(
                          "w-10 h-6 rounded-full relative transition-all",
                          formData.permissions[key as keyof Permissions] ? "bg-green-500" : "bg-slate-200"
                        )}>
                          <div className={cn(
                            "absolute top-1 w-4 h-4 bg-white rounded-full transition-all",
                            formData.permissions[key as keyof Permissions] ? "left-5" : "left-1"
                          )} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-3 bg-slate-50">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-4 py-3 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-white transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit}
                  className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                >
                  Save Changes
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
