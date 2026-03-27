export type UserRole = 'admin' | 'teacher' | 'student';

export interface Permissions {
  viewDashboard: boolean;
  viewStudents: boolean;
  addStudents: boolean;
  editStudents: boolean;
  deleteStudents: boolean;
  viewClasses: boolean;
  manageClasses: boolean;
  markTodayAttendance: boolean;
  editTodayAttendance: boolean;
  viewAttendanceHistory: boolean;
  managePastAttendance: boolean;
  useUnifiedMode: boolean;
  manageFees: boolean;
  viewReports: boolean;
  exportReports: boolean;
  manageTeachers: boolean;
  createStudentLogin: boolean;
  manageOffDays: boolean;
  manageFinance: boolean;
  manageTimetable: boolean;
}

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  status: 'active' | 'inactive';
  assignedClassIds: string[];
  studentId?: string;
  joinedAt?: string;
  tempPassword?: string;
  permissions: Permissions;
  impersonatedBy?: string;
}

export interface Student {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  rollNumber: string;
  classId: string;
  status: 'active' | 'left' | 'completed';
  joinedAt: string;
  uid?: string;
  tempPassword?: string;
}

export interface Class {
  id: string;
  name: string;
  subjects: string[];
  subjectTeacherMap?: { [subject: string]: string }; // subject -> teacherUid
  timing: string;
  monthlyFee: number;
  offDays: string[];
  emergencyOnDates?: string[];
  emergencyOffDates?: string[];
  capacity?: number;
}

export interface Attendance {
  id: string;
  classId: string;
  date: string;
  markedBy: string;
  markedAt: string;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  status: 'present' | 'absent' | 'leave';
  date: string;
  classId: string;
  subject: string;
  teacherId?: string;
}

export interface Fee {
  id: string;
  studentId: string;
  month: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  status: 'paid' | 'unpaid' | 'partial';
  lastPaymentAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userName: string;
  timestamp: string;
  details: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'salary' | 'utility' | 'maintenance' | 'other';
  date: string;
  month: string;
  description?: string;
  paidTo?: string;
}

export interface TimetableSlot {
  id: string;
  classId: string;
  subject: string;
  teacherUid?: string;
  type: 'lecture' | 'break';
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
  room?: string;
}
