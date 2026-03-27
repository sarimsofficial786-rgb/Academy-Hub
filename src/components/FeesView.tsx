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
  serverTimestamp,
  setDoc,
  documentId
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cn } from '../lib/utils';
import { Student, Class, UserProfile, Fee } from '../types';
import { 
  Plus, 
  Search, 
  Filter, 
  DollarSign, 
  CreditCard, 
  History, 
  CheckCircle2, 
  AlertCircle, 
  Clock,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';

export default function FeesView({ profile }: { profile: UserProfile }) {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [fees, setFees] = useState<Fee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);

  useEffect(() => {
    const isTeacher = profile.role === 'teacher';
    const classIds = profile.assignedClassIds || [];

    const bQuery = isTeacher
      ? query(collection(db, 'classes'), where(documentId(), 'in', classIds.length > 0 ? classIds : ['_none_']))
      : collection(db, 'classes');

    let sUnsubscribe: (() => void) | null = null;
    let fUnsubscribe: (() => void) | null = null;

    const bUnsubscribe = onSnapshot(bQuery, (snapshot) => {
      const filteredClasses = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Class));
      setClasses(filteredClasses);
      
      const classNames = filteredClasses.map(b => b.name);
      const allIdentifiers = [...classIds, ...classNames];
      const safeIdentifiers = allIdentifiers.length > 0 ? allIdentifiers : ['_none_'];

      // Cleanup previous listeners if they exist
      if (sUnsubscribe) sUnsubscribe();
      if (fUnsubscribe) fUnsubscribe();

      const sQuery = isTeacher
        ? query(collection(db, 'students'), where('classId', 'in', safeIdentifiers))
        : collection(db, 'students');

      sUnsubscribe = onSnapshot(sQuery, (sSnapshot) => {
        setStudents(sSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Student)));
      }, (error) => {
        if (error.message?.includes('permission-denied')) return;
        handleFirestoreError(error, OperationType.GET, 'students');
      });

      const fQuery = isTeacher
        ? query(collection(db, 'fees'), where('month', '==', selectedMonth), where('classId', 'in', safeIdentifiers))
        : query(collection(db, 'fees'), where('month', '==', selectedMonth));

      fUnsubscribe = onSnapshot(fQuery, (fSnapshot) => {
        setFees(fSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Fee)));
        setLoading(false);
      }, (error) => {
        if (error.message?.includes('permission-denied')) return;
        handleFirestoreError(error, OperationType.GET, 'fees');
      });
    }, (error) => {
      if (error.message?.includes('permission-denied')) return;
      handleFirestoreError(error, OperationType.GET, 'classes');
    });

    return () => {
      bUnsubscribe();
      if (sUnsubscribe) sUnsubscribe();
      if (fUnsubscribe) fUnsubscribe();
    };
  }, [selectedMonth, profile]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudent) return;

    const cls = classes.find(b => b.id === selectedStudent.classId || b.name === selectedStudent.classId);
    if (!cls) return;

    const existingFee = fees.find(f => f.studentId === selectedStudent.id);
    const feeId = existingFee?.id || `${selectedStudent.id}_${selectedMonth}`;
    
    const paidAmount = (existingFee?.paidAmount || 0) + paymentAmount;
    const totalAmount = cls.monthlyFee;
    const remaining = totalAmount - paidAmount;
    const status = remaining <= 0 ? 'paid' : (paidAmount > 0 ? 'partial' : 'unpaid');

    try {
      await setDoc(doc(db, 'fees', feeId), {
        studentId: selectedStudent.id,
        month: selectedMonth,
        totalAmount,
        paidAmount,
        remaining,
        status,
        lastPaymentAt: new Date().toISOString(),
        classId: selectedStudent.classId
      }, { merge: true });

      setIsModalOpen(false);
      setSelectedStudent(null);
      setPaymentAmount(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `fees/${feeId}`);
    }
  };

  const filteredData = students
    .filter(s => s.status === 'active')
    .filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           s.rollNumber.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesClass = filterClass === 'all' || s.classId === filterClass;
      const fee = fees.find(f => f.studentId === s.id);
      const status = fee?.status || 'unpaid';
      const matchesStatus = filterStatus === 'all' || status === filterStatus;
      return matchesSearch && matchesClass && matchesStatus;
    });

  const canManage = profile.role === 'admin' || profile.permissions.manageFees;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Fees Management</h1>
          <p className="text-slate-500">Track monthly fee payments and dues</p>
        </div>
        <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() - 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="p-2 hover:bg-slate-50 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>
          <span className="font-bold text-slate-900 min-w-[120px] text-center">
            {format(new Date(selectedMonth + '-01'), 'MMMM yyyy')}
          </span>
          <button 
            onClick={() => {
              const d = new Date(selectedMonth + '-01');
              d.setMonth(d.getMonth() + 1);
              setSelectedMonth(format(d, 'yyyy-MM'));
            }}
            className="p-2 hover:bg-slate-50 rounded-lg"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search student..." 
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
          <option value="all">All Fee Status</option>
          <option value="paid">Paid</option>
          <option value="partial">Partial</option>
          <option value="unpaid">Unpaid</option>
        </select>
      </div>

      {/* Fees Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Class</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Total Fee</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Paid</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Remaining</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.map((student) => {
                const fee = fees.find(f => f.studentId === student.id);
                const cls = classes.find(b => b.id === student.classId);
                const totalFee = cls?.monthlyFee || 0;
                const paid = fee?.paidAmount || 0;
                const remaining = totalFee - paid;
                const status = fee?.status || 'unpaid';

                return (
                  <tr key={student.id} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div>
                        <p className="font-semibold text-slate-900">{student.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{student.rollNumber}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {cls?.name || 'Unknown'}
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-slate-900">${totalFee}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-bold text-green-600">${paid}</span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn("font-bold", remaining > 0 ? "text-red-600" : "text-slate-400")}>
                        ${remaining}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
                        status === 'paid' ? "bg-green-50 text-green-700" :
                        status === 'partial' ? "bg-amber-50 text-amber-700" : "bg-red-50 text-red-700"
                      )}>
                        {status === 'paid' ? <CheckCircle2 className="w-3 h-3" /> :
                         status === 'partial' ? <Clock className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                        {status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canManage && (
                        <button 
                          onClick={() => {
                            setSelectedStudent(student);
                            setPaymentAmount(0);
                            setIsModalOpen(true);
                          }}
                          className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-lg hover:bg-indigo-100 transition-all"
                        >
                          Add Payment
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {isModalOpen && selectedStudent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Add Payment</h2>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-50 rounded-lg">
                  <XCircle className="w-6 h-6" />
                </button>
              </div>
              <form onSubmit={handlePayment} className="p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 mb-4">
                  <p className="text-sm text-slate-500">Student</p>
                  <p className="font-bold text-slate-900">{selectedStudent.name}</p>
                  <p className="text-xs text-slate-500">{classes.find(b => b.id === selectedStudent.classId)?.name}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Payment Amount ($)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input 
                      required
                      type="number" 
                      className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(Number(e.target.value))}
                    />
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
                    Save Payment
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

const XCircle = ({ className }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);
