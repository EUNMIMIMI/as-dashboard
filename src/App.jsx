import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, X, FileText, Calendar, CheckCircle, Clock, AlertCircle, 
  Download, Upload, FileCode, Plus, Edit, Trash, Save, BarChart, PieChart, Layers
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, doc, setDoc, deleteDoc, onSnapshot } from 'firebase/firestore';

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

// 초기 목업 데이터
const initialMockData = [
  {
    id: 1, asNumber: 'WQ-2821-01-26-001', orderNumber: 'P100Z260001', originalOrderNumber: 'P1DSZ250066',
    receiptDate: '01월 07일', reqDeliveryDate: '01월 15일', businessUnit: 'PMD', agencyName: '이노바이저',
    companyName: '크라이오에이치앤아이', model: 'P255', qtyDefect: 1, serialNo: 'P250219884', releaseDate: '2025.02.24',
    defectContent: 'LEAK', causeAnalysis: '관안 용접부위 핀홀로 LEAK됨',
    processDetails: '신규제작 및 재발방지 대책서 송부\nCryo H&I 납품분만 버든튜브 용접 후 수압 테스트 전에 헬륨 LEAK TEST 하기로 대책서 작성함',
    processDate: '01월 16일', processType: '견적 후 착수', cost: 0, claimType: '일반 A/S', repairMethod: '무상수리', ptBoardType: 'N'
  },
  {
    id: 2, asNumber: 'WQ-2821-01-26-002', orderNumber: 'P1AGZ260013', originalOrderNumber: '',
    receiptDate: '01월 07일', reqDeliveryDate: '01월 15일', businessUnit: 'PMD', agencyName: '우진종합계기(구로)',
    companyName: '한국드와이어', model: 'P252', qtyDefect: 6, serialNo: 'C151009684\n...', releaseDate: '',
    defectContent: '성적서 발행 요청', causeAnalysis: '', processDetails: '', processDate: '', processType: '견적 후 착수',
    cost: null, claimType: '일반 A/S', repairMethod: '', ptBoardType: 'N'
  },
  {
    id: 3, asNumber: 'WQ-2821-01-26-144', orderNumber: 'P1SAZ260027', originalOrderNumber: 'SAZ230009',
    receiptDate: '03월 18일', reqDeliveryDate: '03월 25일', businessUnit: 'PMD', agencyName: '티에스아이',
    companyName: '미원화학', model: 'P982', qtyDefect: 1, serialNo: 'P230124988', releaseDate: '',
    defectContent: '압력지시 안됨', causeAnalysis: '', processDetails: '', processDate: '', processType: '견적 후 착수',
    cost: null, claimType: '일반 A/S', repairMethod: '', ptBoardType: 'N'
  },
  {
    id: 4, asNumber: 'WQ-2821-01-26-145', orderNumber: 'UHPATZ260160', originalOrderNumber: 'ATZ230035',
    receiptDate: '03월 19일', reqDeliveryDate: '03월 27일', businessUnit: 'UHP', agencyName: '우진계기(서울)',
    companyName: '동광화학', model: 'SMT2001', qtyDefect: 2, serialNo: 'TM230300925\nTM230300932', releaseDate: '2023.04.26',
    defectContent: '에러표시 및 헌팅', causeAnalysis: '', processDetails: '', processDate: '', processType: '견적 후 착수',
    cost: null, claimType: '일반 A/S', repairMethod: '', ptBoardType: 'N'
  },
  {
    id: 6, asNumber: 'WQ-2821-01-26-146', orderNumber: 'P4BNZ260291', originalOrderNumber: '',
    receiptDate: '03월 20일', reqDeliveryDate: '03월 27일', businessUnit: 'PT', agencyName: '오토센서코리아',
    companyName: '원앤유엔씨테크', model: 'PT-100', qtyDefect: 1, serialNo: '', releaseDate: '',
    defectContent: '출력 불량 확인요청', causeAnalysis: '', processDetails: '', processDate: '', processType: '선조치',
    cost: null, claimType: '고객불만', repairMethod: '유상수리', ptBoardType: 'ZMDI'
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
              key={item.label}
              cx="50" cy="50" r={radius} fill="transparent" 
              stroke={item.color} strokeWidth={strokeWidth}
              strokeDasharray={strokeDasharray}
              strokeDashoffset={offset}
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
            strokeDasharray={`${normalDash} ${circumference}`}
            strokeDashoffset="0"
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        )}
        {complaint > 0 && (
          <circle 
            cx="50" cy="50" r={radius} fill="transparent" stroke="#ef4444" strokeWidth={strokeWidth}
            strokeDasharray={`${complaintDash} ${circumference}`}
            strokeDashoffset={-normalDash}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
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
  if (bu === 'PT') {
    return ptBoardType === 'ZMDI' ? 'ZMDI' : 'N';
  }
  
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
  const [data, setData] = useState([]); 
  const [activeTab, setActiveTab] = useState('전체'); 
  const [user, setUser] = useState(null);
  const [isSeeded, setIsSeeded] = useState(false);
  
  const [filterCompliance, setFilterCompliance] = useState('all');
  const [filterAgency, setFilterAgency] = useState('all');
  const [filterModel, setFilterModel] = useState('all');
  const [filterPtBoard, setFilterPtBoard] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1); 
  const itemsPerPage = 5; 
  
  const [selectedRow, setSelectedRow] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState(null);
  
  const fileInputRef = useRef(null);

  // --- Firebase 실시간 연동 (Auth & Firestore) ---
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
      snapshot.forEach(doc => {
        records.push({ id: doc.id, ...doc.data() });
      });
      
      if (snapshot.empty && !isSeeded) {
        setIsSeeded(true);
        initialMockData.forEach(async (record) => {
          await setDoc(doc(db, getCollectionPath(), String(record.id)), record);
        });
      } else {
        // 접수번호(asNumber) 기준으로 내림차순(최신순) 정렬되도록 수정
        records.sort((a, b) => {
          const numA = a.asNumber || '';
          const numB = b.asNumber || '';
          return numB.localeCompare(numA); 
        });
        setData(records);
      }
    }, (error) => {
      console.error("Firestore Error:", error);
    });
    
    return () => unsubscribe();
  }, [user, isSeeded]);
  // ---------------------------------------------

  const processedData = useMemo(() => {
    return data.map(item => ({
      ...item,
      complianceStatus: calculateCompliance(item.reqDeliveryDate, item.processDate),
      duration: calculateDuration(item.receiptDate, item.processDate)
    }));
  }, [data]);

  const aggregatedStats = useMemo(() => {
    const stats = {};
    const AGGREGATION_ORDER = ['PMD', 'TMD', 'FLD', 'UHP', 'PT (ZMDI)', 'PT (N)'];
    
    AGGREGATION_ORDER.forEach(unit => {
      stats[unit] = { unit, normal: 0, complaint: 0 }; 
    });

    processedData.forEach(item => {
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
      
      totalNormal += stat.normal;
      totalComplaint += stat.complaint;

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
  }, [processedData]);

  const dashboardStats = useMemo(() => {
    const stats = {};
    
    FIXED_UNITS_ORDER.forEach(bu => {
      stats[bu] = { unit: bu, total: 0, models: {} };
    });

    processedData.forEach(item => {
      const bu = FIXED_UNITS_ORDER.includes(item.businessUnit) ? item.businessUnit : '기타사업부';
      if (!stats[bu]) stats[bu] = { unit: bu, total: 0, models: {} };
      
      const groupLabel = getModelGroup(item.businessUnit, item.model, item.ptBoardType);
      
      stats[bu].total += 1;
      if (!stats[bu].models[groupLabel]) {
        stats[bu].models[groupLabel] = { label: groupLabel, total: 0, normal: 0, complaint: 0 };
      }
      
      stats[bu].models[groupLabel].total += 1;
      if (item.claimType === '고객불만') {
        stats[bu].models[groupLabel].complaint += 1;
      } else {
        stats[bu].models[groupLabel].normal += 1;
      }
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
  }, [processedData]);

  const dynamicUnits = Array.from(new Set(processedData.map(d => d.businessUnit).filter(Boolean)));
  const otherUnits = dynamicUnits.filter(unit => !FIXED_UNITS_ORDER.includes(unit));
  const businessUnits = ['전체', ...FIXED_UNITS_ORDER, ...otherUnits, '집계'];
  
  const tabFilteredData = useMemo(() => {
    if (activeTab === '집계' || activeTab === '전체') return processedData;
    return processedData.filter(item => {
      if (item.businessUnit !== activeTab) return false;
      if (activeTab === 'PT' && filterPtBoard !== 'all') {
        if (item.ptBoardType !== filterPtBoard) return false;
      }
      return true;
    });
  }, [processedData, activeTab, filterPtBoard]);

  const agencies = useMemo(() => {
    const list = Array.from(new Set(tabFilteredData.map(d => d.agencyName).filter(Boolean)));
    return ['all', ...list.sort()];
  }, [tabFilteredData]);

  const models = useMemo(() => {
    const list = Array.from(new Set(tabFilteredData.map(d => d.model).filter(Boolean)));
    return ['all', ...list.sort()];
  }, [tabFilteredData]);

  const filteredData = useMemo(() => {
    return tabFilteredData.filter(item => {
      if (activeTab === '집계') return true; 
      if (filterCompliance !== 'all' && item.complianceStatus !== filterCompliance) return false;
      if (filterAgency !== 'all' && item.agencyName !== filterAgency) return false;
      if (filterModel !== 'all' && item.model !== filterModel) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          (item.asNumber || '').toLowerCase().includes(query) ||
          (item.companyName || '').toLowerCase().includes(query) ||
          (item.agencyName || '').toLowerCase().includes(query) ||
          (item.model || '').toLowerCase().includes(query)
        );
      }
      return true;
    });
  }, [tabFilteredData, activeTab, filterCompliance, filterAgency, filterModel, searchQuery]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filterCompliance, filterAgency, filterModel, filterPtBoard, searchQuery]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  // --- 페이지네이션 5개 단위 블록 계산 ---
  const maxVisiblePages = 5;
  const currentBlock = Math.ceil(currentPage / maxVisiblePages);
  const startPage = (currentBlock - 1) * maxVisiblePages + 1;
  const endPage = Math.min(startPage + maxVisiblePages - 1, totalPages);
  const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

  const renderStatusBadge = (status) => {
    switch (status) {
      case '준수': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="w-3 h-3 mr-1" />준수</span>;
      case '지연': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800"><AlertCircle className="w-3 h-3 mr-1" />지연</span>;
      case '미완료': return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3 mr-1" />처리중</span>;
      default: return <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">알수없음</span>;
    }
  };

  const handleOpenForm = (record = null) => {
    if (record) {
      setFormData({ ptBoardType: 'N', claimType: '일반 A/S', repairMethod: '무상수리', ...record });
      setSelectedRow(null);
    } else {
      const newAsNumber = generateNextAsNumber(data);
      setFormData({
        id: Date.now(),
        asNumber: newAsNumber, orderNumber: '', originalOrderNumber: '',
        receiptDate: '', reqDeliveryDate: '', processDate: '',
        businessUnit: 'PMD', agencyName: '', companyName: '',
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
      if (name === 'releaseDate') {
        finalValue = `${y}.${m}.${d}`;
      } else {
        finalValue = `${m}월 ${d}일`;
      }
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

      if (name === 'repairMethod' && finalValue !== '유상수리') {
        newData.cost = '';
      }
      
      return newData;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!user) return alert('데이터베이스에 연결 중입니다. 잠시 후 다시 시도해주세요.');

    const docId = String(formData.id || Date.now());
    const docRef = doc(db, getCollectionPath(), docId);
    
    await setDoc(docRef, { ...formData, id: docId });
    setIsFormOpen(false);
  };

  const handleDelete = async (id) => {
    if (confirm('정말로 이 기록을 삭제하시겠습니까?')) {
      if (!user) return;
      await deleteDoc(doc(db, getCollectionPath(), String(id)));
      setSelectedRow(null);
    }
  };

  const exportToCSV = async () => {
    const header1 = '접수번호,수주번호,대리점명,업체명,MODEL,불량수량,하자내용,SERIAL No.,출고일자,기존주문번호,처리 방법,,,접수일,납기요구일,처리완료일,처리,,,,비용,원인 분석,,제품 원인,처리내역,사업부(시스템용),PT보드구분(시스템용)\n';
    const header2 = ',,,,,,,,,,견적 후 착수,선 조치,출장,,,,무상,유상,수리 불가,수리 취소,,일반 A/S,고객 불만,,,,\n';
    
    let csvContent = header1 + header2;
    const targetData = activeTab === '집계' ? processedData : filteredData;

    targetData.forEach(row => {
      const costVal = row.cost != null && row.cost !== '' ? row.cost : '';
      
      const rowData = [
        row.asNumber || '',
        row.orderNumber || '',
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
        costVal,
        row.claimType === '일반 A/S' ? '●' : '',
        row.claimType === '고객불만' ? '●' : '',
        row.causeAnalysis || '',
        row.processDetails || '',
        row.businessUnit || '',
        row.ptBoardType || 'N'
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
      console.warn("EUC-KR 인코딩 모듈 로드 실패. 기본 UTF-8(BOM) 방식으로 다운로드됩니다.", error);
      const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `AS관리대장_${new Date().toISOString().slice(0,10)}.csv`);
    }
  };

  const parseCSVRow = (str) => {
    const result = [];
    let inQuotes = false;
    let currentStr = '';
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if (char === '"' && str[i+1] === '"') {
            currentStr += '"';
            i++;
        } else if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(currentStr);
            currentStr = '';
        } else {
            currentStr += char;
        }
    }
    result.push(currentStr);
    return result;
  };

  const importFromCSV = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      const rows = text.split('\n');
      if (rows.length < 3) return alert('유효한 데이터가 부족합니다. (헤더 2줄 포함 필요)');
      
      const newRecords = [];
      for (let i = 2; i < rows.length; i++) {
        const row = rows[i].trim();
        if (!row) continue;
        
        const cols = parseCSVRow(row);
        
        if (cols.length >= 20) {
          let processType = '';
          if (cols[10] && cols[10].includes('●')) processType = '견적 후 착수';
          else if (cols[11] && cols[11].includes('●')) processType = '선조치';
          else if (cols[12] && cols[12].includes('●')) processType = '출장';

          let repairMethod = '';
          if (cols[16] && cols[16].includes('●')) repairMethod = '무상수리';
          else if (cols[17] && cols[17].includes('●')) repairMethod = '유상수리';
          else if (cols[18] && cols[18].includes('●')) repairMethod = '수리불가';
          else if (cols[19] && cols[19].includes('●')) repairMethod = '수리취소';

          let claimType = '일반 A/S'; 
          if (cols[22] && cols[22].includes('●')) claimType = '고객불만';
          else if (cols[21] && cols[21].includes('●')) claimType = '일반 A/S';

          let costRaw = (cols[20] || '').replace(/[₩\s,\-]/g, '');
          let cost = (costRaw && !isNaN(costRaw)) ? Number(costRaw) : null;

          let bu = cols[25] || '';
          if (!bu && cols[1]) {
            const orderNum = cols[1].toUpperCase();
            if (orderNum.startsWith('P1')) bu = 'PMD';
            else if (orderNum.startsWith('UHP') || orderNum.startsWith('P3')) bu = 'UHP';
            else if (orderNum.startsWith('P4')) bu = 'PT';
            else if (orderNum.startsWith('T')) bu = 'TMD';
            else if (orderNum.startsWith('F')) bu = 'FLD';
          }

          newRecords.push({
            id: Date.now() + i,
            asNumber: cols[0] || '',
            orderNumber: cols[1] || '',
            agencyName: cols[2] || '',
            companyName: cols[3] || '',
            model: cols[4] || '',
            qtyDefect: parseInt(cols[5]) || 1,
            defectContent: cols[6] || '',
            serialNo: cols[7] || '',
            releaseDate: cols[8] || '',
            originalOrderNumber: cols[9] || '',
            processType: processType,
            receiptDate: cols[13] || '',
            reqDeliveryDate: cols[14] || '',
            processDate: cols[15] || '',
            repairMethod: repairMethod,
            cost: cost,
            claimType: claimType,
            causeAnalysis: cols[23] || '',
            processDetails: cols[24] || '',
            businessUnit: bu,
            ptBoardType: cols[26] || 'N'
          });
        }
      }
      
      if(newRecords.length > 0) {
         if (user) {
           newRecords.forEach(async (record) => {
             await setDoc(doc(db, getCollectionPath(), String(record.id)), record);
           });
           alert(`${newRecords.length}건의 데이터를 성공적으로 업로드 중입니다. (잠시 후 실시간으로 반영됩니다.)`);
         } else {
           alert('데이터베이스 연결이 안되어 업로드할 수 없습니다.');
         }
      } else {
         alert('업로드할 유효한 데이터 항목을 찾지 못했습니다.');
      }
    };
    
    reader.readAsText(file, 'euc-kr');
    e.target.value = null;
  };

  const exportToHTML = () => {
    const targetData = activeTab === '집계' ? processedData : filteredData;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="ko">
      <head>
        <meta charset="UTF-8">
        <title>A/S 처리 관리대장 보고서</title>
        <style>
          body { font-family: 'Malgun Gothic', sans-serif; padding: 20px; }
          h1 { text-align: center; color: #333; }
          .summary { margin-bottom: 20px; text-align: right; color: #666; font-size: 14px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
          th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
          th { background-color: #f4f4f5; font-weight: bold; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .claim-badge { display:inline-block; padding:2px 4px; border-radius:3px; background:#f0f0f0; font-size:10px; margin-bottom:4px; }
        </style>
      </head>
      <body>
        <h1>A/S 처리 관리대장 보고서</h1>
        <div class="summary">출력일시: ${new Date().toLocaleString()} | 총 ${targetData.length}건</div>
        <table>
          <thead>
            <tr>
              <th>사업부</th><th>상태</th><th>접수번호</th><th>수주번호</th><th>대리점</th><th>업체명</th><th>모델(수량)</th>
              <th>하자내용</th><th>기존주문정보(S/N)</th><th>처리방식</th><th>처리방법(금액)</th><th>일정</th>
            </tr>
          </thead>
          <tbody>
            ${targetData.map(row => `
              <tr>
                <td class="text-center">${row.businessUnit}</td>
                <td class="text-center">${row.complianceStatus}</td>
                <td>${row.asNumber}</td>
                <td>${row.orderNumber}</td>
                <td>${row.agencyName}</td>
                <td>${row.companyName}</td>
                <td>${row.model}<br>(${row.qtyDefect}개)</td>
                <td><span class="claim-badge">${row.claimType || '일반 A/S'}</span><br/>${row.defectContent || '-'}</td>
                <td>S/N: ${row.serialNo || '-'}<br>출고: ${row.releaseDate || '-'}<br>수주: ${row.originalOrderNumber || '-'}</td>
                <td class="text-center">${row.processType || '-'}</td>
                <td class="text-right">
                  <strong>${row.repairMethod || '-'}</strong><br/>
                  ${row.repairMethod === '유상수리' ? (row.cost != null && row.cost !== '' ? '₩ ' + Number(row.cost).toLocaleString() : '₩ 0') : ''}
                </td>
                <td>접수: ${row.receiptDate}<br>요구: <span style="color:red">${row.reqDeliveryDate}</span><br>납기: ${row.processDate || '-'}</td>
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

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="text-blue-600" />
              A/S 처리 관리대장
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={importFromCSV} className="hidden" />
            <button onClick={() => fileInputRef.current.click()} className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Upload className="w-4 h-4 mr-1.5" /> CSV 업로드
            </button>
            <button onClick={exportToCSV} className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
              <Download className="w-4 h-4 mr-1.5" /> CSV 다운로드
            </button>
            <button onClick={exportToHTML} className="flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200">
              <FileCode className="w-4 h-4 mr-1.5" /> HTML 보고서
            </button>
            <button onClick={() => handleOpenForm()} className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm ml-2">
              <Plus className="w-4 h-4 mr-1.5" /> 새 데이터 추가
            </button>
          </div>
        </header>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 px-2 flex overflow-x-auto hide-scrollbar">
            {businessUnits.map(unit => (
              <button
                key={unit}
                onClick={() => {
                  setActiveTab(unit);
                  if (unit !== 'PT') setFilterPtBoard('all');
                  
                  // 탭 변경 시 상세 필터 및 페이지 자동 초기화
                  setFilterCompliance('all');
                  setFilterAgency('all');
                  setFilterModel('all');
                  setSearchQuery('');
                  setCurrentPage(1);
                }}
                className={`whitespace-nowrap py-4 px-6 text-sm font-medium border-b-2 transition-colors duration-200 ${
                  activeTab === unit ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          {activeTab !== '집계' && (
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

        {activeTab === '집계' ? (
          
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
                  <BarChart className="w-5 h-5 text-gray-600" /> 사업부별 세부 비율 지표
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
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">사업부</th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">상태</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">접수번호</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">수주번호</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">대리점</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">업체명</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">모델명</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">수량</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">하자내용</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">기존 주문정보</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">처리방식</th>
                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">처리방법</th>
                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">일정</th>
                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase whitespace-nowrap">관리</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedData.length > 0 ? (
                    paginatedData.map((row) => (
                      <tr key={row.id} onClick={() => setSelectedRow(row)} className="hover:bg-blue-50 transition-colors cursor-pointer">
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                          {row.businessUnit}
                          {row.businessUnit === 'PT' && row.ptBoardType && (
                            <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-800">
                              {row.ptBoardType}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
                          {renderStatusBadge(row.complianceStatus)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">{row.asNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.orderNumber}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.agencyName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.companyName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">{row.model}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">{row.qtyDefect}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500 max-w-[150px] truncate">
                          <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded mr-1 mb-1">{row.claimType || '일반 A/S'}</span>
                          <div className="truncate">{row.defectContent || '-'}</div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center"><span className="text-gray-400 w-8">S/N:</span> <span className="text-gray-900 max-w-[120px] truncate">{row.serialNo || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-8">출고:</span> <span className="text-gray-900">{row.releaseDate || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-8">수주:</span> <span className="text-gray-900">{row.originalOrderNumber || '-'}</span></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{row.processType || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-right align-middle">
                          {row.repairMethod === '유상수리' ? (
                            <div>
                              <span className="font-medium text-blue-700">{row.repairMethod}</span>
                              <span className="block text-xs text-gray-500">₩ {row.cost != null && row.cost !== '' ? Number(row.cost).toLocaleString() : '0'}</span>
                            </div>
                          ) : (
                            <span className="font-medium text-gray-700">{row.repairMethod || '-'}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div className="flex flex-col gap-1 text-xs">
                            <div className="flex items-center"><span className="text-gray-400 w-8">접수:</span> <span className="text-gray-900">{row.receiptDate}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-8">요구:</span> <span className="text-red-500">{row.reqDeliveryDate}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-8">납기:</span> <span className="text-gray-900">{row.processDate || '-'}</span></div>
                            <div className="flex items-center"><span className="text-gray-400 w-8">소요:</span> <span className="text-gray-900">{row.duration}</span></div>
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center align-middle">
                          <div className="flex items-center justify-center gap-1">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenForm(row); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="수정">
                              <Edit className="w-4 h-4" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(row.id); }} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="삭제">
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="14" className="px-6 py-12 text-center text-gray-500">
                        조건에 맞는 데이터가 없습니다. 필터를 변경해보세요.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 컨트롤 바 추가 */}
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
      {selectedRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between shrink-0 bg-gray-50 rounded-t-2xl">
              <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                A/S 상세 정보
              </h2>
              <button onClick={() => setSelectedRow(null)} className="p-2 hover:bg-gray-200 rounded-full"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex justify-between items-end border-b pb-2">
                    <h3 className="text-lg font-semibold text-gray-900">기본 정보</h3>
                    <span className="text-sm font-medium text-blue-600">{selectedRow.asNumber}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                    <DetailItem label="사업부" value={selectedRow.businessUnit} />
                    <DetailItem label="처리 방식" value={selectedRow.processType} />
                    <DetailItem label="대리점명" value={selectedRow.agencyName} />
                    <DetailItem label="업체명" value={selectedRow.companyName} />
                    <DetailItem label="접수일" value={selectedRow.receiptDate} />
                    <DetailItem label="납기요구일" value={selectedRow.reqDeliveryDate} />
                  </div>
                </div>
                
                <div className="space-y-6 bg-gray-50 p-5 rounded-xl border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">제품 정보</h3>
                  <div className="space-y-4">
                    <DetailItem label="모델명" value={selectedRow.model} />
                    <DetailItem label="불량 수량" value={`${selectedRow.qtyDefect} 개`} />
                    <DetailItem label="출고 일자" value={selectedRow.releaseDate} />
                    <DetailItem label="기존 주문번호" value={selectedRow.originalOrderNumber} />
                    <div className="col-span-2">
                      <DetailItem label="Serial No." value={selectedRow.serialNo || '-'} isMultiline />
                    </div>
                  </div>
                </div>
              </div>

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
              <button onClick={() => handleDelete(selectedRow.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center text-sm font-medium">
                <Trash className="w-4 h-4 mr-2" /> 삭제
              </button>
              <div className="flex gap-2">
                <button onClick={() => handleOpenForm(selectedRow)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium">
                  <Edit className="w-4 h-4 mr-2" /> 이 데이터 수정하기
                </button>
                <button onClick={() => setSelectedRow(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">
                  닫기
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
  if (!value && value !== 0) value = '-';
  return (
    <div>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      {isMultiline ? (
        <div className="text-sm text-gray-900 whitespace-pre-wrap leading-relaxed">{value}</div>
      ) : (
        <div className="text-sm font-medium text-gray-900">{value}</div>
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