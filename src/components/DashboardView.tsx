import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  limit,
  orderBy,
  documentId
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile, Student, Class, Attendance, Fee, Expense, TimetableSlot } from '../types';
import { 
  Users, 
  UserPlus,
  Sparkles,
  CalendarCheck, 
  CreditCard, 
  BookOpen, 
  TrendingUp, 
  TrendingDown,
  AlertCircle,
  Clock,
  CheckCircle2,
  ChevronRight,
  Info,
  Wallet,
  ArrowUpRight,
  ArrowDownRight,
  MapPin
} from 'lucide-react';
import { motion } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { format, startOfMonth, endOfMonth, subDays, isAfter } from 'date-fns';

export default function DashboardView({ profile }: { profile: UserProfile }) {
  if (!profile) return null;

  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<UserProfile[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendanceData, setAttendanceData] = useState<any[]>([]);
  const [todayAttendancePct, setTodayAttendancePct] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const classIds = (profile.role === 'admin' ? [] : profile.assignedClassIds) || [];
    const isTeacher = profile.role === 'teacher';

    // 1. Classes (Fetch first to get names)
    const cQuery = isTeacher
      ? query(collection(db, 'classes'), where(documentId(), 'in', classIds && classIds.length > 0 ? classIds : ['_none_']))
      : collection(db, 'classes');

    const cUnsubscribe = onSnapshot(cQuery, (snapshot) => {
      const filteredClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(filteredClasses);
      
      const classNames = filteredClasses.map(c => c.name);
      const allIdentifiers = [...classIds, ...classNames];
      const safeIdentifiers = allIdentifiers.length > 0 ? allIdentifiers : ['_none_'];

      // 2. Students
      const sQuery = isTeacher 
        ? query(collection(db, 'students'), where('classId', 'in', safeIdentifiers))
        : collection(db, 'students');

      const sUnsubscribe = onSnapshot(sQuery, (sSnapshot) => {
        setStudents(sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'students');
      });

      // 2.5 Teachers (For stats and timetable)
      const tUnsubscribe = onSnapshot(collection(db, 'users'), (tSnapshot) => {
        const allStaff = tSnapshot.docs
          .map(doc => ({ ...doc.data(), uid: doc.id } as any as UserProfile))
          .filter(u => u.role === 'teacher' || u.role === 'admin');
        setTeachers(allStaff);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      });

      // 3. Today's Attendance
      const today = format(new Date(), 'yyyy-MM-dd');
      const aQuery = isTeacher
        ? query(collection(db, 'attendance_records'), where('date', '==', today), where('classId', 'in', safeIdentifiers))
        : query(collection(db, 'attendance_records'), where('date', '==', today));

      const aUnsubscribe = onSnapshot(aQuery, (aSnapshot) => {
        const records = aSnapshot.docs.map(doc => doc.data());
        const present = records.filter(r => r.status === 'present').length;
        const total = records.length;
        setTodayAttendancePct(total > 0 ? Math.round((present / total) * 100) : 0);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'attendance_records');
      });

      // 4. Fees
      const currentMonth = format(new Date(), 'yyyy-MM');
      const fQuery = isTeacher
        ? query(collection(db, 'fees'), where('month', '==', currentMonth), where('classId', 'in', safeIdentifiers))
        : query(collection(db, 'fees'), where('month', '==', currentMonth));

      const fUnsubscribe = onSnapshot(fQuery, (fSnapshot) => {
        setFees(fSnapshot.docs.map(doc => doc.data() as Fee));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'fees');
      });

      // 4.5 Expenses
      const eQuery = query(collection(db, 'expenses'), where('month', '==', currentMonth));
      const eUnsubscribe = onSnapshot(eQuery, (eSnapshot) => {
        setExpenses(eSnapshot.docs.map(doc => doc.data() as Expense));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'expenses');
      });

      // 4.6 Timetable
      const todayDay = format(new Date(), 'EEEE');
      let tTableQuery;
      if (profile.role === 'admin') {
        tTableQuery = query(collection(db, 'timetable'), where('day', '==', todayDay));
      } else if (profile.role === 'teacher') {
        tTableQuery = query(collection(db, 'timetable'), where('day', '==', todayDay), where('teacherUid', '==', profile.uid));
      } else if (profile.role === 'student') {
        const studentClassId = students.find(s => s.uid === profile.uid || s.id === profile.uid)?.classId;
        if (studentClassId) {
          tTableQuery = query(collection(db, 'timetable'), where('day', '==', todayDay), where('classId', '==', studentClassId));
        } else {
          tTableQuery = query(collection(db, 'timetable'), where('day', '==', todayDay));
        }
      }

      const ttUnsubscribe = tTableQuery ? onSnapshot(tTableQuery, (ttSnapshot) => {
        const slots = ttSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as TimetableSlot));
        // Sort by start time
        slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setTimetable(slots);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'timetable');
      }) : () => {};

      // 5. Attendance Trend (Last 7 days)
      const fetchTrend = async () => {
        const data = [];
        try {
          for (let i = 6; i >= 0; i--) {
            const date = format(subDays(new Date(), i), 'yyyy-MM-dd');
            const q = isTeacher
              ? query(collection(db, 'attendance_records'), where('date', '==', date), where('classId', 'in', safeIdentifiers))
              : query(collection(db, 'attendance_records'), where('date', '==', date));
              
            const trendSnapshot = await getDocs(q);
            const records = trendSnapshot.docs.map(doc => doc.data());
            const present = records.filter(r => r.status === 'present').length;
            const total = records.length;
            data.push({
              name: format(subDays(new Date(), i), 'EEE'),
              percentage: total > 0 ? Math.round((present / total) * 100) : 0
            });
          }
          setAttendanceData(data);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'attendance_records_trend');
        }
      };

      fetchTrend();
      setLoading(false);

      return () => {
        sUnsubscribe();
        tUnsubscribe();
        aUnsubscribe();
        fUnsubscribe();
        eUnsubscribe();
        ttUnsubscribe();
      };
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    return () => {
      cUnsubscribe();
    };
  }, [profile]);

  const stats = React.useMemo(() => {
    const activeStudents = students.filter(s => s.status === 'active').length;
    const newStudentsCount = students.filter(s => s.joinedAt && isAfter(new Date(s.joinedAt), subDays(new Date(), 7))).length;
    const newTeachersCount = teachers.filter(t => t.joinedAt && isAfter(new Date(t.joinedAt), subDays(new Date(), 7))).length;
    const monthlyCollection = fees.reduce((sum, f) => sum + f.paidAmount, 0);
    const monthlyExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const monthlyProfit = monthlyCollection - monthlyExpenses;
    
    const currentMonthFees = students.map(student => {
      const fee = fees.find(f => f.studentId === student.id);
      const cls = classes.find(c => c.id === student.classId || c.name === student.classId);
      const monthlyFee = cls?.monthlyFee || 0;
      const paid = fee?.paidAmount || 0;
      return {
        paid,
        remaining: Math.max(0, monthlyFee - paid),
        status: fee?.status || 'unpaid'
      };
    });

    const totalDues = currentMonthFees.reduce((sum, f) => sum + f.remaining, 0);
    const pendingStudentsCount = currentMonthFees.filter(f => f.status !== 'paid').length;

    // Calculate Weekly Schedule Load
    const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    const scheduleLoad = days.map(day => {
      const activeClassesCount = (classes || []).filter(cls => {
        const offDays = cls?.offDays || [];
        return !offDays.includes(day);
      }).length;
      return {
        day: day.substring(0, 3),
        count: activeClassesCount
      };
    });

    return {
      totalStudents: students.length,
      activeStudents,
      newStudentsCount,
      newTeachersCount,
      todayAttendance: todayAttendancePct,
      monthlyCollection,
      monthlyExpenses,
      monthlyProfit,
      activeClasses: classes.length,
      totalDues,
      pendingStudentsCount,
      scheduleLoad
    };
  }, [students, classes, fees, todayAttendancePct]);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Welcome back, {profile.name}!</h1>
          <p className="text-slate-500">Here's what's happening in your academy today.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl shadow-sm">
          <CalendarCheck className="w-5 h-5 text-indigo-600" />
          <span className="text-sm font-bold text-slate-700">{format(new Date(), 'MMMM d, yyyy')}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className={`grid grid-cols-1 md:grid-cols-2 ${profile.role === 'admin' ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-6`}>
        <StatCard title="Active Students" value={stats.activeStudents} trend="+4%" icon={Users} color="indigo" />
        <StatCard title="New Students" value={stats.newStudentsCount} trend="Last 7d" icon={UserPlus} color="purple" />
        {profile.role === 'admin' && (
          <StatCard title="New Teachers" value={stats.newTeachersCount} trend="Last 7d" icon={Sparkles} color="amber" />
        )}
        <StatCard title="Today Attendance" value={`${stats.todayAttendance}%`} trend="-2%" icon={CalendarCheck} color="green" />
      </div>

      {profile.role === 'admin' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <StatCard title="Monthly Revenue" value={`$${stats.monthlyCollection.toLocaleString()}`} trend="Fees" icon={CreditCard} color="green" />
          <StatCard title="Monthly Expenses" value={`$${stats.monthlyExpenses.toLocaleString()}`} trend="Bills" icon={TrendingDown} color="red" />
          <StatCard title="Net Profit" value={`$${stats.monthlyProfit.toLocaleString()}`} trend="Margin" icon={Wallet} color="indigo" />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Attendance Chart */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h3 className="text-lg font-bold text-slate-900">Attendance Trend</h3>
              <p className="text-sm text-slate-500">Attendance percentage for the last 7 days</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
              <TrendingUp className="w-4 h-4" />
              Weekly Growth
            </div>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={attendanceData}>
                <defs>
                  <linearGradient id="colorPct" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ stroke: '#4f46e5', strokeWidth: 2 }}
                />
                <Area type="monotone" dataKey="percentage" stroke="#4f46e5" strokeWidth={3} fillOpacity={1} fill="url(#colorPct)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Weekly Schedule Load */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-bold text-slate-900">Weekly Schedule</h3>
            <p className="text-sm text-slate-500">Number of active classes per day</p>
          </div>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.scheduleLoad}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dy={10} />
                <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} dx={-10} allowDecimals={false} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  cursor={{ fill: '#f1f5f9' }}
                />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Info className="w-4 h-4 text-indigo-500" />
              <span>Days with shorter bars have fewer classes scheduled.</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Quick Actions & Alerts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Schedule Widget */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Today's Schedule</h3>
                <p className="text-sm text-slate-500">{format(new Date(), 'EEEE, MMMM d')}</p>
              </div>
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {timetable.length > 0 ? (
              <div className="space-y-4">
                {timetable.map((slot) => {
                  const now = new Date();
                  const currentTime = format(now, 'HH:mm');
                  const isActive = currentTime >= slot.startTime && currentTime <= slot.endTime;
                  const isPast = currentTime > slot.endTime;

                  return (
                    <div 
                      key={slot.id}
                      className={cn(
                        "flex items-center gap-4 p-4 rounded-xl border transition-all",
                        isActive ? "bg-indigo-50 border-indigo-200 ring-1 ring-indigo-200" : 
                        isPast ? "bg-slate-50 border-slate-100 opacity-60" : "bg-white border-slate-100",
                        slot.type === 'break' && "bg-slate-50 border-dashed border-slate-200"
                      )}
                    >
                      <div className={cn(
                        "flex flex-col items-center justify-center min-w-[80px] py-2 rounded-lg border",
                        isActive ? "bg-indigo-600 text-white border-indigo-600" : "bg-slate-50 text-slate-600 border-slate-100"
                      )}>
                        <span className="text-xs font-bold uppercase">{slot.startTime}</span>
                        <div className="w-4 h-px bg-current opacity-30 my-1" />
                        <span className="text-xs font-bold uppercase">{slot.endTime}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className={cn(
                            "font-bold truncate",
                            slot.type === 'break' ? "text-slate-500" : "text-slate-900"
                          )}>{slot.subject}</h4>
                          {isActive && (
                            <span className="flex h-2 w-2 rounded-full bg-indigo-600 animate-pulse" />
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500">
                          {slot.type === 'lecture' ? (
                            <>
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3 h-3" />
                                {classes.find(c => c.id === slot.classId || c.name === slot.classId)?.name || slot.classId}
                              </span>
                              {slot.room && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="w-3 h-3" />
                                  {slot.room}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-xs font-medium italic">Scheduled Break</span>
                          )}
                        </div>
                      </div>

                      {profile.role === 'admin' && slot.type === 'lecture' && (
                        <div className="text-right hidden sm:block">
                          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Teacher</p>
                          <p className="text-sm font-bold text-slate-700">
                            {teachers.find(t => t.uid === slot.teacherUid)?.name || 'Unknown'}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <div className="p-3 bg-white rounded-full shadow-sm mb-3">
                  <CalendarCheck className="w-6 h-6 text-slate-300" />
                </div>
                <p className="text-slate-500 font-medium">No lectures scheduled for today</p>
                <p className="text-xs text-slate-400 mt-1">Check the full timetable for other days</p>
              </div>
            )}
          </div>

          {profile.role === 'admin' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Fee Alerts</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                      <AlertCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-900">Total Dues</p>
                      <p className="text-xs text-red-600">Action required</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-red-900">${stats.totalDues}</span>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-amber-900">Pending Fees</p>
                      <p className="text-[10px] text-amber-600">Includes Partial & Unpaid</p>
                    </div>
                  </div>
                  <span className="text-lg font-bold text-amber-900">{stats.pendingStudentsCount} Students</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Recent Activity or other relevant teacher info could go here */}
          {profile.role === 'teacher' && (
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Class Overview</h3>
              <p className="text-slate-500 text-sm">You are currently managing {classes.length} active classes with {students.length} students.</p>
            </div>
          )}
        </div>

        <div className="bg-indigo-600 p-6 rounded-2xl shadow-lg shadow-indigo-200 text-white">
          <h3 className="text-lg font-bold mb-2">Quick Attendance</h3>
          <p className="text-indigo-100 text-sm mb-4">Mark attendance for your morning class in one click.</p>
          <button className="w-full bg-white text-indigo-600 font-bold py-2.5 rounded-xl hover:bg-indigo-50 transition-all flex items-center justify-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            Mark Now
          </button>
        </div>
      </div>
    </div>
  );
}

const StatCard = ({ title, value, trend, icon: Icon, color }: any) => {
  const colors: any = {
    indigo: "bg-indigo-50 text-indigo-600 border-indigo-100",
    green: "bg-green-50 text-green-600 border-green-100",
    amber: "bg-amber-50 text-amber-600 border-amber-100",
    purple: "bg-purple-50 text-purple-600 border-purple-100",
    red: "bg-red-50 text-red-600 border-red-100",
  };
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"
    >
      <div className="flex items-center justify-between mb-4">
        <div className={cn("p-3 rounded-xl border", colors[color])}>
          <Icon className="w-6 h-6" />
        </div>
        {trend && (
          <span className={cn("text-xs font-bold px-2 py-1 rounded-full", trend.startsWith('+') ? "bg-green-50 text-green-600" : trend === '0' ? "bg-slate-50 text-slate-600" : "bg-red-50 text-red-600")}>
            {trend}
          </span>
        )}
      </div>
      <h3 className="text-slate-500 text-sm font-medium">{title}</h3>
      <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
    </motion.div>
  );
};

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
