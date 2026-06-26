import React, { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, collection, query, where, limit } from 'firebase/firestore';
import { auth, db } from './firebase/config';
import { safeOnSnapshot } from './firebase/db';
import { User } from './types';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Chat from './components/Chat';
import Dashboard from './components/Dashboard';
import LeaderPage from './components/LeaderPage';
import { ShieldAlert, LogOut } from 'lucide-react';

export default function App() {
  const [firebaseUser, setFirebaseUser] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'dashboard' | 'voting'>('chat');
  const [currentLeaderName, setCurrentLeaderName] = useState<string | null>(null);

  // Authentication & Profile listener
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setCurrentUser(null);
        setLoading(false);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Sync user profile document in real-time
  useEffect(() => {
    if (!firebaseUser) return;

    const userRef = doc(db, 'users', firebaseUser.uid);
    const unsubscribeProfile = safeOnSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const profileData = docSnap.data() as User;
        setCurrentUser(profileData);
      }
      setLoading(false);
    }, (error) => {
      console.error("Profile sync error: ", error);
      setLoading(false);
    });

    return () => unsubscribeProfile();
  }, [firebaseUser]);

  // Dynamically listen to find current leader details
  useEffect(() => {
    if (!currentUser) return;

    const leaderQuery = query(
      collection(db, 'users'),
      where('role', '==', 'leader'),
      limit(1)
    );

    const unsubscribeLeader = safeOnSnapshot(leaderQuery, (snapshot) => {
      if (!snapshot.empty) {
        const leaderData = snapshot.docs[0].data();
        setCurrentLeaderName(leaderData.displayName);
      } else {
        setCurrentLeaderName(null);
      }
    });

    return () => unsubscribeLeader();
  }, [currentUser]);

  const handleRefreshUser = () => {
    // Handled in real-time via onSnapshot, but provided for compatibility
  };

  const handleForceLogout = async () => {
    await auth.signOut();
    setFirebaseUser(null);
    setCurrentUser(null);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A]" id="app_loading_screen">
        <div className="text-center space-y-4">
          <span className="h-10 w-10 animate-spin rounded-full border-4 border-[#2563EB] border-t-transparent inline-block" />
          <p className="text-slate-400 text-sm font-mono tracking-widest">CONNECTING TO 14 DAY CLUB...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login page
  if (!currentUser) {
    return <Login onLoginSuccess={(u) => setCurrentUser(u)} />;
  }

  // Safety block: If user is suspended or banned
  const isSuspended = currentUser.suspendedUntil && new Date(currentUser.suspendedUntil) > new Date();
  if (isSuspended) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4" id="ban_screen">
        <div className="w-full max-w-md rounded-2xl border border-red-500/20 bg-[#1E293B] p-8 text-center shadow-2xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-[#EF4444] mb-4">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold text-white">Access Denied</h2>
          <p className="mt-2 text-sm text-slate-300 leading-relaxed">
            Your account has been suspended or banned by the community leader.
          </p>
          <div className="mt-4 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800 text-xs font-mono text-red-400">
            Suspension valid until: {new Date(currentUser.suspendedUntil!).toLocaleString()}
          </div>
          <button
            onClick={handleForceLogout}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 hover:bg-slate-700 px-5 py-2.5 text-xs font-semibold text-white transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Return to Log In</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col font-sans text-slate-100" id="app_workspace">
      {/* Navigation Header */}
      <Navbar 
        currentUser={currentUser} 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentLeaderName={currentLeaderName}
        onLogout={() => {
          setFirebaseUser(null);
          setCurrentUser(null);
        }}
      />

      {/* Main Views Container */}
      <main className="flex-1 overflow-hidden flex flex-col" id="tab_viewport">
        <div className="flex-1 overflow-auto">
          {activeTab === 'chat' && (
            <Chat currentUser={currentUser} onRefreshUser={handleRefreshUser} />
          )}
          
          {activeTab === 'dashboard' && (
            <Dashboard currentUser={currentUser} onRefreshUser={handleRefreshUser} />
          )}

          {activeTab === 'voting' && (
            <LeaderPage currentUser={currentUser} onRefreshUser={handleRefreshUser} />
          )}
        </div>
      </main>

      {/* Global Footer Bar */}
      <footer className="px-6 py-2.5 bg-[#0F172A] border-t border-slate-800/80 text-[10px] text-slate-500 flex justify-between shrink-0" id="global_footer">
        <div className="flex gap-4">
          <span>Session Status: Connected</span>
          <span>Firestore Sync: Latency 14ms</span>
        </div>
        <div>© 2026 14-Day Testing Club • Operational</div>
      </footer>
    </div>
  );
}
