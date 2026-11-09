/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp, deleteApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot,
  QuerySnapshot 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { 
  Milk, 
  Egg, 
  DollarSign, 
  Calendar, 
  Plus, 
  Trash2, 
  Edit2, 
  LogOut, 
  CheckCircle2, 
  TrendingUp, 
  FileText, 
  Download, 
  Sprout, 
  AlertCircle, 
  Database,
  ChevronRight,
  Layers,
  Wifi,
  WifiOff,
  UserCheck,
  BarChart3,
  RefreshCw,
  UserPlus
} from 'lucide-react';

// Initialize Primary Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
const auth = getAuth(app);

// Error handling helper
enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Data Interfaces
interface Cow {
  id: string;
  userId: string;
  name: string;
  tagNumber: string;
  breed: string;
  status: 'Active' | 'Dry' | 'Sold';
  notes: string;
  createdAt: string;
}

interface MilkProduction {
  id: string;
  userId: string;
  cowId: string;
  cowName: string;
  date: string;
  morningLiters: number;
  eveningLiters: number;
  totalLiters: number;
  notes: string;
  createdAt: string;
}

interface EggCollection {
  id: string;
  userId: string;
  date: string;
  totalEggs: number;
  brokenEggs: number;
  netEggs: number;
  notes: string;
  createdAt: string;
}

interface MilkSale {
  id: string;
  userId: string;
  date: string;
  litersSold: number;
  pricePerLiter: number;
  totalAmount: number;
  buyer: string;
  notes: string;
  createdAt: string;
}

interface EggSale {
  id: string;
  userId: string;
  date: string;
  quantity: number;
  unit: 'pieces' | 'trays';
  price: number;
  totalAmount: number;
  buyer: string;
  notes: string;
  createdAt: string;
}

interface FarmUserRecord {
  id: string;
  email: string;
  role: 'Admin' | 'Manager' | 'Farmer';
  createdAt: string;
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  
  // Login states
  const [usernameInput, setUsernameInput] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSignUp, setIsSignUp] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string>('');

  // Online / Offline Status tracker
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'dashboard' | 'cows' | 'milk' | 'eggs' | 'sales' | 'reports' | 'admin'>('dashboard');

  // Reports sub-tab: 'daily' | 'weekly' | 'monthly'
  const [reportSubTab, setReportSubTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Data states
  const [cows, setCows] = useState<Cow[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkProduction[]>([]);
  const [eggRecords, setEggRecords] = useState<EggCollection[]>([]);
  const [milkSales, setMilkSales] = useState<MilkSale[]>([]);
  const [eggSales, setEggSales] = useState<EggSale[]>([]);
  const [farmUsers, setFarmUsers] = useState<FarmUserRecord[]>([]);
  const [loadingData, setLoadingData] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string>('');

  // Admin account creation form states
  const [newAccountEmail, setNewAccountEmail] = useState<string>('');
  const [newAccountPassword, setNewAccountPassword] = useState<string>('');
  const [newAccountRole, setNewAccountRole] = useState<'Admin' | 'Manager' | 'Farmer'>('Farmer');
  const [creatingAccount, setCreatingAccount] = useState<boolean>(false);

  // Modals
  const [modalOpen, setModalOpen] = useState<'cow' | 'milk' | 'egg' | 'milkSale' | 'eggSale' | null>(null);

  // Editing state for milk and egg records
  const [editingMilkId, setEditingMilkId] = useState<string | null>(null);
  const [editingEggId, setEditingEggId] = useState<string | null>(null);

  // Form states
  const [cowName, setCowName] = useState<string>('');
  const [cowTag, setCowTag] = useState<string>('');
  const [cowBreed, setCowBreed] = useState<string>('Holstein');
  const [cowStatus, setCowStatus] = useState<'Active' | 'Dry' | 'Sold'>('Active');
  const [cowNotes, setCowNotes] = useState<string>('');

  const [milkCowId, setMilkCowId] = useState<string>('');
  const [milkDate, setMilkDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [morningLiters, setMorningLiters] = useState<string>('');
  const [eveningLiters, setEveningLiters] = useState<string>('');
  const [milkNotes, setMilkNotes] = useState<string>('');

  const [eggDate, setEggDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [totalEggs, setTotalEggs] = useState<string>('');
  const [brokenEggs, setBrokenEggs] = useState<string>('0');
  const [eggNotes, setEggNotes] = useState<string>('');

  const [milkSaleDate, setMilkSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [litersSold, setLitersSold] = useState<string>('');
  const [pricePerLiter, setPricePerLiter] = useState<string>('1.50');
  const [milkBuyer, setMilkBuyer] = useState<string>('');
  const [milkSaleNotes, setMilkSaleNotes] = useState<string>('');

  const [eggSaleDate, setEggSaleDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [eggQuantity, setEggQuantity] = useState<string>('');
  const [eggUnit, setEggUnit] = useState<'pieces' | 'trays'>('trays');
  const [eggPrice, setEggPrice] = useState<string>('');
  const [eggBuyer, setEggBuyer] = useState<string>('');
  const [eggSaleNotes, setEggSaleNotes] = useState<string>('');

  // Monitor online / offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: User | null) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Firestore data
  useEffect(() => {
    if (!user) {
      setCows([]);
      setMilkRecords([]);
      setEggRecords([]);
      setMilkSales([]);
      setEggSales([]);
      setFarmUsers([]);
      return;
    }

    setLoadingData(true);

    const unsubCows = onSnapshot(
      query(collection(db, 'cows'), where('userId', '==', user.uid)),
      (snapshot: QuerySnapshot) => {
        const list: Cow[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as Cow));
        setCows(list);
        if (list.length > 0 && !milkCowId) {
          setMilkCowId(list[0].id);
        }
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'cows')
    );

    const unsubMilk = onSnapshot(
      query(collection(db, 'milk_production'), where('userId', '==', user.uid)),
      (snapshot: QuerySnapshot) => {
        const list: MilkProduction[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as MilkProduction));
        setMilkRecords(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'milk_production')
    );

    const unsubEggs = onSnapshot(
      query(collection(db, 'egg_collection'), where('userId', '==', user.uid)),
      (snapshot: QuerySnapshot) => {
        const list: EggCollection[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as EggCollection));
        setEggRecords(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'egg_collection')
    );

    const unsubMilkSales = onSnapshot(
      query(collection(db, 'milk_sales'), where('userId', '==', user.uid)),
      (snapshot: QuerySnapshot) => {
        const list: MilkSale[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as MilkSale));
        setMilkSales(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'milk_sales')
    );

    const unsubEggSales = onSnapshot(
      query(collection(db, 'egg_sales'), where('userId', '==', user.uid)),
      (snapshot: QuerySnapshot) => {
        const list: EggSale[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as EggSale));
        setEggSales(list.sort((a, b) => b.date.localeCompare(a.date)));
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'egg_sales')
    );

    // Fetch Farm Users registered by Admin synced to Firestore
    const unsubUsers = onSnapshot(
      collection(db, 'farm_users'),
      (snapshot: QuerySnapshot) => {
        const list: FarmUserRecord[] = snapshot.docs.map((docItem: any) => ({ id: docItem.id, ...docItem.data() } as FarmUserRecord));
        setFarmUsers(list);
        setLoadingData(false);
      },
      (error: unknown) => handleFirestoreError(error, OperationType.GET, 'farm_users')
    );

    return () => {
      unsubCows();
      unsubMilk();
      unsubEggs();
      unsubMilkSales();
      unsubEggSales();
      unsubUsers();
    };
  }, [user]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 4000);
  };

  const resolveEmail = (input: string) => {
    const clean = input.trim().toLowerCase();
    if (clean === 'admin' || clean === 'systemadmin') return 'admin@sunnyacres.farm';
    if (clean === 'manager' || clean === 'farmmanager') return 'manager@sunnyacres.farm';
    if (clean === 'mama' || clean === 'farmer') return 'farmer.mama@sunnyacres.farm';
    if (clean.includes('@')) return clean;
    return `${clean}@sunnyacres.farm`;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    const resolved = resolveEmail(usernameInput);
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, resolved, password);
        showToast('Account created successfully.');
      } else {
        await signInWithEmailAndPassword(auth, resolved, password);
        showToast('Successfully logged in.');
      }
    } catch (err: any) {
      setAuthError(err.message || 'Authentication failed');
    }
  };

  const handleQuickLogin = async (role: 'admin' | 'manager' | 'mama') => {
    let emailCred = 'farmer.mama@sunnyacres.farm';
    let passCred = 'FarmMama2026!';
    if (role === 'admin') {
      emailCred = 'admin@sunnyacres.farm';
      passCred = 'AdminPass2026!';
    } else if (role === 'manager') {
      emailCred = 'manager@sunnyacres.farm';
      passCred = 'ManagerPass2026!';
    }

    setUsernameInput(emailCred);
    setPassword(passCred);

    try {
      await signInWithEmailAndPassword(auth, emailCred, passCred);
      showToast(`Logged in as ${role.toUpperCase()}`);
    } catch {
      try {
        await createUserWithEmailAndPassword(auth, emailCred, passCred);
        showToast(`Created & logged in as ${role.toUpperCase()}`);
      } catch (err: any) {
        setAuthError(err.message);
      }
    }
  };

  // System Admin creating a new account synced to Firebase Auth and Firestore
  const handleCreateAccountByAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountEmail || !newAccountPassword) return;
    setCreatingAccount(true);

    const resolvedEmail = resolveEmail(newAccountEmail);

    try {
      // Use a secondary Firebase app instance so creating user doesn't log out current Admin session
      const secondaryApp = initializeApp(firebaseConfig, 'secondaryAuthApp_' + Date.now());
      const secondaryAuth = getAuth(secondaryApp);
      
      await createUserWithEmailAndPassword(secondaryAuth, resolvedEmail, newAccountPassword);
      await deleteApp(secondaryApp);

      // Sync account record to Firestore
      await addDoc(collection(db, 'farm_users'), {
        email: resolvedEmail,
        role: newAccountRole,
        createdAt: new Date().toISOString()
      });

      setNewAccountEmail('');
      setNewAccountPassword('');
      setCreatingAccount(false);
      showToast(`Account "${resolvedEmail}" created and synced to Firebase.`);
    } catch (err: any) {
      setCreatingAccount(false);
      showToast(`Failed to create account: ${err.message || err}`);
    }
  };

  const loadSampleData = async () => {
    if (!user) return;
    try {
      setLoadingData(true);
      const sampleCows = [
        { name: 'Daisy', tagNumber: 'C001', breed: 'Holstein', status: 'Active' as const, notes: 'Very gentle, high yield' },
        { name: 'Bessie', tagNumber: 'C002', breed: 'Jersey', status: 'Active' as const, notes: 'Rich milk' },
        { name: 'Buttercup', tagNumber: 'C003', breed: 'Guernsey', status: 'Active' as const, notes: 'Calm temperament' },
        { name: 'Luna', tagNumber: 'C004', breed: 'Ayrshire', status: 'Dry' as const, notes: 'Resting before calving' }
      ];

      const cowIds: string[] = [];
      for (const c of sampleCows) {
        const docRef = await addDoc(collection(db, 'cows'), {
          ...c,
          userId: user.uid,
          createdAt: new Date().toISOString()
        });
        cowIds.push(docRef.id);
      }

      const today = new Date().toISOString().split('T')[0];

      if (cowIds.length > 0) {
        await addDoc(collection(db, 'milk_production'), {
          userId: user.uid,
          cowId: cowIds[0],
          cowName: 'Daisy',
          date: today,
          morningLiters: 14.5,
          eveningLiters: 12.0,
          totalLiters: 26.5,
          notes: 'Good morning milking',
          createdAt: new Date().toISOString()
        });
      }

      await addDoc(collection(db, 'egg_collection'), {
        userId: user.uid,
        date: today,
        totalEggs: 185,
        brokenEggs: 3,
        netEggs: 182,
        notes: 'Collected from Coop A & B',
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'milk_sales'), {
        userId: user.uid,
        date: today,
        litersSold: 25,
        pricePerLiter: 1.20,
        totalAmount: 30.00,
        buyer: 'Local Dairy Shop',
        notes: 'Paid in cash',
        createdAt: new Date().toISOString()
      });

      await addDoc(collection(db, 'egg_sales'), {
        userId: user.uid,
        date: today,
        quantity: 5,
        unit: 'trays',
        price: 8.00,
        totalAmount: 40.00,
        buyer: 'Mrs. Henderson',
        notes: 'Weekly regular customer',
        createdAt: new Date().toISOString()
      });

      showToast('Sample farm data loaded successfully.');
      setLoadingData(false);
    } catch (err: unknown) {
      setLoadingData(false);
      showToast('Error loading sample data.');
    }
  };

  const handleAddCow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !cowName) return;
    try {
      await addDoc(collection(db, 'cows'), {
        userId: user.uid,
        name: cowName,
        tagNumber: cowTag || 'N/A',
        breed: cowBreed,
        status: cowStatus,
        notes: cowNotes,
        createdAt: new Date().toISOString()
      });
      setCowName('');
      setCowTag('');
      setCowNotes('');
      setModalOpen(null);
      showToast(`Cow "${cowName}" added successfully.`);
    } catch (err: unknown) {
      showToast('Failed to add cow.');
    }
  };

  const handleSaveMilk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !milkCowId) return;
    const selectedCow = cows.find((c: Cow) => c.id === milkCowId);
    const m = parseFloat(morningLiters) || 0;
    const ev = parseFloat(eveningLiters) || 0;
    const total = m + ev;

    try {
      if (editingMilkId) {
        await updateDoc(doc(db, 'milk_production', editingMilkId), {
          cowId: milkCowId,
          cowName: selectedCow ? selectedCow.name : 'Unknown',
          date: milkDate,
          morningLiters: m,
          eveningLiters: ev,
          totalLiters: total,
          notes: milkNotes,
        });
        showToast(`Milk record updated successfully (${total} Liters).`);
      } else {
        await addDoc(collection(db, 'milk_production'), {
          userId: user.uid,
          cowId: milkCowId,
          cowName: selectedCow ? selectedCow.name : 'Unknown',
          date: milkDate,
          morningLiters: m,
          eveningLiters: ev,
          totalLiters: total,
          notes: milkNotes,
          createdAt: new Date().toISOString()
        });
        showToast(`Milk recorded: ${total} Liters.`);
      }
      setMorningLiters('');
      setEveningLiters('');
      setMilkNotes('');
      setEditingMilkId(null);
      setModalOpen(null);
    } catch (err: unknown) {
      showToast('Failed to save milk record.');
    }
  };

  const openEditMilk = (record: MilkProduction) => {
    setEditingMilkId(record.id);
    setMilkCowId(record.cowId);
    setMilkDate(record.date);
    setMorningLiters(String(record.morningLiters));
    setEveningLiters(String(record.eveningLiters));
    setMilkNotes(record.notes || '');
    setModalOpen('milk');
  };

  const handleSaveEgg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !totalEggs) return;
    const tot = parseInt(totalEggs) || 0;
    const brok = parseInt(brokenEggs) || 0;
    const net = Math.max(0, tot - brok);

    try {
      if (editingEggId) {
        await updateDoc(doc(db, 'egg_collection', editingEggId), {
          date: eggDate,
          totalEggs: tot,
          brokenEggs: brok,
          netEggs: net,
          notes: eggNotes,
        });
        showToast(`Egg collection updated successfully (${net} good eggs).`);
      } else {
        await addDoc(collection(db, 'egg_collection'), {
          userId: user.uid,
          date: eggDate,
          totalEggs: tot,
          brokenEggs: brok,
          netEggs: net,
          notes: eggNotes,
          createdAt: new Date().toISOString()
        });
        showToast(`Egg collection recorded: ${net} good eggs.`);
      }
      setTotalEggs('');
      setBrokenEggs('0');
      setEggNotes('');
      setEditingEggId(null);
      setModalOpen(null);
    } catch (err: unknown) {
      showToast('Failed to save egg collection.');
    }
  };

  const openEditEgg = (record: EggCollection) => {
    setEditingEggId(record.id);
    setEggDate(record.date);
    setTotalEggs(String(record.totalEggs));
    setBrokenEggs(String(record.brokenEggs));
    setEggNotes(record.notes || '');
    setModalOpen('egg');
  };

  const handleAddMilkSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !litersSold) return;
    const l = parseFloat(litersSold) || 0;
    const p = parseFloat(pricePerLiter) || 0;
    const total = l * p;

    try {
      await addDoc(collection(db, 'milk_sales'), {
        userId: user.uid,
        date: milkSaleDate,
        litersSold: l,
        pricePerLiter: p,
        totalAmount: total,
        buyer: milkBuyer || 'General Buyer',
        notes: milkSaleNotes,
        createdAt: new Date().toISOString()
      });
      setLitersSold('');
      setMilkBuyer('');
      setMilkSaleNotes('');
      setModalOpen(null);
      showToast(`Milk sale recorded: $${total.toFixed(2)}.`);
    } catch (err: unknown) {
      showToast('Failed to save milk sale.');
    }
  };

  const handleAddEggSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !eggQuantity || !eggPrice) return;
    const qty = parseFloat(eggQuantity) || 0;
    const pr = parseFloat(eggPrice) || 0;
    const total = qty * pr;

    try {
      await addDoc(collection(db, 'egg_sales'), {
        userId: user.uid,
        date: eggSaleDate,
        quantity: qty,
        unit: eggUnit,
        price: pr,
        totalAmount: total,
        buyer: eggBuyer || 'General Buyer',
        notes: eggSaleNotes,
        createdAt: new Date().toISOString()
      });
      setEggQuantity('');
      setEggPrice('');
      setEggBuyer('');
      setEggSaleNotes('');
      setModalOpen(null);
      showToast(`Egg sale recorded: $${total.toFixed(2)}.`);
    } catch (err: unknown) {
      showToast('Failed to save egg sale.');
    }
  };

  const handleDeleteItem = async (collName: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        await deleteDoc(doc(db, collName, id));
        showToast('Record deleted successfully.');
      } catch (err: unknown) {
        showToast('Failed to delete record.');
      }
    }
  };

  // Date Calculations
  const todayStr = new Date().toISOString().split('T')[0];
  
  const isDateInCurrentWeek = (dateStr: string) => {
    const currDate = new Date(dateStr);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - currDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && currDate <= today;
  };

  const todayMilkTotal = milkRecords
    .filter((r: MilkProduction) => r.date === todayStr)
    .reduce((acc: number, curr: MilkProduction) => acc + (curr.totalLiters || 0), 0);

  const todayEggTotal = eggRecords
    .filter((r: EggCollection) => r.date === todayStr)
    .reduce((acc: number, curr: EggCollection) => acc + (curr.netEggs || 0), 0);

  const todayMilkSalesAmount = milkSales
    .filter((s: MilkSale) => s.date === todayStr)
    .reduce((acc: number, curr: MilkSale) => acc + (curr.totalAmount || 0), 0);

  const todayEggSalesAmount = eggSales
    .filter((s: EggSale) => s.date === todayStr)
    .reduce((acc: number, curr: EggSale) => acc + (curr.totalAmount || 0), 0);

  const weeklyMilkTotal = milkRecords
    .filter((r: MilkProduction) => isDateInCurrentWeek(r.date))
    .reduce((acc: number, curr: MilkProduction) => acc + (curr.totalLiters || 0), 0);

  const weeklyEggTotal = eggRecords
    .filter((r: EggCollection) => isDateInCurrentWeek(r.date))
    .reduce((acc: number, curr: EggCollection) => acc + (curr.netEggs || 0), 0);

  const weeklyMilkSalesAmount = milkSales
    .filter((s: MilkSale) => isDateInCurrentWeek(s.date))
    .reduce((acc: number, curr: MilkSale) => acc + (curr.totalAmount || 0), 0);

  const weeklyEggSalesAmount = eggSales
    .filter((s: EggSale) => isDateInCurrentWeek(s.date))
    .reduce((acc: number, curr: EggSale) => acc + (curr.totalAmount || 0), 0);

  // Monthly Aggregations for Selected Year
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June', 
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const monthlyAggregates = monthNames.map((monthName, index) => {
    const monthIndexStr = String(index + 1).padStart(2, '0');
    const yearPrefix = `${selectedYear}-${monthIndexStr}`;

    const mTotal = milkRecords
      .filter((r: MilkProduction) => r.date && r.date.startsWith(yearPrefix))
      .reduce((acc: number, curr: MilkProduction) => acc + (curr.totalLiters || 0), 0);

    const eTotal = eggRecords
      .filter((r: EggCollection) => r.date && r.date.startsWith(yearPrefix))
      .reduce((acc: number, curr: EggCollection) => acc + (curr.netEggs || 0), 0);

    const msTotal = milkSales
      .filter((s: MilkSale) => s.date && s.date.startsWith(yearPrefix))
      .reduce((acc: number, curr: MilkSale) => acc + (curr.totalAmount || 0), 0);

    const esTotal = eggSales
      .filter((s: EggSale) => s.date && s.date.startsWith(yearPrefix))
      .reduce((acc: number, curr: EggSale) => acc + (curr.totalAmount || 0), 0);

    return {
      monthName,
      milkLiters: mTotal,
      eggsCollected: eTotal,
      milkRevenue: msTotal,
      eggRevenue: esTotal,
      totalRevenue: msTotal + esTotal
    };
  });

  const activeCowsCount = cows.filter((c: Cow) => c.status === 'Active').length;
  const isAdmin = user?.email?.includes('admin');
  const isManager = user?.email?.includes('manager') || isAdmin;

  if (authLoading) {
    return (
      <div className="min-h-screen bg-emerald-50 flex items-center justify-center">
        <div className="text-center">
          <Sprout className="w-12 h-12 text-emerald-600 animate-bounce mx-auto mb-3" />
          <p className="text-emerald-800 font-medium text-lg">Loading Sunny Acres Farm...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-100 via-amber-50 to-orange-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-xl max-w-md w-full p-8 border border-emerald-100">
          <div className="text-center mb-6">
            <div className="bg-emerald-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3 shadow-md">
              <Sprout className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900">Sunny Acres Farm</h1>
            <p className="text-slate-600 text-sm mt-1">Farm Management System · Sign In</p>
          </div>

          <div className="bg-emerald-50 p-4 rounded-2xl mb-6 border border-emerald-200 space-y-2">
            <p className="text-xs text-emerald-800 font-semibold text-center mb-1">
              Quick Login Accounts:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('mama')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold py-2.5 px-2 rounded-xl transition-colors shadow text-center"
              >
                Farmer Mama
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold py-2.5 px-2 rounded-xl transition-colors shadow text-center"
              >
                Farm Manager
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('admin')}
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold py-2.5 px-2 rounded-xl transition-colors shadow text-center"
              >
                System Admin
              </button>
            </div>
          </div>

          <div className="relative flex py-2 items-center mb-4">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="flex-shrink mx-4 text-slate-400 text-xs">or enter username / email</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {authError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Username or Email</label>
              <input
                type="text"
                required
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="admin, manager, or mama"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-base"
              />
            </div>

            <button
              type="submit"
              className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-3 px-4 rounded-xl transition-colors text-base min-h-[48px] shadow"
            >
              {isSignUp ? 'Create Account' : 'Log In'}
            </button>
          </form>

          <div className="text-center mt-6">
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-emerald-700 hover:underline font-medium"
            >
              {isSignUp ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 md:pb-10 font-sans">
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in border border-emerald-500">
          <CheckCircle2 className="w-6 h-6 shrink-0" />
          <span className="font-semibold text-base">{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xs">
              <Sprout className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Sunny Acres Farm</h1>
              <p className="text-xs text-slate-500 flex items-center gap-1.5">
                <span>Role: <strong className="text-emerald-700">{isAdmin ? 'System Admin' : isManager ? 'Farm Manager' : 'Farmer Mama'}</strong></span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${isOnline ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
              {isOnline ? <Wifi className="w-3.5 h-3.5 text-emerald-600" /> : <WifiOff className="w-3.5 h-3.5 text-amber-600" />}
              <span>{isOnline ? 'Online (Synced)' : 'Offline (Saved Locally)'}</span>
            </div>

            {cows.length === 0 && (
              <button
                type="button"
                onClick={loadSampleData}
                disabled={loadingData}
                className="hidden md:flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold px-3 py-2 rounded-lg transition-colors shadow-xs"
              >
                <RefreshCw className="w-4 h-4" />
                Load Sample Farm Data
              </button>
            )}

            <div className="text-right hidden md:block">
              <p className="text-xs font-medium text-slate-700">{user.email}</p>
              <button
                type="button"
                onClick={() => signOut(auth)}
                className="text-xs text-red-600 hover:underline flex items-center gap-1 justify-end mt-0.5"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="md:hidden p-2 text-slate-600 hover:text-red-600 rounded-lg"
              title="Sign Out"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Desktop Navigation */}
      <nav className="bg-white border-b border-slate-200 hidden md:block shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-2 py-3">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'dashboard' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <TrendingUp className="w-4 h-4" /> Overview & Summaries
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('cows')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'cows' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Database className="w-4 h-4" /> Cows ({activeCowsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('milk')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'milk' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Milk className="w-4 h-4" /> Milk Production
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('eggs')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'eggs' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <Egg className="w-4 h-4" /> Egg Collection
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('sales')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'sales' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <DollarSign className="w-4 h-4" /> Sales Log
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('reports')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'reports' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            <FileText className="w-4 h-4" /> Reports & Analytics
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors flex items-center gap-2 ${activeTab === 'admin' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <UserCheck className="w-4 h-4" /> System Admin
            </button>
          )}
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {!isOnline && (
          <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 mb-6 flex items-center gap-3 text-amber-900 shadow-sm">
            <WifiOff className="w-6 h-6 text-amber-600 shrink-0" />
            <div>
              <p className="font-bold text-sm">You are currently working offline.</p>
              <p className="text-xs text-amber-800">All logs are saved locally and will sync automatically when internet is restored.</p>
            </div>
          </div>
        )}

        {cows.length === 0 && milkRecords.length === 0 && (
          <div className="bg-slate-100 border border-slate-200 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-4">
              <div className="bg-slate-800 text-white p-3 rounded-xl">
                <RefreshCw className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Your farm is brand new</h3>
                <p className="text-slate-600 text-sm mt-0.5">
                  Load sample farm records to explore how daily logging works.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={loadSampleData}
              disabled={loadingData}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold py-3 px-6 rounded-xl transition-colors shadow-md whitespace-nowrap min-h-[48px] flex items-center gap-2"
            >
              <RefreshCw className="w-5 h-5" />
              Load Sample Farm Data
            </button>
          </div>
        )}

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-emerald-800 to-teal-900 rounded-3xl p-6 md:p-8 text-white shadow-lg">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold">Good day, {isAdmin ? 'System Admin' : isManager ? 'Farm Manager' : 'Farmer Mama'}</h2>
                  <p className="text-emerald-100 text-base mt-1">
                    Here is your automated farm performance summary for today and this week.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMilkId(null);
                      setMilkDate(new Date().toISOString().split('T')[0]);
                      setMorningLiters('');
                      setEveningLiters('');
                      setMilkNotes('');
                      setModalOpen('milk');
                    }}
                    className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-4 py-3 rounded-xl shadow transition-all flex items-center gap-2 text-sm min-h-[48px]"
                  >
                    <Milk className="w-5 h-5 text-emerald-700" /> + Add Milk
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingEggId(null);
                      setEggDate(new Date().toISOString().split('T')[0]);
                      setTotalEggs('');
                      setBrokenEggs('0');
                      setEggNotes('');
                      setModalOpen('egg');
                    }}
                    className="bg-white text-emerald-900 hover:bg-emerald-50 font-bold px-4 py-3 rounded-xl shadow transition-all flex items-center gap-2 text-sm min-h-[48px]"
                  >
                    <Egg className="w-5 h-5 text-amber-700" /> + Add Eggs
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalOpen('milkSale')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-3 rounded-xl shadow transition-all flex items-center gap-2 text-sm min-h-[48px]"
                  >
                    <DollarSign className="w-5 h-5" /> + Record Sale
                  </button>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-700" /> Today's Automated Summary ({todayStr})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div onClick={() => setActiveTab('milk')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-emerald-600 cursor-pointer transition-all hover:shadow-md group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-emerald-100 p-3 rounded-xl text-emerald-800">
                      <Milk className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full">Daily Total</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Milk Produced</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">{todayMilkTotal.toFixed(1)} <span className="text-lg font-normal text-slate-500">liters</span></h3>
                </div>

                <div onClick={() => setActiveTab('eggs')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-amber-600 cursor-pointer transition-all hover:shadow-md group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-amber-100 p-3 rounded-xl text-amber-800">
                      <Egg className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold bg-amber-50 text-amber-800 px-2.5 py-1 rounded-full">Daily Total</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Eggs Collected</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">{todayEggTotal} <span className="text-lg font-normal text-slate-500">eggs</span></h3>
                </div>

                <div onClick={() => setActiveTab('sales')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-600 cursor-pointer transition-all hover:shadow-md group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-blue-100 p-3 rounded-xl text-blue-800">
                      <DollarSign className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full">Daily Total</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Milk Sales Revenue</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">${todayMilkSalesAmount.toFixed(2)}</h3>
                </div>

                <div onClick={() => setActiveTab('sales')} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-purple-600 cursor-pointer transition-all hover:shadow-md group">
                  <div className="flex items-center justify-between mb-4">
                    <div className="bg-purple-100 p-3 rounded-xl text-purple-800">
                      <Layers className="w-7 h-7" />
                    </div>
                    <span className="text-xs font-semibold bg-purple-50 text-purple-800 px-2.5 py-1 rounded-full">Daily Total</span>
                  </div>
                  <p className="text-slate-500 text-sm font-medium">Egg Sales Revenue</p>
                  <h3 className="text-3xl font-bold text-slate-900 mt-1">${todayEggSalesAmount.toFixed(2)}</h3>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-teal-700" /> Current Week Summary (Last 7 Days)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-slate-500 text-sm font-medium">Weekly Milk Produced</p>
                  <h3 className="text-2xl font-bold text-emerald-800 mt-1">{weeklyMilkTotal.toFixed(1)} <span className="text-sm font-normal text-slate-500">liters</span></h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-slate-500 text-sm font-medium">Weekly Eggs Collected</p>
                  <h3 className="text-2xl font-bold text-amber-700 mt-1">{weeklyEggTotal} <span className="text-sm font-normal text-slate-500">eggs</span></h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-slate-500 text-sm font-medium">Weekly Milk Revenue</p>
                  <h3 className="text-2xl font-bold text-blue-800 mt-1">${weeklyMilkSalesAmount.toFixed(2)}</h3>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                  <p className="text-slate-500 text-sm font-medium">Weekly Egg Revenue</p>
                  <h3 className="text-2xl font-bold text-purple-800 mt-1">${weeklyEggSalesAmount.toFixed(2)}</h3>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Quick Daily Actions</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMilkId(null);
                    setMilkDate(new Date().toISOString().split('T')[0]);
                    setMorningLiters('');
                    setEveningLiters('');
                    setMilkNotes('');
                    setModalOpen('milk');
                  }}
                  className="p-5 rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-600 transition-all flex flex-col items-center text-center group min-h-[110px] justify-center"
                >
                  <div className="bg-emerald-700 text-white p-3 rounded-xl mb-2">
                    <Milk className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 text-base">Log Milk Production</span>
                  <span className="text-xs text-slate-500 mt-0.5">Record morning & evening liters</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingEggId(null);
                    setEggDate(new Date().toISOString().split('T')[0]);
                    setTotalEggs('');
                    setBrokenEggs('0');
                    setEggNotes('');
                    setModalOpen('egg');
                  }}
                  className="p-5 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50/50 hover:bg-amber-50 hover:border-amber-600 transition-all flex flex-col items-center text-center group min-h-[110px] justify-center"
                >
                  <div className="bg-amber-600 text-white p-3 rounded-xl mb-2">
                    <Egg className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 text-base">Log Egg Collection</span>
                  <span className="text-xs text-slate-500 mt-0.5">Record total eggs & damaged</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen('milkSale')}
                  className="p-5 rounded-xl border-2 border-dashed border-blue-300 bg-blue-50/50 hover:bg-blue-50 hover:border-blue-600 transition-all flex flex-col items-center text-center group min-h-[110px] justify-center"
                >
                  <div className="bg-blue-700 text-white p-3 rounded-xl mb-2">
                    <DollarSign className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 text-base">Record Milk Sale</span>
                  <span className="text-xs text-slate-500 mt-0.5">Track liters sold & buyers</span>
                </button>

                <button
                  type="button"
                  onClick={() => setModalOpen('eggSale')}
                  className="p-5 rounded-xl border-2 border-dashed border-purple-300 bg-purple-50/50 hover:bg-purple-50 hover:border-purple-600 transition-all flex flex-col items-center text-center group min-h-[110px] justify-center"
                >
                  <div className="bg-purple-700 text-white p-3 rounded-xl mb-2">
                    <Layers className="w-6 h-6" />
                  </div>
                  <span className="font-bold text-slate-900 text-base">Record Egg Sale</span>
                  <span className="text-xs text-slate-500 mt-0.5">Track trays, pieces & price</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Cows Tab */}
        {activeTab === 'cows' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Livestock (Cows) Management</h2>
                <p className="text-slate-500 text-sm mt-0.5">Manage dairy cows and status (Active, Dry, Sold).</p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen('cow')}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-base min-h-[48px]"
              >
                <Plus className="w-5 h-5" /> Add New Cow
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {cows.length === 0 ? (
                <div className="col-span-full bg-white rounded-2xl p-12 text-center border border-slate-200">
                  <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium text-lg">No cows added yet.</p>
                  <p className="text-slate-400 text-sm mt-1">Click "Add New Cow" or load sample data to get started.</p>
                </div>
              ) : (
                cows.map((cow: Cow) => {
                  const isAct = cow.status === 'Active';
                  const isDry = cow.status === 'Dry';
                  const statusBg = isAct ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : isDry ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-red-100 text-red-800 border-red-300';
                  const dotColor = isAct ? 'bg-emerald-600' : isDry ? 'bg-amber-600' : 'bg-red-600';

                  return (
                    <div key={cow.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm flex flex-col justify-between relative overflow-hidden">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="bg-slate-100 text-slate-700 w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg relative">
                              🐄
                              <span className={`absolute -top-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${dotColor}`} />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900 text-lg">{cow.name}</h3>
                              <p className="text-xs text-slate-500">Tag: {cow.tagNumber} · {cow.breed}</p>
                            </div>
                          </div>
                          <span className={`text-xs font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 ${statusBg}`}>
                            <span className={`w-2 h-2 rounded-full ${dotColor}`} />
                            {cow.status}
                          </span>
                        </div>
                        {cow.notes && (
                          <p className="text-slate-600 text-sm mt-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
                            {cow.notes}
                          </p>
                        )}
                      </div>

                      <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => {
                            const nextStatus = cow.status === 'Active' ? 'Dry' : cow.status === 'Dry' ? 'Sold' : 'Active';
                            updateDoc(doc(db, 'cows', cow.id), { status: nextStatus });
                            showToast(`Cow status updated to ${nextStatus}`);
                          }}
                          className="text-xs font-semibold text-emerald-700 hover:underline"
                        >
                          Change Status ({cow.status})
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteItem('cows', cow.id)}
                          className="text-red-600 hover:text-red-800 p-2 rounded-lg"
                          title="Delete Cow"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Milk Production Tab with Edit button */}
        {activeTab === 'milk' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Milk Production Logging</h2>
                <p className="text-slate-500 text-sm mt-0.5">Record and update daily morning and evening milk collection per cow.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMilkId(null);
                  setMilkDate(new Date().toISOString().split('T')[0]);
                  setMorningLiters('');
                  setEveningLiters('');
                  setMilkNotes('');
                  setModalOpen('milk');
                }}
                className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-base min-h-[48px]"
              >
                <Plus className="w-5 h-5" /> + Log Milk Today
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg">All Milk Production Records</h3>
              </div>
              {milkRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Milk className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No milk records logged yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <th className="p-4">Date</th>
                        <th className="p-4">Cow Name</th>
                        <th className="p-4">Morning (L)</th>
                        <th className="p-4">Evening (L)</th>
                        <th className="p-4">Total (L)</th>
                        <th className="p-4">Notes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {milkRecords.map((r: MilkProduction) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-900">{r.date}</td>
                          <td className="p-4 font-bold text-slate-900">{r.cowName}</td>
                          <td className="p-4 text-slate-600">{r.morningLiters} L</td>
                          <td className="p-4 text-slate-600">{r.eveningLiters} L</td>
                          <td className="p-4 font-bold text-emerald-800">{r.totalLiters} L</td>
                          <td className="p-4 text-slate-500 max-w-xs truncate">{r.notes || '-'}</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openEditMilk(r)}
                              className="text-blue-600 hover:text-blue-800 p-2"
                              title="Edit Record"
                            >
                              <Edit2 className="w-4 h-4 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem('milk_production', r.id)}
                              className="text-red-600 hover:text-red-800 p-2"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Egg Collection Tab with Edit button */}
        {activeTab === 'eggs' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Egg Collection Logging</h2>
                <p className="text-slate-500 text-sm mt-0.5">Record and update daily poultry egg collection and broken eggs.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingEggId(null);
                  setEggDate(new Date().toISOString().split('T')[0]);
                  setTotalEggs('');
                  setBrokenEggs('0');
                  setEggNotes('');
                  setModalOpen('egg');
                }}
                className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-5 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-base min-h-[48px]"
              >
                <Plus className="w-5 h-5" /> + Log Eggs Today
              </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200">
                <h3 className="font-bold text-slate-900 text-lg">All Egg Collection Records</h3>
              </div>
              {eggRecords.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Egg className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-600 font-medium">No egg collection records yet.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <th className="p-4">Date</th>
                        <th className="p-4">Total Collected</th>
                        <th className="p-4">Broken</th>
                        <th className="p-4">Net Good Eggs</th>
                        <th className="p-4">Notes</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {eggRecords.map((r: EggCollection) => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="p-4 font-medium text-slate-900">{r.date}</td>
                          <td className="p-4 text-slate-700">{r.totalEggs}</td>
                          <td className="p-4 text-red-600">{r.brokenEggs}</td>
                          <td className="p-4 font-bold text-amber-700">{r.netEggs} Eggs</td>
                          <td className="p-4 text-slate-500 max-w-xs truncate">{r.notes || '-'}</td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              type="button"
                              onClick={() => openEditEgg(r)}
                              className="text-blue-600 hover:text-blue-800 p-2"
                              title="Edit Record"
                            >
                              <Edit2 className="w-4 h-4 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem('egg_collection', r.id)}
                              className="text-red-600 hover:text-red-800 p-2"
                              title="Delete Record"
                            >
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sales Tab */}
        {activeTab === 'sales' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Farm Sales & Revenue</h2>
                <p className="text-slate-500 text-sm mt-0.5">Track all milk and egg sales to customers and shops.</p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setModalOpen('milkSale')}
                  className="bg-blue-700 hover:bg-blue-800 text-white font-bold px-4 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-sm min-h-[48px]"
                >
                  <Plus className="w-4 h-4" /> Milk Sale
                </button>
                <button
                  type="button"
                  onClick={() => setModalOpen('eggSale')}
                  className="bg-purple-700 hover:bg-purple-800 text-white font-bold px-4 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-sm min-h-[48px]"
                >
                  <Plus className="w-4 h-4" /> Egg Sale
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Milk className="w-5 h-5 text-blue-700" /> Milk Sales Log
                  </h3>
                </div>
                {milkSales.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No milk sales recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                          <th className="p-3">Date</th>
                          <th className="p-3">Liters</th>
                          <th className="p-3">Buyer</th>
                          <th className="p-3">Total ($)</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {milkSales.map((s: MilkSale) => (
                          <tr key={s.id}>
                            <td className="p-3 font-medium">{s.date}</td>
                            <td className="p-3">{s.litersSold} L</td>
                            <td className="p-3 text-slate-600">{s.buyer}</td>
                            <td className="p-3 font-bold text-blue-800">${s.totalAmount.toFixed(2)}</td>
                            <td className="p-3 text-right">
                              <button type="button" onClick={() => handleDeleteItem('milk_sales', s.id)} className="text-red-600 p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-lg flex items-center gap-2">
                    <Egg className="w-5 h-5 text-purple-700" /> Egg Sales Log
                  </h3>
                </div>
                {eggSales.length === 0 ? (
                  <div className="p-8 text-center text-slate-400">No egg sales recorded.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="bg-slate-50 text-slate-600 text-xs font-semibold border-b border-slate-200">
                          <th className="p-3">Date</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3">Buyer</th>
                          <th className="p-3">Total ($)</th>
                          <th className="p-3 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {eggSales.map((s: EggSale) => (
                          <tr key={s.id}>
                            <td className="p-3 font-medium">{s.date}</td>
                            <td className="p-3">{s.quantity} {s.unit}</td>
                            <td className="p-3 text-slate-600">{s.buyer}</td>
                            <td className="p-3 font-bold text-purple-800">${s.totalAmount.toFixed(2)}</td>
                            <td className="p-3 text-right">
                              <button type="button" onClick={() => handleDeleteItem('egg_sales', s.id)} className="text-red-600 p-1">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Reports Tab */}
        {activeTab === 'reports' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Farm Reports & Analytics Hub</h2>
                <p className="text-slate-500 text-sm mt-0.5">View automated daily summaries, weekly reviews, and monthly yearly trends.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const csvData = [
                    ['Type', 'Date', 'Detail 1', 'Detail 2', 'Total/Amount'],
                    ...milkRecords.map((r: MilkProduction) => ['Milk Production', r.date, r.cowName, `${r.totalLiters} Liters`, '-']),
                    ...eggRecords.map((r: EggCollection) => ['Egg Collection', r.date, `Total: ${r.totalEggs}`, `Net: ${r.netEggs}`, '-']),
                    ...milkSales.map((r: MilkSale) => ['Milk Sale', r.date, `${r.litersSold} L`, r.buyer, `$${r.totalAmount}`]),
                    ...eggSales.map((r: EggSale) => ['Egg Sale', r.date, `${r.quantity} ${r.unit}`, r.buyer, `$${r.totalAmount}`])
                  ];
                  const csvContent = 'data:text/csv;charset=utf-8,' + csvData.map((e: string[]) => e.join(',')).join('\n');
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement('a');
                  link.setAttribute('href', encodedUri);
                  link.setAttribute('download', `sunny_acres_farm_report_${todayStr}.csv`);
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                  showToast('Report downloaded as CSV.');
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-3 rounded-xl shadow transition-colors flex items-center gap-2 text-base min-h-[48px]"
              >
                <Download className="w-5 h-5" /> Export All to CSV
              </button>
            </div>

            <div className="flex bg-slate-200/70 p-1.5 rounded-2xl max-w-md gap-1">
              <button
                type="button"
                onClick={() => setReportSubTab('daily')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${reportSubTab === 'daily' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Daily Summary
              </button>
              <button
                type="button"
                onClick={() => setReportSubTab('weekly')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${reportSubTab === 'weekly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Weekly Review
              </button>
              <button
                type="button"
                onClick={() => setReportSubTab('monthly')}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold transition-all ${reportSubTab === 'monthly' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Monthly Trends
              </button>
            </div>

            {reportSubTab === 'daily' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-700" /> Today's Summary Report ({todayStr})
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-800">Total Milk Produced</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{todayMilkTotal.toFixed(1)} L</p>
                  </div>
                  <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                    <p className="text-xs font-semibold text-amber-800">Total Eggs Collected</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{todayEggTotal} eggs</p>
                  </div>
                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800">Milk Sales Revenue</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">${todayMilkSalesAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200">
                    <p className="text-xs font-semibold text-purple-800">Egg Sales Revenue</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">${todayEggSalesAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {reportSubTab === 'weekly' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-teal-700" /> Current Week Summary Report (Last 7 Days)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-emerald-50/60 p-4 rounded-xl border border-emerald-200">
                    <p className="text-xs font-semibold text-emerald-800">Weekly Milk Produced</p>
                    <p className="text-2xl font-bold text-emerald-900 mt-1">{weeklyMilkTotal.toFixed(1)} L</p>
                  </div>
                  <div className="bg-amber-50/60 p-4 rounded-xl border border-amber-200">
                    <p className="text-xs font-semibold text-amber-800">Weekly Eggs Collected</p>
                    <p className="text-2xl font-bold text-amber-900 mt-1">{weeklyEggTotal} eggs</p>
                  </div>
                  <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-200">
                    <p className="text-xs font-semibold text-blue-800">Weekly Milk Revenue</p>
                    <p className="text-2xl font-bold text-blue-900 mt-1">${weeklyMilkSalesAmount.toFixed(2)}</p>
                  </div>
                  <div className="bg-purple-50/60 p-4 rounded-xl border border-purple-200">
                    <p className="text-xs font-semibold text-purple-800">Weekly Egg Revenue</p>
                    <p className="text-2xl font-bold text-purple-900 mt-1">${weeklyEggSalesAmount.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            )}

            {reportSubTab === 'monthly' && (
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                      <BarChart3 className="w-5 h-5 text-indigo-700" /> Monthly Production & Sales Trends ({selectedYear})
                    </h3>
                    <p className="text-slate-500 text-sm mt-0.5">Aggregated monthly breakdown over the course of the entire year.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-semibold text-slate-700">Select Year:</label>
                    <select
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                      className="px-4 py-2 border border-slate-300 rounded-xl bg-white font-bold text-slate-900"
                    >
                      <option value={2026}>2026</option>
                      <option value={2025}>2025</option>
                      <option value={2024}>2024</option>
                    </select>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-600 text-xs uppercase tracking-wider font-semibold border-b border-slate-200">
                        <th className="p-4">Month</th>
                        <th className="p-4">Milk Produced (L)</th>
                        <th className="p-4">Eggs Collected</th>
                        <th className="p-4">Milk Revenue ($)</th>
                        <th className="p-4">Egg Revenue ($)</th>
                        <th className="p-4 text-right">Total Revenue ($)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {monthlyAggregates.map((row) => (
                        <tr key={row.monthName} className="hover:bg-slate-50/50">
                          <td className="p-4 font-bold text-slate-900">{row.monthName}</td>
                          <td className="p-4 text-emerald-800 font-semibold">{row.milkLiters > 0 ? `${row.milkLiters.toFixed(1)} L` : '-'}</td>
                          <td className="p-4 text-amber-700 font-semibold">{row.eggsCollected > 0 ? `${row.eggsCollected} eggs` : '-'}</td>
                          <td className="p-4 text-blue-800 font-medium">{row.milkRevenue > 0 ? `$${row.milkRevenue.toFixed(2)}` : '-'}</td>
                          <td className="p-4 text-purple-800 font-medium">{row.eggRevenue > 0 ? `$${row.eggRevenue.toFixed(2)}` : '-'}</td>
                          <td className="p-4 text-right font-bold text-slate-900">{row.totalRevenue > 0 ? `$${row.totalRevenue.toFixed(2)}` : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-slate-100 font-bold text-slate-900 border-t-2 border-slate-200">
                        <td className="p-4">Annual Total ({selectedYear})</td>
                        <td className="p-4 text-emerald-900">
                          {monthlyAggregates.reduce((acc, r) => acc + r.milkLiters, 0).toFixed(1)} L
                        </td>
                        <td className="p-4 text-amber-900">
                          {monthlyAggregates.reduce((acc, r) => acc + r.eggsCollected, 0)} eggs
                        </td>
                        <td className="p-4 text-blue-900">
                          ${monthlyAggregates.reduce((acc, r) => acc + r.milkRevenue, 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-purple-900">
                          ${monthlyAggregates.reduce((acc, r) => acc + r.eggRevenue, 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right text-indigo-950">
                          ${monthlyAggregates.reduce((acc, r) => acc + r.totalRevenue, 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Admin Tab with Full Account Creation synced to Firebase */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <UserCheck className="w-6 h-6 text-slate-900" /> System Administration & Account Hub
              </h2>
              <p className="text-slate-500 text-sm mt-1">
                System Admin can create new accounts (Farmer Mama, Farm Manager, Admin) which sync immediately to Firebase Auth and Firestore.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Create Account Form */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-emerald-700" /> Create New Farm Account
                </h3>
                <form onSubmit={handleCreateAccountByAdmin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Username / Email</label>
                    <input
                      type="text"
                      required
                      value={newAccountEmail}
                      onChange={(e) => setNewAccountEmail(e.target.value)}
                      placeholder="e.g. mama_mary or worker2@sunnyacres.farm"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="password"
                      required
                      value={newAccountPassword}
                      onChange={(e) => setNewAccountPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Assign Role</label>
                    <select
                      value={newAccountRole}
                      onChange={(e: any) => setNewAccountRole(e.target.value)}
                      className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white font-medium"
                    >
                      <option value="Farmer">Farmer (Daily Logging)</option>
                      <option value="Manager">Farm Manager</option>
                      <option value="Admin">System Admin</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={creatingAccount}
                    className="w-full bg-emerald-700 hover:bg-emerald-800 text-white font-bold py-3 px-4 rounded-xl transition-colors shadow min-h-[48px] disabled:opacity-50"
                  >
                    {creatingAccount ? 'Creating & Syncing to Firebase...' : 'Create & Sync Account'}
                  </button>
                </form>
              </div>

              {/* Existing Farm Accounts List */}
              <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
                <h3 className="text-lg font-bold text-slate-900">Active Farm Accounts in Firebase ({farmUsers.length})</h3>
                {farmUsers.length === 0 ? (
                  <p className="text-slate-400 text-sm py-4">No additional accounts created yet.</p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {farmUsers.map((usr: FarmUserRecord) => (
                      <div key={usr.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{usr.email}</p>
                          <p className="text-xs text-slate-500">Created: {usr.createdAt?.substring(0, 10)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${usr.role === 'Admin' ? 'bg-slate-900 text-white' : usr.role === 'Manager' ? 'bg-teal-700 text-white' : 'bg-emerald-700 text-white'}`}>
                          {usr.role}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around items-center h-16 px-2 z-40 shadow-lg">
        <button
          type="button"
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'dashboard' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <TrendingUp className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Overview</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('cows')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'cows' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <Database className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Cows</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('milk')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'milk' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <Milk className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Milk</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('eggs')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'eggs' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <Egg className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Eggs</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sales')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'sales' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <DollarSign className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Sales</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('reports')}
          className={`flex flex-col items-center justify-center w-full h-full ${activeTab === 'reports' ? 'text-emerald-800 font-bold' : 'text-slate-500 font-medium'}`}
        >
          <FileText className="w-5 h-5 mb-1" />
          <span className="text-[10px]">Reports</span>
        </button>
      </div>

      {/* Modals */}
      {modalOpen === 'cow' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Database className="w-6 h-6 text-emerald-700" /> Add New Cow
            </h3>
            <form onSubmit={handleAddCow} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Cow Name / ID</label>
                <input
                  type="text"
                  required
                  value={cowName}
                  onChange={(e) => setCowName(e.target.value)}
                  placeholder="e.g. Daisy or C-04"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base focus:ring-2 focus:ring-emerald-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tag Number</label>
                  <input
                    type="text"
                    value={cowTag}
                    onChange={(e) => setCowTag(e.target.value)}
                    placeholder="e.g. 104"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Breed</label>
                  <select
                    value={cowBreed}
                    onChange={(e) => setCowBreed(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white"
                  >
                    <option value="Holstein">Holstein</option>
                    <option value="Jersey">Jersey</option>
                    <option value="Guernsey">Guernsey</option>
                    <option value="Ayrshire">Ayrshire</option>
                    <option value="Local Breed">Local Breed</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                <select
                  value={cowStatus}
                  onChange={(e: any) => setCowStatus(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white"
                >
                  <option value="Active">Active (Milking)</option>
                  <option value="Dry">Dry</option>
                  <option value="Sold">Sold</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={cowNotes}
                  onChange={(e) => setCowNotes(e.target.value)}
                  placeholder="e.g. Gentle nature"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow min-h-[48px]"
                >
                  Save Cow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen === 'milk' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Milk className="w-6 h-6 text-emerald-700" /> {editingMilkId ? 'Edit Milk Production Record' : 'Log Milk Production'}
            </h3>
            <form onSubmit={handleSaveMilk} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Select Cow</label>
                {cows.length === 0 ? (
                  <p className="text-red-600 text-sm">Please add a cow first before logging milk.</p>
                ) : (
                  <select
                    value={milkCowId}
                    onChange={(e) => setMilkCowId(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white font-medium"
                  >
                    {cows.filter((c: Cow) => c.status === 'Active' || c.id === milkCowId).map((c: Cow) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.breed})</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={milkDate}
                  onChange={(e) => setMilkDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Morning Liters</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={morningLiters}
                    onChange={(e) => setMorningLiters(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Evening Liters</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={eveningLiters}
                    onChange={(e) => setEveningLiters(e.target.value)}
                    placeholder="0.0"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={milkNotes}
                  onChange={(e) => setMilkNotes(e.target.value)}
                  placeholder="e.g. Extra yield today"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingMilkId(null);
                    setModalOpen(null);
                  }}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={cows.length === 0}
                  className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl font-bold shadow min-h-[48px] disabled:opacity-50"
                >
                  {editingMilkId ? 'Update Record' : 'Save Milk Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen === 'egg' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Egg className="w-6 h-6 text-amber-700" /> {editingEggId ? 'Edit Egg Collection Record' : 'Log Egg Collection'}
            </h3>
            <form onSubmit={handleSaveEgg} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={eggDate}
                  onChange={(e) => setEggDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Total Eggs Collected</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={totalEggs}
                    onChange={(e) => setTotalEggs(e.target.value)}
                    placeholder="e.g. 180"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Broken / Damaged</label>
                  <input
                    type="number"
                    min="0"
                    value={brokenEggs}
                    onChange={(e) => setBrokenEggs(e.target.value)}
                    placeholder="0"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={eggNotes}
                  onChange={(e) => setEggNotes(e.target.value)}
                  placeholder="e.g. Collected from Coop A"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingEggId(null);
                    setModalOpen(null);
                  }}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow min-h-[48px]"
                >
                  {editingEggId ? 'Update Record' : 'Save Egg Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen === 'milkSale' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <DollarSign className="w-6 h-6 text-blue-700" /> Record Milk Sale
            </h3>
            <form onSubmit={handleAddMilkSale} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={milkSaleDate}
                  onChange={(e) => setMilkSaleDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Liters Sold</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    min="0"
                    value={litersSold}
                    onChange={(e) => setLitersSold(e.target.value)}
                    placeholder="e.g. 25"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Price per Liter ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    min="0"
                    value={pricePerLiter}
                    onChange={(e) => setPricePerLiter(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Buyer Name / Shop</label>
                <input
                  type="text"
                  value={milkBuyer}
                  onChange={(e) => setMilkBuyer(e.target.value)}
                  placeholder="e.g. Local Dairy Store"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={milkSaleNotes}
                  onChange={(e) => setMilkSaleNotes(e.target.value)}
                  placeholder="e.g. Paid in cash"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-700 hover:bg-blue-800 text-white rounded-xl font-bold shadow min-h-[48px]"
                >
                  Save Milk Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {modalOpen === 'eggSale' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Layers className="w-6 h-6 text-purple-700" /> Record Egg Sale
            </h3>
            <form onSubmit={handleAddEggSale} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={eggSaleDate}
                  onChange={(e) => setEggSaleDate(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={eggQuantity}
                    onChange={(e) => setEggQuantity(e.target.value)}
                    placeholder="e.g. 5"
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Unit</label>
                  <select
                    value={eggUnit}
                    onChange={(e: any) => setEggUnit(e.target.value)}
                    className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base bg-white"
                  >
                    <option value="trays">Trays</option>
                    <option value="pieces">Pieces</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Price per Unit ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={eggPrice}
                  onChange={(e) => setEggPrice(e.target.value)}
                  placeholder="e.g. 8.00"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Buyer Name / Shop</label>
                <input
                  type="text"
                  value={eggBuyer}
                  onChange={(e) => setEggBuyer(e.target.value)}
                  placeholder="e.g. Mrs. Henderson"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={eggSaleNotes}
                  onChange={(e) => setEggSaleNotes(e.target.value)}
                  placeholder="e.g. Weekly regular customer"
                  className="w-full px-4 py-3 border border-slate-300 rounded-xl text-base"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(null)}
                  className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-purple-700 hover:bg-purple-800 text-white rounded-xl font-bold shadow min-h-[48px]"
                >
                  Save Egg Sale
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
