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
  orderBy,
  serverTimestamp,
  documentId
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';
import { Student, Class, UserProfile } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  UserPlus,
  CheckCircle2,
  XCircle,
  Clock,
  Mail,
  ShieldCheck,
  ShieldAlert,
  Lock,
  UserCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isAfter, subDays } from 'date-fns';

export default function StudentsView({ profile, onImpersonate }: { profile: UserProfile, onImpersonate: (p: UserProfile) => void }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    tempPassword: '',
    rollNumber: '',
    classId: '',
    status: 'active' as const
  });

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];

    const cQuery = isTeacher
      ? query(collection(db, 'classes'), where(documentId(), 'in', classIds.length > 0 ? classIds : ['_none_']))
      : collection(db, 'classes');

    let sUnsubscribe: (() => void) | null = null;

    const cUnsubscribe = onSnapshot(cQuery, (snapshot) => {
      const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(filtered);
      
      // Once classes are loaded, we can fetch students more accurately
      const classNames = filtered.map(b => b.name);
      const allPossibleClassIdentifiers = [...classIds, ...classNames];
      
      // Cleanup previous listener if it exists
      if (sUnsubscribe) sUnsubscribe();

      const sQuery = isTeacher
        ? query(collection(db, 'students'), where('classId', 'in', allPossibleClassIdentifiers.length > 0 ? allPossibleClassIdentifiers : ['_none_']), orderBy('rollNumber', 'asc'))
        : query(collection(db, 'students'), orderBy('rollNumber', 'asc'));

      sUnsubscribe = onSnapshot(sQuery, (sSnapshot) => {
        setStudents(sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
        setLoading(false);
      }, (error) => {
        if (error.message?.includes('permission-denied')) return;
        handleFirestoreError(error, OperationType.GET, 'students');
      });
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    // Fetch teachers for assignment
    const tQuery = query(collection(db, 'users'), where('role', '==', 'teacher'));
    const tUnsubscribe = onSnapshot(tQuery, (snapshot) => {
      setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
    });

    return () => {
      cUnsubscribe();
      tUnsubscribe();
      if (sUnsubscribe) sUnsubscribe();
    };
  }, [profile]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        try {
          await updateDoc(doc(db, 'students', editingStudent.id), formData);
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `students/${editingStudent.id}`);
        }
      } else {
        try {
          await addDoc(collection(db, 'students'), {
            ...formData,
            joinedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, 'students');
        }
      }
      setIsModalOpen(false);
      setEditingStudent(null);
      setFormData({ name: '', phone: '', email: '', tempPassword: '', rollNumber: '', classId: '', status: 'active' });
    } catch (error) {
      console.error("Error saving student:", error);
    }
  };

  const handleGenerateLogin = async (student: Student) => {
    if (!profile.permissions.createStudentLogin) return;
    
    const tempEmail = `${student.rollNumber.toLowerCase()}@academy.com`;
    const tempPass = `academy${student.rollNumber}`;
    
    try {
      await updateDoc(doc(db, 'students', student.id), {
        email: tempEmail,
        tempPassword: tempPass
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `students/${student.id}`);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setDeletingId(id);
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteDoc(doc(db, 'students', deletingId));
      setDeletingId(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `students/${deletingId}`);
    }
  };

  const filteredStudents = students.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesClass = filterClass === 'all' || s.classId === filterClass;
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus;
    return matchesSearch && matchesClass && matchesStatus;
  });

  const canAdd = profile.role === 'admin' || profile.permissions.addStudents;
  const canEdit = profile.role === 'admin' || profile.permissions.editStudents;
  const canDelete = profile.role === 'admin' || profile.permissions.deleteStudents;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Students</h1>
          <p className="text-slate-500">Manage student records and class assignments</p>
        </div>
        {canAdd && (
          <button 
            onClick={() => {
              setEditingStudent(null);
              setFormData({ name: '', phone: '', email: '', tempPassword: '', rollNumber: '', classId: '', status: 'active' });
              setIsModalOpen(true);
            }}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-4 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100"
          >
            <Plus className="w-5 h-5" />
            Add Student
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search by name or roll no..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
        >
          <option value="all">All Classes</option>
          {classes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select 
          className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="active">Active</option>
          <option value="left">Left</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Students Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Roll No</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Login</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Joined</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStudents.map((student) => (
                <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="font-mono text-sm font-semibold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">
                      {student.rollNumber}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        {student.joinedAt && isAfter(new Date(student.joinedAt), subDays(new Date(), 7)) && (
                          <span className="px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded uppercase tracking-wider animate-pulse">
                            New
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">{student.phone || 'No phone'}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-600">
                    {classes.find(b => b.id === student.classId || b.name === student.classId)?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    {student.email ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          {student.uid ? (
                            <span className="flex items-center gap-1 text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full w-fit">
                              <ShieldCheck className="w-3 h-3" /> Linked
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-medium text-amber-600 bg-amber-50 px-2 py-1 rounded-full w-fit">
                              <Mail className="w-3 h-3" /> Pending
                            </span>
                          )}
                        </div>
                        {(profile.role === 'admin' || profile.permissions.createStudentLogin) && (
                          <div className="space-y-0.5">
                            <p className="text-[10px] text-slate-500 truncate max-w-[120px]" title={student.email}>
                              {student.email}
                            </p>
                            {student.tempPassword && (
                              <p className="text-[10px] font-mono font-bold text-indigo-600">
                                Pass: {student.tempPassword}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-slate-400 italic">No login</span>
                        {(profile.role === 'admin' || profile.permissions.createStudentLogin) && (
                          <button 
                            onClick={() => handleGenerateLogin(student)}
                            className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 underline text-left"
                          >
                            Create Login
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                      student.status === 'active' ? "bg-green-50 text-green-700" :
                      student.status === 'left' ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-700"
                    )}>
                      {student.status === 'active' ? <CheckCircle2 className="w-3 h-3" /> :
                       student.status === 'left' ? <XCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                      {student.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">
                    {format(new Date(student.joinedAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {profile.role === 'admin' && (
                        <button 
                          onClick={() => onImpersonate({
                            uid: student.uid || student.id,
                            name: student.name,
                            email: student.email || '',
                            role: 'student',
                            status: 'active',
                            assignedClassIds: [student.classId],
                            permissions: {
                              viewDashboard: true,
                              viewStudents: true,
                              addStudents: false,
                              editStudents: false,
                              deleteStudents: false,
                              viewClasses: true,
                              manageClasses: false,
                              markTodayAttendance: false,
                              editTodayAttendance: false,
                              viewAttendanceHistory: true,
                              managePastAttendance: false,
                              useUnifiedMode: false,
                              manageFees: false,
                              viewReports: false,
                              exportReports: false,
                              manageTeachers: false,
                              createStudentLogin: false,
                              manageOffDays: false,
                              manageFinance: false,
                              manageTimetable: false,
                            }
                          })}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="Login As Student"
                        >
                          <UserCircle className="w-4 h-4" />
                        </button>
                      )}
                      {canEdit && (
                        <button 
                          onClick={() => {
                            setEditingStudent(student);
                            setFormData({
                              name: student.name,
                              phone: student.phone || '',
                              email: student.email || '',
                              tempPassword: student.tempPassword || '',
                              rollNumber: student.rollNumber,
                              classId: student.classId,
                              status: student.status
                            });
                            setIsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={() => handleDelete(student.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  {editingStudent ? 'Edit Student' : 'Add New Student'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Roll Number</label>
                    <input 
                      required
                      type="text" 
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.rollNumber}
                      onChange={(e) => setFormData({...formData, rollNumber: e.target.value})}
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
                  { (profile.role === 'admin' || profile.permissions.createStudentLogin) && (
                    <div className="col-span-2 space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-medium text-slate-700">Student Login Credentials</label>
                        <button 
                          type="button"
                          disabled={!formData.rollNumber}
                          onClick={() => {
                            const tempEmail = `${formData.rollNumber.toLowerCase()}@academy.com`;
                            const tempPass = `academy${formData.rollNumber}`;
                            setFormData({
                              ...formData,
                              email: tempEmail,
                              tempPassword: tempPass
                            });
                          }}
                          className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Plus className="w-3 h-3" /> Generate Temporary Login
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="email" 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Student Email"
                            value={formData.email}
                            onChange={(e) => setFormData({...formData, email: e.target.value})}
                          />
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                          <input 
                            type="text" 
                            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Temporary Password"
                            value={formData.tempPassword}
                            onChange={(e) => setFormData({...formData, tempPassword: e.target.value})}
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-slate-400 italic">
                        * Give these credentials to the student. They should use "Login" with this email and password.
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Class</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.classId}
                      onChange={(e) => setFormData({...formData, classId: e.target.value})}
                    >
                      <option value="">Select Class</option>
                      {classes.map(b => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.timing ? `(${b.timing})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select 
                      required
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                    >
                      <option value="active">Active</option>
                      <option value="left">Left</option>
                      <option value="completed">Completed</option>
                    </select>
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
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    {editingStudent ? 'Update' : 'Save'}
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
                <h3 className="text-xl font-bold">Delete Student?</h3>
              </div>
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this student? This action cannot be undone and will remove all their records.
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
                  Delete Student
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
