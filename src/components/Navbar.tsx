import React from 'react';
import { motion } from 'motion/react';
import { LogOut, MessageSquare, LayoutDashboard, Vote, Shield, User as UserIcon } from 'lucide-react';
import { auth } from '../firebase/config';
import { User } from '../types';
import Logo from './Logo';

interface NavbarProps {
  currentUser: User;
  activeTab: 'chat' | 'dashboard' | 'voting';
  setActiveTab: (tab: 'chat' | 'dashboard' | 'voting') => void;
  currentLeaderName: string | null;
  onLogout: () => void;
}

export default function Navbar({ currentUser, activeTab, setActiveTab, currentLeaderName, onLogout }: NavbarProps) {
  const handleSignOut = async () => {
    try {
      await auth.signOut();
      onLogout();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-700/50 bg-[#1E293B] backdrop-blur-md" id="app_header">
      <div className="mx-auto flex max-w-7xl h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        
        {/* Brand Logo & Current Leader Info */}
        <div className="flex items-center space-x-4" id="header_brand_section">
          <div className="flex items-center space-x-2.5">
            <Logo size="sm" />
            <span className="hidden text-base font-extrabold tracking-tight bg-gradient-to-r from-white via-slate-100 to-blue-200 bg-clip-text text-transparent sm:block">
              14 Day Testing Club
            </span>
          </div>

          {/* Current Elected Leader Badge */}
          {currentLeaderName && (
            <div className="hidden items-center space-x-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-[#10B981] md:flex border border-emerald-500/20" id="active_leader_badge">
              <Shield className="h-3 w-3" />
              <span>Leader: {currentLeaderName}</span>
            </div>
          )}
        </div>

        {/* Tab Switcher */}
        <nav className="flex space-x-1 sm:space-x-1.5" id="header_navigation">
          <button
            onClick={() => setActiveTab('chat')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'chat'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
            id="tab_chat"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Community Chat</span>
          </button>

          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'dashboard'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
            id="tab_dashboard"
          >
            <LayoutDashboard className="h-4 w-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('voting')}
            className={`flex items-center space-x-2 rounded-xl px-4 py-2 text-xs font-bold transition-all sm:text-sm ${
              activeTab === 'voting'
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/30'
                : 'text-slate-400 hover:bg-slate-800/40 hover:text-white'
            }`}
            id="tab_leader_page"
          >
            <Shield className="h-4 w-4 text-emerald-400 animate-pulse" />
            <span className="hidden sm:inline">Leader Page</span>
          </button>
        </nav>

        {/* Profile Card & Logout */}
        <div className="flex items-center space-x-3" id="header_profile_section">
          <div className="flex items-center space-x-2">
            <img
              src={currentUser.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150'}
              alt={currentUser.displayName}
              referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full border-2 border-slate-700 bg-slate-800 object-cover"
              id="header_user_avatar"
            />
            <div className="hidden flex-col text-left lg:flex">
              <span className="text-xs font-semibold text-white leading-tight">{currentUser.displayName}</span>
              <span className="text-[10px] text-slate-400 capitalize flex items-center gap-0.5">
                {currentUser.role === 'leader' ? (
                  <>
                    <Shield className="h-2.5 w-2.5 text-emerald-400" />
                    <span className="text-emerald-400 font-bold">Leader</span>
                  </>
                ) : (
                  <>
                    <UserIcon className="h-2.5 w-2.5 text-blue-400" />
                    <span className="text-blue-400 font-bold">Pro Tester</span>
                  </>
                )}
              </span>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            title="Log Out"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-[#1E293B] text-slate-400 transition-colors hover:bg-red-500/10 hover:text-red-400"
            id="logout_button"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

      </div>
    </header>
  );
}
