import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  doc,
  getDoc,
  updateDoc,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Class, AttendanceRecord, Fee, UserProfile } from '../types';
import { 
  LayoutDashboard, 
  CalendarCheck, 
  CreditCard, 
  BookOpen, 
  UserCircle,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  Users,
  BarChart3,
  Settings,
  Search,
  Mail,
  Phone,
  Download,
  PieChart as PieChartIcon
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, subDays, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths } from 'date-fns';
import { cn } from '../lib/utils';
import TimetableView from './TimetableView';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
  PieChart,
  Pie,
  Legend
} from 'recharts';

interface StudentPanelProps {
  profile: UserProfile;
  activeTab?: string;
}

export default function StudentPanel({ profile, activeTab }: StudentPanelProps) {
  const [student, setStudent] = useState<Student | null>(null);
  const [cls, setCls] = useState<Class | null>(null);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'dashboard' | 'classes' | 'attendance' | 'timetable' | 'fees' | 'reports' | 'settings'>('dashboard');

  useEffect(() => {
    if (activeTab && ['dashboard', 'classes', 'attendance', 'timetable', 'fees', 'reports', 'settings'].includes(activeTab)) {
      setActiveSubTab(activeTab as any);
    }
  }, [activeTab]);

  const fetchStudentData = async () => {
    setLoading(true);
    try {
      // 1. Find the student record associated with this UID
      let sQuery = query(collection(db, 'students'), where('uid', '==', profile.uid));
      let sSnapshot = await getDocs(sQuery);
      
      // 1.1 If not found by UID, try to find by email (auto-link)
      if (sSnapshot.empty && profile.email) {
        const emailQuery = query(collection(db, 'students'), where('email', '==', profile.email));
        const emailSnapshot = await getDocs(emailQuery);
        
        if (!emailSnapshot.empty) {
          const docToLink = emailSnapshot.docs[0];
          const data = docToLink.data();
          
          // Only link if UID is not already set to someone else
          if (!data.uid && profile.uid) {
            await updateDoc(doc(db, 'students', docToLink.id), {
              uid: profile.uid
            });
            // Also update users document to include studentId and classId for security rules
            // Use setDoc with merge: true to ensure the document exists
            await setDoc(doc(db, 'users', profile.uid), {
              studentId: docToLink.id,
              assignedClassIds: [data.classId]
            }, { merge: true });
            // Re-fetch now that it's linked
            sSnapshot = await getDocs(sQuery);
          }
        }
      }

      if (!sSnapshot.empty) {
        const sData = { id: sSnapshot.docs[0].id, ...sSnapshot.docs[0].data() } as Student;
        setStudent(sData);

        // 2. Fetch Class
        if (sData.classId) {
          try {
            const bDoc = await getDoc(doc(db, 'classes', sData.classId));
            if (bDoc.exists()) setCls({ id: bDoc.id, ...bDoc.data() } as Class);
          } catch (err) {
            handleFirestoreError(err, OperationType.GET, `classes/${sData.classId}`);
          }
        }

        // 3. Fetch Attendance
        const aUnsubscribe = onSnapshot(query(collection(db, 'attendance_records'), where('studentId', '==', sData.id)), (snapshot) => {
          setAttendance(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'attendance_records');
        });

        // 4. Fetch Fees
        const fUnsubscribe = onSnapshot(query(collection(db, 'fees'), where('studentId', '==', sData.id)), (snapshot) => {
          setFees(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fee)));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'fees');
        });

        // 5. Fetch Teachers
        const tUnsubscribe = onSnapshot(query(collection(db, 'users'), where('role', '==', 'teacher')), (snapshot) => {
          setTeachers(snapshot.docs.map(doc => ({ ...doc.data(), uid: doc.id } as UserProfile)));
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, 'users');
        });

        setLoading(false);
        return () => {
          aUnsubscribe();
          fUnsubscribe();
          tUnsubscribe();
        };
      } else {
        setLoading(false);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, 'students');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudentData();
  }, [profile.uid]);

  if (loading) return <div className="p-12 text-center">Loading your data...</div>;
  if (!student) return (
    <div className="max-w-md mx-auto p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm mt-12">
      <div className="w-16 h-16 bg-slate-50 text-slate-200 rounded-full flex items-center justify-center mx-auto mb-6">
        <UserCircle className="w-10 h-10" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-2">Student Profile Not Linked</h2>
      <p className="text-slate-500 mb-8">
        Your account ({profile.email}) is not yet linked to a student record. 
        Please contact your academy admin to link your profile.
      </p>
      <div className="space-y-3">
        <button 
          onClick={() => fetchStudentData()}
          className="w-full py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
        >
          Check Again
        </button>
        <p className="text-xs text-slate-400">
          Tip: If you are an admin, go to "Seed Data" and click "Add 8 Students" to generate test data that includes your email.
        </p>
      </div>
    </div>
  );

  const presentCount = attendance.filter(r => r.status === 'present').length;
  const totalAttendance = attendance.length;
  const attendancePercentage = totalAttendance > 0 ? Math.round((presentCount / totalAttendance) * 100) : 0;

  const currentMonth = format(new Date(), 'yyyy-MM');
  const currentFee = fees.find(f => f.month === currentMonth);

  const renderDashboard = () => (
    <div className="space-y-8">
      {/* Welcome Banner */}
      <div className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 rounded-[2.5rem] p-10 text-white shadow-2xl shadow-indigo-200/50">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/30">
                <UserCircle className="w-8 h-8 text-white" />
              </div>
              <span className="px-3 py-1 bg-white/10 backdrop-blur-md text-white text-[10px] font-black rounded-full uppercase tracking-[0.2em] border border-white/20">Student Dashboard</span>
            </div>
            <h2 className="text-4xl font-black mb-3 tracking-tight">Hello, {student.name}! 👋</h2>
            <p className="text-indigo-100 max-w-md text-lg font-medium leading-relaxed">
              Welcome back! You're doing great with <span className="text-white font-black underline decoration-indigo-400 underline-offset-4">{attendancePercentage}%</span> attendance this month.
            </p>
          </div>

          <div className="flex flex-col items-center md:items-end">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-[2rem] p-6 flex flex-col items-center justify-center min-w-[160px]">
              <p className="text-[10px] font-black text-indigo-200 uppercase tracking-[0.2em] mb-1">Roll Number</p>
              <p className="text-5xl font-black text-white tracking-tighter drop-shadow-lg">{student.rollNumber}</p>
            </div>
          </div>
        </div>
        <div className="absolute top-0 right-0 -mt-12 -mr-12 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-indigo-400/20 rounded-full blur-2xl" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-sm">
              <CalendarCheck className="w-7 h-7" />
            </div>
            <div className="flex flex-col items-end">
              <span className={cn(
                "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
                attendancePercentage > 75 ? "bg-green-50 text-green-600 border-green-100" : "bg-red-50 text-red-600 border-red-100"
              )}>
                {attendancePercentage}% Rate
              </span>
            </div>
          </div>
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Attendance</h3>
          <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">{presentCount} <span className="text-lg font-bold text-slate-300">/ {totalAttendance}</span></p>
          <div className="mt-6 w-full bg-slate-100 h-2 rounded-full overflow-hidden p-0.5">
            <div 
              className={cn("h-full rounded-full transition-all duration-1000 ease-out", attendancePercentage > 75 ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-red-400 to-orange-500")} 
              style={{ width: `${attendancePercentage}%` }} 
            />
          </div>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100 shadow-sm">
              <CreditCard className="w-7 h-7" />
            </div>
            <span className={cn(
              "text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest border",
              currentFee?.status === 'paid' ? "bg-green-50 text-green-600 border-green-100" : "bg-amber-50 text-amber-600 border-amber-100"
            )}>
              {currentFee?.status || 'UNPAID'}
            </span>
          </div>
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Current Fee</h3>
          <p className="text-3xl font-black text-slate-900 mt-1 tracking-tight">${currentFee?.paidAmount || 0} <span className="text-lg font-bold text-slate-300">/ ${currentFee?.totalAmount || cls?.monthlyFee}</span></p>
          <p className="text-xs font-bold text-slate-400 mt-3 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Due: {currentFee?.month ? format(new Date(currentFee.month + '-10'), 'MMM d, yyyy') : 'N/A'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center justify-between mb-6">
            <div className="p-4 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 shadow-sm">
              <BookOpen className="w-7 h-7" />
            </div>
          </div>
          <h3 className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">My Class</h3>
          <p className="text-3xl font-black text-slate-900 mt-1 truncate tracking-tight">{cls?.name || 'Loading...'}</p>
          <div className="flex items-center gap-2 text-xs font-bold text-slate-500 mt-3 bg-slate-50 w-fit px-3 py-1 rounded-lg border border-slate-100">
            <Clock className="w-3 h-3 text-purple-500" />
            {cls?.timing}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Attendance */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Attendance</h3>
              <p className="text-sm text-slate-400 font-medium">Your last few days of presence</p>
            </div>
            <button onClick={() => setActiveSubTab('attendance')} className="text-sm text-indigo-600 font-black hover:underline uppercase tracking-widest">View All</button>
          </div>
          <div className="space-y-4">
            {attendance.slice(-5).reverse().map((record) => (
              <div key={record.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform",
                    record.status === 'present' ? "bg-green-100 text-green-600 border border-green-200" :
                    record.status === 'absent' ? "bg-red-100 text-red-600 border border-red-200" : "bg-amber-100 text-amber-600 border border-amber-200"
                  )}>
                    {record.status === 'present' ? <CheckCircle2 className="w-6 h-6" /> :
                     record.status === 'absent' ? <XCircle className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{format(new Date(record.date), 'MMMM d, yyyy')}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                      {record.status} • {record.subject || 'General'}
                      {record.teacherId && ` • ${teachers.find(t => t.uid === record.teacherId || t.email === record.teacherId)?.name || 'Unknown'}`}
                    </p>
                  </div>
                </div>
                <div className="text-xs font-black text-slate-400 bg-white px-3 py-1 rounded-lg border border-slate-100">
                  {format(new Date(record.date), 'EEEE')}
                </div>
              </div>
            ))}
            {attendance.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <CalendarCheck className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">No attendance records found.</p>
              </div>
            )}
          </div>
        </div>

        {/* Fee History */}
        <div className="bg-white p-8 rounded-[2rem] border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">Recent Fees</h3>
              <p className="text-sm text-slate-400 font-medium">Your payment status overview</p>
            </div>
            <button onClick={() => setActiveSubTab('fees')} className="text-sm text-indigo-600 font-black hover:underline uppercase tracking-widest">View All</button>
          </div>
          <div className="space-y-4">
            {fees.slice(-5).reverse().map((fee) => (
              <div key={fee.id} className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 hover:shadow-lg transition-all duration-300 group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-200 flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-base font-black text-slate-900">{format(new Date(fee.month + '-01'), 'MMMM yyyy')}</p>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Paid: ${fee.paidAmount} / ${fee.totalAmount}</p>
                  </div>
                </div>
                <div className={cn(
                  "px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border shadow-sm",
                  fee.status === 'paid' ? "bg-green-50 text-green-700 border-green-200" :
                  fee.status === 'partial' ? "bg-amber-50 text-amber-700 border-amber-200" : "bg-red-50 text-red-700 border-red-200"
                )}>
                  {fee.status}
                </div>
              </div>
            ))}
            {fees.length === 0 && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <CreditCard className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                <p className="text-slate-400 font-bold">No fee records found.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStudents = () => (
    <div className="space-y-8">
      {/* My Profile Card */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden transition-all hover:shadow-xl hover:shadow-indigo-50/50">
        <div className="h-40 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 relative">
          <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]" />
          <div className="absolute top-0 right-0 p-8 opacity-20">
            <Users className="w-32 h-32 text-white rotate-12" />
          </div>
        </div>
        <div className="px-10 pb-10">
          <div className="relative -mt-20 mb-8">
            <div className="w-40 h-40 bg-white rounded-[2rem] p-2 shadow-2xl shadow-indigo-200/50">
              <div className="w-full h-full bg-slate-50 rounded-[1.5rem] flex items-center justify-center text-indigo-200 border border-slate-100">
                <UserCircle className="w-24 h-24" />
              </div>
            </div>
            <div className="absolute bottom-2 right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-lg" />
          </div>
          
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="space-y-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h3 className="text-4xl font-black text-slate-900 tracking-tight">{student.name}</h3>
                  <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-full uppercase tracking-widest border border-indigo-100">Verified Student</span>
                </div>
                <p className="text-slate-500 font-semibold text-xl flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-indigo-500" />
                  {cls?.name} Class
                </p>
              </div>
              
              <div className="flex flex-wrap gap-6 pt-2">
                <div className="flex items-center gap-3 group">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100">
                    <Mail className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email Address</p>
                    <p className="text-sm font-bold text-slate-700">{student.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 group">
                  <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-all border border-slate-100">
                    <Phone className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Phone Number</p>
                    <p className="text-sm font-bold text-slate-700">{student.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-row gap-4">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative px-8 py-5 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Roll Number</p>
                  <p className="text-3xl font-black text-indigo-600 tracking-tighter">{student.rollNumber}</p>
                </div>
              </div>

              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-500 to-emerald-500 rounded-3xl blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <div className="relative px-8 py-5 bg-white rounded-3xl border border-slate-100 flex flex-col items-center justify-center min-w-[140px]">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">Status</p>
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <p className="text-2xl font-black text-green-600 uppercase tracking-tight">{student.status}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderClasses = () => (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm overflow-hidden relative">
        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-bl-full -mr-16 -mt-16 z-0" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
              <BookOpen className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">Class Information</h3>
              <p className="text-sm text-slate-500">Details about your current enrollment</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="group">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 group-hover:text-indigo-500 transition-colors">Class Name</p>
                <p className="text-2xl font-bold text-slate-900">{cls?.name}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Class Timing</p>
                  <div className="flex items-center gap-2 text-slate-700 font-semibold">
                    <Clock className="w-4 h-4 text-indigo-500" />
                    {cls?.timing}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Monthly Fee</p>
                  <div className="flex items-center gap-2 text-slate-900 font-bold text-lg">
                    <div className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">
                      $
                    </div>
                    {cls?.monthlyFee}
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-8">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Subjects & Teachers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cls?.subjects?.map((s, idx) => {
                    const teacherId = student?.subjectTeacherMap?.[s] || cls?.subjectTeacherMap?.[s];
                    const teacher = teachers.find(t => t.uid === teacherId || t.email === teacherId);
                    return (
                      <div key={`${s}-${idx}`} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 hover:bg-white transition-all group">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                            <BookOpen className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900">{s}</p>
                            <p className="text-[10px] text-slate-500 font-medium italic">
                              {teacher ? `Teacher: ${teacher.name}` : 'Teacher: Not Assigned'}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Off Days</p>
                <div className="flex flex-wrap gap-2">
                  {cls?.offDays?.map((d, idx) => (
                    <span key={`${d}-${idx}`} className="px-4 py-2 bg-red-50 text-red-600 text-sm font-bold rounded-xl border border-red-100">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Support Card */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-8 rounded-3xl text-white flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="max-w-md">
          <h4 className="text-xl font-bold mb-2">Need to change your class?</h4>
          <p className="text-slate-400 text-sm">If you wish to switch to a different timing or subject group, please contact the administration office.</p>
        </div>
        <button className="px-8 py-3 bg-white text-slate-900 font-bold rounded-2xl hover:bg-slate-100 transition-all whitespace-nowrap">
          Request Change
        </button>
      </div>
    </div>
  );

  const renderAttendance = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Attendance History</h3>
            <p className="text-sm text-slate-500">Track your daily presence and consistency</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Present</p>
              <p className="text-lg font-bold text-green-600">{presentCount}</p>
            </div>
            <div className="w-px h-8 bg-slate-100" />
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total</p>
              <p className="text-lg font-bold text-slate-900">{totalAttendance}</p>
            </div>
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Date</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Subject</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teacher</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Day</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {attendance.slice().reverse().map((record) => (
                <tr key={record.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-5 px-8">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 rounded-xl flex flex-col items-center justify-center group-hover:bg-white transition-colors">
                        <span className="text-[8px] font-bold text-slate-400 uppercase">{format(new Date(record.date), 'MMM')}</span>
                        <span className="text-sm font-bold text-slate-900">{format(new Date(record.date), 'd')}</span>
                      </div>
                      <span className="text-sm font-bold text-slate-900">{format(new Date(record.date), 'yyyy')}</span>
                    </div>
                  </td>
                  <td className="py-5 px-8 text-sm font-bold text-slate-700">
                    {record.subject || 'General'}
                  </td>
                  <td className="py-5 px-8 text-sm font-medium text-slate-500">
                    {teachers.find(t => t.uid === record.teacherId || t.email === record.teacherId)?.name || 'Not Assigned'}
                  </td>
                  <td className="py-5 px-8 text-sm font-medium text-slate-500">
                    {format(new Date(record.date), 'EEEE')}
                  </td>
                  <td className="py-5 px-8 text-right">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      record.status === 'present' ? "bg-green-50 text-green-600 border border-green-100" :
                      record.status === 'absent' ? "bg-red-50 text-red-600 border border-red-100" : 
                      "bg-amber-50 text-amber-600 border border-amber-100"
                    )}>
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        record.status === 'present' ? "bg-green-500" :
                        record.status === 'absent' ? "bg-red-500" : "bg-amber-500"
                      )} />
                      {record.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {attendance.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CalendarCheck className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-500 font-medium">No attendance records found yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderFees = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Fee Records</h3>
            <p className="text-sm text-slate-500">Manage and view your payment history</p>
          </div>
          <div className="p-3 bg-green-50 text-green-600 rounded-2xl border border-green-100">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Billing Month</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Amount Details</th>
                <th className="py-4 px-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {fees.slice().reverse().map((fee) => (
                <tr key={fee.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="py-6 px-8">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-all">
                        <CalendarCheck className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-slate-900">{format(new Date(fee.month + '-01'), 'MMMM yyyy')}</p>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Invoice #{fee.id.slice(-6).toUpperCase()}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-8">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">${fee.paidAmount}</span>
                        <span className="text-xs text-slate-400">paid of</span>
                        <span className="text-sm font-bold text-slate-900">${fee.totalAmount}</span>
                      </div>
                      <div className="w-32 bg-slate-100 h-1 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500" 
                          style={{ width: `${(fee.paidAmount / fee.totalAmount) * 100}%` }} 
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-6 px-8 text-right">
                    <span className={cn(
                      "inline-flex items-center px-4 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest",
                      fee.status === 'paid' ? "bg-green-100 text-green-700" :
                      fee.status === 'partial' ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                    )}>
                      {fee.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {fees.length === 0 && (
            <div className="py-20 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <CreditCard className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-500 font-medium">No fee records found yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderReports = () => {
    // Process attendance data for chart
    const last6Months = eachMonthOfInterval({
      start: subMonths(new Date(), 5),
      end: new Date()
    });

    const attendanceChartData = last6Months.map(monthDate => {
      const monthStr = format(monthDate, 'yyyy-MM');
      const monthLabel = format(monthDate, 'MMM');
      const monthRecords = attendance.filter(r => r.date.startsWith(monthStr));
      const present = monthRecords.filter(r => r.status === 'present').length;
      const total = monthRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      return {
        name: monthLabel,
        percentage,
        total,
        present
      };
    });

    // Process fee data for summary
    const totalPaid = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const totalDue = fees.reduce((sum, f) => sum + f.totalAmount, 0);
    const feePercentage = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

    const feePieData = [
      { name: 'Paid', value: totalPaid, color: '#4f46e5' },
      { name: 'Remaining', value: Math.max(0, totalDue - totalPaid), color: '#e2e8f0' }
    ];

    // Subject-wise breakdown
    const subjectStats = (cls?.subjects || []).map(subject => {
      const subjectRecords = attendance.filter(r => r.subject === subject);
      const present = subjectRecords.filter(r => r.status === 'present').length;
      const total = subjectRecords.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      return { subject, present, total, percentage };
    }).filter(s => s.total > 0);

    return (
      <div className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Academic Performance Report</h3>
            <p className="text-sm text-slate-500">Comprehensive overview of your progress and standing</p>
          </div>
          <button 
            onClick={() => {
              const csvContent = "data:text/csv;charset=utf-8," 
                + "Type,Name,Value\n"
                + attendanceChartData.map(d => `Monthly Attendance,${d.name},${d.percentage}%`).join("\n")
                + "\n"
                + subjectStats.map(s => `Subject Attendance,${s.subject},${s.percentage}%`).join("\n")
                + "\n"
                + `Fees,Total Paid,$${totalPaid}\n`
                + `Fees,Total Due,$${totalDue}`;
              const encodedUri = encodeURI(csvContent);
              const link = document.createElement("a");
              link.setAttribute("href", encodedUri);
              link.setAttribute("download", `student_report_${student.rollNumber}.csv`);
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }}
            className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
          >
            <Download className="w-5 h-5" />
            Download Report
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Attendance Chart */}
          <div className="lg:col-span-2 bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-8">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-indigo-600" />
                Attendance Trend (%)
              </h4>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Last 6 Months</span>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceChartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                    dy={10}
                  />
                  <YAxis 
                    hide 
                    domain={[0, 100]}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => [`${value}%`, 'Attendance']}
                  />
                  <Bar dataKey="percentage" radius={[6, 6, 0, 0]} barSize={40}>
                    {attendanceChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.percentage >= 75 ? '#4f46e5' : '#f43f5e'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Subject-wise Breakdown */}
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Subject Breakdown
            </h4>
            <div className="space-y-6">
              {subjectStats.map((s, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-bold text-slate-700">{s.subject}</span>
                    <span className="font-black text-indigo-600">{s.percentage}%</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div 
                      className={cn("h-full rounded-full transition-all duration-1000", s.percentage >= 75 ? "bg-indigo-500" : "bg-rose-500")}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {s.present} Present / {s.total} Total
                  </p>
                </div>
              ))}
              {subjectStats.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-slate-400 text-sm font-medium">No subject-wise data available.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Fee Summary */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
            <h4 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
              <PieChartIcon className="w-5 h-5 text-indigo-600" />
              Fee Distribution
            </h4>
            <div className="h-48 w-full relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {feePieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-bold text-slate-900">{feePercentage}%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">Paid</span>
              </div>
            </div>
            <div className="mt-6 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-indigo-600" />
                  <span className="text-slate-600">Total Paid</span>
                </div>
                <span className="font-bold text-slate-900">${totalPaid}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200" />
                  <span className="text-slate-600">Remaining</span>
                </div>
                <span className="font-bold text-slate-900">${Math.max(0, totalDue - totalPaid)}</span>
              </div>
            </div>
          </div>

          {/* Detailed Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Total Classes</p>
            <p className="text-2xl font-bold text-slate-900">{totalAttendance}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <Clock className="w-3 h-3" />
              Since enrollment
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Days Present</p>
            <p className="text-2xl font-bold text-green-600">{presentCount}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="w-3 h-3" />
              Consistent learner
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Days Absent</p>
            <p className="text-2xl font-bold text-red-600">{attendance.filter(r => r.status === 'absent').length}</p>
            <div className="mt-2 flex items-center gap-1 text-xs text-red-600">
              <XCircle className="w-3 h-3" />
              Needs improvement
            </div>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Fee Status</p>
            <p className={cn(
              "text-2xl font-bold",
              feePercentage === 100 ? "text-green-600" : "text-amber-600"
            )}>
              {feePercentage === 100 ? 'Clear' : 'Pending'}
            </p>
            <div className="mt-2 flex items-center gap-1 text-xs text-slate-500">
              <CreditCard className="w-3 h-3" />
              {feePercentage}% cleared
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Personal Info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <UserCircle className="w-5 h-5 text-indigo-600" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Full Name</p>
                <p className="text-slate-900 font-black text-lg">{student.name}</p>
              </div>
              <div className="group p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100 hover:bg-white hover:border-indigo-300 transition-all">
                <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-1">Roll Number</p>
                <p className="text-indigo-600 font-black text-2xl tracking-tighter">{student.rollNumber}</p>
              </div>
              <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Email Address</p>
                <p className="text-slate-900 font-black text-lg">{student.email}</p>
              </div>
              <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Phone Number</p>
                <p className="text-slate-900 font-black text-lg">{student.phone}</p>
              </div>
              <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Joined At</p>
                <p className="text-slate-900 font-black text-lg">{format(new Date(student.joinedAt), 'MMMM d, yyyy')}</p>
              </div>
              <div className="group p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:bg-white hover:border-indigo-200 transition-all">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-1">Status</p>
                <div className="flex items-center gap-2 mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full" />
                  <span className="text-green-600 font-black text-lg uppercase tracking-tight">{student.status}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-indigo-600" />
              Educational Details
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Current Class</p>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <p className="font-bold text-slate-900">{cls?.name}</p>
                  <p className="text-sm text-slate-500">{cls?.timing}</p>
                </div>
              </div>
              <div>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-2">Subjects & Assigned Teachers</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {cls?.subjects?.map((subject, idx) => {
                    const teacherId = student?.subjectTeacherMap?.[subject] || cls?.subjectTeacherMap?.[subject];
                    const teacher = teachers.find(t => t.uid === teacherId);
                    return (
                      <div key={`settings-${subject}-${idx}`} className="px-4 py-3 bg-indigo-50/50 rounded-xl border border-indigo-100">
                        <p className="text-sm font-bold text-indigo-700">{subject}</p>
                        <p className="text-[10px] text-indigo-500 font-medium italic">
                          {teacher ? `Teacher: ${teacher.name}` : 'Teacher: Not Assigned'}
                        </p>
                      </div>
                    );
                  })}
                  {(!cls?.subjects || cls.subjects.length === 0) && (
                    <p className="text-sm text-slate-500 italic">No specific subjects listed for this class.</p>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100">
                <h4 className="text-sm font-bold text-slate-900 mb-3">Holistic Education Goals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center shrink-0">
                      <TrendingUp className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Skill Development</p>
                      <p className="text-xs text-slate-500">Focusing on practical application of concepts.</p>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center shrink-0">
                      <LayoutDashboard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900">Critical Thinking</p>
                      <p className="text-xs text-slate-500">Encouraging analytical and logical reasoning.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          <div className="bg-indigo-600 p-6 rounded-2xl text-white shadow-lg shadow-indigo-100">
            <h3 className="font-bold mb-2">Academic Support</h3>
            <p className="text-sm text-indigo-100 mb-4">Need help with your studies? Our teachers are available for extra guidance.</p>
            <button className="w-full py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-bold transition-all border border-white/20">
              Contact Support
            </button>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Upcoming Events</h3>
            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex flex-col items-center justify-center border border-slate-100 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Apr</span>
                  <span className="text-sm font-bold text-slate-900 leading-none">15</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Monthly Assessment</p>
                  <p className="text-xs text-slate-500">Class: {cls?.name}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-lg flex flex-col items-center justify-center border border-slate-100 shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Apr</span>
                  <span className="text-sm font-bold text-slate-900 leading-none">22</span>
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">Parent-Teacher Meeting</p>
                  <p className="text-xs text-slate-500">Online via Zoom</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 pb-12">
      {/* Header - Only show if not on dashboard (which has its own banner) */}
      {activeSubTab !== 'dashboard' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 capitalize">{activeSubTab}</h1>
            <p className="text-sm text-slate-500">View and manage your {activeSubTab} details</p>
          </div>
          <div className="flex items-center gap-4 bg-white px-6 py-3 rounded-[1.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all group">
            <div className="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform">
              {student.rollNumber.charAt(0)}
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">Student ID</p>
              <p className="text-lg font-black text-slate-900 tracking-tighter">{student.rollNumber}</p>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <motion.div
        key={activeSubTab}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
      >
        {activeSubTab === 'dashboard' && renderDashboard()}
        {activeSubTab === 'classes' && renderClasses()}
        {activeSubTab === 'timetable' && <TimetableView profile={profile} />}
        {activeSubTab === 'attendance' && renderAttendance()}
        {activeSubTab === 'fees' && renderFees()}
        {activeSubTab === 'reports' && renderReports()}
        {activeSubTab === 'settings' && renderSettings()}
      </motion.div>
    </div>
  );
}

const DollarSign = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);


