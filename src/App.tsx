import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  signOut,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  collection, 
  onSnapshot, 
  query, 
  where,
  getDocs,
  getDocFromServer,
  deleteDoc
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile, Permissions, UserRole } from './types';
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  CalendarCheck, 
  CreditCard, 
  BarChart3, 
  Settings, 
  LogOut, 
  GraduationCap,
  ShieldCheck,
  Menu,
  X,
  UserCircle,
  Database,
  ShieldAlert,
  Wallet,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// --- Utils ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Components ---

const LoadingScreen = () => (
  <div className="fixed inset-0 bg-slate-50 flex items-center justify-center z-50">
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center gap-4"
    >
      <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-600 font-medium">Academy Manager Loading...</p>
    </motion.div>
  </div>
);

const Login = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<'login' | 'select'>('select');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const firebaseUser = result.user;
      
      // Check if this is the admin or an existing user
      const isAdminEmail = firebaseUser.email === 'sarimsofficial786@gmail.com';
      if (!isAdminEmail) {
        // Check if user exists in Firestore
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        const studentQuery = query(collection(db, 'students'), where('uid', '==', firebaseUser.uid));
        const studentSnapshot = await getDocs(studentQuery);
        
        // Also check by email if UID doesn't match yet
        const userEmailQuery = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
        const userEmailSnapshot = await getDocs(userEmailQuery);
        const studentEmailQuery = query(collection(db, 'students'), where('email', '==', firebaseUser.email));
        const studentEmailSnapshot = await getDocs(studentEmailQuery);

        if (!userDoc.exists() && studentSnapshot.empty && userEmailSnapshot.empty && studentEmailSnapshot.empty) {
          await signOut(auth);
          throw new Error("Access denied. Please contact the administrator to create your account.");
        }
      }
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      try {
        // Try to sign in first
        await signInWithEmailAndPassword(auth, email, password);
      } catch (signInErr: any) {
        // If sign in fails, check if it's a new user with a temporary password
        if (signInErr.code === 'auth/user-not-found' || signInErr.code === 'auth/invalid-credential') {
          // Check teachers/users collection
          const uQuery = query(collection(db, 'users'), where('email', '==', email), where('tempPassword', '==', password));
          const uSnapshot = await getDocs(uQuery);
          
          if (!uSnapshot.empty) {
            // Create the auth user
            await createUserWithEmailAndPassword(auth, email, password);
            return;
          }

          // Check students collection
          const sQuery = query(collection(db, 'students'), where('email', '==', email), where('tempPassword', '==', password));
          const sSnapshot = await getDocs(sQuery);
          
          if (!sSnapshot.empty) {
            // Create the auth user
            await createUserWithEmailAndPassword(auth, email, password);
            return;
          }
        }
        throw signInErr;
      }
    } catch (err: any) {
      let msg = err.message;
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        msg = "Invalid email or password. If this is your first time, use the credentials provided by your admin.";
      }
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100"
      >
        <div className="flex flex-col items-center gap-6">
          <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <GraduationCap className="w-10 h-10 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900">Academy Manager</h1>
            <p className="text-slate-500 mt-2">Sign in to manage your academy records</p>
          </div>
          
          {mode === 'select' ? (
            <div className="w-full space-y-3">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 font-semibold py-3 px-4 rounded-xl hover:bg-slate-50 transition-all active:scale-95 disabled:opacity-50"
              >
                <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
                Continue with Google
              </button>
              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">Or</span></div>
              </div>
              <button
                onClick={() => setMode('login')}
                className="w-full flex items-center justify-center gap-3 bg-indigo-50 text-indigo-700 font-semibold py-3 px-4 rounded-xl hover:bg-indigo-100 transition-all active:scale-95"
              >
                Continue with Email
              </button>
            </div>
          ) : (
            <form onSubmit={handleEmailAuth} className="w-full space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input 
                  required
                  type="email" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                <input 
                  required
                  type="password" 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-indigo-100"
              >
                {loading ? 'Processing...' : 'Sign In'}
              </button>
              <div className="flex flex-col gap-2 text-center mt-4">
                <button 
                  type="button"
                  onClick={() => setMode('select')}
                  className="text-sm text-slate-500 font-medium hover:underline"
                >
                  Back to options
                </button>
              </div>
            </form>
          )}

          {error && (
            <p className="text-sm text-red-500 bg-red-50 p-3 rounded-lg w-full">{error}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
};

import DashboardView from './components/DashboardView';
import StudentsView from './components/StudentsView';
import ClassesView from './components/ClassesView';
import AttendanceView from './components/AttendanceView';
import TimetableView from './components/TimetableView';
import FeesView from './components/FeesView';
import FinanceView from './components/FinanceView';
import TeachersView from './components/TeachersView';
import ReportsView from './components/ReportsView';
import SettingsView from './components/SettingsView';
import StudentPanel from './components/StudentPanel';
import FakeDataView from './components/FakeDataView';

const DEFAULT_PERMISSIONS: Permissions = {
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

// --- Error Boundary ---
const ErrorBoundary: any = class extends React.Component<any, any> {
  constructor(props: any) {
    super(props);
    this['state'] = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this['state'].hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-red-50 p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-red-100 max-w-md w-full text-center">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-slate-900 mb-2">Something went wrong</h2>
            <p className="text-slate-500 mb-6">The application encountered an error. Please try refreshing the page.</p>
            <pre className="text-xs bg-slate-50 p-4 rounded-lg text-left overflow-auto max-h-40 mb-6">
              {this['state'].error?.message || 'Unknown error'}
            </pre>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-indigo-600 text-white font-bold py-3 rounded-xl hover:bg-indigo-700 transition-all"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this['props'].children;
  }
}

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [originalAdminProfile, setOriginalAdminProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const isAdminEmail = firebaseUser.email === 'sarimsofficial786@gmail.com';
        console.log("Auth state changed:", { email: firebaseUser.email, isAdminEmail });
        
        // Check if user is a student first
        let studentDoc: any = null;
        if (!isAdminEmail) {
          const sQueryUid = query(collection(db, 'students'), where('uid', '==', firebaseUser.uid));
          const sSnapshotUid = await getDocs(sQueryUid);
          
          if (!sSnapshotUid.empty) {
            studentDoc = { id: sSnapshotUid.docs[0].id, ...sSnapshotUid.docs[0].data() };
          } else if (firebaseUser.email) {
            const sQueryEmail = query(collection(db, 'students'), where('email', '==', firebaseUser.email));
            const sSnapshotEmail = await getDocs(sQueryEmail);
            if (!sSnapshotEmail.empty) {
              studentDoc = { id: sSnapshotEmail.docs[0].id, ...sSnapshotEmail.docs[0].data() };
              await updateDoc(doc(db, 'students', studentDoc.id), { uid: firebaseUser.uid });
            }
          }
        }

        if (studentDoc) {
          const studentProfile: UserProfile = {
            uid: firebaseUser.uid,
            name: firebaseUser.displayName || studentDoc.name || 'Student',
            email: firebaseUser.email || studentDoc.email || '',
            role: 'student',
            status: 'active',
            assignedClassIds: [studentDoc.classId],
            studentId: studentDoc.id,
            permissions: DEFAULT_PERMISSIONS
          };
          setProfile(studentProfile);
          setActiveTab('student-panel');
          setLoading(false);
        } else {
          // Real-time listener for user profile
          profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), async (userDoc) => {
            if (userDoc.exists()) {
              const data = userDoc.data() as UserProfile;
              if (isAdminEmail && data.role !== 'admin') {
                const updatedAdminProfile = { 
                  ...data, 
                  role: 'admin' as const,
                  permissions: { 
                    ...DEFAULT_PERMISSIONS, 
                    manageTeachers: true, 
                    manageClasses: true, 
                    manageFees: true, 
                    manageFinance: true,
                    addStudents: true, 
                    editStudents: true, 
                    deleteStudents: true, 
                    managePastAttendance: true, 
                    useUnifiedMode: true, 
                    exportReports: true, 
                    createStudentLogin: true,
                    manageOffDays: true,
                    manageTimetable: true
                  }
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), updatedAdminProfile, { merge: true });
                setProfile(updatedAdminProfile);
              } else {
                setProfile(data);
              }
              setLoading(false);
            } else if (firebaseUser.email) {
              // Check by email if UID doc doesn't exist yet
              const uQueryEmail = query(collection(db, 'users'), where('email', '==', firebaseUser.email));
              const uSnapshotEmail = await getDocs(uQueryEmail);
              
              if (!uSnapshotEmail.empty) {
                const existingUserDoc = uSnapshotEmail.docs[0];
                const existingUserData = existingUserDoc.data() as UserProfile;
                const updatedProfile = { 
                  ...existingUserData, 
                  uid: firebaseUser.uid,
                  role: isAdminEmail ? 'admin' as const : existingUserData.role,
                  permissions: isAdminEmail ? { 
                    ...DEFAULT_PERMISSIONS, 
                    manageTeachers: true, 
                    manageClasses: true, 
                    manageFees: true, 
                    manageFinance: true,
                    addStudents: true, 
                    editStudents: true, 
                    deleteStudents: true, 
                    managePastAttendance: true, 
                    useUnifiedMode: true, 
                    exportReports: true, 
                    createStudentLogin: true,
                    manageOffDays: true,
                    manageTimetable: true
                  } : existingUserData.permissions
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), updatedProfile);
                if (existingUserDoc.id !== firebaseUser.uid) {
                  await deleteDoc(doc(db, 'users', existingUserDoc.id));
                }
                // The onSnapshot will trigger again for the new UID doc
              } else {
                const newProfile: UserProfile = {
                  uid: firebaseUser.uid,
                  name: firebaseUser.displayName || 'New User',
                  email: firebaseUser.email || '',
                  role: isAdminEmail ? 'admin' : 'teacher',
                  status: 'active',
                  assignedClassIds: [],
                  permissions: isAdminEmail ? { 
                    ...DEFAULT_PERMISSIONS, 
                    manageTeachers: true, 
                    manageClasses: true, 
                    manageFees: true, 
                    manageFinance: true,
                    addStudents: true, 
                    editStudents: true, 
                    deleteStudents: true, 
                    managePastAttendance: true, 
                    useUnifiedMode: true, 
                    exportReports: true, 
                    createStudentLogin: true, 
                    manageOffDays: true,
                    manageTimetable: true 
                  } : DEFAULT_PERMISSIONS
                };
                await setDoc(doc(db, 'users', firebaseUser.uid), newProfile);
              }
            }
          }, (error) => {
            // If we get a permission error here, it's likely because the user was signed out by our Google check
            if (error.message?.includes('permission-denied')) return;
            handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
            setLoading(false);
          });
        }
        setUser(firebaseUser);
      } else {
        setUser(null);
        setProfile(null);
        if (profileUnsubscribe) profileUnsubscribe();
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (profileUnsubscribe) profileUnsubscribe();
    };
  }, []);

  const handleImpersonate = (targetProfile: UserProfile) => {
    if (profile?.role === 'admin') {
      setOriginalAdminProfile(profile);
      setProfile({ ...targetProfile, impersonatedBy: profile.name });
      setActiveTab(targetProfile.role === 'student' ? 'student-panel' : 'dashboard');
    }
  };

  const stopImpersonation = () => {
    if (originalAdminProfile) {
      setProfile(originalAdminProfile);
      setOriginalAdminProfile(null);
      setActiveTab('dashboard');
    }
  };

  if (loading) return <LoadingScreen />;
  if (!user) return <Login />;
  if (!profile) return <LoadingScreen />;

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'viewDashboard' },
    { id: 'students', label: 'Students', icon: Users, permission: 'viewStudents' },
    { id: 'classes', label: 'Classes', icon: BookOpen, permission: 'viewClasses' },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, permission: 'viewAttendanceHistory' },
    { id: 'timetable', label: 'Timetable', icon: Clock, permission: 'viewDashboard' },
    { id: 'fees', label: 'Fees', icon: CreditCard, permission: 'manageFees' },
    { id: 'finance', label: 'Finance', icon: Wallet, permission: 'manageFinance' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'viewReports' },
    { id: 'teachers', label: 'Teachers', icon: ShieldCheck, permission: 'manageTeachers' },
    { id: 'seed-data', label: 'Seed Data', icon: Database, permission: 'manageTeachers' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'viewDashboard' },
  ];

  const studentMenuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'viewDashboard' },
    { id: 'classes', label: 'Classes', icon: BookOpen, permission: 'viewClasses' },
    { id: 'attendance', label: 'Attendance', icon: CalendarCheck, permission: 'viewAttendanceHistory' },
    { id: 'timetable', label: 'Timetable', icon: Clock, permission: 'viewDashboard' },
    { id: 'fees', label: 'Fees', icon: CreditCard, permission: 'manageFees' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'viewReports' },
    { id: 'settings', label: 'Settings', icon: Settings, permission: 'viewDashboard' },
  ];

  const filteredMenuItems = profile.role === 'student' 
    ? studentMenuItems 
    : menuItems.filter(item => {
        if (profile.role === 'admin') return true;
        if (item.id === 'attendance') {
          return profile.permissions.viewAttendanceHistory || profile.permissions.markTodayAttendance;
        }
        return profile.permissions[item.permission as keyof Permissions];
      });

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-slate-50 flex">
        {/* Sidebar */}
        <aside className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transition-transform lg:relative lg:translate-x-0",
          !isSidebarOpen && "-translate-x-full"
        )}>
          <div className="h-full flex flex-col">
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <GraduationCap className="w-5 h-5 text-white" />
                </div>
                <span className="font-bold text-slate-900">Academy Hub</span>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="lg:hidden p-2 text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              {filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all",
                    activeTab === item.id 
                      ? "bg-indigo-50 text-indigo-600 font-semibold shadow-sm" 
                      : "text-slate-600 hover:bg-slate-50"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", activeTab === item.id ? "text-indigo-600" : "text-slate-400")} />
                  {item.label}
                </button>
              ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
              {profile.impersonatedBy && (
                <button 
                  onClick={stopImpersonation}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-amber-50 text-amber-700 font-bold rounded-xl mb-3 hover:bg-amber-100 transition-all border border-amber-100"
                >
                  <ShieldAlert className="w-5 h-5" />
                  Return to Admin
                </button>
              )}
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl mb-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                  <UserCircle className="w-6 h-6 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900 truncate">{profile.name}</p>
                  <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
                </div>
              </div>
              <button 
                onClick={() => signOut(auth)}
                className="w-full flex items-center gap-3 px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-all"
              >
                <LogOut className="w-5 h-5" />
                Sign Out
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-8">
            <button onClick={() => setIsSidebarOpen(true)} className="lg:hidden p-2 text-slate-500">
              <Menu className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-4">
              <h2 className="text-lg font-bold text-slate-900 capitalize">
                {activeTab}
              </h2>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-green-50 text-green-700 rounded-full text-xs font-medium border border-green-100">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                System Online
              </div>
            </div>
          </header>

          <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {profile.role === 'student' ? (
                  <StudentPanel profile={profile} activeTab={activeTab} />
                ) : (
                  <>
                    {activeTab === 'dashboard' && <DashboardView profile={profile} />}
                    {activeTab === 'students' && <StudentsView profile={profile} onImpersonate={handleImpersonate} />}
                    {activeTab === 'classes' && <ClassesView profile={profile} />}
                    {activeTab === 'attendance' && <AttendanceView profile={profile} />}
                    {activeTab === 'timetable' && <TimetableView profile={profile} />}
                    {activeTab === 'fees' && <FeesView profile={profile} />}
                    {activeTab === 'finance' && <FinanceView profile={profile} />}
                    {activeTab === 'teachers' && <TeachersView profile={profile} onImpersonate={handleImpersonate} />}
                    {activeTab === 'reports' && <ReportsView profile={profile} />}
                    {activeTab === 'settings' && <SettingsView profile={profile} />}
                    {activeTab === 'seed-data' && <FakeDataView profile={profile} />}
                  </>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

const AlertCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
