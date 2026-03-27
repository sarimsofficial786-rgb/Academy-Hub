import React, { useState, useEffect } from 'react';
import { 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  where, 
  deleteDoc, 
  doc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Student, Class, Permissions } from '../types';
import { 
  Database, 
  Users, 
  ShieldCheck, 
  Trash2, 
  Plus, 
  Loader2, 
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  CalendarCheck,
  CreditCard
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, subDays, startOfMonth } from 'date-fns';

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

export default function FakeDataView({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [stats, setStats] = useState({ students: 0, teachers: 0, classes: 0, attendance: 0, fees: 0 });

  useEffect(() => {
    const unsubscribeClasses = onSnapshot(collection(db, 'classes'), (snapshot) => {
      setClasses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class)));
      setStats(prev => ({ ...prev, classes: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    const unsubscribeStudents = onSnapshot(collection(db, 'students'), (snapshot) => {
      setStudents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setStats(prev => ({ ...prev, students: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'students');
    });

    const unsubscribeTeachers = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
      setStats(prev => ({ ...prev, teachers: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    const unsubscribeAttendance = onSnapshot(collection(db, 'attendance'), (snapshot) => {
      setStats(prev => ({ ...prev, attendance: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'attendance');
    });

    const unsubscribeFees = onSnapshot(collection(db, 'fees'), (snapshot) => {
      setStats(prev => ({ ...prev, fees: snapshot.size }));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'fees');
    });

    return () => {
      unsubscribeClasses();
      unsubscribeStudents();
      unsubscribeTeachers();
      unsubscribeAttendance();
      unsubscribeFees();
    };
  }, []);

  const generateFakeClass = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const classNames = ['Morning Math', 'Evening Physics', 'Weekend Chemistry', 'Advanced English', 'Computer Science'];
      const timings = ['10:00 AM - 11:30 AM', '04:00 PM - 05:30 PM', '09:00 AM - 12:00 PM', '02:00 PM - 03:30 PM', '06:00 PM - 07:30 PM'];
      
      const idx = Math.floor(Math.random() * classNames.length);
      await addDoc(collection(db, 'classes'), {
        name: classNames[idx],
        timing: timings[idx],
        monthlyFee: 2500 + (Math.floor(Math.random() * 5) * 500),
        subjects: ['Math', 'Physics', 'Chemistry', 'English', 'CS'].slice(0, idx + 1),
        offDays: ['Sunday'],
        createdAt: new Date().toISOString()
      });
      setMessage({ type: 'success', text: 'Successfully created a sample class!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to create class.' });
      handleFirestoreError(error, OperationType.CREATE, 'classes');
    } finally {
      setLoading(false);
    }
  };

  const generateFakeStudents = async () => {
    setMessage(null);
    if (classes.length === 0) {
      setMessage({ type: 'error', text: 'Please create at least one class first!' });
      return;
    }
    setLoading(true);
    try {
      const firstNames = ['Ahmad', 'Fatima', 'Zain', 'Sara', 'Ali', 'Ayesha', 'Hamza', 'Hiba', 'Bilal', 'Zoya', 'Umar', 'Noor', 'Hassan', 'Sana'];
      const lastNames = ['Khan', 'Ahmed', 'Malik', 'Sheikh', 'Iqbal', 'Shah', 'Butt', 'Raza', 'Ghani', 'Lodhi'];
      
      const batch = writeBatch(db);
      for (let i = 0; i < 10; i++) {
        const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
        const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
        const rollNum = `S${Math.floor(1000 + Math.random() * 9000)}`;
        const targetClass = classes[Math.floor(Math.random() * classes.length)];
        const email = `${rollNum.toLowerCase()}@academy.com`;

        const studentRef = doc(collection(db, 'students'));
        batch.set(studentRef, {
          name: `${firstName} ${lastName}`,
          rollNumber: rollNum,
          phone: `03${Math.floor(100000000 + Math.random() * 900000000)}`,
          email: email,
          tempPassword: `academy${rollNum}`,
          classId: targetClass.id,
          status: 'active',
          joinedAt: new Date().toISOString()
        });
      }
      await batch.commit();
      setMessage({ type: 'success', text: 'Successfully added 10 fake students!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add students.' });
      handleFirestoreError(error, OperationType.CREATE, 'students');
    } finally {
      setLoading(false);
    }
  };

  const generateFakeAttendance = async () => {
    setMessage(null);
    if (students.length === 0) {
      setMessage({ type: 'error', text: 'Please add students first!' });
      return;
    }
    setLoading(true);
    try {
      const today = new Date();
      const statuses: ('present' | 'absent' | 'leave')[] = ['present', 'present', 'present', 'present', 'absent', 'leave'];
      
      // Generate attendance for the last 7 days
      for (let i = 0; i < 7; i++) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        
        // Group students by class
        const classGroups: Record<string, Student[]> = {};
        students.forEach(s => {
          if (!classGroups[s.classId]) classGroups[s.classId] = [];
          classGroups[s.classId].push(s);
        });

        // Use a new batch for each day to stay within 500 operations limit
        const firestoreBatch = writeBatch(db);

        for (const classId in classGroups) {
          const classStudents = classGroups[classId];
          
          // 1. Create master attendance record
          const attendanceId = `${classId}_${dateStr}`;
          const attendanceRef = doc(db, 'attendance', attendanceId);
          firestoreBatch.set(attendanceRef, {
            date: dateStr,
            classId: classId,
            markedBy: profile.uid,
            markedAt: new Date().toISOString()
          }, { merge: true });

          // 2. Create individual records
          classStudents.forEach(s => {
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const recordId = `${s.id}_${dateStr}`;
            const recordRef = doc(db, 'attendance_records', recordId);
            firestoreBatch.set(recordRef, {
              studentId: s.id,
              status,
              date: dateStr,
              classId: s.classId
            }, { merge: true });
          });
        }
        await firestoreBatch.commit();
      }
      setMessage({ type: 'success', text: 'Successfully generated 7 days of attendance!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate attendance.' });
      handleFirestoreError(error, OperationType.CREATE, 'attendance');
    } finally {
      setLoading(false);
    }
  };

  const generateFakeFees = async () => {
    setMessage(null);
    if (students.length === 0) {
      setMessage({ type: 'error', text: 'Please add students first!' });
      return;
    }
    setLoading(true);
    try {
      const currentMonth = format(new Date(), 'yyyy-MM');
      const batch = writeBatch(db);
      
      for (const student of students) {
        const studentClass = classes.find(b => b.id === student.classId);
        const totalAmount = studentClass?.monthlyFee || 2500;
        
        // Randomly decide if fee is paid (80% chance)
        if (Math.random() > 0.2) {
          const isFull = Math.random() > 0.3;
          const paidAmount = isFull ? totalAmount : Math.floor(totalAmount / 2);
          const remaining = totalAmount - paidAmount;
          const status = remaining <= 0 ? 'paid' : 'partial';
          
          const feeId = `${student.id}_${currentMonth}`;
          const feeRef = doc(db, 'fees', feeId);
          
          batch.set(feeRef, {
            studentId: student.id,
            classId: student.classId,
            month: currentMonth,
            totalAmount,
            paidAmount,
            remaining,
            status,
            lastPaymentAt: new Date().toISOString(),
            receivedBy: profile.uid,
            notes: 'Mock payment generated for testing'
          }, { merge: true });
        }
      }
      await batch.commit();
      setMessage({ type: 'success', text: 'Successfully generated fee records for current month!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to generate fees.' });
      handleFirestoreError(error, OperationType.CREATE, 'fees');
    } finally {
      setLoading(false);
    }
  };

  const generateFakeTeachers = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const teacherNames = ['Sir Kashif', 'Miss Anum', 'Sir Rizwan', 'Miss Hina', 'Sir Adnan'];
      const teacherEmails = ['kashif@academy.com', 'anum@academy.com', 'rizwan@academy.com', 'hina@academy.com', 'adnan@academy.com'];

      for (let i = 0; i < 3; i++) {
        const idx = Math.floor(Math.random() * teacherNames.length);
        await addDoc(collection(db, 'users'), {
          uid: '', // Pre-created
          name: teacherNames[idx],
          email: teacherEmails[idx],
          phone: `0300${Math.floor(1000000 + Math.random() * 9000000)}`,
          role: 'teacher',
          status: 'active',
          tempPassword: 'password123',
          assignedClassIds: classes.slice(0, 2).map(b => b.id),
          permissions: DEFAULT_TEACHER_PERMISSIONS
        });
      }
      setMessage({ type: 'success', text: 'Successfully added 3 fake teachers!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to add teachers.' });
      handleFirestoreError(error, OperationType.CREATE, 'users');
    } finally {
      setLoading(false);
    }
  };

  const clearAllData = async () => {
    setMessage(null);
    setLoading(true);
    try {
      const collections = ['students', 'attendance', 'attendance_records', 'fees', 'classes'];
      for (const coll of collections) {
        const snap = await getDocs(collection(db, coll));
        const batch = writeBatch(db);
        snap.docs.forEach(d => {
          batch.delete(doc(db, coll, d.id));
        });
        await batch.commit();
      }

      const teacherSnap = await getDocs(query(collection(db, 'users'), where('role', '==', 'teacher')));
      const teacherBatch = writeBatch(db);
      teacherSnap.docs.forEach(d => {
        teacherBatch.delete(doc(db, 'users', d.id));
      });
      await teacherBatch.commit();
      
      setMessage({ type: 'success', text: 'All mock data cleared successfully!' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to clear data.' });
      handleFirestoreError(error, OperationType.DELETE, 'bulk_clear');
    } finally {
      setLoading(false);
    }
  };

  if (profile.role !== 'admin') {
    return (
      <div className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900">Access Denied</h2>
        <p className="text-slate-500">Only administrators can access the seed data panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center">
          <Database className="w-7 h-7 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Seed Data Panel</h1>
          <p className="text-slate-500">Quickly populate your academy with mock records for testing</p>
        </div>
      </div>

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-4 rounded-xl flex items-center gap-3 border ${
            message.type === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-700' : 
            message.type === 'error' ? 'bg-red-50 border-red-100 text-red-700' :
            'bg-blue-50 border-blue-100 text-blue-700'
          }`}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          <p className="font-medium">{message.text}</p>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Statistics */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Current Statistics</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <p className="text-xs text-indigo-600 font-bold uppercase">Students</p>
              <p className="text-2xl font-black text-indigo-900">{stats.students}</p>
            </div>
            <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100">
              <p className="text-xs text-emerald-600 font-bold uppercase">Teachers</p>
              <p className="text-2xl font-black text-emerald-900">{stats.teachers}</p>
            </div>
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100">
              <p className="text-xs text-amber-600 font-bold uppercase">Classes</p>
              <p className="text-2xl font-black text-amber-900">{stats.classes}</p>
            </div>
            <div className="p-4 bg-rose-50 rounded-xl border border-rose-100">
              <p className="text-xs text-rose-600 font-bold uppercase">Attendance</p>
              <p className="text-2xl font-black text-rose-900">{stats.attendance}</p>
            </div>
            <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 col-span-2">
              <p className="text-xs text-blue-600 font-bold uppercase">Fee Records</p>
              <p className="text-2xl font-black text-blue-900">{stats.fees}</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <h3 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-wider">Quick Actions</h3>
          <div className="space-y-3">
            <div className="flex gap-3">
              <button 
                onClick={generateFakeClass}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-amber-600 text-white font-bold py-3 rounded-xl hover:bg-amber-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <BookOpen className="w-5 h-5" />}
                + Class
              </button>
              <button 
                onClick={generateFakeStudents}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Users className="w-5 h-5" />}
                + 10 Students
              </button>
            </div>
            
            <div className="flex gap-3">
              <button 
                onClick={generateFakeAttendance}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-rose-600 text-white font-bold py-3 rounded-xl hover:bg-rose-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CalendarCheck className="w-5 h-5" />}
                + 7d Attendance
              </button>
              <button 
                onClick={generateFakeFees}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <CreditCard className="w-5 h-5" />}
                + Monthly Fees
              </button>
            </div>

            <button 
              onClick={generateFakeTeachers}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Add 3 Teachers
            </button>
            
            <button 
              onClick={clearAllData}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-red-50 text-red-600 font-bold py-3 rounded-xl hover:bg-red-100 transition-all border border-red-100"
            >
              <Trash2 className="w-5 h-5" />
              Clear All Mock Data
            </button>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 p-6 rounded-2xl">
        <div className="flex gap-4">
          <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
          <div>
            <h4 className="font-bold text-amber-900">Important Note</h4>
            <p className="text-sm text-amber-800 mt-1">
              Generating fake data helps you see how the app looks with real records. 
              Attendance will be generated for the last 7 days for all students.
              Fees will be marked as paid for 80% of students for the current month.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
