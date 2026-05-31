export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  role: "USER" | "MODERATOR" | "ADMIN" | "SUPER_ADMIN";
  status: "PENDING" | "ACTIVE" | "SUSPENDED" | "BANNED" | "DELETED";
  emailVerified?: Date;
  lastLoginAt?: Date;
  createdAt: Date;
}

export interface Profile {
  id: string;
  userId: string;
  gender: "MALE" | "FEMALE";
  age: number;
  nationality: string;
  country: string;
  city: string;
  maritalStatus: "SINGLE" | "DIVORCED" | "WIDOWED" | "MARRIED";
  religiousLevel: string;
  height?: number;
  weight?: number;
  skinColor?: string;
  education?: string;
  job?: string;
  salary?: number;
  hasChildren: boolean;
  childrenCount: number;
  acceptPolygamy: boolean;
  wantsPolygamy: boolean;
  tribe?: string;
  bio?: string;
  hobbies: string[];
  seekingDescription?: string;
  photoVisible: boolean;
  isVerified: boolean;
  guardianName?: string;
  guardianPhone?: string;
  guardianRelation?: string;
}

export interface Subscription {
  id: string;
  userId: string;
  planId: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED" | "PENDING" | "FAILED";
  startDate: Date;
  endDate?: Date;
  autoRenew: boolean;
  amount?: number;
}

export interface SubscriptionPlan {
  id: string;
  nameAr: string;
  description?: string;
  price: number;
  duration: number;
  features: string[];
  maxDevices: number;
  maxMessages: number;
  hasApi: boolean;
  hasWebhooks: boolean;
  hasAutomation: boolean;
  hasBroadcast: boolean;
  isPopular: boolean;
  support: "BASIC" | "STANDARD" | "PREMIUM" | "VIP";
}

export interface WaDevice {
  id: string;
  name: string;
  phoneNumber: string;
  status: "CONNECTED" | "DISCONNECTED" | "CONNECTING" | "QR_SCAN" | "ERROR";
  isConnected: boolean;
  messagesSent: number;
  messagesReceived: number;
  lastConnected?: Date;
}

export interface Message {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  type: "TEXT" | "REQUEST" | "SYSTEM";
  isRead: boolean;
  createdAt: Date;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
  isRead: boolean;
  createdAt: Date;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  entity: string;
  details?: Record<string, any>;
  ipAddress?: string;
  createdAt: Date;
}
