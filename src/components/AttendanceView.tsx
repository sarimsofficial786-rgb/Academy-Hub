import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  setDoc,
  doc, 
  query, 
  where,
  getDocs,
  writeBatch,
  serverTimestamp,
  documentId
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';
import { Student, Class, UserProfile, Attendance, AttendanceRecord } from '../types';
import { 
  Calendar, 
  Users, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Save, 
  Filter,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isSameDay, startOfDay, parseISO, startOfMonth, endOfMonth } from 'date-fns';

export default function AttendanceView({ profile }: { profile: UserProfile }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [selectedSubject, setSelectedSubject] = useState<string>('');
  const [attendanceMode, setAttendanceMode] = useState<'class' | 'unified'>('class');
  const [serverRecords, setServerRecords] = useState<Record<string, 'present' | 'absent' | 'leave'>>({});
  const [localRecords, setLocalRecords] = useState<Record<string, 'present' | 'absent' | 'leave'>>({});
  const [monthlyStats, setMonthlyStats] = useState<Record<string, { present: number, total: number }>>({});
  const [loadingAttendance, setLoadingAttendance] = useState(false);
  const [isAlreadyMarked, setIsAlreadyMarked] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const getAvailableSubjects = (cls: Class | undefined) => {
    if (!cls) return [];
    if (profile.role === 'admin') return cls.subjects || [];
    
    // For teachers, filter subjects where they are assigned in the subjectTeacherMap
    return (cls.subjects || []).filter(subject => {
      const assignedTeacherId = cls.subjectTeacherMap?.[subject];
      return assignedTeacherId === profile.uid || assignedTeacherId === profile.email;
    });
  };

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];

    const cQuery = isTeacher
      ? query(collection(db, 'classes'), where(documentId(), 'in', classIds.length > 0 ? classIds : ['_none_']))
      : collection(db, 'classes');

    const cUnsubscribe = onSnapshot(cQuery, (snapshot) => {
      const filtered = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(filtered);
      if (filtered.length > 0 && !selectedClassId) {
        setSelectedClassId(filtered[0].id);
        const available = getAvailableSubjects(filtered[0]);
        if (available.length > 0) {
          setSelectedSubject(available[0]);
        }
      }
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    return () => {
      cUnsubscribe();
    };
  }, [profile]);

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];
    const classNames = classes.map(b => b.name);
    const allPossibleClassIdentifiers = [...classIds, ...classNames];
    
    const sQuery = isTeacher
      ? query(collection(db, 'students'), where('classId', 'in', allPossibleClassIdentifiers.length > 0 ? allPossibleClassIdentifiers : ['_none_']))
      : collection(db, 'students');

    const sUnsubscribe = onSnapshot(sQuery, (sSnapshot) => {
      setStudents(sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      setLoading(false);
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'students');
    });

    return () => sUnsubscribe();
  }, [profile, classes]);

  useEffect(() => {
    if (!selectedDate || (attendanceMode === 'class' && !selectedClassId) || (attendanceMode === 'class' && !selectedSubject)) {
      setServerRecords({});
      setLocalRecords({});
      setIsAlreadyMarked(false);
      return;
    }

    setLoadingAttendance(true);
    // Clear local records when changing filters
    setLocalRecords({});

    const classIds = profile.role === 'admin' ? [] : profile.assignedClassIds;
    let q;
    
    if (attendanceMode === 'class') {
      const cls = classes.find(b => b.id === selectedClassId);
      const identifiers = [selectedClassId];
      if (cls) identifiers.push(cls.name);

      q = query(
        collection(db, 'attendance_records'), 
        where('date', '==', selectedDate),
        where('classId', 'in', identifiers),
        where('subject', '==', selectedSubject)
      );
    } else {
      if (profile.role === 'admin') {
        q = query(
          collection(db, 'attendance_records'), 
          where('date', '==', selectedDate)
        );
      } else {
        const classNames = classes.filter(b => classIds.includes(b.id)).map(b => b.name);
        const allIdentifiers = [...classIds, ...classNames];

        q = query(
          collection(db, 'attendance_records'), 
          where('date', '==', selectedDate),
          where('classId', 'in', allIdentifiers.length > 0 ? allIdentifiers : ['_none_'])
        );
      }
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records: Record<string, 'present' | 'absent' | 'leave'> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as AttendanceRecord;
        records[data.studentId] = data.status;
      });
      setServerRecords(records);
      setIsAlreadyMarked(snapshot.docs.length > 0);
      setLoadingAttendance(false);
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'attendance_records');
      setLoadingAttendance(false);
    });

    // Fetch monthly stats for the students in this class
    const monthStart = format(startOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    const monthEnd = format(endOfMonth(new Date(selectedDate)), 'yyyy-MM-dd');
    
    const monthlyQuery = query(
      collection(db, 'attendance_records'),
      where('date', '>=', monthStart),
      where('date', '<=', monthEnd)
    );

    const monthlyUnsubscribe = onSnapshot(monthlyQuery, (snapshot) => {
      const stats: Record<string, { present: number, total: number }> = {};
      snapshot.docs.forEach(doc => {
        const data = doc.data() as AttendanceRecord;
        if (!stats[data.studentId]) stats[data.studentId] = { present: 0, total: 0 };
        stats[data.studentId].total++;
        if (data.status === 'present') stats[data.studentId].present++;
      });
      setMonthlyStats(stats);
    });

    return () => {
      unsubscribe();
      monthlyUnsubscribe();
    };
  }, [selectedDate, selectedClassId, selectedSubject, attendanceMode, profile, classes]);

  const handleMarkAll = (status: 'present' | 'absent') => {
    const newRecords = { ...localRecords };
    filteredStudents.forEach(student => {
      newRecords[student.id] = status;
    });
    setLocalRecords(newRecords);
  };

  const filteredStudents = attendanceMode === 'class' 
    ? students.filter(s => {
        const cls = classes.find(b => b.id === selectedClassId);
        const isClassMatch = s.classId === selectedClassId || cls?.name === s.classId;
        const isActive = s.status === 'active';
        
        // If teacher, only show students assigned to them for this subject
        if (profile.role === 'teacher') {
          const assignedTeacherId = cls?.subjectTeacherMap?.[selectedSubject];
          const isAssigned = assignedTeacherId === profile.uid || assignedTeacherId === profile.email;
          return isClassMatch && isActive && isAssigned;
        }
        
        return isClassMatch && isActive;
      })
    : students.filter(s => {
        const isClassMatch = profile.role === 'admin' || 
          profile.assignedClassIds.includes(s.classId) || 
          classes.some(b => profile.assignedClassIds.includes(b.id) && b.name === s.classId);
        return isClassMatch && s.status === 'active';
      });

  const handleStatusChange = (studentId: string, status: 'present' | 'absent' | 'leave') => {
    setLocalRecords(prev => ({ ...prev, [studentId]: status }));
  };

  const toggleEmergencyStatus = async (status: 'on' | 'off' | 'regular') => {
    const canManageOffDays = profile.role === 'admin' || profile.permissions.manageOffDays;
    if (!selectedClassId || !canManageOffDays) return;
    
    const cls = classes.find(b => b.id === selectedClassId);
    if (!cls) return;

    const newOnDates = [...(cls.emergencyOnDates || [])];
    const newOffDates = [...(cls.emergencyOffDates || [])];

    // Remove current date from both lists first
    const filteredOn = newOnDates.filter(d => d !== selectedDate);
    const filteredOff = newOffDates.filter(d => d !== selectedDate);

    if (status === 'on') {
      filteredOn.push(selectedDate);
    } else if (status === 'off') {
      filteredOff.push(selectedDate);
    }

    try {
      await updateDoc(doc(db, 'classes', selectedClassId), {
        emergencyOnDates: filteredOn,
        emergencyOffDates: filteredOff
      });
      setMessage({ type: 'success', text: `Schedule updated for ${selectedDate}` });
      setTimeout(() => setMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `classes/${selectedClassId}`);
    }
  };

  const saveAttendance = async () => {
    const isToday = isSameDay(parseISO(selectedDate), startOfDay(new Date()));
    const canManagePast = profile.role === 'admin' || profile.permissions.managePastAttendance;
    const canMarkToday = profile.role === 'admin' || profile.permissions.markTodayAttendance;
    const canEditToday = profile.role === 'admin' || profile.permissions.editTodayAttendance;

    if (isToday) {
      if (isAlreadyMarked) {
        if (!canEditToday) {
          setMessage({ type: 'error', text: 'Attendance is already marked. You do not have permission to edit today\'s attendance.' });
          return;
        }
      } else {
        if (!canMarkToday) {
          setMessage({ type: 'error', text: 'You do not have permission to mark attendance today.' });
          return;
        }
      }
    } else if (!canManagePast) {
      setMessage({ type: 'error', text: 'You do not have permission to manage past attendance.' });
      return;
    }

    setIsSaving(true);
    try {
      const batchWrite = writeBatch(db);
      
      // 1. Create/Update master attendance record for each class involved
      const classIds = attendanceMode === 'class' ? [selectedClassId] : [...new Set(filteredStudents.map(s => s.classId))];
      
      for (const bId of classIds) {
        const attendanceId = `${bId}_${selectedDate}_${selectedSubject || 'General'}`;
        const attendanceRef = doc(db, 'attendance', attendanceId);
        batchWrite.set(attendanceRef, {
          classId: bId,
          date: selectedDate,
          subject: selectedSubject || 'General',
          markedBy: profile.uid,
          markedAt: new Date().toISOString()
        }, { merge: true });
      }

      // 2. Save individual records
      for (const student of filteredStudents) {
        const status = localRecords[student.id] || serverRecords[student.id] || 'absent';
        const recordId = `${student.id}_${selectedDate}_${selectedSubject || 'General'}`;
        const recordRef = doc(db, 'attendance_records', recordId);
        
        // Determine the teacher for this subject
        const cls = classes.find(b => b.id === student.classId || b.name === student.classId);
        const teacherId = cls?.subjectTeacherMap?.[selectedSubject] || profile.uid;

        batchWrite.set(recordRef, {
          studentId: student.id,
          status,
          date: selectedDate,
          classId: student.classId,
          subject: selectedSubject || 'General',
          teacherId
        }, { merge: true });
      }

      try {
        await batchWrite.commit();
        setLocalRecords({}); // Clear local changes after successful save
        setIsAlreadyMarked(true);
        setMessage({ type: 'success', text: 'Attendance saved successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'batch_attendance');
      }
    } catch (error) {
      console.error("Error saving attendance:", error);
      setMessage({ type: 'error', text: 'Failed to save attendance.' });
    } finally {
      setIsSaving(false);
    }
  };

  const isToday = isSameDay(parseISO(selectedDate), startOfDay(new Date()));
  const canMarkToday = profile.role === 'admin' || profile.permissions.markTodayAttendance;
  const canEditToday = profile.role === 'admin' || profile.permissions.editTodayAttendance;
  const canManagePast = profile.role === 'admin' || profile.permissions.managePastAttendance;

  const getIsOffDay = (dateStr: string, classId: string) => {
    const cls = classes.find(b => b.id === classId || b.name === classId);
    if (!cls) return false;
    if (cls.emergencyOnDates?.includes(dateStr)) return false;
    if (cls.emergencyOffDates?.includes(dateStr)) return true;
    const dayName = format(parseISO(dateStr), 'EEEE');
    return cls.offDays?.includes(dayName);
  };

  const isClassOff = attendanceMode === 'class' && selectedClassId ? getIsOffDay(selectedDate, selectedClassId) : false;

  const isDateLocked = (!isToday && !canManagePast) ||
                       (isToday && isAlreadyMarked && !canEditToday) ||
                       (isToday && !isAlreadyMarked && !canMarkToday) ||
                       (isClassOff && !canManagePast); // Lock if it's an off day unless admin/past manager

  const canViewHistory = profile.role === 'admin' || profile.permissions.viewAttendanceHistory;

  if (classes.length === 0 && !loading) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
        <Users className="w-16 h-16 text-slate-200 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Classes Assigned</h2>
        <p className="text-slate-500">You are not assigned to any classes yet. Please contact your administrator to assign classes to your profile.</p>
      </div>
    );
  }

  if (!isToday && !canViewHistory) {
    return (
      <div className="p-12 text-center bg-white rounded-2xl border border-slate-200">
        <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
        <p className="text-slate-500">You do not have permission to view attendance history. You can only mark attendance for today.</p>
        <button 
          onClick={() => setSelectedDate(format(new Date(), 'yyyy-MM-dd'))}
          className="mt-6 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all"
        >
          Go to Today
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Attendance</h1>
          <p className="text-slate-500">Mark and view attendance for your classes</p>
        </div>
        <div className="flex items-center gap-2">
          {profile.permissions.useUnifiedMode && (
            <div className="bg-white border border-slate-200 rounded-xl p-1 flex shadow-sm">
              <button 
                onClick={() => setAttendanceMode('class')}
                className={cn("p-2 rounded-lg transition-all", attendanceMode === 'class' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
              >
                <LayoutGrid className="w-5 h-5" />
              </button>
              <button 
                onClick={() => setAttendanceMode('unified')}
                className={cn("p-2 rounded-lg transition-all", attendanceMode === 'unified' ? "bg-indigo-50 text-indigo-600" : "text-slate-400 hover:bg-slate-50")}
              >
                <List className="w-5 h-5" />
              </button>
            </div>
          )}
          <button 
            onClick={saveAttendance}
            disabled={isSaving || isDateLocked}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50"
          >
            <Save className="w-5 h-5" />
            {isSaving ? 'Saving...' : 'Save Attendance'}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input 
              type="date" 
              className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="flex gap-1">
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() - 1);
                setSelectedDate(format(d, 'yyyy-MM-dd'));
              }}
              className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"
            >
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            <button 
              onClick={() => {
                const d = new Date(selectedDate);
                d.setDate(d.getDate() + 1);
                setSelectedDate(format(d, 'yyyy-MM-dd'));
              }}
              className="p-2 hover:bg-slate-50 rounded-lg border border-slate-200"
            >
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>
        </div>
        {attendanceMode === 'class' && (
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={selectedClassId}
                onChange={(e) => {
                  setSelectedClassId(e.target.value);
                  const cls = classes.find(b => b.id === e.target.value);
                  const available = getAvailableSubjects(cls);
                  if (available.length > 0) {
                    setSelectedSubject(available[0]);
                  } else {
                    setSelectedSubject('');
                  }
                }}
              >
                {classes.map(b => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.timing ? `(${b.timing})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="relative flex-1">
              <LayoutGrid className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <select 
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
              >
                <option value="">Select Subject</option>
                {getAvailableSubjects(classes.find(b => b.id === selectedClassId)).map((s, idx) => (
                  <option key={`${s}-${idx}`} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>
        )}
      </div>

      {isDateLocked && (
        <div className={cn(
          "p-4 rounded-xl flex items-center gap-3 font-medium border",
          isClassOff ? "bg-red-50 border-red-200 text-red-700" : "bg-amber-50 border-amber-200 text-amber-700"
        )}>
          <AlertCircle className="w-5 h-5" />
          <p className="text-sm">
            {isClassOff 
              ? `Today is an OFF day (${classes.find(b => b.id === selectedClassId)?.offDays.join(', ')}) for this class. Attendance is disabled.`
              : !isToday 
                ? "Past attendance is locked. Only Admins can modify past records."
                : isAlreadyMarked 
                  ? "Attendance is already marked for today. You do not have permission to edit it."
                  : "You do not have permission to mark attendance for today."
            }
          </p>
        </div>
      )}

      {message && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "p-4 rounded-xl flex items-center gap-3 font-medium",
            message.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
          )}
        >
          {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </motion.div>
      )}

      {/* Schedule Override Controls */}
      {attendanceMode === 'class' && selectedClassId && (profile.role === 'admin' || profile.permissions.manageOffDays) && (
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-lg",
                isClassOff ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
              )}>
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {isClassOff ? 'Holiday / Off Day' : 'Class Day / On Day'}
                </p>
                <p className="text-xs text-slate-500">
                  {selectedDate} — {isClassOff ? 'No attendance required' : 'Attendance marking enabled'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => toggleEmergencyStatus('off')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  classes.find(b => b.id === selectedClassId)?.emergencyOffDates?.includes(selectedDate)
                    ? "bg-red-600 text-white border-red-600"
                    : "bg-white text-red-600 border-red-200 hover:bg-red-50"
                )}
              >
                Set Holiday
              </button>
              <button
                onClick={() => toggleEmergencyStatus('on')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold transition-all border",
                  classes.find(b => b.id === selectedClassId)?.emergencyOnDates?.includes(selectedDate)
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-green-600 border-green-200 hover:bg-green-50"
                )}
              >
                Set Extra Class
              </button>
              {(classes.find(b => b.id === selectedClassId)?.emergencyOnDates?.includes(selectedDate) || 
                classes.find(b => b.id === selectedClassId)?.emergencyOffDates?.includes(selectedDate)) && (
                <button
                  onClick={() => toggleEmergencyStatus('regular')}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all border bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                >
                  Reset
                </button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-slate-400 italic border-t border-slate-50 pt-2">
            Use these controls to quickly change today's schedule. "Extra Class" forces attendance to be open, while "Holiday" closes it.
          </p>
        </div>
      )}

      {/* Attendance List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50/50 gap-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <span className="font-bold text-slate-900">
              {attendanceMode === 'class' 
                ? classes.find(b => b.id === selectedClassId)?.name 
                : 'Unified View (All Assigned Students)'}
            </span>
            <span className="text-xs font-medium text-slate-500 bg-slate-200/50 px-2 py-0.5 rounded-full ml-2">
              {filteredStudents.length} Students
            </span>
          </div>
          
          {filteredStudents.length > 0 && !isDateLocked && (
            <div className="flex gap-2">
              <button 
                onClick={() => handleMarkAll('present')}
                className="text-xs font-bold text-green-600 hover:bg-green-100/50 px-3 py-1.5 rounded-lg transition-all border border-green-200 bg-green-50/50"
              >
                Mark All Present
              </button>
              <button 
                onClick={() => handleMarkAll('absent')}
                className="text-xs font-bold text-red-600 hover:bg-red-100/50 px-3 py-1.5 rounded-lg transition-all border border-red-200 bg-red-50/50"
              >
                Mark All Absent
              </button>
            </div>
          )}
        </div>

        <div className="divide-y divide-slate-100">
          {loadingAttendance && Object.keys(serverRecords).length === 0 ? (
            <div className="p-12 space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="flex items-center justify-between animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-full" />
                    <div className="space-y-2">
                      <div className="h-4 w-32 bg-slate-100 rounded" />
                      <div className="h-3 w-20 bg-slate-50 rounded" />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="h-10 w-24 bg-slate-50 rounded-xl" />
                    <div className="h-10 w-24 bg-slate-50 rounded-xl" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            filteredStudents.map((student) => {
              const currentStatus = localRecords[student.id] || serverRecords[student.id];
              const stats = monthlyStats[student.id];
              const monthlyPercentage = stats ? Math.round((stats.present / stats.total) * 100) : 0;
              
              return (
                <div key={student.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500">
                      {student.name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        {stats && (
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-tighter",
                            monthlyPercentage >= 75 ? "bg-green-50 text-green-600" : "bg-amber-50 text-amber-600"
                          )}>
                            {monthlyPercentage}% Month
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 font-mono">{student.rollNumber}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handleStatusChange(student.id, 'present')}
                      disabled={isDateLocked}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                        currentStatus === 'present' 
                          ? "bg-green-600 text-white border-green-600 shadow-md shadow-green-100" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Present
                    </button>
                    <button 
                      onClick={() => handleStatusChange(student.id, 'absent')}
                      disabled={isDateLocked}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                        currentStatus === 'absent' 
                          ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-100" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <XCircle className="w-4 h-4" />
                      Absent
                    </button>
                    <button 
                      onClick={() => handleStatusChange(student.id, 'leave')}
                      disabled={isDateLocked}
                      className={cn(
                        "flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all border",
                        currentStatus === 'leave' 
                          ? "bg-amber-500 text-white border-amber-500 shadow-md shadow-amber-100" 
                          : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      <Clock className="w-4 h-4" />
                      Leave
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {!loadingAttendance && filteredStudents.length === 0 && (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-slate-300" />
              </div>
              <p className="text-slate-500 font-medium">No active students found for this selection.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
