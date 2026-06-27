import React, { useState, useEffect, useRef } from 'react';
import { 
  collection, query, orderBy, limit, serverTimestamp, doc
} from 'firebase/firestore';
import { db } from '../firebase/config';
import { 
  safeOnSnapshot, safeAddDoc, safeDeleteDoc, safeUpdateDoc, safeSetDoc, safeGetDoc
} from '../firebase/db';
import { Message, User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import ImageLightbox from './ImageLightbox';
import { 
  Send, Trash2, ShieldAlert, Pin, UserCheck, 
  UserMinus, Info, AlertOctagon, ThumbsUp, Heart, Smile, CheckCircle, ShieldAlert as ReportIcon, Phone, Mail, Award, X,
  Image as ImageIcon
} from 'lucide-react';

interface ChatProps {
  currentUser: User;
  onRefreshUser: () => void;
}

export default function Chat({ currentUser, onRefreshUser }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showProfilePopup, setShowProfilePopup] = useState(false);
  const [muteReason, setMuteReason] = useState('');
  const [reportingMessage, setReportingMessage] = useState<Message | null>(null);
  const [reportReason, setReportReason] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [chatImage, setChatImage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const handleChatImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
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

        // Compress with high quality (0.93) so that images and texts are crystal clear and highly legible when zoomed!
        const dataUrl = canvas.toDataURL('image/jpeg', 0.93);
        setChatImage(dataUrl);
        setUploadingImage(false);
      };
      img.onerror = () => {
        setUploadingImage(false);
        alert("Failed to load image");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // Common quick emojis to support
  const quickEmojis = ['👋', '🔥', '🚀', '💯', '👍', '💻', '🐛', '📱', '🎉', '❤️'];

  // Listen to community chat
  useEffect(() => {
    const q = query(
      collection(db, 'messages'),
      orderBy('timestamp', 'desc'),
      limit(60)
    );

    const unsubscribe = safeOnSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        msgs.push({
          id: doc.id,
          userId: data.userId,
          userDisplayName: data.userDisplayName,
          userPhotoURL: data.userPhotoURL,
          content: data.content,
          timestamp: data.timestamp,
          isAnnouncement: data.isAnnouncement || false,
          isPinned: data.isPinned || false,
          reportedCount: data.reportedCount || 0,
          imageUrl: data.imageUrl || '',
        });
      });
      // Sort ascending for display
      setMessages(msgs.reverse());
    }, (error) => {
      console.error("Firestore subscription error: ", error);
    });

    return () => unsubscribe();
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!text.trim() && !chatImage) return;

    // Check if muted or suspended
    if (currentUser.muted) {
      alert("You are currently muted by the leader.");
      return;
    }
    if (currentUser.suspendedUntil && new Date(currentUser.suspendedUntil) > new Date()) {
      alert(`Your account is suspended until ${new Date(currentUser.suspendedUntil).toLocaleString()}.`);
      return;
    }

    try {
      const messageData: any = {
        userId: currentUser.uid,
        userDisplayName: currentUser.displayName,
        userPhotoURL: currentUser.photoURL,
        content: text.trim(),
        timestamp: new Date().toISOString(),
        isAnnouncement: false,
        isPinned: false,
        reportedCount: 0,
      };

      if (chatImage) {
        messageData.imageUrl = chatImage;
      }

      await safeAddDoc(collection(db, 'messages'), messageData);
      setText('');
      setChatImage('');
    } catch (err) {
      console.error("Failed to send message: ", err);
      alert("Could not send message. Please verify permissions.");
    }
  };

  const handleInsertEmoji = (emoji: string) => {
    setText((prev) => prev + emoji);
  };

  // Delete message (Self or Leader)
  const handleDeleteMessage = async (messageId: string) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await safeDeleteDoc(doc(db, 'messages', messageId));
    } catch (err) {
      console.error("Failed to delete message: ", err);
    }
  };

  // Toggle pin announcement (Leader only)
  const handleTogglePin = async (message: Message) => {
    try {
      const messageRef = doc(db, 'messages', message.id);
      await safeUpdateDoc(messageRef, {
        isPinned: !message.isPinned
      });
    } catch (err) {
      console.error("Failed to pin message: ", err);
    }
  };

  // Initiate message report
  const triggerReportMessage = (message: Message) => {
    setReportingMessage(message);
    setReportReason('');
    setShowReportModal(true);
  };

  // Submit message report to Violation Center
  const handleSubmitReport = async () => {
    if (!reportingMessage || !reportReason.trim()) return;
    try {
      // Increment reportedCount in message
      const msgRef = doc(db, 'messages', reportingMessage.id);
      await safeUpdateDoc(msgRef, {
        reportedCount: (reportingMessage.reportedCount || 0) + 1
      });

      // Log in user_reports
      const reportId = `${currentUser.uid}_msg_${reportingMessage.id}`;
      await safeSetDoc(doc(db, 'user_reports', reportId), {
        id: reportId,
        reportedUid: reportingMessage.userId,
        reportedName: reportingMessage.userDisplayName,
        reporterUid: currentUser.uid,
        reporterName: currentUser.displayName,
        reason: `In-Chat Message Abuse: ${reportReason}`,
        evidenceText: `Message Content: "${reportingMessage.content}" | Sent at: ${reportingMessage.timestamp}`,
        createdAt: new Date().toISOString(),
        status: 'Pending'
      });

      alert("Thank you. The message has been flagged and submitted to the active leader.");
      setShowReportModal(false);
      setReportingMessage(null);
    } catch (err) {
      console.error("Failed to report message: ", err);
    }
  };

  // Show profile popover
  const handleViewProfile = async (userId: string) => {
    // If clicking self, show self. Otherwise fetch details.
    if (userId === currentUser.uid) {
      setSelectedUser(currentUser);
      setShowProfilePopup(true);
      return;
    }

    try {
      // In a real application we read from users collection
      const userRef = doc(db, 'users', userId);
      safeOnSnapshot(userRef, (docSnap) => {
        if (docSnap.exists()) {
          setSelectedUser(docSnap.data() as User);
          setShowProfilePopup(true);
        }
      });
    } catch (err) {
      console.error("Error loading user profile: ", err);
    }
  };

  // Leader moderation: Mute user
  const handleLeaderMute = async (targetUser: User, action: 'Mute' | 'Unmute') => {
    if (action === 'Mute' && !muteReason.trim()) {
      alert("Please provide a reason for muting the user.");
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
        reason: action === 'Mute' ? muteReason : 'Reversed mute action',
        createdAt: new Date().toISOString()
      });

      alert(`User has been ${action === 'Mute' ? 'muted' : 'unmuted'} successfully.`);
      setMuteReason('');
      setShowProfilePopup(false);
    } catch (err) {
      console.error("Moderation action failed: ", err);
    }
  };

  // Leader moderation: Suspension
  const handleLeaderSuspend = async (targetUser: User, duration: '24h' | '7d' | '14d') => {
    const reason = window.prompt(`Enter suspension reason for suspending ${targetUser.displayName}:`);
    if (!reason) return;

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

      // Log mod action
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

      alert(`User suspended until ${suspensionEnd.toLocaleString()}.`);
      setShowProfilePopup(false);
    } catch (err) {
      console.error("Moderation action failed: ", err);
    }
  };

  // Leader moderation: Ban user
  const handleLeaderBan = async (targetUser: User) => {
    const reason = window.prompt(`Are you absolutely sure you want to permanently BAN ${targetUser.displayName}? This blocks login. Enter reason:`);
    if (!reason) return;

    // Set suspended date to far in the future
    const farFuture = new Date();
    farFuture.setFullYear(farFuture.getFullYear() + 99);

    try {
      const targetRef = doc(db, 'users', targetUser.uid);
      await safeUpdateDoc(targetRef, {
        suspendedUntil: farFuture.toISOString()
      });

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

      alert("User permanently banned.");
      setShowProfilePopup(false);
    } catch (err) {
      console.error("Moderation action failed: ", err);
    }
  };

  const pinnedMessage = messages.find(m => m.isPinned);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-[#0F172A] relative overflow-hidden" id="chat_panel">
      
      {/* Pinned Announcement Header */}
      {pinnedMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-blue-600/10 border-b border-blue-500/20 px-4 py-2.5 flex items-center justify-between text-left"
          id="pinned_announcement_bar"
        >
          <div className="flex items-center space-x-3 overflow-hidden">
            <Pin className="h-4 w-4 text-[#2563EB] shrink-0" />
            <div className="text-xs text-slate-200 truncate">
              <span className="font-semibold text-blue-400">Pinned Announcement: </span>
              "{pinnedMessage.content}" - <span className="text-slate-400 font-mono text-[10px]">{pinnedMessage.userDisplayName}</span>
            </div>
          </div>
          {currentUser.role === 'leader' && (
            <button 
              onClick={() => handleTogglePin(pinnedMessage)}
              className="text-xs text-slate-400 hover:text-white underline shrink-0 ml-4"
              id="unpin_button"
            >
              Unpin
            </button>
          )}
        </motion.div>
      )}

      {/* Main Chat Stream Container */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" id="chat_messages_container">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 space-y-2">
            <Smile className="h-10 w-10 text-slate-600 animate-bounce" />
            <p className="text-sm">Welcome! No messages in the chat yet.</p>
            <p className="text-xs text-slate-600">Be the first to say hello to the testing community!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.userId === currentUser.uid;
            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex items-start space-x-3 ${isSelf ? 'justify-end text-right' : 'justify-start text-left'}`}
                id={`msg_${msg.id}`}
              >
                {!isSelf && (
                  <button onClick={() => handleViewProfile(msg.userId)} className="shrink-0 focus:outline-none">
                    <img
                      src={msg.userPhotoURL}
                      alt={msg.userDisplayName}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full border border-slate-700 object-cover"
                    />
                  </button>
                )}

                <div className={`max-w-[70%] rounded-2xl px-4 py-2.5 shadow-sm text-left ${
                  isSelf 
                    ? 'bg-[#2563EB] text-white rounded-tr-none' 
                    : 'bg-[#1E293B] text-slate-100 rounded-tl-none border border-slate-800'
                }`}>
                  {/* Sender Metadata */}
                  <div className="flex items-center space-x-2 pb-1 text-slate-400 text-xs font-medium">
                    {!isSelf && (
                      <span className="font-semibold text-blue-400 hover:underline cursor-pointer" onClick={() => handleViewProfile(msg.userId)}>
                        {msg.userDisplayName}
                      </span>
                    )}
                    {isSelf && <span className="font-semibold text-slate-300">You</span>}
                    <span className="text-[9px] font-mono opacity-60">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Body Content */}
                  {msg.content && <p className="text-sm leading-relaxed break-words">{msg.content}</p>}
                  {msg.imageUrl && (
                    <button 
                      type="button"
                      onClick={() => setLightboxImage(msg.imageUrl)}
                      className="mt-2 rounded-lg overflow-hidden border border-slate-700 bg-slate-900/40 hover:brightness-110 transition-all block focus:outline-none cursor-zoom-in"
                    >
                      <img 
                        src={msg.imageUrl} 
                        alt="Shared upload" 
                        className="max-h-60 max-w-full object-contain mx-auto rounded"
                        referrerPolicy="no-referrer"
                      />
                    </button>
                  )}

                  {/* Action Bars for Messages */}
                  <div className="flex items-center justify-end space-x-2 mt-1.5 pt-1 border-t border-slate-800/20 text-[10px] text-slate-400">
                    {/* Reporting Trigger */}
                    {!isSelf && (
                      <button 
                        onClick={() => triggerReportMessage(msg)}
                        className="flex items-center gap-0.5 hover:text-red-400 transition-colors"
                        title="Report Message to Leader"
                      >
                        <ShieldAlert className="h-3 w-3" />
                        <span>Flag</span>
                      </button>
                    )}
                    
                    {/* Pin Toggle for Leaders */}
                    {currentUser.role === 'leader' && (
                      <button 
                        onClick={() => handleTogglePin(msg)}
                        className={`flex items-center gap-0.5 hover:text-amber-400 transition-colors ${msg.isPinned ? 'text-amber-400' : ''}`}
                        title={msg.isPinned ? 'Unpin message' : 'Pin to top'}
                      >
                        <Pin className="h-3 w-3" />
                        <span>{msg.isPinned ? 'Pinned' : 'Pin'}</span>
                      </button>
                    )}

                    {/* Delete Options */}
                    {(isSelf || currentUser.role === 'leader') && (
                      <button 
                        onClick={() => handleDeleteMessage(msg.id)}
                        className="flex items-center gap-0.5 text-red-500/75 hover:text-red-400 transition-colors"
                        title="Delete Message"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>

                {isSelf && (
                  <button onClick={() => handleViewProfile(msg.userId)} className="shrink-0 focus:outline-none">
                    <img
                      src={msg.userPhotoURL}
                      alt={msg.userDisplayName}
                      referrerPolicy="no-referrer"
                      className="h-9 w-9 rounded-full border border-slate-700 object-cover"
                    />
                  </button>
                )}
              </motion.div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input panel & Emoji helpers */}
      <div className="p-4 border-t border-slate-800 bg-[#1E293B]" id="chat_controls_container">
        {/* Inline Emojis Row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5 pb-2 border-b border-slate-800/40" id="emoji_helper_bar">
          <span className="text-[10px] font-mono text-slate-500 mr-2 uppercase tracking-wide">Quick Emoji:</span>
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleInsertEmoji(emoji)}
              className="h-7 w-7 text-sm flex items-center justify-center rounded bg-slate-800 hover:bg-[#2563EB] hover:scale-115 transition-all"
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Preview of attached chat image */}
        {chatImage && (
          <div className="relative inline-block mb-3 bg-slate-900 border border-slate-800 p-1.5 rounded-xl text-left" id="chat_img_preview">
            <img src={chatImage} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
            <button
              type="button"
              onClick={() => setChatImage('')}
              className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 rounded-full text-white text-xs flex items-center justify-center font-bold hover:bg-red-600 shadow"
            >
              ×
            </button>
          </div>
        )}

        {/* Form Container */}
        <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
          <input
            type="file"
            accept="image/*"
            id="chat_image_input"
            className="hidden"
            onChange={handleChatImageUpload}
          />
          <button
            type="button"
            disabled={currentUser.muted || uploadingImage}
            onClick={() => document.getElementById('chat_image_input')?.click()}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors border border-slate-700/60 disabled:opacity-50 shrink-0"
            id="chat_image_attach_btn"
            title="Attach image from gallery"
          >
            {uploadingImage ? (
              <span className="text-[10px] text-slate-400 font-mono animate-pulse">...</span>
            ) : (
              <ImageIcon className="h-5 w-5 text-blue-400" />
            )}
          </button>

          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={currentUser.muted}
            placeholder={currentUser.muted ? "You are currently muted by the leader." : "Type a message..."}
            className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-[#2563EB] disabled:opacity-50"
            id="chat_input_text"
          />
          <button
            type="submit"
            disabled={(!text.trim() && !chatImage) || currentUser.muted}
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#2563EB] text-white hover:bg-blue-600 disabled:opacity-50 disabled:hover:bg-[#2563EB]"
            id="send_message_button"
          >
            <Send className="h-5 w-5" />
          </button>
        </form>
      </div>

      {/* Profile Popup Popover */}
      <AnimatePresence>
        {showProfilePopup && selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" id="user_profile_popover">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm rounded-2xl border border-slate-800 bg-[#1E293B] overflow-hidden shadow-2xl"
              id="profile_popover_card"
            >
              {/* Profile Card Header Banner */}
              <div className="h-20 bg-gradient-to-r from-blue-600 to-emerald-600 relative" />
              
              <div className="px-6 pb-6 relative text-left">
                {/* Close Button */}
                <button
                  onClick={() => setShowProfilePopup(false)}
                  className="absolute top-4 right-4 text-slate-400 hover:text-white"
                  id="close_popover"
                >
                  <X className="h-5 w-5" />
                </button>

                {/* Avatar */}
                <div className="flex justify-between items-end -mt-10 mb-4">
                  <img
                    src={selectedUser.photoURL}
                    alt={selectedUser.displayName}
                    referrerPolicy="no-referrer"
                    className="h-20 w-20 rounded-full border-4 border-[#1E293B] bg-slate-800 object-cover"
                    id="popover_avatar"
                  />
                  
                  {/* Role Tag */}
                  <span className={`rounded-full px-3 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                    selectedUser.role === 'leader' 
                      ? 'bg-emerald-500/10 text-[#10B981]' 
                      : 'bg-blue-500/10 text-blue-400'
                  }`}>
                    {selectedUser.role}
                  </span>
                </div>

                <h3 className="text-xl font-bold text-white">{selectedUser.displayName}</h3>
                <p className="text-xs text-slate-400 font-mono mt-0.5">UID: {selectedUser.uid}</p>

                {/* Profile Information details */}
                <div className="mt-4 space-y-2.5 border-t border-b border-slate-800 py-3 text-xs">
                  <div className="flex items-center text-slate-300">
                    <Mail className="h-3.5 w-3.5 mr-2 text-slate-500" />
                    <span>{selectedUser.email}</span>
                  </div>
                  {selectedUser.contactNumber && (
                    <div className="flex items-center text-slate-300">
                      <Phone className="h-3.5 w-3.5 mr-2 text-slate-500" />
                      <span>{selectedUser.contactNumber}</span>
                    </div>
                  )}
                  <div className="flex items-start text-slate-300">
                    <Info className="h-3.5 w-3.5 mr-2 text-slate-500 mt-0.5 shrink-0" />
                    <span className="italic">{selectedUser.bio || 'No bio provided.'}</span>
                  </div>
                </div>

                {/* Leader Moderation Console inside Popover */}
                {currentUser.role === 'leader' && selectedUser.uid !== currentUser.uid && (
                  <div className="mt-4 p-3 bg-slate-950 rounded-xl space-y-3 border border-slate-800">
                    <div className="flex items-center space-x-1.5 text-amber-500 text-xs font-semibold">
                      <AlertOctagon className="h-3.5 w-3.5" />
                      <span>Leader Moderation Panel</span>
                    </div>

                    {/* Mute Box */}
                    <div className="flex flex-col gap-1.5">
                      <input
                        type="text"
                        placeholder="Reason for mute..."
                        value={muteReason}
                        onChange={(e) => setMuteReason(e.target.value)}
                        className="bg-slate-900 border border-slate-800 rounded px-2.5 py-1 text-xs text-white"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleLeaderMute(selectedUser, selectedUser.muted ? 'Unmute' : 'Mute')}
                          className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                            selectedUser.muted ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 'bg-amber-600 hover:bg-amber-700 text-white'
                          }`}
                        >
                          {selectedUser.muted ? 'Unmute User' : 'Mute User'}
                        </button>
                      </div>
                    </div>

                    {/* Suspension buttons */}
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-slate-400 font-mono">Suspension Period:</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => handleLeaderSuspend(selectedUser, '24h')} className="flex-1 bg-slate-850 hover:bg-red-500/20 hover:text-red-400 border border-slate-800 py-1 rounded text-[10px] font-medium transition-all">
                          24 Hrs
                        </button>
                        <button onClick={() => handleLeaderSuspend(selectedUser, '7d')} className="flex-1 bg-slate-850 hover:bg-red-500/20 hover:text-red-400 border border-slate-800 py-1 rounded text-[10px] font-medium transition-all">
                          7 Days
                        </button>
                        <button onClick={() => handleLeaderSuspend(selectedUser, '14d')} className="flex-1 bg-slate-850 hover:bg-red-500/20 hover:text-red-400 border border-slate-800 py-1 rounded text-[10px] font-medium transition-all">
                          14 Days
                        </button>
                      </div>
                    </div>

                    {/* Ban and Delete actions */}
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => handleLeaderBan(selectedUser)}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1.5 rounded font-semibold transition-colors"
                      >
                        Permanent Ban
                      </button>
                    </div>
                  </div>
                )}

                {/* Non-leader reporting */}
                {selectedUser.uid !== currentUser.uid && (
                  <button
                    onClick={() => {
                      setReportingMessage(null);
                      setReportReason('');
                      setShowReportModal(true);
                      // Formulate reported name
                      setReportingMessage({
                        id: 'user_only',
                        userId: selectedUser.uid,
                        userDisplayName: selectedUser.displayName,
                        userPhotoURL: selectedUser.photoURL,
                        content: `Direct user report against UID ${selectedUser.uid}`,
                        timestamp: new Date().toISOString()
                      });
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 py-2 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/15"
                  >
                    <ShieldAlert className="h-4 w-4" />
                    Report User
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Report Modal */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" id="reporting_modal_container">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-xl border border-slate-800 bg-[#1E293B] p-6 text-left shadow-2xl"
              id="reporting_modal_card"
            >
              <div className="flex items-center space-x-2 text-red-400 mb-4">
                <ReportIcon className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">Report Violations</h3>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                Your report will be immediately dispatched to the active community leader. Please enter a brief explanation of the offense (abuse, spam, or misconduct).
              </p>

              <textarea
                value={reportReason}
                onChange={(e) => setReportReason(e.target.value)}
                placeholder="Details of violation..."
                rows={4}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              />

              <div className="mt-5 flex justify-end space-x-2">
                <button
                  onClick={() => setShowReportModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitReport}
                  disabled={!reportReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors"
                >
                  Submit Flag
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {lightboxImage && (
          <ImageLightbox 
            src={lightboxImage} 
            alt="Shared Photo Zoom" 
            onClose={() => setLightboxImage(null)} 
          />
        )}
      </AnimatePresence>

    </div>
  );
}
