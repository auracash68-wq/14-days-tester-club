import React, { useState, useEffect } from 'react';
import { 
  collection, query, where, doc 
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  safeOnSnapshot, safeAddDoc, safeUpdateDoc, safeSetDoc, safeDeleteDoc 
} from '../firebase/db';
import { App, Report, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ImageLightbox from './ImageLightbox';
import { 
  User as UserIcon, PlusCircle, Inbox, MessageSquareCode, 
  Upload, Copy, Check, Save, ExternalLink, Calendar, ChevronDown, 
  ChevronUp, Bug, Lightbulb, Image, Send, CheckCircle2, ShieldAlert, Pencil, Trash2
} from 'lucide-react';

interface DashboardProps {
  currentUser: User;
  onRefreshUser: () => void;
}

export default function Dashboard({ currentUser, onRefreshUser }: DashboardProps) {
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'requests' | 'receive' | 'daily_check' | 'reviews' | 'report_user'>('profile');
  
  // Profile state
  const [displayName, setDisplayName] = useState(currentUser.displayName);
  const [contactNumber, setContactNumber] = useState(currentUser.contactNumber || '');
  const [bio, setBio] = useState(currentUser.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(() => !currentUser.displayName && !currentUser.contactNumber && !currentUser.bio);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Testing Requests form state
  const [appName, setAppName] = useState('');
  const [appIcon, setAppIcon] = useState('');
  const [googleGroupLink, setGoogleGroupLink] = useState('');
  const [joinWebLink, setJoinWebLink] = useState('');
  const [joinAndroidLink, setJoinAndroidLink] = useState('');
  const [postingApp, setPostingApp] = useState(false);
  const [appSuccess, setAppSuccess] = useState(false);

  // Testing Receive state
  const [otherApps, setOtherApps] = useState<App[]>([]);
  const [expandedAppId, setExpandedAppId] = useState<string | null>(null);

  // Report Submission Form state (Tester feedback)
  const [submittingReport, setSubmittingReport] = useState(false);
  const [selectedAppForReport, setSelectedAppForReport] = useState<App | null>(null);
  const [reportFeedback, setReportFeedback] = useState('');
  const [reportBug, setReportBug] = useState('');
  const [reportSuggestion, setReportSuggestion] = useState('');
  const [reportScreenshots, setReportScreenshots] = useState<string[]>([]);

  // Subscribed app ids where the current user submitted a report
  const [submittedReportAppIds, setSubmittedReportAppIds] = useState<Set<string>>(new Set());

  // General user Complaint Form state (Report user)
  const [reportTargetUser, setReportTargetUser] = useState('');
  const [complaintText, setComplaintText] = useState('');
  const [complaintScreenshots, setComplaintScreenshots] = useState<string[]>([]);
  const [submittingComplaint, setSubmittingComplaint] = useState(false);
  const [complaintSuccess, setComplaintSuccess] = useState(false);

  // Developer Reviews (My apps) state
  const [receivedReports, setReceivedReports] = useState<Report[]>([]);
  const [deletingReportId, setDeletingReportId] = useState<string | null>(null);

  // Copy User ID Helper
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  // Process and downscale base64 images to save Firestore storage size
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, callback: (base64: string) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new window.Image();
      img.onload = () => {
        // Render in a tiny Canvas to compress size to ~10-20KB
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        callback(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Multi screenshot compressor
  const handleScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 2000; // Large width to preserve vertical phone screenshot clarity (around 1080px wide)
          const MAX_HEIGHT = 2800; // Large height to avoid extreme downscaling
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Set high quality (0.93) so that screenshots containing small text are crystal clear and highly readable when zoomed!
          const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
          setReportScreenshots((prev) => [...prev, dataUrl].slice(0, 3)); // Limit to max 3 screenshots
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Fetch testing apps (excluding self)
  useEffect(() => {
    const q = query(collection(db, 'apps'));
    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const appsList: App[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.developerUid !== currentUser.uid) {
          appsList.push({
            id: doc.id,
            appName: data.appName,
            appIcon: data.appIcon,
            googleGroupLink: data.googleGroupLink,
            joinWebLink: data.joinWebLink,
            joinAndroidLink: data.joinAndroidLink,
            developerUid: data.developerUid,
            developerEmail: data.developerEmail,
            createdAt: data.createdAt,
          });
        }
      });
      setOtherApps(appsList);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Fetch reviews received (filtered for developer or all if admin)
  useEffect(() => {
    const isAdmin = currentUser.email === 'sg7899976@gmail.com' || currentUser.email === 'gazisahidhosen76@gmail.com' || currentUser.role === 'leader';
    
    const q = isAdmin 
      ? query(collection(db, 'reports'))
      : query(collection(db, 'reports'), where('developerUid', '==', currentUser.uid));

    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const reportsList: Report[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        // Allow if user is admin OR if they are the developer of the app
        if (isAdmin || data.developerUid === currentUser.uid) {
          reportsList.push({
            id: doc.id,
            appId: data.appId,
            appName: data.appName,
            developerUid: data.developerUid,
            testerUid: data.testerUid,
            testerName: data.testerName,
            testerPhoto: data.testerPhoto,
            feedback: data.feedback,
            bugReport: data.bugReport,
            suggestions: data.suggestions,
            screenshots: data.screenshots || [],
            status: data.status,
            createdAt: data.createdAt,
          });
        }
      });
      setReceivedReports(reportsList);
    });

    return () => unsubscribe();
  }, [currentUser.uid, currentUser.email, currentUser.role]);

  // Fetch reviews submitted by me to other apps
  useEffect(() => {
    const q = query(
      collection(db, 'reports'),
      where('testerUid', '==', currentUser.uid)
    );
    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const appIds = new Set<string>();
      snapshot.forEach((doc) => {
        const data = doc.data();
        if (data.appId) {
          appIds.add(data.appId);
        }
      });
      setSubmittedReportAppIds(appIds);
    });

    return () => unsubscribe();
  }, [currentUser.uid]);

  // Multi screenshot compressor for complaints
  const handleComplaintScreenshotUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    (Array.from(files) as File[]).forEach((file: File) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new window.Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 2000; // Large width to preserve vertical phone screenshot clarity (around 1080px wide)
          const MAX_HEIGHT = 2800; // Large height to avoid extreme downscaling
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width *= MAX_HEIGHT / height;
              height = MAX_HEIGHT;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
          setComplaintScreenshots((prev) => [...prev, dataUrl].slice(0, 3)); // Limit to max 3 screenshots
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  // Submit Complaint Report against user to Administrator
  const handleSubmitComplaint = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetUser.trim() || !complaintText.trim()) {
      alert("Please provide the target user info and complaint description.");
      return;
    }

    setSubmittingComplaint(true);
    setComplaintSuccess(false);

    try {
      const complaintId = `comp_${Date.now()}_${currentUser.uid}`;
      const complaintData = {
        id: complaintId,
        reporterUid: currentUser.uid,
        reporterName: currentUser.displayName || currentUser.email,
        reporterEmail: currentUser.email,
        targetUser: reportTargetUser.trim(),
        complaintText: complaintText.trim(),
        screenshots: complaintScreenshots,
        createdAt: new Date().toISOString(),
        status: 'Pending'
      };

      await safeSetDoc(doc(db, 'complaints', complaintId), complaintData);

      setReportTargetUser('');
      setComplaintText('');
      setComplaintScreenshots([]);
      setComplaintSuccess(true);
      alert("Your complaint report has been successfully submitted to the Administrator.");
      setTimeout(() => setComplaintSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert("Failed to submit complaint.");
    } finally {
      setSubmittingComplaint(false);
    }
  };

  // Save profile changes
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileSuccess(false);

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await safeUpdateDoc(userRef, {
        displayName: displayName.trim(),
        contactNumber: contactNumber.trim(),
        bio: bio.trim(),
      });

      setProfileSuccess(true);
      onRefreshUser();
      setIsEditingProfile(false);
      setTimeout(() => setProfileSuccess(false), 3000);
    } catch (err) {
      console.error("Profile save error: ", err);
      alert("Error saving profile options.");
    } finally {
      setSavingProfile(false);
    }
  };

  // Submit test request (App)
  const handlePostApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appName.trim() || !googleGroupLink.trim() || !joinWebLink.trim() || !joinAndroidLink.trim()) {
      alert("Please complete all required fields.");
      return;
    }

    setPostingApp(true);
    setAppSuccess(false);

    try {
      const iconToSave = appIcon || 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=150';
      const newAppRef = {
        appName: appName.trim(),
        appIcon: iconToSave,
        googleGroupLink: googleGroupLink.trim(),
        joinWebLink: joinWebLink.trim(),
        joinAndroidLink: joinAndroidLink.trim(),
        developerUid: currentUser.uid,
        developerEmail: currentUser.email,
        createdAt: new Date().toISOString(),
      };

      await safeAddDoc(collection(db, 'apps'), newAppRef);
      
      setAppName('');
      setAppIcon('');
      setGoogleGroupLink('');
      setJoinWebLink('');
      setJoinAndroidLink('');
      setAppSuccess(true);
      setTimeout(() => {
        setAppSuccess(false);
        setActiveSubTab('receive'); // Redirect to receive
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Failed to submit testing request.");
    } finally {
      setPostingApp(false);
    }
  };

  // Submit Feedback Report
  const handleSubmitReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAppForReport || !reportFeedback.trim()) {
      alert("Feedback content is required.");
      return;
    }

    setSubmittingReport(true);

    try {
      const reportId = `rep_${Date.now()}_${currentUser.uid}`;
      const reportData = {
        id: reportId,
        appId: selectedAppForReport.id,
        appName: selectedAppForReport.appName,
        developerUid: selectedAppForReport.developerUid,
        testerUid: currentUser.uid,
        testerName: currentUser.displayName,
        testerPhoto: currentUser.photoURL,
        feedback: reportFeedback.trim(),
        bugReport: reportBug.trim(),
        suggestions: reportSuggestion.trim(),
        screenshots: reportScreenshots,
        status: 'Pending',
        createdAt: new Date().toISOString(),
      };

      await safeSetDoc(doc(db, 'reports', reportId), reportData);

      alert(`Your feedback report for ${selectedAppForReport.appName} has been submitted to the developer!`);
      
      // Reset Form State
      setSelectedAppForReport(null);
      setReportFeedback('');
      setReportBug('');
      setReportSuggestion('');
      setReportScreenshots([]);
    } catch (err) {
      console.error(err);
      alert("An error occurred while submitting report.");
    } finally {
      setSubmittingReport(false);
    }
  };

  // Developer updates report status
  const handleUpdateReportStatus = async (reportId: string, nextStatus: 'Reviewed' | 'Resolved') => {
    try {
      const reportRef = doc(db, 'reports', reportId);
      await safeUpdateDoc(reportRef, {
        status: nextStatus
      });
    } catch (err) {
      console.error("Failed to update status: ", err);
    }
  };

  // Developer deletes report permanently (safe and non-blocking in iframe)
  const handleDeleteReport = async (reportId: string) => {
    setDeletingReportId(reportId);
    try {
      await safeDeleteDoc(doc(db, 'reports', reportId));
    } catch (err) {
      console.error("Failed to delete report: ", err);
    } finally {
      setDeletingReportId(null);
    }
  };

  const isAdmin = currentUser.email === 'sg7899976@gmail.com' || currentUser.email === 'gazisahidhosen76@gmail.com' || currentUser.role === 'leader';
  const visibleReports = isAdmin 
    ? receivedReports 
    : receivedReports.filter(report => report.developerUid === currentUser.uid);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 bg-[#0F172A] min-h-[calc(100vh-4rem)]" id="dashboard_container">
      
      {/* Tab Switcher Grid */}
      <div className="grid grid-cols-2 gap-3 md:flex md:flex-wrap md:space-x-3 border-b border-slate-700/50 pb-5" id="dashboard_header_tabs">
        <button
          onClick={() => setActiveSubTab('profile')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'profile'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/35 shadow-lg shadow-blue-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_profile"
        >
          <UserIcon className="h-4 w-4" />
          <span>My Profile</span>
        </button>

        <button
          onClick={() => setActiveSubTab('requests')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'requests'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/35 shadow-lg shadow-blue-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_requests"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Post App</span>
        </button>

        <button
          onClick={() => setActiveSubTab('receive')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'receive'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/35 shadow-lg shadow-blue-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_receive"
        >
          <Inbox className="h-4 w-4" />
          <span>Test Requests ({otherApps.filter(app => !submittedReportAppIds.has(app.id)).length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('daily_check')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'daily_check'
              ? 'bg-emerald-600/15 text-emerald-400 border border-emerald-500/35 shadow-lg shadow-emerald-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_daily_check"
        >
          <Calendar className="h-4 w-4" />
          <span>daily check</span>
        </button>

        <button
          onClick={() => setActiveSubTab('reviews')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'reviews'
              ? 'bg-blue-600/15 text-blue-400 border border-blue-500/35 shadow-lg shadow-blue-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_reviews"
        >
          <MessageSquareCode className="h-4 w-4" />
          <span>Review Logs ({visibleReports.length})</span>
        </button>

        <button
          onClick={() => setActiveSubTab('report_user')}
          className={`flex items-center justify-center space-x-2 rounded-xl py-2.5 px-4 text-xs font-bold transition-all sm:text-sm ${
            activeSubTab === 'report_user'
              ? 'bg-rose-600/15 text-rose-400 border border-rose-500/35 shadow-lg shadow-rose-500/5'
              : 'bg-[#1E293B]/60 border border-slate-700/40 text-slate-400 hover:bg-[#1E293B] hover:text-white'
          }`}
          id="dashboard_subtab_report_user"
        >
          <ShieldAlert className="h-4 w-4" />
          <span>Report</span>
        </button>
      </div>

      <div className="mt-8" id="dashboard_content_canvas">
        {/* Profile Editor Screen */}
        {activeSubTab === 'profile' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-8 md:grid-cols-3"
            id="profile_editor_layout"
          >
            {/* User Meta Card */}
            <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 text-center shadow-xl h-fit">
              <img
                src={currentUser.photoURL}
                alt={currentUser.displayName}
                referrerPolicy="no-referrer"
                className="mx-auto h-24 w-24 rounded-full border-4 border-[#2563EB] bg-slate-900 object-cover shadow-md"
                id="profile_large_avatar"
              />
              <h2 className="mt-4 text-xl font-bold text-white">{currentUser.displayName}</h2>
              <span className="mt-1 inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-400 uppercase tracking-wider">
                {currentUser.role} Account
              </span>

              {/* ID Display Box */}
              <div className="mt-6 rounded-lg bg-slate-950/50 p-3 text-left border border-slate-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">User ID</span>
                  <button 
                    onClick={() => copyToClipboard(currentUser.uid)}
                    className="text-slate-400 hover:text-white flex items-center space-x-1 text-xs"
                    id="copy_uid_button"
                  >
                    {copiedId ? <Check className="h-3.5 w-3.5 text-[#22C55E]" /> : <Copy className="h-3.5 w-3.5" />}
                    <span className="text-[10px]">{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
                <p className="mt-1.5 font-mono text-xs text-slate-300 select-all truncate">{currentUser.uid}</p>
              </div>

              <div className="mt-4 text-left text-xs text-slate-400 leading-relaxed border-t border-slate-700/50 pt-4">
                Joined 14 Day Club on {new Date(currentUser.createdAt).toLocaleDateString()}. Make sure to keep your bio and contact number updated so developers can coordinate testing rewards or requirements.
              </div>
            </div>

            {/* Form settings / Display Card */}
            <div className="rounded-2xl border border-slate-700/50 bg-[#1E293B] p-6 shadow-xl md:col-span-2 text-left">
              {!isEditingProfile ? (
                <div className="space-y-6">
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4">
                    <div>
                      <h3 className="text-lg font-bold text-white">Profile Details</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Your registered club membership details</p>
                    </div>
                    <button
                      onClick={() => setIsEditingProfile(true)}
                      className="flex items-center space-x-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2 text-xs font-bold transition-all border border-slate-700"
                      id="toggle_edit_profile_btn"
                    >
                      <Pencil className="h-3.5 w-3.5 text-blue-400" />
                      <span>Edit Profile</span>
                    </button>
                  </div>

                  {profileSuccess && (
                    <motion.div 
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center space-x-1.5 text-[#22C55E] text-xs font-semibold bg-green-500/10 p-3 rounded-lg border border-green-500/20"
                      id="save_profile_success_banner"
                    >
                      <CheckCircle2 className="h-4 w-4 shrink-0" />
                      <span>Profile details saved and synchronized in the club directory!</span>
                    </motion.div>
                  )}

                  <div className="space-y-5">
                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Display Name</span>
                      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white font-medium">
                        {currentUser.displayName || <span className="text-slate-500 italic">Not specified</span>}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Google Account Email</span>
                      <div className="w-full bg-slate-900/30 border border-slate-800/40 rounded-xl px-4 py-3 text-sm text-slate-400 font-medium font-mono">
                        {currentUser.email}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Contact Number</span>
                      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl px-4 py-3 text-sm text-white font-medium font-mono">
                        {currentUser.contactNumber || <span className="text-slate-500 italic">Not specified</span>}
                      </div>
                    </div>

                    <div>
                      <span className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Bio / Developer Description</span>
                      <div className="w-full bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 text-sm text-slate-200 leading-relaxed min-h-[110px] whitespace-pre-wrap">
                        {currentUser.bio || <span className="text-slate-500 italic">No description provided yet. Let the community know what you build!</span>}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6">
                    <div>
                      <h3 className="text-lg font-bold text-white">Edit Profile Settings</h3>
                      <p className="text-xs text-slate-400 mt-0.5">Modify your developer description and contact info</p>
                    </div>
                    <button
                      onClick={() => {
                        setDisplayName(currentUser.displayName);
                        setContactNumber(currentUser.contactNumber || '');
                        setBio(currentUser.bio || '');
                        setIsEditingProfile(false);
                      }}
                      className="text-xs font-bold text-slate-400 hover:text-white underline"
                      id="cancel_edit_profile_btn"
                    >
                      Cancel
                    </button>
                  </div>

                  <form onSubmit={handleSaveProfile} className="space-y-5">
                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Display Name</label>
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        id="input_display_name"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Google Account Email</label>
                      <input
                        type="email"
                        disabled
                        value={currentUser.email}
                        className="w-full bg-slate-900/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
                        id="input_email_disabled"
                      />
                      <p className="mt-1.5 text-[10px] text-slate-500">Google accounts are locked and linked directly to Google Play authentication.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Contact Number</label>
                      <input
                        type="tel"
                        placeholder="+1 (555) 000-0000"
                        value={contactNumber}
                        onChange={(e) => setContactNumber(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        id="input_contact_number"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Bio / Developer Description</label>
                      <textarea
                        placeholder="Tell us about the Android apps you make or your testing device capabilities..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                        className="w-full bg-slate-900 border border-slate-700/60 rounded-xl p-4 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        id="input_bio_textarea"
                      />
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      {profileSuccess && (
                        <motion.div 
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center space-x-1.5 text-[#22C55E] text-sm"
                          id="save_profile_success"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>Profile saved successfully!</span>
                        </motion.div>
                      )}
                      <div className="ml-auto">
                        <button
                          type="submit"
                          disabled={savingProfile}
                          className="flex items-center space-x-2 rounded-xl bg-[#2563EB] py-2.5 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                          id="save_profile_btn"
                        >
                          <Save className="h-4 w-4" />
                          <span>{savingProfile ? 'Saving...' : 'Save Profile'}</span>
                        </button>
                      </div>
                    </div>
                  </form>
                </>
              )}
            </div>
          </motion.div>
        )}

        {/* Post Testing Request Screen */}
        {activeSubTab === 'requests' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto rounded-2xl border border-slate-800 bg-[#1E293B] p-6 shadow-lg text-left"
            id="post_request_layout"
          >
            <h3 className="text-xl font-bold text-white mb-2">Submit App for 14-Day Testing</h3>
            <p className="text-xs text-slate-400 mb-6">Create a request so other community members can join your Google Group and install your app for 14 continuous days.</p>

            <form onSubmit={handlePostApp} className="space-y-5">
              
              {/* App Icon Upload Component */}
              <div className="flex items-center space-x-4 p-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/40">
                <div className="shrink-0 h-16 w-16 rounded-xl bg-slate-800 flex items-center justify-center border border-slate-700 overflow-hidden">
                  {appIcon ? (
                    <img src={appIcon} alt="App Icon" className="h-full w-full object-cover" />
                  ) : (
                    <Upload className="h-6 w-6 text-slate-500 animate-pulse" />
                  )}
                </div>
                <div>
                  <span className="block text-xs font-semibold text-white">App Icon Launcher</span>
                  <p className="text-[10px] text-slate-500 mt-0.5">Drag & drop or browse device photo (SVG/JPEG/PNG, auto compressed)</p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => handleImageUpload(e, setAppIcon)}
                    className="mt-2 text-xs text-slate-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-slate-800 file:text-slate-200 file:cursor-pointer hover:file:bg-[#2563EB]"
                    id="app_icon_input"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">App Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Focus Flow Pomodoro"
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  id="app_name_input"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Google Group Join Link</label>
                <input
                  type="url"
                  required
                  placeholder="https://groups.google.com/g/my-app-testers"
                  value={googleGroupLink}
                  onChange={(e) => setGoogleGroupLink(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                  id="group_link_input"
                />
                <p className="mt-1.5 text-[10px] text-slate-500">Testers MUST join your Google Group first to gain Play Store download authorization.</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Join on Web Link</label>
                  <input
                    type="url"
                    required
                    placeholder="https://play.google.com/apps/testing/com.company.app"
                    value={joinWebLink}
                    onChange={(e) => setJoinWebLink(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                    id="join_web_input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase text-slate-400 mb-2">Join on Android Link</label>
                  <input
                    type="url"
                    required
                    placeholder="https://play.google.com/store/apps/details?id=com.company.app"
                    value={joinAndroidLink}
                    onChange={(e) => setJoinAndroidLink(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                    id="join_android_input"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <div className="flex flex-col text-xs text-slate-500 leading-tight">
                  <span>Author UID: {currentUser.uid.slice(0,8)}...</span>
                  <span>Email: {currentUser.email}</span>
                </div>
                <button
                  type="submit"
                  disabled={postingApp}
                  className="flex items-center space-x-2 rounded-xl bg-[#2563EB] py-2.5 px-6 text-sm font-semibold text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
                  id="submit_request_button"
                >
                  <PlusCircle className="h-4 w-4" />
                  <span>{postingApp ? 'Uploading...' : 'Publish Testing Link'}</span>
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Testing Receive Screen */}
        {activeSubTab === 'receive' && (
          <div className="space-y-6" id="testing_receive_canvas">
            {/* Feedback report submission state overlay */}
            <AnimatePresence>
              {selectedAppForReport && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
                  id="feedback_submission_overlay"
                >
                  <motion.div
                    initial={{ scale: 0.95 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0.95 }}
                    className="w-full max-w-lg rounded-2xl border border-slate-800 bg-[#1E293B] p-6 shadow-2xl overflow-y-auto max-h-[90vh] text-left"
                    id="feedback_submission_card"
                  >
                    <div className="flex justify-between items-center mb-4">
                      <div className="flex items-center space-x-3">
                        <img src={selectedAppForReport.appIcon} alt={selectedAppForReport.appName} className="h-10 w-10 rounded-lg object-cover" />
                        <div>
                          <h4 className="text-lg font-bold text-white">Submit Report: {selectedAppForReport.appName}</h4>
                          <p className="text-xs text-slate-400">Tester: {currentUser.displayName} ({currentUser.email})</p>
                        </div>
                      </div>
                      <button onClick={() => setSelectedAppForReport(null)} className="text-slate-400 hover:text-white font-semibold">✕</button>
                    </div>

                    <form onSubmit={handleSubmitReport} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Install App First</label>
                        <div className="flex flex-wrap gap-2 mb-3">
                          <a href={selectedAppForReport.googleGroupLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-lg">
                            1. Join Group <ExternalLink className="h-3 w-3" />
                          </a>
                          <a href={selectedAppForReport.joinWebLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-lg">
                            2. Accept Tester <ExternalLink className="h-3 w-3" />
                          </a>
                          <a href={selectedAppForReport.joinAndroidLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-200 hover:text-white px-3 py-1.5 rounded-lg">
                            3. Download <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Feedback & Detailed Review *</label>
                        <textarea
                          required
                          rows={3}
                          placeholder="What did you think of the user interface? Did it work smoothly?"
                          value={reportFeedback}
                          onChange={(e) => setReportFeedback(e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#2563EB]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Bug Reports (Optional)</label>
                        <div className="flex items-start bg-slate-900 border border-slate-800 rounded-xl p-3">
                          <Bug className="h-5 w-5 mr-2 text-[#EF4444] shrink-0 mt-0.5" />
                          <textarea
                            rows={2}
                            placeholder="Describe any crashes, layouts cutting off, or functional issues you found..."
                            value={reportBug}
                            onChange={(e) => setReportBug(e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Suggestions & Features (Optional)</label>
                        <div className="flex items-start bg-slate-900 border border-slate-800 rounded-xl p-3">
                          <Lightbulb className="h-5 w-5 mr-2 text-[#F59E0B] shrink-0 mt-0.5" />
                          <textarea
                            rows={2}
                            placeholder="Are there features you think would make the app better?"
                            value={reportSuggestion}
                            onChange={(e) => setReportSuggestion(e.target.value)}
                            className="w-full bg-transparent border-0 p-0 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-0"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase text-slate-400 mb-1.5">Upload screenshots (Max 3)</label>
                        <div className="flex items-center gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
                          <Image className="h-5 w-5 text-slate-400" />
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={handleScreenshotUpload}
                            className="text-xs text-slate-400"
                          />
                        </div>
                        {reportScreenshots.length > 0 && (
                          <div className="flex gap-2 mt-3">
                            {reportScreenshots.map((src, idx) => (
                              <div key={idx} className="relative h-14 w-14 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                                <img src={src} alt="screenshot" className="h-full w-full object-cover" />
                                <button type="button" onClick={() => setReportScreenshots(prev => prev.filter((_,i) => i !== idx))} className="absolute top-0.5 right-0.5 text-white bg-black/60 h-4 w-4 rounded-full flex items-center justify-center text-[8px]">✕</button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end space-x-2 pt-3 border-t border-slate-850">
                        <button type="button" onClick={() => setSelectedAppForReport(null)} className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white">Cancel</button>
                        <button type="submit" disabled={submittingReport || !reportFeedback.trim()} className="flex items-center space-x-1.5 px-5 py-2 bg-[#10B981] hover:bg-emerald-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg">
                          <Send className="h-3.5 w-3.5" />
                          <span>Submit Report</span>
                        </button>
                      </div>
                    </form>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>

            {otherApps.filter(app => !submittedReportAppIds.has(app.id)).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-slate-800 bg-[#1E293B] text-center text-slate-400">
                <Inbox className="h-12 w-12 text-slate-600 mb-3 animate-pulse" />
                <h4 className="text-base font-bold text-white">No Testing Requests Available</h4>
                <p className="text-xs mt-1 max-w-sm leading-relaxed">Either no developer has submitted an app yet, or you have completed all outstanding test requests.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2" id="receive_grid">
                {otherApps.filter(app => !submittedReportAppIds.has(app.id)).map((app) => {
                  const isExpanded = expandedAppId === app.id;
                  return (
                    <motion.div
                      layout
                      key={app.id}
                      className="rounded-2xl border border-slate-800 bg-[#1E293B] overflow-hidden shadow-md flex flex-col text-left"
                    >
                      {/* Collapsed view header */}
                      <div className="p-5 flex items-start space-x-4">
                        <img
                          src={app.appIcon}
                          alt={app.appName}
                          className="h-14 w-14 rounded-xl border border-slate-700 bg-slate-900 object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-lg font-bold text-white truncate">{app.appName}</h4>
                          <span className="text-[10px] font-mono text-slate-400">Developer UID: {app.developerUid.slice(0, 10)}</span>
                          <div className="flex items-center space-x-2 mt-1 text-xs text-slate-500">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Published on {new Date(app.createdAt).toLocaleDateString()}</span>
                          </div>
                        </div>

                        {/* Accordion trigger */}
                        <button
                          onClick={() => setExpandedAppId(isExpanded ? null : app.id)}
                          className="text-slate-400 hover:text-white"
                        >
                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                        </button>
                      </div>

                      {/* Expandable details segment */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden border-t border-slate-800 bg-slate-950 px-5 pb-5 text-xs"
                          >
                            <div className="space-y-4 pt-4">
                              <div>
                                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-500">How to join:</span>
                                <div className="grid gap-2 sm:grid-cols-3 mt-2">
                                  <a
                                    href={app.googleGroupLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between rounded-lg bg-[#1E293B] border border-slate-800 p-2.5 text-slate-200 hover:text-white"
                                  >
                                    <span>1. Join Group</span>
                                    <ExternalLink className="h-3 w-3 text-blue-400" />
                                  </a>

                                  <a
                                    href={app.joinWebLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between rounded-lg bg-[#1E293B] border border-slate-800 p-2.5 text-slate-200 hover:text-white"
                                  >
                                    <span>2. Accept on Web</span>
                                    <ExternalLink className="h-3 w-3 text-blue-400" />
                                  </a>

                                  <a
                                    href={app.joinAndroidLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center justify-between rounded-lg bg-[#1E293B] border border-slate-800 p-2.5 text-slate-200 hover:text-white"
                                  >
                                    <span>3. Play Store</span>
                                    <ExternalLink className="h-3 w-3 text-blue-400" />
                                  </a>
                                </div>
                              </div>

                              <div className="pt-3 border-t border-slate-800 flex justify-between items-center">
                                <span className="text-[10px] text-slate-500">Verify your Play Store login match!</span>
                                <button
                                  onClick={() => setSelectedAppForReport(app)}
                                  className="flex items-center space-x-1.5 px-4 py-2 bg-[#10B981] text-white rounded-lg font-bold hover:bg-emerald-600 text-xs"
                                >
                                  <Send className="h-3 w-3" />
                                  <span>Submit Testing Report</span>
                                </button>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* daily check Screen */}
        {activeSubTab === 'daily_check' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-left animate-fadeIn"
            id="daily_check_panel"
          >
            <div className="bg-slate-900/40 border border-slate-800 p-5 rounded-2xl">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-400" />
                <span>Daily Check: Direct Android Links</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Click any link below to join as a tester and open the Android application directly on the Google Play Store.
              </p>
            </div>

            {(() => {
              const dailyCheckApps = otherApps.filter((app) => {
                const createdTime = new Date(app.createdAt).getTime();
                const diffTime = Date.now() - createdTime;
                const diffDays = diffTime / (1000 * 60 * 60 * 24);
                return diffDays <= 14;
              });

              if (dailyCheckApps.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-slate-800 bg-[#1E293B] text-center text-slate-400">
                    <CheckCircle2 className="h-12 w-12 text-emerald-500 mb-3 animate-pulse" />
                    <h4 className="text-base font-bold text-white">All Caught Up!</h4>
                    <p className="text-xs mt-1 max-w-sm leading-relaxed">No active app download links are available right now. Please check back later!</p>
                  </div>
                );
              }

              return (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" id="daily_check_grid">
                  {dailyCheckApps.map((app) => {
                    const createdTime = new Date(app.createdAt).getTime();
                    const diffTime = (createdTime + 14 * 24 * 60 * 60 * 1000) - Date.now();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    const daysRemaining = diffDays > 0 ? diffDays : 0;

                    return (
                      <div key={app.id} className="rounded-2xl border border-slate-850 bg-[#1E293B] p-5 flex flex-col justify-between hover:border-emerald-500/40 transition-all shadow-xl hover:shadow-emerald-500/5 group">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3.5">
                              <img src={app.appIcon} alt={app.appName} className="h-12 w-12 rounded-xl object-cover border border-slate-800 shadow-md group-hover:scale-105 transition-transform" />
                              <div>
                                <h4 className="text-sm font-bold text-white tracking-wide leading-tight group-hover:text-emerald-400 transition-colors">{app.appName}</h4>
                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider block mt-0.5">DEV: {app.developerEmail ? app.developerEmail.split('@')[0] : 'Unknown'}</span>
                              </div>
                            </div>
                            <span className={`px-2 py-1 rounded text-[9px] font-mono font-bold tracking-wider uppercase border ${
                              daysRemaining <= 3 
                                ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' 
                                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                            }`}>
                              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left
                            </span>
                          </div>
                          <div className="text-[10px] bg-slate-900/50 text-slate-400 rounded-lg p-2.5 border border-slate-800/50 leading-relaxed font-mono truncate">
                            <span>Link: </span>
                            <span className="text-emerald-400 font-bold">{app.joinAndroidLink}</span>
                          </div>
                        </div>

                        <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 font-mono">Posted: {new Date(app.createdAt).toLocaleDateString()}</span>
                          <a
                            href={app.joinAndroidLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-lg shadow-emerald-600/10 hover:shadow-emerald-500/20 active:scale-[0.98] transition-all"
                          >
                            <span>JOIN ON ANDROID</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </motion.div>
        )}

        {/* Report User (Complaint) Screen */}
        {activeSubTab === 'report_user' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-2xl mx-auto text-left animate-fadeIn"
            id="report_user_panel"
          >
            <div className="rounded-2xl border border-slate-800 bg-[#1E293B] p-6 shadow-xl space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-500" />
                  <span>Report User / General Complaint</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                  Submit a formal complaint against a community member. Please provide their Name, Email address, or User ID, a clear explanation of what occurred, and optional screenshots to support your report.
                </p>
              </div>

              {complaintSuccess && (
                <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl p-4 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Your complaint has been successfully delivered to the admin desk.</span>
                </div>
              )}

              <form onSubmit={handleSubmitComplaint} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Target User Information <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Enter User's Name, Email address, or User ID (any information known)"
                    value={reportTargetUser}
                    onChange={(e) => setReportTargetUser(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                  <p className="text-[10px] text-slate-500 mt-1.5">Please provide any details you have (Name, Email, or UID) so our moderation team can identify the account.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    What Happened? (Detailed Description) <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide a detailed explanation of the incident, issue, or behavior that occurred..."
                    value={complaintText}
                    onChange={(e) => setComplaintText(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">
                    Supporting Screenshots / Evidence (Optional, Max 3)
                  </label>
                  <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-850">
                    <Image className="h-5 w-5 text-slate-400" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleComplaintScreenshotUpload}
                      className="text-xs text-slate-400 cursor-pointer"
                    />
                  </div>
                  {complaintScreenshots.length > 0 && (
                    <div className="flex gap-2.5 mt-3">
                      {complaintScreenshots.map((src, idx) => (
                        <div key={idx} className="relative h-16 w-20 rounded-lg bg-slate-800 border border-slate-700 overflow-hidden">
                          <img src={src} alt="complaint screenshot" className="h-full w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setComplaintScreenshots((prev) => prev.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 text-white bg-black/75 h-4 w-4 rounded-full flex items-center justify-center text-[8px] hover:bg-black transition-colors"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-800/80 flex justify-end">
                  <button
                    type="submit"
                    disabled={submittingComplaint}
                    className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white font-bold text-xs px-6 py-2.5 rounded-xl shadow-lg shadow-rose-600/10 hover:shadow-rose-500/20 active:scale-[0.98] transition-all"
                  >
                    {submittingComplaint ? (
                      <span>SUBMITTING REPORT...</span>
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span>SUBMIT COMPLAINT REPORT</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        )}

        {/* Review Comments Screen */}
        {activeSubTab === 'reviews' && (
          <div className="space-y-6" id="developer_reviews_panel">
            {visibleReports.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 rounded-2xl border border-slate-800 bg-[#1E293B] text-center text-slate-400">
                <MessageSquareCode className="h-12 w-12 text-slate-600 mb-3" />
                <h4 className="text-base font-bold text-white">No Reviews Received</h4>
                <p className="text-xs mt-1 max-w-sm leading-relaxed">Once other testers install your app and write feedback reports, they will compile right here in real-time!</p>
              </div>
            ) : (
              <div className="space-y-4" id="reviews_list">
                {visibleReports.map((report) => (
                  <div key={report.id} className="rounded-2xl border border-slate-800 bg-[#1E293B] p-5 text-left flex flex-col md:flex-row gap-5">
                    {/* Tester Info column */}
                    <div className="md:w-1/4 shrink-0 border-b md:border-b-0 md:border-r border-slate-800 pb-4 md:pb-0 md:pr-5 flex md:flex-col items-center md:items-start text-center md:text-left gap-3">
                      <img src={report.testerPhoto} alt={report.testerName} referrerPolicy="no-referrer" className="h-12 w-12 rounded-full border border-slate-700 object-cover" />
                      <div>
                        <h5 className="text-sm font-bold text-white leading-tight">{report.testerName}</h5>
                        <p className="text-[10px] font-mono text-slate-500 mt-0.5">ID: {report.testerUid.slice(0, 10)}</p>
                        <div className="flex items-center space-x-1 text-[10px] text-slate-400 mt-1">
                          <Calendar className="h-3.5 w-3.5 shrink-0" />
                          <span>{new Date(report.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Report feedback details column */}
                    <div className="flex-1 space-y-3.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-blue-400">App: {report.appName}</span>
                        
                        {/* Status chip toggle */}
                        <div className="flex items-center space-x-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            report.status === 'Resolved' ? 'bg-[#22C55E]/10 text-[#22C55E]' :
                            report.status === 'Reviewed' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' :
                            'bg-red-500/10 text-[#EF4444]'
                          }`}>
                            {report.status}
                          </span>
                          
                          {/* Developer quick action status transitions */}
                          {report.status !== 'Resolved' && (
                            <div className="flex gap-1.5">
                              {report.status === 'Pending' && (
                                <button
                                  onClick={() => handleUpdateReportStatus(report.id, 'Reviewed')}
                                  className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-[10px] font-bold"
                                >
                                  Mark Reviewed
                                </button>
                              )}
                              <button
                                onClick={() => handleUpdateReportStatus(report.id, 'Resolved')}
                                className="px-2 py-0.5 bg-[#22C55E]/20 hover:bg-[#22C55E]/30 text-[#22C55E] rounded text-[10px] font-bold"
                              >
                                Resolve
                              </button>
                            </div>
                          )}

                          <button
                            onClick={() => {
                              if (window.confirm("Are you sure you want to permanently delete this feedback report?")) {
                                handleDeleteReport(report.id);
                              }
                            }}
                            disabled={deletingReportId === report.id}
                            className="flex items-center gap-1.5 px-2.5 py-1 bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/20 rounded text-[10px] font-bold transition-all disabled:opacity-50"
                            title="Delete report permanently from database"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>{deletingReportId === report.id ? "Deleting..." : "Delete"}</span>
                          </button>
                        </div>
                      </div>

                      {/* Main Feedback text */}
                      <div>
                        <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Review feedback:</span>
                        <p className="text-sm text-slate-200 mt-1 leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/60">{report.feedback}</p>
                      </div>

                      {/* Optional Bug logs */}
                      {report.bugReport && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-red-400 tracking-wider flex items-center gap-1">
                            <Bug className="h-3 w-3" /> Bug report details:
                          </span>
                          <p className="text-xs text-red-200 mt-1 leading-relaxed bg-red-500/5 p-3 rounded-lg border border-red-500/10 font-mono">{report.bugReport}</p>
                        </div>
                      )}

                      {/* Optional Suggestions logs */}
                      {report.suggestions && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider flex items-center gap-1">
                            <Lightbulb className="h-3 w-3" /> Developer suggestions:
                          </span>
                          <p className="text-xs text-amber-200 mt-1 leading-relaxed bg-amber-500/5 p-3 rounded-lg border border-amber-500/10">{report.suggestions}</p>
                        </div>
                      )}

                      {/* Optional Screenshots Row with lightboxes */}
                      {report.screenshots && report.screenshots.length > 0 && (
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Submitted screenshots (Click to zoom/panning):</span>
                          <div className="flex gap-2.5 mt-2.5">
                            {report.screenshots.map((src, i) => (
                              <button 
                                key={i} 
                                type="button"
                                onClick={() => setLightboxImage(src)}
                                className="relative group overflow-hidden rounded-lg border border-slate-800 hover:border-blue-500 transition-colors focus:outline-none"
                              >
                                <img src={src} alt="Feedback Screenshot" className="h-16 w-24 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] text-white font-mono transition-opacity">Zoom In</div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>

      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox 
            src={lightboxImage} 
            alt="Review Log Screenshot Zoom" 
            onClose={() => setLightboxImage(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}
