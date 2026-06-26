import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { doc } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase/config';
import { safeGetDoc, safeSetDoc } from '../firebase/db';
import { motion } from 'motion/react';
import { ShieldCheck, AlertTriangle, Cpu } from 'lucide-react';
import Logo from './Logo';

interface LoginProps {
  onLoginSuccess: (user: any) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (!user) {
        throw new Error("No user information received from Google Sign-In.");
      }

      // Check if user already exists in Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await safeGetDoc(userDocRef);

      if (!userDoc.exists()) {
        // Create user document with default values
        const newUser = {
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || 'Anonymous Tester',
          photoURL: user.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150',
          role: 'member', // Default role
          muted: false,
          suspendedUntil: null,
          createdAt: new Date().toISOString(),
        };
        await safeSetDoc(userDocRef, newUser);
        onLoginSuccess(newUser);
      } else {
        const existingData = userDoc.data();
        if (existingData.suspendedUntil && new Date(existingData.suspendedUntil) > new Date()) {
          // If permanent ban or suspended
          throw new Error(`Your account is currently suspended until ${new Date(existingData.suspendedUntil).toLocaleString()}.`);
        }
        onLoginSuccess(existingData);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F172A] px-4 py-12" id="login_container">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md rounded-2xl border border-slate-800 bg-[#1E293B] p-8 shadow-2xl"
        id="login_card"
      >
        <div className="flex flex-col items-center text-center">
          {/* Animated Logo */}
          <motion.div
            animate={{ 
              rotate: [0, 5, -5, 0],
              scale: [1, 1.03, 0.97, 1]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 5, 
              ease: "easeInOut" 
            }}
            className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-xl shadow-blue-500/10"
            id="logo_animation"
          >
            <Logo size="lg" />
          </motion.div>

          <h1 className="mt-6 text-3xl font-bold tracking-tight text-white" id="brand_title">
            14 Day Testing Club
          </h1>
          <p className="mt-2 text-sm text-slate-400" id="brand_subtitle">
            Professional Android App Testing Community
          </p>
        </div>

        {/* Warning Alert Box */}
        <div className="mt-8 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-left" id="warning_box">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[#F59E0B]" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Play Store Account Requirement
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">
                Please sign in using the same Google account used in your Google Play Store and Chrome Browser.
              </p>
              <p className="mt-1.5 text-xs font-medium text-amber-400">
                Using another account may create testing participation issues. Only Google Sign-In is allowed.
              </p>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400 text-center" id="error_message">
            {error}
          </div>
        )}

        <div className="mt-8" id="actions_container">
          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-[#2563EB] py-3.5 px-4 text-sm font-medium text-white transition-all hover:bg-[#1d4ed8] disabled:opacity-50"
            id="google_signin_button"
          >
            {loading ? (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
            ) : (
              <>
                <ShieldCheck className="h-5 w-5" />
                Sign in with Google
              </>
            )}
          </button>
        </div>

        <div className="mt-8 text-center text-xs text-slate-500" id="footer_text">
          By signing in, you agree to follow the 14-day closed testing club guidelines.
        </div>
      </motion.div>
    </div>
  );
}
