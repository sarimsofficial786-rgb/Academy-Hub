import React, { useState, useEffect } from 'react';
import { updateDoc, doc, collection, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { UserProfile } from '../types';
import { 
  User, 
  Mail, 
  Phone, 
  Shield, 
  Save, 
  CheckCircle2,
  AlertCircle,
  Database,
  ExternalLink,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

export default function SettingsView({ profile }: { profile: UserProfile }) {
  const [formData, setFormData] = useState({
    name: profile.name,
    phone: profile.phone || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  
  // Real-time stats
  const [counts, setCounts] = useState({
    students: 0,
    classes: 0,
    attendance: 0,
    fees: 0
  });

  useEffect(() => {
    const unsubStudents = onSnapshot(collection(db, 'students'), (s) => setCounts(prev => ({ ...prev, students: s.size })));
    const unsubClasses = onSnapshot(collection(db, 'classes'), (s) => setCounts(prev => ({ ...prev, classes: s.size })));
    const unsubAttendance = onSnapshot(collection(db, 'attendance_records'), (s) => setCounts(prev => ({ ...prev, attendance: s.size })));
    const unsubFees = onSnapshot(collection(db, 'fees'), (s) => setCounts(prev => ({ ...prev, fees: s.size })));

    return () => {
      unsubStudents();
      unsubClasses();
      unsubAttendance();
      unsubFees();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    if (!profile.uid) {
      setMessage({ type: 'error', text: 'User ID is missing. Please try logging in again.' });
      setIsSaving(false);
      return;
    }
    try {
      await updateDoc(doc(db, 'users', profile.uid), formData);
      setMessage({ type: 'success', text: 'Profile updated successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
      setMessage({ type: 'error', text: 'Failed to update profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Manage your profile and account preferences</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-100">
              <User className="w-8 h-8 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">{profile.name}</h3>
              <p className="text-sm text-slate-500 capitalize">{profile.role} Account</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl flex items-center gap-3 font-medium",
                message.type === 'success' ? "bg-green-50 text-green-700 border border-green-200" : "bg-red-50 text-red-700 border border-red-200"
              )}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              {message.text}
            </motion.div>
          )}

          <div className="grid grid-cols-1 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  required
                  type="text" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.name}
                  onChange={(e) => setFormData({...formData, name: e.target.value})}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  disabled
                  type="email" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-100 border border-slate-200 rounded-xl text-slate-500 cursor-not-allowed"
                  value={profile.email}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1">Email cannot be changed as it is linked to your Google account.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input 
                  type="tel" 
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-100 flex justify-end">
            <button 
              type="submit"
              disabled={isSaving}
              className="flex items-center justify-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all active:scale-95 shadow-lg shadow-indigo-100 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {isSaving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>

      {/* Database Usage Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Real-Time Database Usage</h3>
              <p className="text-sm text-slate-500">Current number of records in your academy</p>
            </div>
          </div>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Students</p>
              <p className="text-2xl font-bold text-indigo-600">{counts.students}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Classes</p>
              <p className="text-2xl font-bold text-indigo-600">{counts.classes}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Attendance</p>
              <p className="text-2xl font-bold text-indigo-600">{counts.attendance}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-center">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fee Records</p>
              <p className="text-2xl font-bold text-indigo-600">{counts.fees}</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex gap-3">
                <Info className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-sm font-bold text-indigo-900">Understanding Storage</p>
                  <p className="text-xs text-indigo-700 leading-relaxed">
                    Firestore storage depends on the total size of these records. 1GB of storage can typically hold hundreds of thousands of documents like these.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div>
                <p className="text-sm font-bold text-slate-900">Detailed Quota Usage</p>
                <p className="text-xs text-slate-500">View exact storage and read/write limits in your console.</p>
              </div>
              <a 
                href="https://console.firebase.google.com/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 transition-colors"
              >
                Open Firebase Console
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-6 h-6 text-indigo-600" />
          <h3 className="text-lg font-bold text-slate-900">Security & Role</h3>
        </div>
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
            <div>
              <p className="text-sm font-bold text-slate-900">Account Role</p>
              <p className="text-xs text-slate-500 capitalize">{profile.role}</p>
            </div>
            <span className="px-3 py-1 bg-indigo-100 text-indigo-700 text-xs font-bold rounded-full">
              Verified
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}


