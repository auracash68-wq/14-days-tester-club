export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  contactNumber?: string;
  bio?: string;
  role: 'member' | 'leader';
  muted: boolean;
  suspendedUntil?: string; // ISO string or null
  createdAt: string;
}

export interface Message {
  id: string;
  userId: string;
  userDisplayName: string;
  userPhotoURL: string;
  content: string;
  timestamp: string; // ISO string
  isAnnouncement?: boolean;
  isPinned?: boolean;
  reportedCount?: number;
  imageUrl?: string; // Base64 or standard URL
}

export interface App {
  id: string;
  appName: string;
  appIcon: string; // Base64 or standard URL
  googleGroupLink: string;
  joinWebLink: string;
  joinAndroidLink: string;
  developerUid: string;
  developerEmail: string;
  createdAt: string;
}

export interface Report {
  id: string;
  appId: string;
  appName: string;
  developerUid: string;
  testerUid: string;
  testerName: string;
  testerPhoto: string;
  feedback: string;
  bugReport?: string;
  suggestions?: string;
  screenshots: string[]; // List of base64 screenshots
  status: 'Pending' | 'Reviewed' | 'Resolved';
  createdAt: string;
}

export interface Vote {
  voterUid: string;
  candidateUid: string;
  candidateName: string;
  votingRoundId: string;
  createdAt: string;
}

export interface UserReport {
  id: string;
  reportedUid: string;
  reportedName: string;
  reporterUid: string;
  reporterName: string;
  reason: string;
  evidenceText: string;
  createdAt: string;
  status: 'Pending' | 'Reviewed';
}

export interface ModerationLog {
  id: string;
  leaderUid: string;
  leaderName: string;
  targetUid: string;
  targetName: string;
  actionType: 'Mute' | 'Unmute' | 'Suspend_24h' | 'Suspend_7d' | 'Suspend_14d' | 'Unsuspend' | 'Ban' | 'Delete_Account';
  reason: string;
  createdAt: string;
}

export interface VotingRound {
  id: string;
  startDate: string;
  endDate: string;
  candidates: {
    uid: string;
    displayName: string;
    photoURL: string;
    votesCount: number;
  }[];
  active: boolean;
  winnerUid?: string;
}

export interface Complaint {
  id: string;
  reporterUid: string;
  reporterName: string;
  reporterEmail: string;
  targetUser: string;
  complaintText: string;
  screenshots: string[];
  createdAt: string;
  status: 'Pending' | 'Reviewed' | 'Resolved';
}

