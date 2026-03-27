import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  orderBy,
  documentId
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { Student, Class, AttendanceRecord, Fee, UserProfile } from '../types';
import { 
  Download, 
  FileText, 
  Users, 
  Calendar, 
  DollarSign, 
  Filter,
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  TrendingUp,
  PieChart as PieChartIcon,
  Info,
  BookOpen
} from 'lucide-react';
import { motion } from 'motion/react';
import { format, startOfMonth, endOfMonth, subDays } from 'date-fns';
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
  Pie
} from 'recharts';

export default function ReportsView({ profile }: { profile: UserProfile }) {
  const [reportType, setReportType] = useState<'attendance' | 'fees'>('attendance');
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClassId, setSelectedClassId] = useState('all');
  const [selectedSubject, setSelectedSubject] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [startDate, setStartDate] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'present' | 'absent' | 'leave'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];

    const cQuery = isTeacher
      ? query(collection(db, 'classes'), where(documentId(), 'in', classIds.length > 0 ? classIds : ['_none_']))
      : collection(db, 'classes');

    const cUnsubscribe = onSnapshot(cQuery, (snapshot) => {
      const filteredClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(filteredClasses);
      
      const classNames = filteredClasses.map(b => b.name);
      const allIdentifiers = [...classIds, ...classNames];
      const safeIdentifiers = allIdentifiers.length > 0 ? allIdentifiers : ['_none_'];

      const sQuery = isTeacher
        ? query(collection(db, 'students'), where('classId', 'in', safeIdentifiers))
        : collection(db, 'students');

      const sUnsubscribe = onSnapshot(sQuery, (sSnapshot) => {
        setStudents(sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'students');
      });

      const aQuery = isTeacher
        ? query(collection(db, 'attendance_records'), where('classId', 'in', safeIdentifiers))
        : collection(db, 'attendance_records');

      const aUnsubscribe = onSnapshot(aQuery, (aSnapshot) => {
        setAttendanceRecords(aSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'attendance_records');
      });

      const fQuery = isTeacher
        ? query(collection(db, 'fees'), where('month', '==', selectedMonth), where('classId', 'in', safeIdentifiers))
        : query(collection(db, 'fees'), where('month', '==', selectedMonth));

      const fUnsubscribe = onSnapshot(fQuery, (fSnapshot) => {
        setFees(fSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fee)));
        setLoading(false);
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'fees');
      });

      return () => {
        sUnsubscribe();
        aUnsubscribe();
        fUnsubscribe();
      };
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    return () => {
      cUnsubscribe();
    };
  }, [selectedMonth, profile]);

  const exportToCSV = (data: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(row => Object.values(row).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const attendanceStats = students
    .filter(s => selectedClassId === 'all' || s.classId === selectedClassId)
    .map(student => {
      const records = attendanceRecords.filter(r => {
        const matchesStudent = r.studentId === student.id;
        const matchesDate = r.date >= startDate && r.date <= endDate;
        const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
        const matchesSubject = selectedSubject === 'all' || r.subject === selectedSubject;
        return matchesStudent && matchesDate && matchesStatus && matchesSubject;
      });
      
      const present = records.filter(r => r.status === 'present').length;
      const absent = records.filter(r => r.status === 'absent').length;
      const leave = records.filter(r => r.status === 'leave').length;
      const total = records.length;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      return {
        name: student.name,
        rollNumber: student.rollNumber,
        class: classes.find(b => b.id === student.classId)?.name || 'Unknown',
        present,
        absent,
        leave,
        total,
        percentage
      };
    })
    .filter(s => s.total > 0 || selectedStatus === 'all'); // Only show students with records in range if status filtered

  const feeStats = students
    .filter(s => selectedClassId === 'all' || s.classId === selectedClassId)
    .map(student => {
      const fee = fees.find(f => f.studentId === student.id);
      const cls = classes.find(b => b.id === student.classId);
      const monthlyFee = cls?.monthlyFee || 0;
      const paidAmount = fee?.paidAmount || 0;
      const remaining = Math.max(0, monthlyFee - paidAmount);
      
      return {
        name: student.name,
        rollNumber: student.rollNumber,
        class: cls?.name || 'Unknown',
        totalFee: monthlyFee,
        paid: paidAmount,
        remaining: remaining,
        status: fee?.status || 'unpaid'
      };
    });

  const canExport = profile.role === 'admin' || profile.permissions.exportReports;

  // Summary Stats
  const totalStudents = reportType === 'attendance' ? attendanceStats.length : feeStats.length;
  const avgAttendance = attendanceStats.length > 0 
    ? Math.round(attendanceStats.reduce((sum, s) => sum + s.percentage, 0) / attendanceStats.length) 
    : 0;
  const totalFeesCollected = feeStats.reduce((sum, s) => sum + s.paid, 0);
  const totalFeesPending = feeStats.reduce((sum, s) => sum + s.remaining, 0);

  // Chart Data
  const classAttendanceData = classes.map(cls => {
    const classStudents = attendanceStats.filter(s => s.class === cls.name);
    const avg = classStudents.length > 0 
      ? Math.round(classStudents.reduce((sum, s) => sum + s.percentage, 0) / classStudents.length) 
      : 0;
    return { name: cls.name, percentage: avg };
  });

  const feeStatusData = [
    { name: 'Paid', value: feeStats.filter(s => s.status === 'paid').length, color: '#10b981' },
    { name: 'Partial', value: feeStats.filter(s => s.status === 'partial').length, color: '#f59e0b' },
    { name: 'Unpaid', value: feeStats.filter(s => s.status === 'unpaid').length, color: '#ef4444' }
  ].filter(d => d.value > 0);

  // Grid Data calculation
  const daysInMonth = Array.from({ length: 31 }, (_, i) => i + 1);
  const currentMonthDate = new Date(selectedMonth + '-01');
  const monthName = format(currentMonthDate, 'MMMM yyyy');
  const filteredAttendance = attendanceRecords.filter(r => r.date.startsWith(selectedMonth));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
          <p className="text-slate-500">Analyze attendance and financial performance</p>
        </div>
        {canExport && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => exportToCSV(reportType === 'attendance' ? attendanceStats : feeStats, `${reportType}_report_${selectedMonth}`)}
              className="flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 px-4 py-2.5 rounded-xl font-semibold hover:bg-slate-50 transition-all active:scale-95 shadow-sm"
            >
              <Download className="w-5 h-5" />
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Students</span>
          </div>
          <p className="text-2xl font-bold text-slate-900">{totalStudents}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-green-50 text-green-600 rounded-lg">
              <TrendingUp className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Avg Attendance</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{avgAttendance}%</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
              <DollarSign className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fees Collected</span>
          </div>
          <p className="text-2xl font-bold text-emerald-600">${totalFeesCollected}</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-red-50 text-red-600 rounded-lg">
              <AlertCircle className="w-5 h-5" />
            </div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Fees Pending</span>
          </div>
          <p className="text-2xl font-bold text-red-600">${totalFeesPending}</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            Attendance by Class (%)
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={classAttendanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                <YAxis hide domain={[0, 100]} />
                <Tooltip cursor={{ fill: '#f8fafc' }} />
                <Bar dataKey="percentage" radius={[4, 4, 0, 0]} barSize={30}>
                  {classAttendanceData.map((entry) => (
                    <Cell key={entry.name} fill={entry.percentage > 75 ? '#10b981' : entry.percentage > 50 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <PieChartIcon className="w-5 h-5 text-indigo-600" />
            Fee Status Distribution
          </h3>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={feeStatusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {feeStatusData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center gap-4 mt-2">
            {feeStatusData.map((d) => (
              <div key={d.name} className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                <span className="text-xs font-medium text-slate-600">{d.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex bg-slate-100 p-1 rounded-xl sm:col-span-2 lg:col-span-1">
            <button 
              onClick={() => setReportType('attendance')}
              className={cn("flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all", reportType === 'attendance' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Attendance
            </button>
            <button 
              onClick={() => setReportType('fees')}
              className={cn("flex-1 py-1.5 px-3 rounded-lg text-sm font-bold transition-all", reportType === 'fees' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
            >
              Fees
            </button>
          </div>

          {reportType === 'attendance' && (
            <div className="flex bg-slate-100 p-1 rounded-xl sm:col-span-2 lg:col-span-1">
              <button 
                onClick={() => setViewMode('table')}
                className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all", viewMode === 'table' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Table
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={cn("flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all", viewMode === 'grid' ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-700")}
              >
                Grid
              </button>
            </div>
          )}
          
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={selectedClassId}
              onChange={(e) => {
                setSelectedClassId(e.target.value);
                setSelectedSubject('all');
              }}
            >
              <option value="all">All Classes</option>
              {classes.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>

          {reportType === 'attendance' && (
            <div className="relative">
              <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="all">All Subjects</option>
                {selectedClassId !== 'all' ? (
                  classes.find(b => b.id === selectedClassId)?.subjects.map((s, idx) => (
                    <option key={`${s}-${idx}`} value={s}>{s}</option>
                  ))
                ) : (
                  Array.from(new Set(classes.flatMap(b => b.subjects))).map((s, idx) => (
                    <option key={`${s}-${idx}`} value={s}>{s}</option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type={reportType === 'attendance' ? "date" : "month"} 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={reportType === 'attendance' ? startDate : selectedMonth}
              onChange={(e) => reportType === 'attendance' ? setStartDate(e.target.value) : setSelectedMonth(e.target.value)}
            />
          </div>

          {reportType === 'attendance' && (
            <>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="date" 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="relative">
                <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select 
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value as any)}
                >
                  <option value="all">All Status</option>
                  <option value="present">Present Only</option>
                  <option value="absent">Absent Only</option>
                  <option value="leave">Leave Only</option>
                </select>
              </div>
            </>
          )}
        </div>

        {reportType === 'fees' && (
          <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-xl flex items-center gap-3 text-indigo-700 text-xs">
            <Info className="w-4 h-4 shrink-0" />
            <p>
              <span className="font-bold">Partial Status:</span> Student has paid some amount but less than the full monthly fee. 
              <span className="font-bold ml-2">Unpaid Status:</span> No payment recorded for the selected month.
            </p>
          </div>
        )}
      </div>

      {/* Report Table/Grid */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {reportType === 'attendance' && viewMode === 'grid' ? (
          <div className="overflow-x-auto">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h4 className="font-bold text-slate-900">Monthly Attendance Grid - {monthName}</h4>
              <p className="text-xs text-slate-500">P = Present, A = Absent, L = Leave</p>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="sticky left-0 z-10 bg-slate-50 px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider border-r border-slate-200">Student</th>
                  {daysInMonth.map(day => (
                    <th key={day} className="px-2 py-4 text-[10px] font-bold text-slate-500 text-center border-r border-slate-100 min-w-[30px]">{day}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendanceStats.map((stat) => {
                  const studentId = students.find(s => s.rollNumber === stat.rollNumber)?.id;
                  return (
                    <tr key={stat.rollNumber} className="hover:bg-slate-50 transition-colors">
                      <td className="sticky left-0 z-10 bg-white px-6 py-3 border-r border-slate-200 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">
                        <p className="font-bold text-slate-900 text-sm truncate max-w-[150px]">{stat.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{stat.rollNumber}</p>
                      </td>
                      {daysInMonth.map(day => {
                        const dateStr = `${selectedMonth}-${day.toString().padStart(2, '0')}`;
                        const dayRecords = filteredAttendance.filter(r => r.studentId === studentId && r.date === dateStr);
                        const status = dayRecords.length > 0 ? dayRecords[0].status : null;
                        
                        return (
                          <td key={day} className="p-0 border-r border-slate-100 text-center">
                            <div className={cn(
                              "w-full h-10 flex items-center justify-center text-[10px] font-black",
                              status === 'present' ? "bg-green-50 text-green-600" :
                              status === 'absent' ? "bg-red-50 text-red-600" :
                              status === 'leave' ? "bg-amber-50 text-amber-600" : "text-slate-200"
                            )}>
                              {status === 'present' ? 'P' : status === 'absent' ? 'A' : status === 'leave' ? 'L' : '·'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                {reportType === 'attendance' ? (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Present</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Absent</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Leave</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Percentage</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Fee</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Paid</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining</th>
                    <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reportType === 'attendance' ? (
                attendanceStats.map((stat) => (
                  <tr key={stat.rollNumber} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{stat.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{stat.rollNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{stat.class}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">{stat.present}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">{stat.absent}</td>
                    <td className="px-6 py-4 text-sm font-bold text-amber-600">{stat.leave}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{stat.total}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all", stat.percentage > 75 ? "bg-green-500" : stat.percentage > 50 ? "bg-amber-500" : "bg-red-500")}
                            style={{ width: `${stat.percentage}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-slate-700">{stat.percentage}%</span>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                feeStats.map((stat) => (
                  <tr key={stat.rollNumber} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{stat.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{stat.rollNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{stat.class}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${stat.totalFee}</td>
                    <td className="px-6 py-4 text-sm font-bold text-green-600">${stat.paid}</td>
                    <td className="px-6 py-4 text-sm font-bold text-red-600">${stat.remaining}</td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        stat.status === 'paid' ? "bg-green-50 text-green-700" :
                        stat.status === 'partial' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      )}>
                        {stat.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
          </div>
        )}
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
