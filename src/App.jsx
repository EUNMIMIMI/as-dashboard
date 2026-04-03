import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, X, FileText, Calendar, CheckCircle2, Clock, AlertCircle, 
  Download, Upload, FileCode, Plus, Edit, Trash2, Save, BarChart3, PieChart, Layers, Lock, LogOut, RotateCcw, FileSpreadsheet
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot } from 'firebase/firestore';

// --- 사용자 권한 및 비밀번호 설정 ---
const ACCESS_ROLES = {
  'q123': { name: '품질경영팀', tabs: 'ALL' },
  'pmd123': { name: 'pmd 담당자', tabs: ['PMD'] },
  'tmd123': { name: 'tmd 담당자', tabs: ['TMD'] },
  'fld123': { name: 'fld 담당자', tabs: ['FLD'] },
  'uhp123': { name: 'uhp 담당자', tabs: ['UHP', 'PT'] }
};
// ------------------------------------

// --- Firebase 초기화 ---
const isCanvasEnv = typeof __firebase_config !== 'undefined';
const firebaseConfig = isCanvasEnv
  ? JSON.parse(__firebase_config)
  : {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const getCollectionPath = () => {
  if (isCanvasEnv) {
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    return `artifacts/${appId}/public/data/as_records`;
  }
  return 'as_records';
};
// -----------------------

const initialMockData = [
  {
    id: 1, asNumber: 'WQ-2821-01-26-001', orderNumber: 'P100Z260001', originalOrderNumber: 'P1DSZ250066',
    receiptDate: '01월 07일', reqDeliveryDate: '01월 15일', businessUnit: 'PMD', agencyName: '이노바이저',
    companyName: '크라이오에이치앤아이', model: 'P255', qtyDefect: 1, serialNo: 'P250219884', releaseDate: '2025.02.24',
    defectContent: 'LEAK', causeAnalysis: '관안 용접부위 핀홀로 LEAK됨',
    processDetails: '신규제작 및 재발방지 대책서 송부',
    processDate: '01월 16일', processType: '견적 후 착수', cost: 0, claimType: '일반 A/S', repairMethod: '무상수리', ptBoardType: 'N'
  }
];

const FIXED_UNITS_ORDER = ['PMD', 'TMD', 'FLD', 'UHP', 'PT'];
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6'];

const parseDate = (dateStr) => {
  if (!dateStr) return 0;
  if (dateStr.includes('월') && dateStr.includes('일')) {
    const m = parseInt(dateStr.split('월')[0].trim());
    const d = parseInt(dateStr.split('월')[1].replace('일', '').trim());
    return new Date(2026, m - 1, d).getTime();
  }
  const parts = dateStr.split('/');
  if (parts.length === 2) {
    return new Date(2026, parseInt(parts[0]) - 1, parseInt(parts[1])).getTime();
  }
  return 0;
};

const calculateCompliance = (reqDate, compDate) => {
  if (!compDate) return '미완료';
  const reqTime = parseDate(reqDate);
  const compTime = parseDate(compDate);
  if (reqTime === 0 || compTime === 0) return '오류';
  if (compTime <= reqTime) return '준수';
  return '지연';
};

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate) return '-';
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  if (start === 0 || end === 0) return '-';
  const diffTime = end - start;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? `${diffDays}일` : '-';
};

const addBusinessDays = (dateStr, days) => {
  if (!dateStr) return '';
  let m, d;
  if (dateStr.includes('월') && dateStr.includes('일')) {
    m = parseInt(dateStr.split('월')[0].trim());
    d = parseInt(dateStr.split('월')[1].replace('일', '').trim());
  } else if (dateStr.includes('/')) {
    const parts = dateStr.split('/');
    m = parseInt(parts[0]);
    d = parseInt(parts[1]);
  } else {
    return '';
  }
  let date = new Date(2026, m - 1, d);
  if (isNaN(date.getTime())) return '';
  
  let addedDays = 0;
  while (addedDays < days) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) addedDays++;
  }
  if (dateStr.includes('월')) {
    return `${String(date.getMonth() + 1).padStart(2, '0')}월 ${String(date.getDate()).padStart(2, '0')}일`;
  }
  return `${date.getMonth() + 1}/${date.getDate()}`;
};

const generateNextAsNumber = (currentData) => {
  const currentYear = new Date().getFullYear().toString().slice(-2);
  const prefix = `WQ-2821-01-${currentYear}-`;
  let maxSeq = 0;
  currentData.forEach(item => {
    if (item.asNumber && item.asNumber.startsWith(prefix)) {
      const seqStr = item.asNumber.substring(prefix.length);
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) maxSeq = seqNum;
    }
  });
  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
};

const isIncomplete = (item) => {
  const coreFields = [
    'asNumber', 'businessUnit', 'agencyName', 'model', 
    'defectContent', 'causeAnalysis', 'processDetails', 
    'processType', 'repairMethod', 'receiptDate', 'processDate'
  ];
  return coreFields.some(field => {
    const val = item[field];
    return val === null || val === undefined || String(val).trim() === '';
  });
};

const formatForDateInput = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  try {
    if (dateStr.includes('.')) {
      const parts = dateStr.split('.').map(p => p.trim());
      if (parts.length >= 3) return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    }
    let m, d;
    if (dateStr.includes('월') && dateStr.includes('일')) {
      m = dateStr.split('월')[0].trim();
      d = dateStr.split('월')[1].replace('일', '').trim();
    } else if (dateStr.includes('/')) {
      const parts = dateStr.split('/');
      m = parts[0].trim();
      d = parts[1].trim();
    } else {
      return '';
    }
    return `2026-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  } catch (e) {
    return '';
  }
};

const MultiDonutChart = ({ data, size = 160, strokeWidth = 24 }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-sm">
        {total === 0 && (
          <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        )}
        {data.map((item, i) => {
          if (item.value === 0) return null;
          const dashLength = (item.value / total) * circumference;
          const strokeDasharray = `${dashLength} ${circumference}`;
          const offset = -currentOffset;
          currentOffset += dashLength;
          
          return (
            <circle 
              key={item.label} cx="50" cy="50" r={radius} fill="transparent" 
              stroke={item.color} strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray} strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center bg-white rounded-full p-2">
        <span className="text-[10px] text-gray-500 mb-0.5">총계</span>
        <span className="text-sm font-bold text-gray-900 leading-none">{total}건</span>
      </div>
    </div>
  );
};

const DonutChart = ({ normal, complaint, size = 120, strokeWidth = 12 }) => {
  const total = normal + complaint;
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  const normalDash = total === 0 ? 0 : (normal / total) * circumference;
  const complaintDash = total === 0 ? 0 : (complaint / total) * circumference;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-sm">
        <circle cx="50" cy="50" r={radius} fill="transparent" stroke="#f3f4f6" strokeWidth={strokeWidth} />
        {normal > 0 && (
          <circle 
            cx="50" cy="50" r={radius} fill="transparent" stroke="#3b82f6" strokeWidth={strokeWidth}
            strokeDasharray={`${normalDash} ${circumference}`} strokeDashoffset="0"
            strokeLinecap="round" className="transition-all duration-1000 ease-out"
          />
        )}
        {complaint > 0 && (
          <circle 
            cx="50" cy="50" r={radius} fill="transparent" stroke="#ef4444" strokeWidth={strokeWidth}
            strokeDasharray={`${complaintDash} ${circumference}`} strokeDashoffset={-normalDash}
            strokeLinecap="round" className="transition-all duration-1000 ease-out"
          />
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-[10px] text-gray-500 mb-0.5">총 접수</span>
        <span className="text-sm font-bold text-gray-900 leading-none">{total}건</span>
      </div>
    </div>
  );
};

const getModelGroup = (bu, modelName, ptBoardType) => {
  if (bu === 'PT') return ptBoardType === 'ZMDI' ? 'ZMDI' : 'N';
  if (!modelName) return bu === 'PMD' ? 'ACC' : '기타';
  const upperModel = modelName.toUpperCase().trim();
  
  if (bu === 'PMD') {
    const match = upperModel.match(/^P(\d+)/);
    if (match) {
      const num = parseInt(match[1], 10);
      const rounded = Math.floor(num / 100) * 100;
      return `P${rounded}`;
    }
    return 'ACC';
  }
  
  const match = upperModel.match(/^([A-Z]+-?)(\d+)/);
  if (match) {
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const rounded = Math.floor(num / 100) * 100;
    return `${prefix}${rounded}`;
  }
  
  return upperModel;
};

export default function App() {
  const [currentUserRole, setCurrentUserRole] = useState(() => {
    const saved = localStorage.getItem('as_dashboard_role');
    return saved ? JSON.parse(saved) : null;
  });
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const [data, setData] = useState([]); 
  const [activeTab, setActiveTab] = useState('전체'); 
  const [user, setUser] = useState(null);
  const [isSeeded, setIsSeeded] = useState(false);
  
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterPtBoard, setFilterPtBoard] = useState('all');
  const [filterExcludeReport, setFilterExcludeReport] = useState('all'); 
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1); 
  const itemsPerPage = 5; 
  
  const [selectedRow, setSelectedRow] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(null);

  const [itemToDelete, setItemToDelete] = useState(null);
  const [itemToPermanentDelete, setItemToPermanentDelete] = useState(null);
  const [alertMessage, setAlertMessage] = useState('');
  
  const fileInputRef = useRef(null);

  const customAlert = (message) => setAlertMessage(message);

  const handleLogin = (e) => {
    e.preventDefault();
    const role = ACCESS_ROLES[loginPassword];
    if (role) {
      setCurrentUserRole(role);
      localStorage.setItem('as_dashboard_role', JSON.stringify(role));
      setLoginError('');
      setActiveTab(role.tabs === 'ALL' ? '전체' : role.tabs[0]);
    } else {
      setLoginError('비밀번호가 올바르지 않습니다.');
    }
  };

  const handleLogout = () => {
    setCurrentUserRole(null);
    localStorage.removeItem('as_dashboard_role');
    setLoginPassword('');
    setIsCapsLockOn(false);
  };

  useEffect(() => {
    if (currentUserRole) {
      const isQM = currentUserRole.name === '품질경영팀';
      if (!isQM && (activeTab === '휴지통' || activeTab === '보고서')) {
        setActiveTab(currentUserRole.tabs[0]);
      } else if (currentUserRole.tabs !== 'ALL' && !currentUserRole.tabs.includes(activeTab)) {
        setActiveTab(currentUserRole.tabs[0]);
      }
    }
  }, [currentUserRole, activeTab]);

  useEffect(() => {
    const initAuth = async () => {
      if (isCanvasEnv && typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const colRef = collection(db, getCollectionPath());
    
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const records = [];
      const now = Date.now();
      const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d.deletedAt && (now - d.deletedAt > THREE_DAYS_MS)) {
          deleteDoc(doc(db, getCollectionPath(), docSnap.id)).catch(console.error);
        } else {
          records.push({ id: docSnap.id, ...d });
        }
      });
      
      if (snapshot.empty && !isSeeded) {
        setIsSeeded(true);
        initialMockData.forEach(async (record) => {
          await setDoc(doc(db, getCollectionPath(), String(record.id)), record);
        });
      } else {
        records.sort((a, b) => {
          const numA = a.asNumber || '';
          const numB = b.asNumber || '';
          return numB.localeCompare(numA); 
        });
        setData(records);
      }
    }, (error) => console.error("Firestore Error:", error));
    return () => unsubscribe();
  }, [user, isSeeded]);

  const activeRecords = useMemo(() => data.filter(d => !d.deletedAt), [data]);
  const deletedRecords = useMemo(() => data.filter(d => d.deletedAt), [data]);

  const processedData = useMemo(() => {
    return activeRecords.map(item => ({
      ...item,
      complianceStatus: calculateCompliance(item.reqDeliveryDate, item.processDate),
      duration: calculateDuration(item.receiptDate, item.processDate)
    }));
  }, [activeRecords]);

  const processedDeletedData = useMemo(() => {
    return deletedRecords.map(item => ({
      ...item,
      complianceStatus: calculateCompliance(item.reqDeliveryDate, item.processDate),
      duration: calculateDuration(item.receiptDate, item.processDate)
    }));
  }, [deletedRecords]);

  const allowedProcessedData = useMemo(() => {
    if (!currentUserRole || currentUserRole.tabs === 'ALL') return processedData;
    return processedData.filter(item => currentUserRole.tabs.includes(item.businessUnit));
  }, [processedData, currentUserRole]);

  const aggregatedStats = useMemo(() => {
    const stats = {};
    const AGGREGATION_ORDER = ['PMD', 'TMD', 'FLD', 'UHP', 'PT (ZMDI)', 'PT (N)'];
    AGGREGATION_ORDER.forEach(unit => stats[unit] = { unit, normal: 0, complaint: 0 });

    allowedProcessedData.forEach(item => {
      let unit = item.businessUnit || '미분류';
      if (unit === 'PT') {
        const boardType = item.ptBoardType === 'ZMDI' ? 'ZMDI' : 'N';
        unit = `PT (${boardType})`;
      }
      if (!stats[unit]) stats[unit] = { unit, normal: 0, complaint: 0 }; 
      if (item.claimType === '고객불만') stats[unit].complaint += 1;
      else stats[unit].normal += 1;
    });

    let totalNormal = 0; let totalComplaint = 0;
    const result = Object.values(stats).map(stat => {
      const totalClaims = stat.normal + stat.complaint;
      const normalRate = totalClaims > 0 ? ((stat.normal / totalClaims) * 100).toFixed(1) : 0;
      const complaintRate = totalClaims > 0 ? ((stat.complaint / totalClaims) * 100).toFixed(1) : 0;
      totalNormal += stat.normal; totalComplaint += stat.complaint;
      return { ...stat, totalClaims, normalRate, complaintRate };
    });

    result.sort((a, b) => {
      const indexA = AGGREGATION_ORDER.indexOf(a.unit);
      const indexB = AGGREGATION_ORDER.indexOf(b.unit);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.unit.localeCompare(b.unit);
    });

    const grandTotalClaims = totalNormal + totalComplaint;
    const grandNormalRate = grandTotalClaims > 0 ? ((totalNormal / grandTotalClaims) * 100).toFixed(1) : 0;
    const grandComplaintRate = grandTotalClaims > 0 ? ((totalComplaint / grandTotalClaims) * 100).toFixed(1) : 0;

    result.push({
      unit: '총계', isTotal: true, normal: totalNormal, complaint: totalComplaint,
      totalClaims: grandTotalClaims, normalRate: grandNormalRate, complaintRate: grandComplaintRate
    });
    return result;
  }, [allowedProcessedData]);

  const dashboardStats = useMemo(() => {
    const stats = {};
    FIXED_UNITS_ORDER.forEach(bu => stats[bu] = { unit: bu, total: 0, models: {} });

    allowedProcessedData.forEach(item => {
      const bu = FIXED_UNITS_ORDER.includes(item.businessUnit) ? item.businessUnit : '기타사업부';
      if (!stats[bu]) stats[bu] = { unit: bu, total: 0, models: {} };
      
      const groupLabel = getModelGroup(item.businessUnit, item.model, item.ptBoardType);
      stats[bu].total += 1;
      if (!stats[bu].models[groupLabel]) stats[bu].models[groupLabel] = { label: groupLabel, total: 0, normal: 0, complaint: 0 };
      
      stats[bu].models[groupLabel].total += 1;
      if (item.claimType === '고객불만') stats[bu].models[groupLabel].complaint += 1;
      else stats[bu].models[groupLabel].normal += 1;
    });

    return Object.values(stats).map(buStat => {
      const modelsArr = Object.values(buStat.models).sort((a, b) => b.total - a.total);
      modelsArr.forEach((m, idx) => {
        m.color = CHART_COLORS[idx % CHART_COLORS.length];
        m.rate = buStat.total > 0 ? ((m.total / buStat.total) * 100).toFixed(1) : 0;
      });
      return { ...buStat, modelsArr };
    }).sort((a, b) => {
      let ia = FIXED_UNITS_ORDER.indexOf(a.unit);
      let ib = FIXED_UNITS_ORDER.indexOf(b.unit);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib;
    });
  }, [allowedProcessedData]);

  const dynamicUnits = Array.from(new Set(processedData.map(d => d.businessUnit).filter(Boolean)));
  const otherUnits = dynamicUnits.filter(unit => !FIXED_UNITS_ORDER.includes(unit));
  const allBusinessUnits = ['전체', ...FIXED_UNITS_ORDER, ...otherUnits, '미입력', '집계'];
  
  const visibleBusinessUnits = useMemo(() => {
    if (!currentUserRole) return [];
    if (currentUserRole.tabs === 'ALL') return allBusinessUnits;
    return allBusinessUnits.filter(u => currentUserRole.tabs.includes(u));
  }, [currentUserRole, allBusinessUnits]);
  
  const tabFilteredData = useMemo(() => {
    if (activeTab === '휴지통') return processedDeletedData;

    let baseData = allowedProcessedData;
    if (activeTab === '전체' || activeTab === '집계' || activeTab === '보고서') return baseData;
    if (activeTab === '미입력') return baseData.filter(isIncomplete);

    return baseData.filter(item => {
      if (item.businessUnit !== activeTab) return false;
      if (activeTab === 'PT' && filterPtBoard !== 'all') {
        if (item.ptBoardType !== filterPtBoard) return false;
      }
      return true;
    });
  }, [allowedProcessedData, processedDeletedData, activeTab, filterPtBoard]);

  const agencies = ['all', ...Array.from(new Set(tabFilteredData.map(d => d.agencyName).filter(Boolean)))].sort();
  const models = ['all', ...Array.from(new Set(tabFilteredData.map(d => d.model).filter(Boolean)))].sort();

  const filteredData = useMemo(() => {
    return tabFilteredData.filter(item => {
      if (activeTab === '집계') return true; 
      if (filterCompliance !== 'all' && item.complianceStatus !== filterCompliance) return false;
      if (filterAgency !== 'all' && item.agencyName !== filterAgency) return false;
      if (filterModel !== 'all' && item.model !== filterModel) return false;
      
      if (activeTab === 'PT' && filterExcludeReport === 'exclude') {
        const content = item.defectContent || '';
        if (content.includes('성적서 발행') || content.includes('성적서발행')) return false;
      }

      if (searchQuery) {
        const query = searchQuery.toLowerCase().trim();
        const queryDigits = query.replace(/\D/g, ''); 

        const asNum = (item.asNumber || '').toLowerCase();
        const orderNum = (item.orderNumber || '').toLowerCase();
        const comp = (item.companyName || '').toLowerCase();
        const agency = (item.agencyName || '').toLowerCase();
        const mod = (item.model || '').toLowerCase();

        const orderNumDigits = orderNum.replace(/\D/g, '');
        const asNumLast = asNum.split('-').pop() || '';

        const isNormalMatch = 
          asNum.includes(query) || orderNum.includes(query) ||
          comp.includes(query) || agency.includes(query) || mod.includes(query);

        const isDigitMatch = queryDigits.length > 0 && (
          orderNumDigits.includes(queryDigits) || asNumLast.includes(queryDigits)
        );

        return isNormalMatch || isDigitMatch;
      }
      return true;
    });
  }, [tabFilteredData, activeTab, filterCompliance, filterAgency, filterModel, filterPtBoard, filterExcludeReport, searchQuery]);

  const renderStatusBadge = (status) => {
    switch (status) {
      case '준수': return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-800"><CheckCircle2 className="w-3 h-3 mr-1" />준수</span>;
      case '지연': return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />지연</span>;
      case '미완료': return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />처리중</span>;
      default: return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-800">알수없음</span>;
    }
  };

  const handleOpenForm = (record = null) => {
    if (record) {
      setFormData({ ptBoardType: 'N', claimType: '일반 A/S', repairMethod: '무상수리', ...record });
      setSelectedRow(null);
    } else {
      const newAsNumber = generateNextAsNumber(data);
      const defaultBU = (currentUserRole.tabs !== 'ALL' && currentUserRole.tabs.length > 0) ? currentUserRole.tabs[0] : 'PMD';
      
      setFormData({
        id: Date.now(),
        asNumber: newAsNumber, orderNumber: '', originalOrderNumber: '',
        receiptDate: '', reqDeliveryDate: '', processDate: '',
        businessUnit: defaultBU, agencyName: '', companyName: '',
        model: '', qtyDefect: 1, serialNo: '', releaseDate: '',
        defectContent: '', causeAnalysis: '', processDetails: '',
        processType: '견적 후 착수', cost: '', ptBoardType: 'N',
        claimType: '일반 A/S', repairMethod: '무상수리'
      });
    }
    setIsFormOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;
    
    if (type === 'date' && value) {
      const [y, m, d] = value.split('-');
      if (name === 'releaseDate') finalValue = `${y}.${m}.${d}`;
      else finalValue = `${m}월 ${d}일`;
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: finalValue };
      if (name === 'orderNumber') {
        const orderNum = finalValue.toUpperCase();
        if (orderNum.startsWith('P1')) newData.businessUnit = 'PMD';
        else if (orderNum.startsWith('UHP') || orderNum.startsWith('P3')) newData.businessUnit = 'UHP';
        else if (orderNum.startsWith('P4')) newData.businessUnit = 'PT';
        else if (orderNum.startsWith('T')) newData.businessUnit = 'TMD';
        else if (orderNum.startsWith('F')) newData.businessUnit = 'FLD';
      }
      if (name === 'receiptDate') {
        const autoReqDate = addBusinessDays(finalValue, 5);
        if (autoReqDate) newData.reqDeliveryDate = autoReqDate;
      }
      if (name === 'repairMethod' && finalValue !== '유상수리') newData.cost = '';

      if (name === 'defectContent' || name === 'qtyDefect') {
        const currentContent = name === 'defectContent' ? finalValue : prev.defectContent;
        const prevContent = prev.defectContent || '';
        const currentQty = name === 'qtyDefect' ? Math.max(1, parseInt(finalValue) || 1) : prev.qtyDefect;

        const isReport = currentContent && (currentContent.includes('성적서 발행') || currentContent.includes('성적서발행'));
        const wasReport = prevContent && (prevContent.includes('성적서 발행') || prevContent.includes('성적서발행'));

        if (isReport && (!wasReport || name === 'qtyDefect')) {
          newData.cost = currentQty * 1000;
          newData.repairMethod = '유상수리';
        }
      }

      return newData;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      customAlert('데이터베이스에 연결 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const docId = String(formData.id || Date.now());
    const docRef = doc(db, getCollectionPath(), docId);
    
    await setDoc(docRef, { ...formData, id: docId });
    setIsFormOpen(false);
  };

  const handleDeletePrepare = (id, e) => {
    if (e) e.stopPropagation();
    setItemToDelete(id);
  };

  const executeDelete = async () => {
    if (!user || !itemToDelete) return;
    await updateDoc(doc(db, getCollectionPath(), String(itemToDelete)), { deletedAt: Date.now() });
    setItemToDelete(null);
    setSelectedRow(null);
  };

  const handlePermanentDeletePrepare = (id, e) => {
    if (e) e.stopPropagation();
    setItemToPermanentDelete(id);
  };

  const executePermanentDelete = async () => {
    if (!user || !itemToPermanentDelete) return;
    await deleteDoc(doc(db, getCollectionPath(), String(itemToPermanentDelete)));
    setItemToPermanentDelete(null);
    setSelectedRow(null);
  };

  const handleRestore = async (id, e) => {
    if (e) e.stopPropagation();
    if (!user) return;
    await updateDoc(doc(db, getCollectionPath(), String(id)), { deletedAt: null });
    setSelectedRow(null);
    customAlert('데이터가 성공적으로 복구되었습니다.');
  };

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterCompliance, filterAgency, filterModel, filterPtBoard, filterExcludeReport, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const maxVisiblePages = 5;
  const currentBlock = Math.ceil(currentPage / maxVisiblePages);
  const startPage = (currentBlock - 1) * maxVisiblePages + 1;
  const endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const exportToExcel = async () => {
    try {
      const XLSX = await import('https://esm.sh/xlsx-js-style');
      const targetData = activeTab === '집계' || activeTab === '보고서' ? allowedProcessedData : filteredData;
      
      const wsData = [
        ["[2026년 A/S 처리관리대장]", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        ["접수번호", "수주번호", "사업부", "대리점명", "업체명", "MODEL", "불량\n수량", "하자내용", "SERIAL No.", "출고일자", "기존\n주문번호", "처리 방법", "", "", "접수일", "납기\n요구일", "처리\n완료일", "처리", "", "", "", "비용", "원인 분석", "", "제품 원인", "처리내역"],
        ["", "", "", "", "", "", "", "", "", "", "", "견적\n후\n착수", "선\n조치", "출장", "", "", "", "무상", "유상", "수리\n불가", "수리\n취소", "", "일반\nA/S", "고객\n불만", "", ""]
      ];

      targetData.forEach(row => {
        wsData.push([
          row.asNumber || '',
          row.orderNumber || '',
          row.businessUnit || '',
          row.agencyName || '',
          row.companyName || '',
          row.model || '',
          row.qtyDefect || 1,
          row.defectContent || '',
          row.serialNo || '',
          row.releaseDate || '',
          row.originalOrderNumber || '',
          row.processType === '견적 후 착수' ? '●' : '',
          row.processType === '선조치' ? '●' : '',
          row.processType === '출장' ? '●' : '',
          row.receiptDate || '',
          row.reqDeliveryDate || '',
          row.processDate || '',
          row.repairMethod === '무상수리' ? '●' : '',
          row.repairMethod === '유상수리' ? '●' : '',
          row.repairMethod === '수리불가' ? '●' : '',
          row.repairMethod === '수리취소' ? '●' : '',
          row.cost != null && row.cost !== '' ? Number(row.cost) : '',
          row.claimType === '일반 A/S' ? '●' : '',
          row.claimType === '고객불만' ? '●' : '',
          row.causeAnalysis || '',
          row.processDetails || ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(wsData);

      ws['!merges'] = [
        { s: {r:0, c:0}, e: {r:0, c:25} }, 
        { s: {r:1, c:0}, e: {r:2, c:0} }, 
        { s: {r:1, c:1}, e: {r:2, c:1} }, 
        { s: {r:1, c:2}, e: {r:2, c:2} }, 
        { s: {r:1, c:3}, e: {r:2, c:3} }, 
        { s: {r:1, c:4}, e: {r:2, c:4} }, 
        { s: {r:1, c:5}, e: {r:2, c:5} }, 
        { s: {r:1, c:6}, e: {r:2, c:6} }, 
        { s: {r:1, c:7}, e: {r:2, c:7} }, 
        { s: {r:1, c:8}, e: {r:2, c:8} }, 
        { s: {r:1, c:9}, e: {r:2, c:9} }, 
        { s: {r:1, c:10}, e: {r:2, c:10} }, 
        { s: {r:1, c:11}, e: {r:1, c:13} }, 
        { s: {r:1, c:14}, e: {r:2, c:14} }, 
        { s: {r:1, c:15}, e: {r:2, c:15} }, 
        { s: {r:1, c:16}, e: {r:2, c:16} }, 
        { s: {r:1, c:17}, e: {r:1, c:20} }, 
        { s: {r:1, c:21}, e: {r:2, c:21} }, 
        { s: {r:1, c:22}, e: {r:1, c:23} }, 
        { s: {r:1, c:24}, e: {r:2, c:24} }, 
        { s: {r:1, c:25}, e: {r:2, c:25} }  
      ];

      const borderStyle = { top: {style: 'thin', color: {rgb: "000000"}}, bottom: {style: 'thin', color: {rgb: "000000"}}, left: {style: 'thin', color: {rgb: "000000"}}, right: {style: 'thin', color: {rgb: "000000"}} };
      const grayStyle = { font: { name: '맑은 고딕', sz: 10, bold: true }, fill: { fgColor: { rgb: "BFBFBF" } }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const pinkStyle = { font: { name: '맑은 고딕', sz: 10, bold: true }, fill: { fgColor: { rgb: "E6B8B7" } }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const blueStyle = { font: { name: '맑은 고딕', sz: 10, bold: true }, fill: { fgColor: { rgb: "8DB4E2" } }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const dataStyleCenter = { font: { name: '맑은 고딕', sz: 10 }, border: borderStyle, alignment: { horizontal: "center", vertical: "center", wrapText: true } };
      const dataStyleLeft = { font: { name: '맑은 고딕', sz: 10 }, border: borderStyle, alignment: { horizontal: "left", vertical: "center", wrapText: true } };
      const dataStyleRight = { font: { name: '맑은 고딕', sz: 10 }, border: borderStyle, alignment: { horizontal: "right", vertical: "center", wrapText: true } };

      for (let R = 0; R < wsData.length; R++) {
        for (let C = 0; C <= 25; C++) {
          const cellRef = XLSX.utils.encode_cell({c: C, r: R});
          if (!ws[cellRef]) ws[cellRef] = { t: 's', v: '' }; 
          
          if (R === 0) {
            ws['A1'].s = { font: { name: '맑은 고딕', sz: 20, bold: true }, alignment: { horizontal: "center", vertical: "center" } };
          } else if (R === 1 || R === 2) {
            if (C <= 13) ws[cellRef].s = grayStyle;
            else if (C <= 21) ws[cellRef].s = pinkStyle;
            else ws[cellRef].s = blueStyle;
          } else {
            if ([7, 8, 24, 25].includes(C)) ws[cellRef].s = dataStyleLeft;
            else if (C === 21) ws[cellRef].s = dataStyleRight;
            else ws[cellRef].s = dataStyleCenter;
          }
        }
      }
      
      ws['!cols'] = [
        {wch: 16}, {wch: 14}, {wch: 8}, {wch: 14}, {wch: 14}, {wch: 12}, {wch: 6}, {wch: 30}, {wch: 18}, {wch: 11}, {wch: 14}, 
        {wch: 5}, {wch: 5}, {wch: 5}, {wch: 10}, {wch: 10}, {wch: 10}, {wch: 5}, {wch: 5}, {wch: 5}, {wch: 5}, {wch: 10}, 
        {wch: 5}, {wch: 5}, {wch: 25}, {wch: 30}
      ];

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "AS 접수대장");
      XLSX.writeFile(wb, `AS관리대장_${new Date().toISOString().slice(0,10)}.xlsx`);
      customAlert("색상과 서식이 유지된 엑셀 파일이 다운로드되었습니다!");

    } catch (error) {
      console.error(error);
      customAlert("엑셀 변환 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    }
  };

  const exportToCSV = async () => {
    const header1 = '접수번호,수주번호,대리점명,업체명,MODEL,불량수량,하자내용,SERIAL No.,출고일자,기존주문번호,처리 방법,,,접수일,납기요구일,처리완료일,처리,,,,비용,원인 분석,,제품 원인,처리내역,사업부(시스템용),PT보드구분(시스템용)\n';
    const header2 = ',,,,,,,,,,견적 후 착수,선 조치,출장,,,,무상,유상,수리 불가,수리 취소,,일반 A/S,고객 불만,,,,\n';
    
    let csvContent = header1 + header2;
    const targetData = activeTab === '집계' || activeTab === '보고서' ? allowedProcessedData : filteredData;

    targetData.forEach(row => {
      const costVal = row.cost != null && row.cost !== '' ? row.cost : '';
      const rowData = [
        row.asNumber || '', row.orderNumber || '', row.agencyName || '', row.companyName || '', row.model || '',
        row.qtyDefect || 1, row.defectContent || '', row.serialNo || '', row.releaseDate || '', row.originalOrderNumber || '',
        row.processType === '견적 후 착수' ? '●' : '', row.processType === '선조치' ? '●' : '', row.processType === '출장' ? '●' : '',
        row.receiptDate || '', row.reqDeliveryDate || '', row.processDate || '',
        row.repairMethod === '무상수리' ? '●' : '', row.repairMethod === '유상수리' ? '●' : '', row.repairMethod === '수리불가' ? '●' : '', row.repairMethod === '수리취소' ? '●' : '',
        costVal, row.claimType === '일반 A/S' ? '●' : '', row.claimType === '고객불만' ? '●' : '', row.causeAnalysis || '', row.processDetails || '',
        row.businessUnit || '', row.ptBoardType || 'N'
      ].map(cell => {
        let str = String(cell).replace(/"/g, '""');
        if (str.search(/("|,|\n)/g) >= 0) str = `"${str}"`;
        return str;
      });
      csvContent += rowData.join(',') + '\n';
    });

    const triggerDownload = (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    try {
      const iconvModule = await import('https://esm.sh/iconv-lite');
      const iconv = iconvModule.default || iconvModule;
      const encodedBuffer = iconv.encode(csvContent, 'euc-kr');
      const blob = new Blob([encodedBuffer], { type: 'text/csv;charset=euc-kr;' });
      triggerDownload(blob, `AS관리대장_${new Date().toISOString().slice(0,10)}_EUC-KR.csv`);
    } catch (error) {
      console.warn("EUC-KR 인코딩 모듈 로드 실패", error);
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `AS관리대장_${new Date().toISOString().slice(0,10)}.csv`);
    }
  };

  const parseCSVText = (text) => {
    const rows = [];
    let currentRow = [];
    let currentCell = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          currentCell += '"';
          i++; 
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        currentRow.push(currentCell);
        currentCell = '';
      } else if ((char === '\n' || (char === '\r' && nextChar === '\n')) && !inQuotes) {
        if (char === '\r') i++; 
        currentRow.push(currentCell);
        rows.push(currentRow);
        currentRow = [];
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    if (currentCell || currentRow.length > 0) {
      currentRow.push(currentCell);
      rows.push(currentRow);
    }
    return rows;
  };

  const importFromCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toUpperCase();
    let defaultPtBoard = 'N';
    if (fileName.includes('ZMDI')) defaultPtBoard = 'ZMDI';

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      
      const rows = parseCSVText(text);
      if (rows.length < 3) return customAlert('유효한 데이터가 부족합니다. (헤더 2줄 포함 필요)');
      
      const newRecords = [];
      const hasBUColumnAt2 = rows[0][2] && rows[0][2].replace(/\s/g, '').includes('사업부');
      const offset = hasBUColumnAt2 ? 1 : 0;

      for (let i = 2; i < rows.length; i++) {
        const cols = rows[i];
        if (!cols[0] || !cols[0].trim()) continue;
        
        if (cols.length >= 20) {
          let processType = '';
          if (cols[10 + offset] && cols[10 + offset].includes('●')) processType = '견적 후 착수';
          else if (cols[11 + offset] && cols[11 + offset].includes('●')) processType = '선조치';
          else if (cols[12 + offset] && cols[12 + offset].includes('●')) processType = '출장';

          let repairMethod = '';
          if (cols[16 + offset] && cols[16 + offset].includes('●')) repairMethod = '무상수리';
          else if (cols[17 + offset] && cols[17 + offset].includes('●')) repairMethod = '유상수리';
          else if (cols[18 + offset] && cols[18 + offset].includes('●')) repairMethod = '수리불가';
          else if (cols[19 + offset] && cols[19 + offset].includes('●')) repairMethod = '수리취소';

          let claimType = '일반 A/S'; 
          if (cols[22 + offset] && cols[22 + offset].includes('●')) claimType = '고객불만';
          else if (cols[21 + offset] && cols[21 + offset].includes('●')) claimType = '일반 A/S';

          let costRaw = (cols[20 + offset] || '').replace(/[₩\s,\-]/g, '');
          let cost = (costRaw && !isNaN(costRaw)) ? Number(costRaw) : null;
          
          let orderNumber = cols[1] ? cols[1].trim() : '';

          let bu = '';
          if (hasBUColumnAt2) bu = cols[2] ? cols[2].trim() : '';
          else bu = cols[25] ? cols[25].trim() : '';

          if (!bu && orderNumber) {
            const orderNum = orderNumber.toUpperCase();
            if (orderNum.startsWith('P1')) bu = 'PMD';
            else if (orderNum.startsWith('UHP') || orderNum.startsWith('P3')) bu = 'UHP';
            else if (orderNum.startsWith('P4')) bu = 'PT';
            else if (orderNum.startsWith('T')) bu = 'TMD';
            else if (orderNum.startsWith('F')) bu = 'FLD'; 
          }

          let ptBoard = '';
          if (!hasBUColumnAt2 && cols[26]) ptBoard = cols[26].trim();
          if (!ptBoard) ptBoard = (bu === 'PT' ? defaultPtBoard : 'N');

          let defectContent = cols[6 + offset] ? cols[6 + offset].trim() : '';
          let qtyDefect = parseInt(cols[5 + offset]) || 1;

          if (defectContent.includes('성적서 발행') || defectContent.includes('성적서발행')) {
            if (cost === null || cost === 0) cost = qtyDefect * 1000;
            if (!repairMethod) repairMethod = '유상수리';
          }

          let receiptDate = cols[13 + offset] ? cols[13 + offset].trim() : '';
          let reqDeliveryDate = cols[14 + offset] ? cols[14 + offset].trim() : '';
          let processDate = cols[15 + offset] ? cols[15 + offset].trim() : '';

          if (receiptDate && !reqDeliveryDate) {
            reqDeliveryDate = addBusinessDays(receiptDate, 5);
          }

          newRecords.push({
            id: Date.now() + i,
            asNumber: cols[0].trim(),
            orderNumber: orderNumber,
            agencyName: cols[2 + offset] ? cols[2 + offset].trim() : '',
            companyName: cols[3 + offset] ? cols[3 + offset].trim() : '',
            model: cols[4 + offset] ? cols[4 + offset].trim() : '',
            qtyDefect: qtyDefect,
            defectContent: defectContent,
            serialNo: cols[7 + offset] ? cols[7 + offset].trim() : '',
            releaseDate: cols[8 + offset] ? cols[8 + offset].trim() : '',
            originalOrderNumber: cols[9 + offset] ? cols[9 + offset].trim() : '',
            processType: processType,
            receiptDate: receiptDate,
            reqDeliveryDate: reqDeliveryDate,
            processDate: processDate,
            repairMethod: repairMethod,
            cost: cost,
            claimType: claimType,
            causeAnalysis: cols[23 + offset] ? cols[23 + offset].trim() : '',
            processDetails: cols[24 + offset] ? cols[24 + offset].trim() : '',
            businessUnit: bu,
            ptBoardType: ptBoard,
            deletedAt: null 
          });
        }
      }
      
      if(newRecords.length > 0) {
         if (user) {
           newRecords.forEach(async (record) => {
             await setDoc(doc(db, getCollectionPath(), String(record.id)), record);
           });
           customAlert(`${newRecords.length}건의 데이터를 성공적으로 업로드 중입니다.`);
         } else {
           customAlert('데이터베이스 연결이 안되어 업로드할 수 없습니다.');
         }
      } else {
         customAlert('업로드할 유효한 데이터 항목을 찾지 못했습니다.');
      }
    };
    
    reader.readAsText(file, 'euc-kr');
    e.target.value = null;
  };

  const exportToHTML = () => {
    const targetData = activeTab === '집계' || activeTab === '보고서' ? allowedProcessedData : filteredData;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>[2026년 A/S 처리관리대장]</title>
        <style>
          @page { size: landscape; margin: 10mm; }
          body, table, th, td { font-family: '맑은 고딕', 'Malgun Gothic', Tahoma, sans-serif; font-size: 10pt; color: #000; }
          body { padding: 20px; background: #fff; }
          h1 { text-align: center; color: #000; font-size: 20pt; margin-bottom: 15px; letter-spacing: 1px; font-weight: bold; }
          .summary { margin-bottom: 5px; text-align: right; color: #000; font-size: 10pt; }
          
          table { width: 100%; border-collapse: collapse; table-layout: auto; word-break: break-all; }
          th, td { border: 1pt solid #000; padding: 4px; text-align: center; vertical-align: middle; line-height: 1.3; }
          
          th.bg-gray { background-color: #BFBFBF !important; }
          th.bg-pink { background-color: #E6B8B7 !important; }
          th.bg-blue { background-color: #8DB4E2 !important; }
          
          th { font-weight: bold; white-space: pre-wrap; font-size: 10pt; }
          
          .text-left { text-align: left; padding-left: 5px; white-space: pre-wrap; }
          .text-right { text-align: right; padding-right: 5px; }
          .circle { font-size: 11pt; font-weight: bold; }
          .nowrap { white-space: nowrap; }
          
          .col-defect { min-width: 100px; }
          .col-cause { min-width: 100px; }
          .col-detail { min-width: 100px; }
          .col-serial { min-width: 70px; word-break: break-all; }
        </style>
      </head>
      <body>
        <h1>[2026년 A/S 처리관리대장]</h1>
        <div class="summary">출력일시: ${new Date().toLocaleString()} | 대상: 총 ${targetData.length}건</div>
        <table>
          <thead>
            <tr>
              <th rowspan="2" class="bg-gray nowrap">접수번호</th>
              <th rowspan="2" class="bg-gray nowrap">수주번호</th>
              <th rowspan="2" class="bg-gray nowrap">사업부</th>
              <th rowspan="2" class="bg-gray">대리점명</th>
              <th rowspan="2" class="bg-gray">업체명</th>
              <th rowspan="2" class="bg-gray">MODEL</th>
              <th rowspan="2" class="bg-gray">불량<br>수량</th>
              <th rowspan="2" class="col-defect bg-gray">하자내용</th>
              <th rowspan="2" class="col-serial bg-gray">SERIAL No.</th>
              <th rowspan="2" class="bg-gray nowrap">출고일자</th>
              <th rowspan="2" class="bg-gray">기존<br>주문번호</th>
              <th colspan="3" class="bg-gray">처리 방법</th>
              
              <th rowspan="2" class="bg-pink nowrap">접수일</th>
              <th rowspan="2" class="bg-pink nowrap">납기<br>요구일</th>
              <th rowspan="2" class="bg-pink nowrap">처리<br>완료일</th>
              <th colspan="4" class="bg-pink">처리</th>
              <th rowspan="2" class="bg-pink">비용</th>
              
              <th colspan="2" class="bg-blue">원인 분석</th>
              <th rowspan="2" class="col-cause bg-blue">제품 원인</th>
              <th rowspan="2" class="col-detail bg-blue">처리내역</th>
            </tr>
            <tr>
              <th class="bg-gray nowrap">견적 후<br>착수</th>
              <th class="bg-gray nowrap">선 조치</th>
              <th class="bg-gray nowrap">출장</th>
              
              <th class="bg-pink nowrap">무상</th>
              <th class="bg-pink nowrap">유상</th>
              <th class="bg-pink nowrap">수리<br>불가</th>
              <th class="bg-pink nowrap">수리<br>취소</th>
              
              <th class="bg-blue nowrap">일반<br>A/S</th>
              <th class="bg-blue nowrap">고객<br>불만</th>
            </tr>
          </thead>
          <tbody>
            ${targetData.map(row => `
              <tr>
                <td class="nowrap">${row.asNumber || ''}</td>
                <td class="nowrap">${row.orderNumber || ''}</td>
                <td class="nowrap">${row.businessUnit || ''}</td>
                <td>${row.agencyName || ''}</td>
                <td>${row.companyName || ''}</td>
                <td>${row.model || ''}</td>
                <td>${row.qtyDefect || 1}</td>
                <td class="text-left">${(row.defectContent || '').replace(/\n/g, '<br/>')}</td>
                <td class="text-left" style="font-size: 9pt;">${(row.serialNo || '').replace(/\n/g, '<br/>')}</td>
                <td class="nowrap">${row.releaseDate || ''}</td>
                <td class="nowrap">${row.originalOrderNumber || ''}</td>
                <td class="circle">${row.processType === '견적 후 착수' ? '●' : ''}</td>
                <td class="circle">${row.processType === '선조치' ? '●' : ''}</td>
                <td class="circle">${row.processType === '출장' ? '●' : ''}</td>
                <td class="nowrap">${row.receiptDate || ''}</td>
                <td class="nowrap">${row.reqDeliveryDate || ''}</td>
                <td class="nowrap">${row.processDate || ''}</td>
                <td class="circle">${row.repairMethod === '무상수리' ? '●' : ''}</td>
                <td class="circle">${row.repairMethod === '유상수리' ? '●' : ''}</td>
                <td class="circle">${row.repairMethod === '수리불가' ? '●' : ''}</td>
                <td class="circle">${row.repairMethod === '수리취소' ? '●' : ''}</td>
                <td class="text-right nowrap">${row.cost ? Number(row.cost).toLocaleString() : ''}</td>
                <td class="circle">${row.claimType === '일반 A/S' ? '●' : ''}</td>
                <td class="circle">${row.claimType === '고객불만' ? '●' : ''}</td>
                <td class="text-left">${(row.causeAnalysis || '').replace(/\n/g, '<br/>')}</td>
                <td class="text-left">${(row.processDetails || '').replace(/\n/g, '<br/>')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AS관리대장_보고서_${new Date().toISOString().slice(0,10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToASReportHTML = (lang = 'ko') => {
    const targetData = activeTab === '집계' || activeTab === '보고서' ? allowedProcessedData : filteredData;

    const translateToEn = (text) => {
      if (!text) return '-';
      const dict = {
        '일반 A/S': 'General Service',
        '고객불만': 'Customer Claim',
        '무상수리': 'FOC Repair (Warranty)',
        '유상수리': 'Paid Repair',
        '수리불가': 'Beyond Economical Repair',
        '수리취소': 'Repair Canceled',
        '견적 후 착수': 'Proceed after Quotation',
        '선조치': 'Advance Replacement/Repair',
        '출장': 'On-site Service',
        '성적서 발행 요청': 'Requested issuance of inspection certificate',
        '성적서 발행': 'Issued inspection certificate',
        '관안 용접부위 핀홀로 LEAK됨': 'Leakage detected due to pinhole at internal weld joint',
        '신규제작 및 재발방지 대책서 송부': 'Remanufactured product & submitted preventive action report',
        '압력지시 안됨': 'Failure in pressure indication',
        '에러표시 및 헌팅': 'Error displayed & signal hunting observed',
        '출력 불량 확인요청': 'Requested verification of output defect',
        '최소값 고정': 'Output fixed at minimum value',
        '센서보드 패턴 이상': 'Defect in sensor board circuit pattern',
        '대체품 출하': 'Replacement unit shipped',
        '정상제품': 'No Defect Found (NDF)',
        'LEAK': 'Leakage detected'
      };

      let result = text;
      if (dict[result.trim()]) return dict[result.trim()].replace(/\n/g, '<br/>');

      Object.keys(dict).forEach(key => {
        const regex = new RegExp(key, 'g');
        result = result.replace(regex, dict[key]);
      });

      return result.replace(/\n/g, '<br/>');
    };

    const headers = lang === 'en' ? {
      docTitle: 'A/S Report (Service Summary)',
      dateLabel: 'Report Date',
      targetLabel: 'Total',
      countUnit: 'records',
      colAsNum: 'Receipt No.',
      colAgency: 'Agency / Customer',
      colModel: 'Model (Qty)',
      colDefect: 'Defect Description',
      colCause: 'Root Cause Analysis',
      colResult: 'Service Result',
      colDetails: 'Action Taken & Countermeasure',
      qtyUnit: 'ea'
    } : {
      docTitle: 'AS 보고서 (처리내역 요약)',
      dateLabel: '보고일자',
      targetLabel: '대상: 총',
      countUnit: '건',
      colAsNum: '접수번호',
      colAgency: '대리점 / 업체명',
      colModel: '모델 (수량)',
      colDefect: '하자 내용',
      colCause: '원인 분석',
      colResult: '처리 결과',
      colDetails: '처리 내역 및 대책',
      qtyUnit: '개'
    };

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="${lang}">
      <head>
        <meta charset="UTF-8">
        <title>${headers.docTitle}</title>
        <style>
          body, table, th, td { font-family: '맑은 고딕', 'Malgun Gothic', Arial, sans-serif; font-size: 10pt; color: #000; }
          body { padding: 20px; background: #fff; }
          h1 { text-align: center; color: #1e3a8a; font-size: 20pt; font-weight: bold; }
          .summary { margin-bottom: 20px; text-align: right; color: #666; font-size: 10pt; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; line-height: 1.5; }
          th, td { border: 1pt solid #cbd5e1; padding: 10px; text-align: left; vertical-align: top; }
          th { background-color: #f1f5f9; font-weight: bold; color: #334155; text-align: center; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .claim-badge { display:inline-block; padding:3px 6px; border-radius:4px; background:#e2e8f0; font-size:9pt; margin-bottom:6px; color:#475569; font-weight:bold; }
          .highlight-cell { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>${headers.docTitle}</h1>
        <div class="summary">${headers.dateLabel}: ${new Date().toLocaleString()} | ${headers.targetLabel} ${targetData.length}${headers.countUnit}</div>
        <table>
          <thead>
            <tr>
              <th width="10%">${headers.colAsNum}</th>
              <th width="12%">${headers.colAgency}</th>
              <th width="10%">${headers.colModel}</th>
              <th width="18%">${headers.colDefect}</th>
              <th width="18%">${headers.colCause}</th>
              <th width="10%">${headers.colResult}</th>
              <th width="22%">${headers.colDetails}</th>
            </tr>
          </thead>
          <tbody>
            ${targetData.map(row => {
              const claimTypeStr = lang === 'en' ? translateToEn(row.claimType || '일반 A/S') : (row.claimType || '일반 A/S');
              const defectStr = lang === 'en' ? translateToEn(row.defectContent) : (row.defectContent || '-').replace(/\n/g, '<br/>');
              const causeStr = lang === 'en' ? translateToEn(row.causeAnalysis) : (row.causeAnalysis || '-').replace(/\n/g, '<br/>');
              const methodStr = lang === 'en' ? translateToEn(row.repairMethod) : (row.repairMethod || '-');
              const detailStr = lang === 'en' ? translateToEn(row.processDetails) : (row.processDetails || '-').replace(/\n/g, '<br/>');
              
              return `
              <tr>
                <td class="text-center font-bold"><strong>${row.asNumber}</strong></td>
                <td>${row.agencyName}<br/><span style="color:#64748b; font-size:9pt;">${row.companyName}</span></td>
                <td class="text-center">${row.model}<br/><strong>(${row.qtyDefect}${headers.qtyUnit})</strong></td>
                <td><span class="claim-badge">${claimTypeStr}</span><br/>${defectStr}</td>
                <td>${causeStr}</td>
                <td class="text-center highlight-cell">
                  <strong>${methodStr}</strong><br/>
                  <span style="font-size:9pt; color:#64748b;">${row.repairMethod === '유상수리' ? (row.cost != null && row.cost !== '' ? (lang === 'en' ? 'KRW ' : '₩ ') + Number(row.cost).toLocaleString() : (lang === 'en' ? 'KRW 0' : '₩ 0')) : ''}</span>
                </td>
                <td class="highlight-cell">${detailStr}</td>
              </tr>
            `}).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `AS_Report_${lang.toUpperCase()}_${new Date().toISOString().slice(0,10)}.html`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCapsLockCheck = (e) => {
    if (e.getModifierState && e.getModifierState('CapsLock')) {
      setIsCapsLockOn(true);
    } else {
      setIsCapsLockOn(false);
    }
  };

  if (!currentUserRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center border border-gray-100">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="w-8 h-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">A/S 관리대장 로그인</h1>
          <p className="text-gray-500 mb-8">부여받은 시스템 접근 비밀번호를 입력해주세요.</p>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="relative">
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => {
                  setLoginPassword(e.target.value);
                  if (/[A-Z]/.test(e.target.value)) setIsCapsLockOn(true);
                }}
                onKeyDown={handleCapsLockCheck}
                onKeyUp={handleCapsLockCheck}
                placeholder="비밀번호 입력"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-center text-lg tracking-widest"
                required
              />
              {isCapsLockOn && (
                <p className="text-orange-500 text-sm font-bold mt-2 animate-pulse">
                  ⚠️ 캡스락(Caps Lock)을 풀어주세요.
                </p>
              )}
            </div>
            {loginError && <p className="text-red-500 text-sm font-medium">{loginError}</p>}
            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm mt-4"
            >
              시스템 접속
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" />
              A/S 처리 관리대장
            </h1>
            <p className="text-sm text-gray-500 mt-1 flex items-center">
              접속 권한: <span className="font-bold text-blue-600 ml-1">{currentUserRole.name}</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => handleOpenForm()} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm ml-2">
              <Plus className="w-4 h-4 mr-1.5" /> 새 데이터 추가
            </button>
            <button onClick={handleLogout} className="flex items-center px-3 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors ml-2">
              <LogOut className="w-4 h-4 mr-1.5" /> 로그아웃
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 flex justify-between items-center bg-white overflow-x-auto hide-scrollbar">
            <div className="flex">
              {visibleBusinessUnits.map(unit => (
                <button
                  key={unit}
                  onClick={() => {
                    setActiveTab(unit);
                    if (unit !== 'PT') {
                      setFilterPtBoard('all');
                      setFilterExcludeReport('all');
                    }
                  }}
                  className={`whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 transition-colors duration-200 ${
                    activeTab === unit 
                      ? (unit === '미입력' ? 'border-red-500 text-red-600' : 'border-blue-500 text-blue-600') 
                      : (unit === '미입력' ? 'border-transparent text-red-400 hover:text-red-500 hover:bg-gray-50' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50')
                  }`}
                >
                  {unit}
                </button>
              ))}
            </div>
            
            {currentUserRole?.name === '품질경영팀' && (
              <div className="flex shrink-0">
                <button
                  onClick={() => setActiveTab('보고서')}
                  className={`whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 transition-colors duration-200 ${
                    activeTab === '보고서' 
                      ? 'border-gray-800 text-gray-900 bg-gray-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  📊 보고서
                </button>
                <button
                  onClick={() => setActiveTab('휴지통')}
                  className={`whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 transition-colors duration-200 ${
                    activeTab === '휴지통' 
                      ? 'border-gray-800 text-gray-900 bg-gray-50' 
                      : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  }`}
                >
                  🗑️ 휴지통 <span className="text-xs font-normal text-gray-400 ml-1">(3일 보관)</span>
                </button>
              </div>
            )}
          </div>

          {activeTab !== '집계' && activeTab !== '휴지통' && activeTab !== '보고서' && (
            <>
              {activeTab === 'PT' && (
                <div className="bg-indigo-50/50 px-6 py-3 border-b border-indigo-100 flex items-center gap-4">
                  <span className="text-sm font-semibold text-indigo-800">PT 보드 필터:</span>
                  <div className="flex bg-white rounded-lg shadow-sm border border-indigo-200 p-1">
                    {['all', 'ZMDI', 'N'].map(board => (
                      <button
                        key={board}
                        onClick={() => setFilterPtBoard(board)}
                        className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${
                          filterPtBoard === board ? 'bg-indigo-600 text-white shadow-sm' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {board === 'all' ? '전체 보기' : board}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="p-4 bg-gray-50/50 flex flex-wrap gap-4 items-center">
                <div className="flex items-center text-sm font-medium text-gray-700 mr-2">
                  <Filter className="w-4 h-4 mr-2" /> 상세 필터
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">상태:</label>
                  <select value={filterCompliance} onChange={(e) => setFilterCompliance(e.target.value)} className="text-sm border border-gray-300 rounded-md shadow-sm py-1.5 px-3">
                    <option value="all">전체</option>
                    <option value="준수">준수</option>
                    <option value="지연">지연</option>
                    <option value="미완료">처리중</option>
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">대리점:</label>
                  <select value={filterAgency} onChange={(e) => setFilterAgency(e.target.value)} className="text-sm border border-gray-300 rounded-md shadow-sm py-1.5 px-3 max-w-[150px]">
                    <option value="all">전체 대리점</option>
                    {agencies.filter(a => a !== 'all').map(agency => <option key={agency} value={agency}>{agency}</option>)}
                  </select>
                </div>
                <div className="flex items-center space-x-2">
                  <label className="text-sm text-gray-600">모델명:</label>
                  <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)} className="text-sm border border-gray-300 rounded-md shadow-sm py-1.5 px-3 max-w-[150px]">
                    <option value="all">전체 모델</option>
                    {models.filter(m => m !== 'all').map(model => <option key={model} value={model}>{model}</option>)}
                  </select>
                </div>

                {activeTab === 'PT' && (
                  <div className="flex items-center space-x-3 border-l border-gray-300 pl-4 ml-2">
                    <label className="text-sm text-gray-600 font-medium">성적서발행:</label>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" value="all" checked={filterExcludeReport === 'all'} onChange={(e) => setFilterExcludeReport(e.target.value)} className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-sm text-gray-700">포함</span>
                      </label>
                      <label className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" value="exclude" checked={filterExcludeReport === 'exclude'} onChange={(e) => setFilterExcludeReport(e.target.value)} className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-sm text-gray-700">제외</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="relative ml-auto">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="검색어 입력..."
                    className="block w-64 pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div className="text-sm text-gray-500 bg-white px-3 py-1.5 rounded-md border border-gray-200">
                  총 <span className="font-bold text-gray-900">{filteredData.length}</span>건
                </div>
              </div>
            </>
          )}
        </div>

        <input type="file" accept=".csv" ref={fileInputRef} onChange={importFromCSV} className="hidden" />
        
        {activeTab === '보고서' ? (
          
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">데이터 백업 및 내보내기</h2>
              <p className="text-gray-500 mb-8">현재 필터 조건에 맞는 <span className="font-bold text-blue-600">{filteredData.length}건</span>의 데이터를 원본 양식의 엑셀(.xlsx) 또는 CSV로 백업할 수 있습니다.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-12">
                <div onClick={() => fileInputRef.current.click()} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-white group flex flex-col items-center justify-center">
                  <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                    <Upload className="w-6 h-6 text-blue-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">CSV 데이터 업로드</h3>
                </div>
                
                <div onClick={exportToExcel} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-green-500 hover:shadow-lg transition-all cursor-pointer bg-white group flex flex-col items-center justify-center">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-green-100 transition-colors">
                    <FileSpreadsheet className="w-6 h-6 text-green-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-900">xlsx 다운로드</h3>
                </div>
                
                <div onClick={exportToCSV} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-gray-400 hover:shadow-md transition-all cursor-pointer bg-gray-50 group flex flex-col items-center justify-center">
                  <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center mb-3 group-hover:bg-gray-300 transition-colors">
                    <Download className="w-6 h-6 text-gray-600" />
                  </div>
                  <h3 className="text-base font-bold text-gray-700">csv 다운로드</h3>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-10">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">HTML 보고서 출력</h2>
                <p className="text-gray-500 mb-8">웹페이지 형태로 깔끔하게 포맷팅된 요약 보고서를 생성하여 인쇄하거나 PDF로 저장합니다.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                  <div onClick={exportToHTML} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-purple-500 hover:shadow-lg transition-all cursor-pointer bg-white group flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-purple-100 transition-colors">
                      <FileCode className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="text-base font-bold text-center text-gray-900">AS 관리대장 HTML 생성</h3>
                  </div>

                  <div onClick={() => exportToASReportHTML('ko')} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-indigo-500 hover:shadow-lg transition-all cursor-pointer bg-white group flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-indigo-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-indigo-100 transition-colors">
                      <FileText className="w-6 h-6 text-indigo-600" />
                    </div>
                    <h3 className="text-base font-bold text-center text-gray-900">AS 보고서 HTML (국문)</h3>
                  </div>

                  <div onClick={() => exportToASReportHTML('en')} className="py-8 px-6 border border-gray-200 rounded-2xl hover:border-blue-500 hover:shadow-lg transition-all cursor-pointer bg-white group flex flex-col items-center justify-center">
                    <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3 group-hover:bg-blue-100 transition-colors">
                      <FileText className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="text-base font-bold text-center text-gray-900">AS 보고서 HTML (영문)</h3>
                  </div>
                </div>
              </div>
            </div>
          </div>

        ) : activeTab === '집계' ? (
          
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-1 flex flex-col items-center justify-center">
                <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2 w-full">
                  <PieChart className="w-5 h-5 text-blue-600" /> 전체 A/S 종합 현황
                </h3>
                <DonutChart 
                  normal={aggregatedStats.find(s => s.isTotal)?.normal || 0} 
                  complaint={aggregatedStats.find(s => s.isTotal)?.complaint || 0} 
                  size={180} 
                  strokeWidth={16} 
                />
                <div className="w-full mt-8 space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="font-medium text-gray-700">일반 A/S</span></div>
                    <span className="font-bold text-gray-900">{aggregatedStats.find(s => s.isTotal)?.normal || 0}건 <span className="text-gray-500 font-normal ml-1">({aggregatedStats.find(s => s.isTotal)?.normalRate || 0}%)</span></span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="font-medium text-gray-700">고객불만</span></div>
                    <span className="font-bold text-red-600">{aggregatedStats.find(s => s.isTotal)?.complaint || 0}건 <span className="text-red-400 font-normal ml-1">({aggregatedStats.find(s => s.isTotal)?.complaintRate || 0}%)</span></span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-3">
                <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-600" /> 사업부별 세부 비율 지표
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                  {aggregatedStats.filter(s => !s.isTotal).map(stat => (
                    <div key={stat.unit} className="border border-gray-100 rounded-xl p-5 bg-white shadow-sm hover:shadow-md transition-shadow flex flex-col items-center relative overflow-hidden group">
                       <div className="w-full text-center pb-3 mb-4 border-b border-gray-100">
                         <h4 className="font-bold text-gray-800 text-sm">{stat.unit}</h4>
                       </div>
                       
                       <DonutChart normal={stat.normal} complaint={stat.complaint} size={110} strokeWidth={12} />
                       
                       <div className="w-full mt-5 space-y-2 text-xs">
                         <div className="flex justify-between items-center bg-blue-50/50 px-2 py-1.5 rounded text-blue-900">
                           <span className="font-medium">일반</span>
                           <span className="font-bold">{stat.normal}건 <span className="text-blue-600 font-normal">({stat.normalRate}%)</span></span>
                         </div>
                         <div className="flex justify-between items-center bg-red-50/50 px-2 py-1.5 rounded text-red-900">
                           <span className="font-medium">불만</span>
                           <span className="font-bold text-red-600">{stat.complaint}건 <span className="text-red-500 font-normal">({stat.complaintRate}%)</span></span>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              {dashboardStats.map(buStat => (
                <div key={buStat.unit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col">
                  
                  <h3 className="text-lg font-bold text-gray-900 mb-6 text-center border-b border-gray-100 pb-4">
                    {buStat.unit} 모델별 접수 현황
                  </h3>
                  
                  <div className="flex justify-center mb-8">
                    <MultiDonutChart 
                      data={buStat.modelsArr.map(m => ({ label: m.label, value: m.total, color: m.color }))} 
                      size={180} strokeWidth={24} 
                    />
                  </div>
                  
                  <div className="flex-1 w-full mt-2">
                    <table className="w-full text-sm text-left">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          <th className="pb-2 font-semibold">모델군</th>
                          <th className="pb-2 font-semibold text-right">접수</th>
                          <th className="pb-2 font-semibold text-right">일반 / 불만</th>
                        </tr>
                      </thead>
                      <tbody>
                        {buStat.modelsArr.map(m => (
                          <tr key={m.label} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                            <td className="py-3 font-medium text-gray-800 flex items-center gap-2">
                              <span className="w-3 shrink-0 h-3 rounded-full" style={{ backgroundColor: m.color }}></span>
                              {m.label}
                            </td>
                            <td className="py-3 text-right">
                              <span className="font-bold text-gray-900">{m.total}</span>
                              <span className="text-[10px] text-gray-400 font-normal ml-1">({m.rate}%)</span>
                            </td>
                            <td className="py-3 text-right whitespace-nowrap">
                              <div className="text-[11px]">
                                <span className="text-blue-600 font-medium">{m.normal}</span> 
                                <span className="text-gray-300 mx-1">/</span>
                                <span className="text-red-500 font-medium">{m.complaint}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                        {buStat.modelsArr.length === 0 && (
                          <tr><td colSpan="3" className="py-6 text-center text-gray-400">데이터가 없습니다.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

          </div>

        ) : (

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">사업부</th>
                    <th scope="col" className="px-2.5 py-2 text-center text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">상태</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">접수번호</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">수주번호</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">대리점</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">업체명</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">모델명</th>
                    <th scope="col" className="px-2.5 py-2 text-right text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">수량</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">하자내용</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">원인분석</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">일정</th>
                    <th scope="col" className="px-2.5 py-2 text-right text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">처리방법</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">기존 주문정보</th>
                    <th scope="col" className="px-2.5 py-2 text-left text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">처리방식</th>
                    <th scope="col" className="px-2.5 py-2 text-center text-[12px] font-bold text-gray-500 uppercase whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.length > 0 ? (
                    paginatedData.map((row) => (
                      <tr key={row.id} onClick={() => setSelectedRow(row)} className="hover:bg-blue-50 transition-colors cursor-pointer">
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs font-medium text-gray-900">
                          {row.businessUnit}
                          {row.businessUnit === 'PT' && row.ptBoardType && (
                            <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-800">
                              {row.ptBoardType}
                            </span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-center align-middle">
                          {renderStatusBadge(row.complianceStatus)}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs font-medium text-blue-600">{row.asNumber}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-500">{row.orderNumber}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-900">{row.agencyName}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-500">{row.companyName}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-900">{row.model}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-900 text-right">{row.qtyDefect}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-500 max-w-[150px] truncate">
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[9px] rounded mr-1 mb-1">{row.claimType || '일반 A/S'}</span>
                          <div className="truncate" title={row.defectContent}>{row.defectContent || '-'}</div>
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-500 max-w-[150px] truncate">
                          <div className="truncate" title={row.causeAnalysis}>{row.causeAnalysis || '-'}</div>
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <div className="flex items-center"><span className="text-gray-400 w-7">접수:</span> <span className="text-gray-900">{row.receiptDate}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-7">요구:</span> <span className="text-red-500">{row.reqDeliveryDate}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-7">납기:</span> <span className="text-gray-900">{row.processDate || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-7">소요:</span> <span className="text-gray-900">{row.duration}</span></div>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-right align-middle">
                          {row.repairMethod === '유상수리' ? (
                            <div>
                              <span className="font-medium text-blue-700">{row.repairMethod}</span>
                              <span className="block text-[10px] text-gray-500">₩ {row.cost != null && row.cost !== '' ? Number(row.cost).toLocaleString() : '0'}</span>
                            </div>
                          ) : (
                            <span className="font-medium text-gray-700">{row.repairMethod || '-'}</span>
                          )}
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap">
                          <div className="flex flex-col gap-0.5 text-[10px]">
                            <div className="flex items-center"><span className="text-gray-400 w-7">S/N:</span> <span className="text-gray-900 max-w-[100px] truncate">{row.serialNo || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-7">출고:</span> <span className="text-gray-900">{row.releaseDate || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-7">수주:</span> <span className="text-gray-900">{row.originalOrderNumber || '-'}</span></div>
                          </div>
                        </td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-xs text-gray-500">{row.processType || '-'}</td>
                        <td className="px-2.5 py-2 whitespace-nowrap text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            {activeTab === '휴지통' ? (
                              <>
                                <button onClick={(e) => handleRestore(row.id, e)} className="p-1 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-md transition-colors" title="데이터 복구">
                                  <RotateCcw className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={(e) => handlePermanentDeletePrepare(row.id, e)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="영구 삭제">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button onClick={(e) => { e.stopPropagation(); handleOpenForm(row); }} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="수정">
                                  <Edit className="w-3.5 h-3.5" />
                                </button>
                                {currentUserRole?.name === '품질경영팀' && (
                                  <button onClick={(e) => handleDeletePrepare(row.id, e)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="삭제 (휴지통으로 이동)">
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="15" className="px-6 py-12 text-center text-gray-500">
                        조건에 맞는 데이터가 없습니다. 
                        {activeTab === '미입력' && ' 모든 핵심 데이터가 완벽하게 입력되어 있습니다!'}
                        {activeTab === '휴지통' && ' 휴지통이 비어 있습니다.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 컨트롤 바 */}
            {filteredData.length > 0 && (
              <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200 bg-white">
                <div className="text-sm text-gray-700">
                  총 <span className="font-bold text-gray-900">{filteredData.length}</span>건 중 
                  <span className="font-medium ml-1">{(currentPage - 1) * itemsPerPage + 1}</span> - 
                  <span className="font-medium mr-1">{Math.min(currentPage * itemsPerPage, filteredData.length)}</span> 표시
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-none hide-scrollbar">
                    {currentBlock > 1 && (
                      <button
                        onClick={() => setCurrentPage(startPage - 1)}
                        className="px-2 py-1.5 text-gray-500 hover:text-gray-700 bg-white font-bold"
                      >
                        ...
                      </button>
                    )}
                    {visiblePages.map(page => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-1.5 border rounded-md text-sm font-medium ${
                          currentPage === page
                            ? 'bg-blue-600 text-white border-blue-600'
                            : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    {endPage < totalPages && (
                      <button
                        onClick={() => setCurrentPage(endPage + 1)}
                        className="px-2 py-1.5 text-gray-500 hover:text-gray-700 bg-white font-bold"
                      >
                        ...
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="px-3 py-1.5 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              </div>
            )}

          </div>

        )}
      </div>

      {/* 1. 상세 정보 모달 */}
      {selectedRow && !isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                A/S 상세 정보 <span className="text-sm font-normal text-gray-500 ml-2">{selectedRow.asNumber}</span>
              </h2>
              <button onClick={() => setSelectedRow(null)} className="p-2 hover:bg-gray-100 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* 상태 요약 */}
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-sm text-gray-500 mb-1">현재 상태</div>
                  <div className="flex items-center gap-3">
                    {renderStatusBadge(selectedRow.complianceStatus)}
                    <span className="text-sm font-medium text-gray-900">{selectedRow.processType || '미처리'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">처리 일정 <span className="font-bold text-blue-600 ml-1">(소요: {selectedRow.duration || '-'})</span></div>
                  <div className="text-sm font-medium text-gray-900">접수: {selectedRow.receiptDate || '-'} / 요구: <span className="text-red-600">{selectedRow.reqDeliveryDate || '-'}</span> / 완료: {selectedRow.processDate || '미정'}</div>
                </div>
              </div>

              {/* 기본 정보 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">기본 정보</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailItem label="사업부" value={selectedRow.businessUnit === 'PT' ? `${selectedRow.businessUnit} (${selectedRow.ptBoardType || 'N'})` : selectedRow.businessUnit} />
                  <DetailItem label="대리점명" value={selectedRow.agencyName} />
                  <DetailItem label="업체명" value={selectedRow.companyName} />
                  <DetailItem label="접수번호" value={selectedRow.asNumber} />
                  <DetailItem label="수주번호" value={selectedRow.orderNumber} />
                  <DetailItem label="접수일 (소요기간)" value={`${selectedRow.receiptDate || '-'} (총 ${selectedRow.duration || '-'})`} />
                </div>
              </div>

              {/* 제품 정보 */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">제품 및 수주 정보</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailItem label="MODEL" value={selectedRow.model} />
                  <DetailItem label="불량수량" value={`${selectedRow.qtyDefect}개`} />
                  <DetailItem label="출고일자" value={selectedRow.releaseDate || '-'} />
                  <DetailItem label="기존수주번호" value={selectedRow.originalOrderNumber || '-'} />
                  <div className="col-span-2">
                    <DetailItem label="Serial No." value={selectedRow.serialNo || '-'} isMultiline />
                  </div>
                </div>
              </div>

              {/* 내용 (클레임유형, 수리방법, 금액 통합) */}
              <div>
                <div className="flex justify-between items-end mb-3 border-b pb-2">
                  <h3 className="text-lg font-semibold text-gray-900">하자 및 처리 내용</h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${selectedRow.claimType === '고객불만' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'}`}>
                    {selectedRow.claimType || '일반 A/S'}
                  </span>
                </div>
                
                <div className="space-y-4">
                  <DetailItem label="하자 내용 (고객 접수)" value={selectedRow.defectContent} isMultiline />
                  <DetailItem label="원인 분석" value={selectedRow.causeAnalysis} isMultiline />
                  <div className="bg-blue-50/50 p-4 rounded-lg border border-blue-100">
                    <DetailItem label="처리 내역 및 대책" value={selectedRow.processDetails} isMultiline />
                  </div>
                  
                  {/* 처리 결과 및 방법 영역 */}
                  <div className="mt-4 flex items-center justify-between bg-gray-50 border border-gray-200 p-4 rounded-lg">
                    <div className="text-sm font-bold text-gray-800">
                      처리 결과: <span className="text-blue-700 ml-2">{selectedRow.repairMethod || '-'}</span>
                    </div>
                    {selectedRow.repairMethod === '유상수리' && (
                      <div className="text-sm font-bold text-gray-900 bg-white px-3 py-1.5 rounded border border-gray-200 shadow-sm">
                        청구 금액: ₩ {selectedRow.cost != null && selectedRow.cost !== '' ? Number(selectedRow.cost).toLocaleString() : '0'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-between shrink-0 rounded-b-2xl">
              {selectedRow.deletedAt ? (
                <div className="flex gap-2 w-full justify-between">
                  <button onClick={(e) => handlePermanentDeletePrepare(selectedRow.id, e)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center text-sm font-medium">
                    <Trash2 className="w-4 h-4 mr-2" /> 영구 삭제
                  </button>
                  <div className="flex gap-2">
                    <button onClick={(e) => handleRestore(selectedRow.id, e)} className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center text-sm font-medium">
                      <RotateCcw className="w-4 h-4 mr-2" /> 복구하기
                    </button>
                    <button onClick={() => setSelectedRow(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                      닫기
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {currentUserRole?.name === '품질경영팀' ? (
                    <button onClick={(e) => handleDeletePrepare(selectedRow.id, e)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center text-sm font-medium">
                      <Trash2 className="w-4 h-4 mr-2" /> 삭제
                    </button>
                  ) : <div />}
                  <div className="flex gap-2">
                    <button onClick={(e) => handleOpenForm(selectedRow)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium">
                      <Edit className="w-4 h-4 mr-2" /> 이 데이터 수정하기
                    </button>
                    <button onClick={() => setSelectedRow(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                      닫기
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. 추가/수정 폼 모달 */}
      {isFormOpen && formData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                {data.find(d => d.id === formData.id) ? '데이터 수정' : '새 데이터 추가'}
              </h2>
              <button onClick={() => setIsFormOpen(false)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>

            <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
              
              {formData.businessUnit === 'PT' && (
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-6">
                  <label className="block text-sm font-bold text-indigo-900">PT 보드 구분 선택</label>
                  <div className="flex gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="ptBoardType" value="ZMDI" checked={formData.ptBoardType === 'ZMDI'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-gray-900">ZMDI</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="radio" name="ptBoardType" value="N" checked={formData.ptBoardType === 'N'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" />
                      <span className="text-sm font-medium text-gray-900">N</span>
                    </label>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormGroup label="사업부">
                  <select name="businessUnit" value={formData.businessUnit} onChange={handleFormChange} className="form-input" required>
                    <option value="">사업부 선택</option>
                    <option value="PMD">PMD</option>
                    <option value="TMD">TMD</option>
                    <option value="FLD">FLD</option>
                    <option value="UHP">UHP</option>
                    <option value="PT">PT</option>
                  </select>
                </FormGroup>
                <FormGroup label="접수번호">
                  <input type="text" name="asNumber" value={formData.asNumber} onChange={handleFormChange} className="form-input" required />
                </FormGroup>
                <FormGroup label="수주번호">
                  <input type="text" name="orderNumber" value={formData.orderNumber} onChange={handleFormChange} className="form-input" />
                </FormGroup>
                <FormGroup label="처리방식 (접수단계)">
                  <select name="processType" value={formData.processType} onChange={handleFormChange} className="form-input">
                    <option value="">선택안함</option>
                    <option value="견적 후 착수">견적 후 착수</option>
                    <option value="선조치">선조치</option>
                    <option value="출장">출장</option>
                  </select>
                </FormGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                <FormGroup label="접수일자 (클릭 시 달력)">
                  <input type="date" name="receiptDate" value={formatForDateInput(formData.receiptDate)} onChange={handleFormChange} className="form-input cursor-pointer" />
                </FormGroup>
                <FormGroup label="납기요구일 (자동 5영업일 계산)">
                  <input type="date" name="reqDeliveryDate" value={formatForDateInput(formData.reqDeliveryDate)} onChange={handleFormChange} className="form-input cursor-pointer" />
                </FormGroup>
                <FormGroup label="처리완료일">
                  <input type="date" name="processDate" value={formatForDateInput(formData.processDate)} onChange={handleFormChange} className="form-input cursor-pointer" />
                </FormGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                <FormGroup label="대리점명">
                  <input type="text" name="agencyName" value={formData.agencyName} onChange={handleFormChange} className="form-input" />
                </FormGroup>
                <FormGroup label="업체명">
                  <input type="text" name="companyName" value={formData.companyName} onChange={handleFormChange} className="form-input" />
                </FormGroup>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <FormGroup label="MODEL">
                  <input type="text" name="model" value={formData.model} onChange={handleFormChange} className="form-input" />
                </FormGroup>
                <FormGroup label="불량 수량">
                  <input type="number" name="qtyDefect" value={formData.qtyDefect} onChange={handleFormChange} className="form-input" min="1" />
                </FormGroup>
                <FormGroup label="출고일자 (달력 선택)">
                  <input type="date" name="releaseDate" value={formatForDateInput(formData.releaseDate)} onChange={handleFormChange} className="form-input cursor-pointer" />
                </FormGroup>
                <FormGroup label="기존수주번호">
                  <input type="text" name="originalOrderNumber" value={formData.originalOrderNumber} onChange={handleFormChange} className="form-input" />
                </FormGroup>
              </div>

              <FormGroup label="Serial No. (여러 개일 경우 줄바꿈 가능)">
                <textarea name="serialNo" value={formData.serialNo} onChange={handleFormChange} className="form-input h-16" />
              </FormGroup>

              {/* 하자 및 처리내용 입력 섹션 */}
              <div className="border-t border-gray-200 pt-6 space-y-4">
                
                <div className="flex gap-6 mb-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="claimType" value="일반 A/S" checked={formData.claimType === '일반 A/S'} onChange={handleFormChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                    <span className="text-sm font-bold text-gray-900">일반 A/S</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="claimType" value="고객불만" checked={formData.claimType === '고객불만'} onChange={handleFormChange} className="w-4 h-4 text-red-600 focus:ring-red-500" />
                    <span className="text-sm font-bold text-red-600">고객불만</span>
                  </label>
                </div>

                <FormGroup label="하자 내용">
                  <textarea name="defectContent" value={formData.defectContent} onChange={handleFormChange} className="form-input h-20" />
                </FormGroup>
                <FormGroup label="원인 분석">
                  <textarea name="causeAnalysis" value={formData.causeAnalysis} onChange={handleFormChange} className="form-input h-20" />
                </FormGroup>
                <FormGroup label="처리 내역 및 대책">
                  <textarea name="processDetails" value={formData.processDetails} onChange={handleFormChange} className="form-input h-24" />
                </FormGroup>
                
                <div className="pt-4 border-t border-gray-100 bg-gray-50 p-4 rounded-xl mt-4">
                  <label className="block text-sm font-bold text-gray-700 mb-3">수리 결과 및 방법 선택</label>
                  <div className="flex flex-wrap items-center gap-6">
                    {['무상수리', '유상수리', '수리불가', '수리취소'].map(method => (
                      <label key={method} className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="repairMethod" value={method} checked={formData.repairMethod === method} onChange={handleFormChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" />
                        <span className="text-sm font-medium text-gray-900">{method}</span>
                      </label>
                    ))}
                    
                    {formData.repairMethod === '유상수리' && (
                      <div className="ml-auto flex items-center gap-2 bg-white px-3 py-1.5 rounded-md border border-gray-200 shadow-sm transition-all">
                        <span className="text-sm font-bold text-gray-700">금액 (₩)</span>
                        <input type="number" name="cost" value={formData.cost === null || formData.cost === undefined ? '' : formData.cost} onChange={handleFormChange} className="form-input w-32 !py-1" min="0" placeholder="0" />
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <button type="submit" className="hidden">저장</button>
            </form>

            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0 rounded-b-2xl gap-2">
              <button onClick={() => setIsFormOpen(false)} className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium">
                취소
              </button>
              <button onClick={handleFormSubmit} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium">
                <Save className="w-4 h-4 mr-2" /> 저장하기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. 일반 알림 팝업 */}
      {alertMessage && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-blue-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-6">{alertMessage}</h3>
            <button onClick={() => setAlertMessage('')} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
              확인
            </button>
          </div>
        </div>
      )}

      {/* 4. 휴지통 이동(소프트 삭제) 확인 팝업 */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">데이터를 삭제하시겠습니까?</h3>
            <p className="text-sm text-gray-500 mb-6">삭제된 데이터는 <strong>휴지통에서 3일간 보관</strong>된 후 영구 삭제됩니다.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">삭제하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 5. 영구 삭제 확인 팝업 */}
      {itemToPermanentDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">영구 삭제하시겠습니까?</h3>
            <p className="text-sm text-red-500 mb-6 font-medium">이 작업은 되돌릴 수 없습니다.</p>
            <div className="flex justify-center gap-3">
              <button onClick={() => setItemToPermanentDelete(null)} className="flex-1 py-3 bg-gray-100 text-gray-700 font-bold rounded-xl hover:bg-gray-200 transition-colors">취소</button>
              <button onClick={executePermanentDelete} className="flex-1 py-3 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-colors">영구 삭제</button>
            </div>
          </div>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .form-input {
          display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem;
          line-height: 1.25rem; border: 1px solid #d1d5db; border-radius: 0.375rem; outline: none; transition: border-color .15s;
        }
        .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
      `}} />
    </div>
  );
}

function DetailItem({ label, value, isMultiline = false }) {
  let displayValue = value;
  if (typeof value === 'object' && value !== null) {
     displayValue = JSON.stringify(value);
  }
  if (!displayValue && displayValue !== 0) displayValue = '-';
  
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {isMultiline ? (
        <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{displayValue}</div>
      ) : (
        <div className="text-sm font-medium text-gray-900">{displayValue}</div>
      )}
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}