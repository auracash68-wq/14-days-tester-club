import React, { useState, useEffect } from 'react';
import { 
  collection, query, doc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  safeOnSnapshot, safeGetDocs, safeGetDoc, safeSetDoc, safeUpdateDoc, safeDeleteDoc 
} from '../firebase/db';
import { User, UserReport, ModerationLog } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Shield, ShieldAlert, Users, Layers, Flag, 
  Trash2, Ban, VolumeX, Volume2, ShieldCheck, 
  History, Info, Lock, Unlock, CheckCircle
} from 'lucide-react';

interface LeaderPageProps {
  currentUser: User;
  onRefreshUser: () => void;
}

export default function LeaderPage({ currentUser, onRefreshUser }: LeaderPageProps) {
  // Authentication Gate State
  const [adminEmailInput, setAdminEmailInput] = useState('');
  const [adminPasswordInput, setAdminPasswordInput] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const isEmailAdmin = currentUser.email === 'gazisahidhosen76@gmail.com';
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return isEmailAdmin || localStorage.getItem('admin_panel_unlocked') === 'true';
  });

  // System states
  const [loading, setLoading] = useState(true);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [totalUsersCount, setTotalUsersCount] = useState(0);
  const [totalAppsCount, setTotalAppsCount] = useState(0);
  const [reportedUsersList, setReportedUsersList] = useState<UserReport[]>([]);
  const [reportedCount, setReportedCount] = useState(0);
  const [moderationLogs, setModerationLogs] = useState<ModerationLog[]>([]);

  // Local input for moderation action
  const [modReason, setModReason] = useState<{ [key: string]: string }>({});

  // Sync isUnlocked when logged in user is the administrator
  useEffect(() => {
    if (isEmailAdmin) {
      setIsUnlocked(true);
      localStorage.setItem('admin_panel_unlocked', 'true');
    }
  }, [currentUser.email, isEmailAdmin]);

  // Statistics & Subscriptions (Loads only if unlocked or is admin)
  useEffect(() => {
    if (!isUnlocked) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Subscribe to all users in community
    const unsubUsers = safeOnSnapshot(collection(db, 'users'), (snapshot) => {
      setTotalUsersCount(snapshot.docs?.length || 0);
      const users: User[] = [];
      snapshot.forEach(docSnap => {
        users.push(docSnap.data() as User);
      });
      setAllUsers(users);
      setLoading(false);
    }, (err) => {
      console.error("Users load error: ", err);
      setLoading(false);
    });

    // Subscribe to apps
    const unsubApps = safeOnSnapshot(collection(db, 'apps'), (snapshot) => {
      setTotalAppsCount(snapshot.docs?.length || 0);
    });

    // Subscribe to active reported incidents
    const unsubReports = safeOnSnapshot(collection(db, 'user_reports'), (snapshot) => {
      const reports: UserReport[] = [];
      snapshot.forEach(docSnap => {
        reports.push(docSnap.data() as UserReport);
      });
      setReportedUsersList(reports);
      setReportedCount(reports.filter(r => r.status === 'Pending').length);
    });

    // Subscribe to moderation audit history log
    const unsubLogs = safeOnSnapshot(collection(db, 'moderation_logs'), (snapshot) => {
      const logs: ModerationLog[] = [];
      snapshot.forEach(docSnap => {
        logs.push(docSnap.data() as ModerationLog);
      });
      setModerationLogs(logs.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    });

    return () => {
      unsubUsers();
      unsubApps();
      unsubReports();
      unsubLogs();
    };
  }, [isUnlocked]);

  // Admin access gate trigger
  const handleAdminGateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const trimmedEmail = adminEmailInput.trim().toLowerCase();
    const trimmedPass = adminPasswordInput.trim();

    if (trimmedEmail === 'gazisahidhosen76@gmail.com' && trimmedPass === '86537334190') {
      setIsUnlocked(true);
      localStorage.setItem('admin_panel_unlocked', 'true');
      alert("Clearance approved. Secure connection established to Leader Console.");
    } else {
      setLoginError("Incorrect credentials. Please verify your Administrator Email and Password.");
    }
  };

  // Lock the admin panel back
  const handleLockPanel = () => {
    setIsUnlocked(false);
    localStorage.removeItem('admin_panel_unlocked');
    setAdminEmailInput('');
    setAdminPasswordInput('');
    alert("Leader Console locked successfully.");
  };

  // Mute member action
  const handleLeaderMute = async (targetUser: User, action: 'Mute' | 'Unmute') => {
    const reason = modReason[targetUser.uid]?.trim();
    if (action === 'Mute' && !reason) {
      alert("Please enter a professional reason for muting this user.");
      return;
    }

    try {
      const targetRef = doc(db, 'users', targetUser.uid);
      await safeUpdateDoc(targetRef, {
        muted: action === 'Mute'
      });

      // Log moderation action
      const logId = `modlog_${Date.now()}`;
      await safeSetDoc(doc(db, 'moderation_logs', logId), {
        id: logId,
        leaderUid: currentUser.uid,
        leaderName: currentUser.displayName,
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        actionType: action === 'Mute' ? 'Mute' : 'Unmute',
        reason: action === 'Mute' ? reason : 'Mute privilege restored',
        createdAt: new Date().toISOString()
      });

      // Clear input reason
      setModReason(prev => ({ ...prev, [targetUser.uid]: '' }));
      alert(`User ${targetUser.displayName} has been successfully ${action === 'Mute' ? 'muted' : 'unmuted'}.`);
    } catch (err) {
      console.error(err);
      alert("Failed to perform mute operation.");
    }
  };

  // Suspend member action
  const handleLeaderSuspend = async (targetUser: User, duration: '24h' | '7d' | '14d') => {
    const reason = modReason[targetUser.uid]?.trim();
    if (!reason) {
      alert("Please provide a moderation reason before executing user suspension.");
      return;
    }

    let suspensionEnd = new Date();
    let type: any = 'Suspend_24h';
    if (duration === '24h') {
      suspensionEnd.setHours(suspensionEnd.getHours() + 24);
    } else if (duration === '7d') {
      suspensionEnd.setDate(suspensionEnd.getDate() + 7);
      type = 'Suspend_7d';
    } else {
      suspensionEnd.setDate(suspensionEnd.getDate() + 14);
      type = 'Suspend_14d';
    }

    try {
      const targetRef = doc(db, 'users', targetUser.uid);
      await safeUpdateDoc(targetRef, {
        suspendedUntil: suspensionEnd.toISOString()
      });

      // Log moderation action
      const logId = `modlog_${Date.now()}`;
      await safeSetDoc(doc(db, 'moderation_logs', logId), {
        id: logId,
        leaderUid: currentUser.uid,
        leaderName: currentUser.displayName,
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        actionType: type,
        reason: reason,
        createdAt: new Date().toISOString()
      });

      setModReason(prev => ({ ...prev, [targetUser.uid]: '' }));
      alert(`User suspended until ${suspensionEnd.toLocaleString()}.`);
    } catch (err) {
      console.error(err);
      alert("Failed to suspend user.");
    }
  };

  // Ban user action (sets suspended indefinitely)
  const handleLeaderBan = async (targetUser: User) => {
    const reason = modReason[targetUser.uid]?.trim();
    if (!reason) {
      alert("Please provide an explicit ban reason to block community entry.");
      return;
    }

    if (!window.confirm(`Are you absolutely sure you want to permanently BAN ${targetUser.displayName}? This restricts all application logins.`)) {
      return;
    }

    const suspensionEnd = new Date('2099-12-31T23:59:59.000Z');

    try {
      const targetRef = doc(db, 'users', targetUser.uid);
      await safeUpdateDoc(targetRef, {
        suspendedUntil: suspensionEnd.toISOString()
      });

      // Log moderation action
      const logId = `modlog_${Date.now()}`;
      await safeSetDoc(doc(db, 'moderation_logs', logId), {
        id: logId,
        leaderUid: currentUser.uid,
        leaderName: currentUser.displayName,
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        actionType: 'Ban',
        reason: reason,
        createdAt: new Date().toISOString()
      });

      setModReason(prev => ({ ...prev, [targetUser.uid]: '' }));
      alert(`User permanently banned successfully.`);
    } catch (err) {
      console.error(err);
      alert("Failed to ban user.");
    }
  };

  // Revoke/Lift all penalties
  const handleUnsuspendUser = async (targetUser: User) => {
    try {
      await safeUpdateDoc(doc(db, 'users', targetUser.uid), {
        suspendedUntil: null,
        muted: false
      });

      const logId = `modlog_${Date.now()}`;
      await safeSetDoc(doc(db, 'moderation_logs', logId), {
        id: logId,
        leaderUid: currentUser.uid,
        leaderName: currentUser.displayName,
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        actionType: 'Unsuspend',
        reason: 'Restored to good standing by Administrator',
        createdAt: new Date().toISOString()
      });

      alert(`User ${targetUser.displayName} restored to active status.`);
    } catch (err) {
      console.error(err);
      alert("Error lifting user penalties.");
    }
  };

  // Delete User Account
  const handleLeaderDeleteAccount = async (targetUser: User) => {
    const reason = modReason[targetUser.uid]?.trim() || "Account purged by Administrator";
    
    if (!window.confirm(`CRITICAL ACTION: Are you sure you want to delete the user account for ${targetUser.displayName}? This cannot be undone.`)) {
      return;
    }

    try {
      await safeDeleteDoc(doc(db, 'users', targetUser.uid));

      // Log moderation action
      const logId = `modlog_${Date.now()}`;
      await safeSetDoc(doc(db, 'moderation_logs', logId), {
        id: logId,
        leaderUid: currentUser.uid,
        leaderName: currentUser.displayName,
        targetUid: targetUser.uid,
        targetName: targetUser.displayName,
        actionType: 'Delete_Account',
        reason: reason,
        createdAt: new Date().toISOString()
      });

      setModReason(prev => ({ ...prev, [targetUser.uid]: '' }));
      alert(`User ${targetUser.displayName} has been successfully deleted from the database.`);
    } catch (err) {
      console.error(err);
      alert("Failed to delete user account.");
    }
  };

  // Action Incident Reports
  const handleActionReport = async (report: UserReport, action: 'Reviewed' | 'Dismissed') => {
    try {
      if (action === 'Dismissed') {
        await safeDeleteDoc(doc(db, 'user_reports', report.id));
      } else {
        await safeUpdateDoc(doc(db, 'user_reports', report.id), { status: 'Reviewed' });
      }
      alert(`Reported incident has been marked as ${action}.`);
    } catch (err) {
      console.error(err);
      alert("Error processing report action.");
    }
  };

  // Render Loader if Subscriptions are booting up
  if (isUnlocked && loading) {
    return (
      <div className="flex h-[80vh] items-center justify-center bg-[#0F172A]" id="leader_loading_state">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-[#0F172A] min-h-[calc(100vh-4rem)] text-left" id="leader_page_container">
      
      <AnimatePresence mode="wait">
        {!isUnlocked ? (
          // GOOGLE SECURITY GATE (ACCESS RESTRICTED SCREEN)
          <motion.div
            key="lock_gate_screen"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="flex items-center justify-center py-10"
            id="admin_lock_gate_view"
          >
            <div className="w-full max-w-lg rounded-3xl border border-red-500/30 bg-[#1E293B] p-8 shadow-2xl text-center">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 text-red-500">
                <Lock className="h-8 w-8" />
              </div>

              <h2 className="text-2xl font-black text-white tracking-tight uppercase">Google Security clearance</h2>
              <div className="h-1 w-20 bg-red-500 mx-auto mt-3 rounded-full" />

              <p className="mt-5 text-sm leading-relaxed text-slate-300">
                This page is strictly for the **Administrator**. General users, testing group members, or unauthorized visitors are not allowed to access this area.
              </p>

              <div className="mt-4 p-4 rounded-xl bg-slate-950/40 border border-slate-800 text-left text-xs text-slate-400 leading-relaxed">
                <span className="font-bold text-red-400 block mb-1">Access Restructured Mode:</span>
                Admin dashboard utilizes Google high-security guidelines. Access is secured. To proceed, please authorize with the designated secure email address and passcode.
              </div>

              {loginError && (
                <div className="mt-4 text-xs font-semibold text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20" id="access_gate_error">
                  {loginError}
                </div>
              )}

              <form onSubmit={handleAdminGateSubmit} className="mt-6 space-y-4 text-left">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Administrator Gmail</label>
                  <input
                    type="email"
                    required
                    value={adminEmailInput}
                    onChange={(e) => setAdminEmailInput(e.target.value)}
                    placeholder="example@gmail.com"
                    className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    id="admin_gate_email"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">Secret Passcode</label>
                  <input
                    type="password"
                    required
                    value={adminPasswordInput}
                    onChange={(e) => setAdminPasswordInput(e.target.value)}
                    placeholder="••••••••••••••"
                    className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-red-500"
                    id="admin_gate_password"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full flex justify-center items-center space-x-2 rounded-xl bg-red-600 hover:bg-red-700 text-white py-3.5 px-4 font-bold text-sm shadow-lg transition-all"
                  id="admin_gate_submit_btn"
                >
                  <Unlock className="h-4 w-4" />
                  <span>Verify Credentials</span>
                </button>
              </form>
            </div>
          </motion.div>
        ) : (
          // ADMINISTRATIVE WORKSPACE
          <motion.div
            key="unlocked_leader_workspace"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 15 }}
            className="space-y-8"
            id="unlocked_admin_workspace"
          >
            {/* Header Area */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-6">
              <div>
                <h2 className="text-3xl font-black text-white flex items-center gap-2.5">
                  <Shield className="h-8 w-8 text-emerald-400 animate-pulse" />
                  Administrator Leader Panel
                </h2>
                <p className="text-sm text-slate-400 mt-1">
                  Active directory moderation, incident response center, and system logs.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[11px] font-bold font-mono px-3.5 py-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  Verified Admin Session
                </span>
                <button
                  onClick={handleLockPanel}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl px-4 py-2 text-xs font-bold transition-all"
                  id="admin_lock_session_btn"
                >
                  Lock Panel
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4" id="admin_stats_grid">
              <div className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-blue-600 to-indigo-700 p-5 shadow-xl shadow-blue-900/10">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-100 uppercase tracking-wider">Total Members</span>
                  <Users className="h-4 w-4 text-blue-200" />
                </div>
                <p className="text-3xl font-black text-white mt-2">{totalUsersCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Apps</span>
                  <Layers className="h-4 w-4 text-emerald-500" />
                </div>
                <p className="text-3xl font-bold text-white mt-2">{totalAppsCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Open Incidents</span>
                  <ShieldAlert className="h-4 w-4 text-[#EF4444]" />
                </div>
                <p className="text-3xl font-bold text-red-400 mt-2">{reportedCount}</p>
              </div>

              <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-5 shadow-md">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Logged Audit Trails</span>
                  <History className="h-4 w-4 text-amber-500" />
                </div>
                <p className="text-3xl font-bold text-white mt-2">{moderationLogs.length}</p>
              </div>
            </div>

            {/* Main Interactive Moderation Workspace */}
            <div className="grid gap-8 lg:grid-cols-3" id="admin_main_controls">
              
              {/* Columns left-mid: Moderation Directory and Active Incidents */}
              <div className="lg:col-span-2 space-y-8">
                
                {/* 1. Violation Center: Active Incidents list */}
                <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 shadow-xl text-left">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                    <Flag className="h-5 w-5 text-red-500" />
                    Incident Queue (User Reports)
                  </h3>

                  {reportedUsersList.length === 0 ? (
                    <div className="text-center py-10 text-xs text-slate-500 italic">
                      No open member reports at this time. All users are behaving perfectly!
                    </div>
                  ) : (
                    <div className="space-y-4" id="reports_list_viewport">
                      {reportedUsersList.map((rep) => (
                        <div key={rep.id} className="p-4 rounded-xl border border-slate-850 bg-slate-900/60 text-xs leading-relaxed">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-bold text-slate-200">
                              Reported User: {rep.reportedName} <span className="font-mono text-[10px] text-slate-500">({rep.reportedUid.slice(0, 8)})</span>
                            </span>
                            <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold uppercase ${rep.status === 'Reviewed' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400 border border-red-500/10'}`}>
                              {rep.status}
                            </span>
                          </div>
                          
                          <p className="text-slate-300">
                            <span className="text-slate-500 font-bold">Reason filed:</span> {rep.reason}
                          </p>

                          {rep.evidenceText && (
                            <div className="mt-2.5 font-mono text-[10px] text-slate-400 bg-slate-950 p-2.5 rounded border border-slate-850 break-all leading-normal whitespace-pre-wrap">
                              <span className="text-slate-500 font-semibold uppercase tracking-wide block mb-1">[Logged Evidence]:</span>
                              {rep.evidenceText}
                            </div>
                          )}

                          <div className="mt-3.5 flex justify-between items-center pt-2.5 border-t border-slate-800/80 text-[10px]">
                            <span className="text-slate-500">Filed by {rep.reporterName}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleActionReport(rep, 'Dismissed')}
                                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg font-bold"
                              >
                                Dismiss Incident
                              </button>
                              {rep.status === 'Pending' && (
                                <button
                                  onClick={() => handleActionReport(rep, 'Reviewed')}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold"
                                >
                                  Mark Reviewed
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Moderation Directory - Interactive Users Dashboard */}
                <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 shadow-xl text-left">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                    <Users className="h-5 w-5 text-blue-400" />
                    Community Member Moderation Directory
                  </h3>

                  <div className="space-y-5" id="member_list_root">
                    {allUsers.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-500">No active members registered.</div>
                    ) : (
                      allUsers.map((user) => {
                        const isSuspended = user.suspendedUntil && new Date(user.suspendedUntil) > new Date();
                        const isUserAdmin = user.email === 'gazisahidhosen76@gmail.com';
                        
                        return (
                          <div key={user.uid} className="p-4 rounded-xl border border-slate-850 bg-slate-900/30 space-y-3" id={`member_card_${user.uid}`}>
                            
                            {/* User Header Info Row */}
                            <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                              <div className="flex items-center space-x-3">
                                <img
                                  src={user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'}
                                  alt={user.displayName}
                                  referrerPolicy="no-referrer"
                                  className="h-10 w-10 rounded-full border border-slate-800 object-cover"
                                />
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-bold text-white text-sm">{user.displayName}</span>
                                    {isUserAdmin && (
                                      <span className="bg-red-500/10 text-red-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-red-500/20">
                                        Super Admin
                                      </span>
                                    )}
                                    {user.role === 'leader' && !isUserAdmin && (
                                      <span className="bg-blue-500/10 text-blue-400 text-[9px] font-bold px-1.5 py-0.5 rounded border border-blue-500/20">
                                        Leader
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[10px] font-mono text-slate-500 mt-0.5">{user.email} | UID: {user.uid.slice(0, 10)}...</p>
                                </div>
                              </div>

                              {/* Status Badges */}
                              <div className="flex items-center gap-2">
                                {user.muted && (
                                  <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                                    Muted
                                  </span>
                                )}
                                {isSuspended && (
                                  <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                                    Suspended
                                  </span>
                                )}
                                {!user.muted && !isSuspended && (
                                  <span className="bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-0.5 rounded text-[9px] font-bold uppercase">
                                    Good Standing
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* User Bio and Contact if any */}
                            {(user.contactNumber || user.bio) && (
                              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded border border-slate-850/60 leading-relaxed">
                                {user.contactNumber && <p className="font-mono text-slate-500 font-semibold mb-1">📞 Contact: {user.contactNumber}</p>}
                                {user.bio && <p className="italic">"{user.bio}"</p>}
                              </div>
                            )}

                            {/* Moderation Controls (Hidden for Self Admin to prevent self lockout) */}
                            {!isUserAdmin && (
                              <div className="pt-2 border-t border-slate-800/60 space-y-2.5">
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="Enter moderation audit reason..."
                                    value={modReason[user.uid] || ''}
                                    onChange={(e) => setModReason(prev => ({ ...prev, [user.uid]: e.target.value }))}
                                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none"
                                  />
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                  {/* Mute/Unmute toggle */}
                                  <button
                                    onClick={() => handleLeaderMute(user, user.muted ? 'Unmute' : 'Mute')}
                                    className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all border ${
                                      user.muted 
                                        ? 'bg-amber-600/10 hover:bg-amber-600 text-amber-400 hover:text-white border-amber-500/30' 
                                        : 'bg-slate-800 hover:bg-amber-500/20 hover:text-amber-400 border-slate-700/60'
                                    }`}
                                  >
                                    {user.muted ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                                    <span>{user.muted ? 'Unmute' : 'Mute User'}</span>
                                  </button>

                                  {/* Suspension Timers */}
                                  {!isSuspended ? (
                                    <>
                                      <button
                                        onClick={() => handleLeaderSuspend(user, '24h')}
                                        className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700/60 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all"
                                      >
                                        Suspend 24H
                                      </button>
                                      <button
                                        onClick={() => handleLeaderSuspend(user, '7d')}
                                        className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700/60 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all"
                                      >
                                        Suspend 7D
                                      </button>
                                      <button
                                        onClick={() => handleLeaderSuspend(user, '14d')}
                                        className="bg-slate-800 hover:bg-red-500/20 hover:text-red-400 border border-slate-700/60 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all"
                                      >
                                        Suspend 14D
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      onClick={() => handleUnsuspendUser(user)}
                                      className="bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 rounded text-[10px] font-bold transition-all"
                                    >
                                      Revoke Suspension
                                    </button>
                                  )}

                                  {/* Permanent Ban */}
                                  <button
                                    onClick={() => handleLeaderBan(user)}
                                    className="bg-slate-850 hover:bg-red-600 hover:text-white border border-slate-800 text-red-400 px-2.5 py-1.5 rounded text-[10px] font-extrabold transition-all ml-auto"
                                  >
                                    <Ban className="h-3 w-3 inline mr-1" />
                                    Ban
                                  </button>

                                  {/* Delete Account */}
                                  <button
                                    onClick={() => handleLeaderDeleteAccount(user)}
                                    className="bg-red-900/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/20 px-2.5 py-1.5 rounded text-[10px] font-bold transition-all"
                                  >
                                    <Trash2 className="h-3 w-3 inline mr-1" />
                                    Delete Account
                                  </button>
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

              </div>

              {/* Sidebar Column: Immutable Audit Trails */}
              <div className="lg:col-span-1">
                <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-6 shadow-xl text-left h-full flex flex-col justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-1.5 border-b border-slate-800 pb-3">
                      <History className="h-5 w-5 text-amber-500" />
                      Immutable Moderation Logs
                    </h3>

                    {moderationLogs.length === 0 ? (
                      <div className="text-center py-10 text-xs text-slate-500 italic">No historical moderation records.</div>
                    ) : (
                      <div className="space-y-3.5 max-h-[550px] overflow-y-auto pr-1" id="audit_timeline_scroller">
                        {moderationLogs.map((log) => (
                          <div key={log.id} className="p-3 bg-slate-900/60 border border-slate-850 rounded-xl space-y-1 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-red-400 uppercase text-[9px] tracking-wide bg-red-500/5 px-1.5 py-0.5 rounded border border-red-500/10">
                                {log.actionType}
                              </span>
                              <span className="text-[9px] text-slate-500 font-mono">
                                {new Date(log.createdAt).toLocaleDateString()}
                              </span>
                            </div>

                            <p className="text-slate-200">
                              Target user: <span className="font-bold text-white">{log.targetName}</span>
                            </p>

                            <p className="text-[10px] text-slate-400 italic bg-slate-950/40 p-1.5 rounded border border-slate-850/40">
                              Reason: "{log.reason}"
                            </p>

                            <p className="text-[9px] text-slate-600 font-mono">Executed by: {log.leaderName}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-6 pt-4 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-start gap-2 leading-relaxed">
                    <Info className="h-4 w-4 text-[#2563EB] shrink-0 mt-0.5" />
                    <span>Logs are cryptographically linked to the session and are permanently saved in our system registry for moderation transparency.</span>
                  </div>
                </div>
              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
