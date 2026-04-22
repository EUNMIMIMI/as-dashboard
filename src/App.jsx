import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Search, Filter, X, FileText, Calendar, CheckCircle2, Clock, AlertCircle, 
  Download, Upload, FileCode, Plus, Edit, Trash2, Save, BarChart3, PieChart, Layers, Lock, LogOut, RotateCcw, FileSpreadsheet, TrendingUp, Copy, LineChart, CheckCircle, Wrench, Archive
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
  'uhp123': { name: 'uhp 담당자', tabs: ['SMT', 'PG', 'PT', 'UPT900'] }
};

// --- Firebase 초기화 ---
const isCanvasEnv = typeof __firebase_config !== 'undefined';

let localConfig = { apiKey: "", authDomain: "", projectId: "", storageBucket: "", messagingSenderId: "", appId: "" };
try {
  localConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || ""
  };
} catch (e) {
  // 환경변수가 없는 환경(캔버스 등)에서 발생하는 에러 무시
}

const firebaseConfig = isCanvasEnv 
  ? JSON.parse(__firebase_config) 
  : localConfig;

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

// --- 하드코딩 데이터 ---
const HISTORICAL_YEARLY = {
  'PMD': { '2023': { total: 287, complaint: 4 }, '2024': { total: 251, complaint: 29 }, '2025': { total: 215, complaint: 15 } },
  'TMD': { '2023': { total: 116, complaint: 5 }, '2024': { total: 112, complaint: 24 }, '2025': { total: 96, complaint: 16 } },
  'FLD': { '2023': { total: 15, complaint: 0 }, '2024': { total: 7, complaint: 1 }, '2025': { total: 14, complaint: 3 } },
  'SMT': { '2023': { total: 134, complaint: 9 }, '2024': { total: 154, complaint: 140 }, '2025': { total: 127, complaint: 12 } },
  'PG': { '2023': { total: 0, complaint: 0 }, '2024': { total: 0, complaint: 0 }, '2025': { total: 0, complaint: 0 } }
};
const TREND_UNITS = ['PMD', 'TMD', 'FLD', 'SMT', 'PG']; 

const CAUSE_HEADERS = [
  { id: 'c1', label: '설치\n조건' }, { id: 'c2', label: '취급\n부주의' }, { id: 'c3', label: '품질\n보증\n기간' },
  { id: 'w1', label: '사양\n검토\n미흡' }, { id: 'w2', label: '설계\n미흡' }, { id: 'w3', label: '사양\n검토\n미흡' },
  { id: 'w4', label: '용접\n불량' }, { id: 'w5', label: '세척\n불량' }, { id: 'w6', label: '가공\n불량' },
  { id: 'w7', label: '성능\n불량' }, { id: 'w8', label: '조립\n불량' }, { id: 'w9', label: '오일\n주입\n불량' },
  { id: 'w10', label: '외관\n불량' }, { id: 'w11', label: '식별\n포장' }, { id: 'w12', label: '검사\n미흡' },
  { id: 'e1', label: '자재\n부품\n불량' }, { id: 'e2', label: '운송\n중\n충격' }, { id: 'e3', label: '원인\n분석\n불가' },
  { id: 'e4', label: '정상' }, { id: 'e5', label: '연구\n및\n개선' }
];

const PT_CAUSE_HEADERS = [
  { id: 'c1', label: '설치\n조건' }, { id: 'c2', label: '취급\n부주의' }, { id: 'c3', label: '품질\n보증\n기간' },
  { id: 'w1', label: '사양\n검토\n미흡' }, { id: 'w2', label: '설계\n미흡' }, { id: 'w3', label: '사양\n검토\n미흡' },
  { id: 'w4', label: '용접\n불량' }, { id: 'w5', label: '세척\n불량' }, { id: 'w6', label: '가공\n불량' },
  { id: 'w8', label: '조립\n불량' }, { id: 'w7', label: '성능\n불량' }, { id: 'pt1', label: '캐패시터\n불량' },
  { id: 'pt2', label: '커넥터\n보드\n불량' }, { id: 'pt3', label: '센서칩\n불량' }, { id: 'pt4', label: '와이어\n본딩\n불량' },
  { id: 'pt5', label: '메인\n보드\n불량' }, { id: 'pt6', label: '케이블\n눌림' }, { id: 'w10', label: '외관\n불량' },
  { id: 'w11', label: '식별\n포장' }, { id: 'w12', label: '검사\n미흡' }, { id: 'e1', label: '자재\n부품\n불량' },
  { id: 'e2', label: '운송\n중\n충격' }, { id: 'e3', label: '원인\n분석\n불가' }, { id: 'e4', label: '정상' },
  { id: 'e5', label: '연구\n및\n개선' }, { id: 'pt7', label: '품질\n테스트' }
];

const UPT900_CAUSE_HEADERS = [
  { id: 'c1', label: '설치\n조건' }, { id: 'c2', label: '취급\n부주의' }, { id: 'c3', label: '품질\n보증\n기간' },
  { id: 'w1', label: '사양\n검토\n미흡' }, { id: 'w2', label: '설계\n미흡' }, { id: 'w3', label: '사양\n검토\n미흡' },
  { id: 'w4', label: '용접\n불량' }, { id: 'w6', label: '가공\n불량' }, { id: 'w7', label: '성능\n불량' },
  { id: 'w8', label: '조립\n불량' }, { id: 'w10', label: '외관\n불량' }, { id: 'upt1', label: '스티커\n불량' },
  { id: 'upt2', label: 'PCB불량' }, { id: 'upt3', label: '영점\n불량' }, { id: 'w11', label: '식별\n포장' },
  { id: 'w12', label: '검사\n미흡' }, { id: 'e1', label: '자재\n부품\n불량' }, { id: 'e2', label: '운송\n중\n충격' },
  { id: 'e3', label: '원인\n분석\n불가' }, { id: 'e4', label: '정상' }, { id: 'e5', label: '연구\n및\n개선' }
];

const PROCESS_HEADERS = [
  { id: 'p1', value: '점검 및 수리', label: '점검\n및\n수리' },
  { id: 'p2', value: '부품 교체', label: '부품\n교체' },
  { id: 'p3', value: '신규 제작', label: '신규\n제작' },
  { id: 'p4', value: '수리 불가', label: '수리\n불가' },
  { id: 'p5', value: '수리 취소', label: '수리\n취소' },
];

const ALL_CAUSE_HEADERS = [...CAUSE_HEADERS, ...PT_CAUSE_HEADERS, ...UPT900_CAUSE_HEADERS];
const CAUSE_LABEL_MAP = ALL_CAUSE_HEADERS.reduce((acc, curr) => {
  if (!acc[curr.id]) acc[curr.id] = curr.label.replace(/\n/g, ' ');
  return acc;
}, {});

const getCauseTableConfig = (bu) => {
  if (bu === 'PT') return { headers: PT_CAUSE_HEADERS, totalCols: 26, wiseCols: 17, otherGroupCols: 6, prodCols: 14, otherCols: 5 };
  if (bu === 'UPT900') return { headers: UPT900_CAUSE_HEADERS, totalCols: 21, wiseCols: 13, otherGroupCols: 5, prodCols: 10, otherCols: 4 };
  return { headers: CAUSE_HEADERS, totalCols: 20, wiseCols: 12, otherGroupCols: 5, prodCols: 9, otherCols: 4 };
};

const getCauseGroup = (id) => {
  if (['c1'].includes(id)) return '설치조건';
  if (['c2'].includes(id)) return '취급부주의';
  if (['c3'].includes(id)) return '품질보증기간';
  if (['w1'].includes(id)) return '영업 검토 미흡';
  if (['w2'].includes(id)) return '설계 미흡';
  if (['w3', 'w4', 'w5', 'w6', 'w7', 'w8', 'w9', 'w10', 'pt1', 'pt2', 'pt3', 'pt4', 'pt5', 'pt6', 'upt1', 'upt2', 'upt3'].includes(id)) return '생산 불량';
  if (['w11', 'w12', 'pt7'].includes(id)) return '품질 검사 미흡';
  if (['e1'].includes(id)) return '공급자 불량';
  if (['e2'].includes(id)) return '운송 중 충격';
  if (['e3'].includes(id)) return '원인분석 불가';
  if (['e4'].includes(id)) return '정상';
  if (['e5'].includes(id)) return '연구 및 개선';
  return '기타';
};

const formatDisplayDate = (dateStr) => {
  if (!dateStr) return '';
  let str = String(dateStr).trim();
  let y = new Date().getFullYear();
  let m, d;
  if (str.includes('.')) {
    const parts = str.split('.').map(p => p.trim());
    if (parts.length >= 3) {
      y = parts[0].length === 2 ? 2000 + parseInt(parts[0]) : parseInt(parts[0]);
      m = parseInt(parts[1]);
      d = parseInt(parts[2]);
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length >= 3) { y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]); }
  } else { return dateStr; }
  if (isNaN(y) || isNaN(m) || isNaN(d)) return dateStr;
  return `${String(y).slice(-2)}.${String(m).padStart(2, '0')}.${String(d).padStart(2, '0')}`;
};

const formatForDateInput = (dateStr) => {
  if (!dateStr || !dateStr.includes('.')) return '';
  const parts = dateStr.split('.').map(p => p.trim());
  if (parts.length === 3) return `20${parts[0]}-${parts[1]}-${parts[2]}`;
  return '';
};

const calculateCompliance = (reqDate, compDate) => {
  if (!compDate || compDate === '-' || !reqDate) return '미완료';
  try {
    const reqParts = reqDate.split('.').map(Number);
    const compParts = compDate.split('.').map(Number);
    const reqObj = new Date(2000 + reqParts[0], reqParts[1] - 1, reqParts[2]);
    const compObj = new Date(2000 + compParts[0], compParts[1] - 1, compParts[2]);
    return compObj.getTime() <= reqObj.getTime() ? '준수' : '지연';
  } catch(e) { return '오류'; }
};

const calculateDuration = (startDate, endDate) => {
  if (!startDate || !endDate || endDate === '-') return '-';
  try {
    const sParts = startDate.split('.').map(Number);
    const eParts = endDate.split('.').map(Number);
    const sObj = new Date(2000 + sParts[0], sParts[1] - 1, sParts[2]);
    const eObj = new Date(2000 + eParts[0], eParts[1] - 1, eParts[2]);
    const diffDays = Math.ceil((eObj.getTime() - sObj.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? `${diffDays}일` : '-';
  } catch(e) { return '-'; }
};

const addBusinessDays = (dateStr, days) => {
  if (!dateStr) return '';
  let str = String(dateStr).trim();
  let y = new Date().getFullYear();
  let m, d;
  if (str.includes('.')) {
    const parts = str.split('.').map(p => p.trim());
    if (parts.length >= 3) {
      y = parts[0].length === 2 ? 2000 + parseInt(parts[0]) : parseInt(parts[0]);
      m = parseInt(parts[1]);
      d = parseInt(parts[2]);
    }
  } else if (str.includes('-')) {
    const parts = str.split('-');
    if (parts.length >= 3) { y = parseInt(parts[0]); m = parseInt(parts[1]); d = parseInt(parts[2]); }
  } else return '';
  
  if (isNaN(y) || isNaN(m) || isNaN(d)) return '';
  const dObj = new Date(y, m - 1, d);
  
  let addedDays = 0;
  while (addedDays < days) {
    dObj.setDate(dObj.getDate() + 1);
    const dayOfWeek = dObj.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) addedDays++;
  }
  const yy = String(dObj.getFullYear()).slice(-2);
  const mm = String(dObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dObj.getDate()).padStart(2, '0');
  return `${yy}.${mm}.${dd}`;
};

const FIXED_UNITS_ORDER = ['PMD', 'TMD', 'FLD', 'SMT', 'PG', 'PT', 'UPT900'];
const STATUS_STEPS = ['접수 대기', '접수 완료', '견적 승인 대기', '수리 중', '수리 완료', '종결'];
const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899', '#f97316', '#6366f1', '#14b8a6', '#84cc16', '#a855f7'];

const DASHBOARD_CONFIG = [
  { status: '전체', label: '전체', icon: Layers, hex: '#D9D5D2' },
  { status: '접수 대기', label: '접수 대기', icon: AlertCircle, hex: '#F886A8' },
  { status: '접수 완료', label: '접수 완료', icon: CheckCircle2, hex: '#FE8D6F' },
  { status: '견적 승인 대기', label: '견적 대기', icon: FileText, hex: '#FDC453' },
  { status: '수리 중', label: '수리 진행 중', icon: Wrench, hex: '#DFDD6C' },
  { status: '수리 완료', label: '수리 완료', icon: CheckCircle, hex: '#A0DDE0' },
  { status: '종결', label: '종결', icon: Archive, hex: '#9ADBC5' }
];

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

const getUniqueCount = (dataList, statusFilter) => {
  let filtered = dataList;
  if (statusFilter !== '전체') {
    filtered = dataList.filter(d => (d.currentStatus || '접수 대기') === statusFilter);
  }
  const uniqueRecords = new Set();
  filtered.forEach(d => {
    const claim = d.claimType === '고객불만' ? '고객불만' : '일반 A/S';
    const status = d.currentStatus || '접수 대기';
    if (d.asNumber) {
      uniqueRecords.add(`${d.asNumber.trim().toUpperCase()}_${claim}_${status}`);
    } else {
      uniqueRecords.add(`doc_${d.id}`);
    }
  });
  return uniqueRecords.size;
};

const parseDateObj = (dateStr) => {
  if (!dateStr) return null;
  let str = String(dateStr).trim();
  let y = new Date().getFullYear();
  let m, d;
  if (str.includes('.')) {
    const parts = str.split('.').map(p => p.trim());
    if (parts.length >= 3) {
      y = parts[0].length === 2 ? 2000 + parseInt(parts[0]) : parseInt(parts[0]);
      m = parseInt(parts[1]);
      d = parseInt(parts[2]);
    }
  } else if (str.includes('-')) {
     const parts = str.split('-');
     if (parts.length >= 3) {
      y = parseInt(parts[0]);
      m = parseInt(parts[1]);
      d = parseInt(parts[2]);
     }
  } else {
     return null;
  }
  if (isNaN(y) || isNaN(m) || isNaN(d)) return null;
  return new Date(y, m - 1, d);
};

const getYearFromDate = (dateStr) => {
  const d = parseDateObj(dateStr);
  if (d) return String(d.getFullYear());
  return null;
};

const MultiDonutChart = ({ data, size = 160, strokeWidth = 24 }) => {
  const total = data.reduce((acc, item) => acc + item.value, 0);
  const radius = 50 - strokeWidth / 2;
  const circumference = 2 * Math.PI * radius;
  let currentOffset = 0;
  let currentAngle = -90;
  
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
        <g transform="rotate(-90 50 50)">
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
        </g>
        {data.map((item, i) => {
          if (item.value === 0) return null;
          const sliceAngle = (item.value / total) * 360;
          const midAngle = currentAngle + sliceAngle / 2;
          currentAngle += sliceAngle;
          
          if (item.value / total < 0.05) return null;
          
          const rad = (midAngle * Math.PI) / 180;
          const x = 50 + radius * Math.cos(rad);
          const y = 50 + radius * Math.sin(rad);
          const percentage = ((item.value / total) * 100).toFixed(1) + '%';
          
          return (
            <text 
              key={`text-${item.label}`} 
              x={x} y={y} 
              fill="#ffffff" 
              textAnchor="middle" 
              dominantBaseline="central"
              style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.8)' }}
            >
              <tspan x={x} dy="-3" fontSize="4.5" fontWeight="bold">{item.label}</tspan>
              <tspan x={x} dy="5.5" fontSize="4.5" fontWeight="bold">{percentage}</tspan>
            </text>
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center bg-white rounded-full" style={{ width: '48%', height: '48%' }}>
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
  
  const normalAngle = total === 0 ? 0 : (normal / total) * 360;
  const complaintAngle = total === 0 ? 0 : (complaint / total) * 360;

  const getLabelPos = (angle, sliceAngle) => {
    const midAngle = angle + sliceAngle / 2;
    const rad = (midAngle * Math.PI) / 180;
    return {
      x: 50 + radius * Math.cos(rad),
      y: 50 + radius * Math.sin(rad)
    };
  };

  const normalPos = getLabelPos(-90, normalAngle);
  const complaintPos = getLabelPos(-90 + normalAngle, complaintAngle);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-sm">
        <g transform="rotate(-90 50 50)">
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
        </g>
        {normal > 0 && (normal / total >= 0.08) && (
           <text x={normalPos.x} y={normalPos.y} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
             {((normal / total) * 100).toFixed(1)}%
           </text>
        )}
        {complaint > 0 && (complaint / total >= 0.08) && (
           <text x={complaintPos.x} y={complaintPos.y} fill="#ffffff" fontSize="8" fontWeight="bold" textAnchor="middle" dominantBaseline="central" style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}>
             {((complaint / total) * 100).toFixed(1)}%
           </text>
        )}
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center bg-white rounded-full" style={{ width: '55%', height: '55%' }}>
        <span className="text-[10px] text-gray-500 mb-0.5">총 접수</span>
        <span className="text-sm font-bold text-gray-900 leading-none">{total}건</span>
      </div>
    </div>
  );
};

const YearlyTrendChart = ({ data, heightClass = 'h-[220px]', type = 'mixed' }) => {
  if (!data || data.length === 0) return <div className="text-sm text-gray-400 flex items-center justify-center h-full">데이터가 없습니다.</div>;

  const maxVal = Math.max(...data.map(d => Math.max(d.total, d.complaint)), 10) * 1.2; 
  const w = 500;
  const h = 250;
  const px = 40;
  const py = 40;
  const cw = w - px * 2;
  const ch = h - py * 2;

  const getX = (index) => px + (cw / (data.length * 2)) * (index * 2 + 1);
  const getY = (val) => py + ch - (val / maxVal) * ch;

  const totalPoints = data.map((d, i) => `${getX(i)},${getY(d.total)}`).join(' ');
  const complaintPoints = data.map((d, i) => `${getX(i)},${getY(d.complaint)}`).join(' ');

  return (
    <div className={`w-full flex justify-center items-center ${heightClass}`}>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-full h-full font-sans">
        {/* Background grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
          const yPos = py + ch * ratio;
          return (
            <g key={ratio}>
              <line x1={px} y1={yPos} x2={w-px} y2={yPos} stroke="#e5e7eb" strokeWidth="1" />
            </g>
          );
        })}

        {type === 'mixed' ? (
          <>
            {/* Bars for Total */}
            {data.map((d, i) => {
              const barH = (d.total / maxVal) * ch;
              const xPos = getX(i);
              return (
                <g key={`bar-${i}`}>
                  <rect x={xPos - 20} y={py + ch - barH} width="40" height={barH} fill="#3b82f6" opacity="0.9" rx="2" />
                  <text x={xPos} y={py + ch - barH - 8} textAnchor="middle" fontSize="14" fill="#2563eb" fontWeight="bold">{d.total}</text>
                  <text x={xPos} y={h - 15} textAnchor="middle" fontSize="13" fill="#6b7280" fontWeight="bold">{d.year}년</text>
                </g>
              );
            })}

            {/* Line and Dots for Complaint */}
            {data.length > 1 && <polyline points={complaintPoints} fill="none" stroke="#ef4444" strokeWidth="3" />}
            {data.map((d, i) => (
              <g key={`dot-${i}`}>
                <circle cx={getX(i)} cy={getY(d.complaint)} r="6" fill="#ef4444" stroke="#ffffff" strokeWidth="2" />
                <text x={getX(i)} y={getY(d.complaint) - 12} textAnchor="middle" fontSize="14" fill="#dc2626" fontWeight="bold">{d.complaint}</text>
              </g>
            ))}
          </>
        ) : (
          <>
            {/* Line and Dots for Total */}
            {data.length > 1 && <polyline points={totalPoints} fill="none" stroke="#b91c1c" strokeWidth="2.5" />}
            {data.map((d, i) => (
              <g key={`total-dot-${i}`}>
                <circle cx={getX(i)} cy={getY(d.total)} r="4" fill="#b91c1c" />
                <text x={getX(i)} y={getY(d.total) - 10} textAnchor="middle" fontSize="13" fill="#b91c1c" fontWeight="bold">{d.total}</text>
                <text x={getX(i)} y={h - 15} textAnchor="middle" fontSize="13" fill="#6b7280" fontWeight="bold">{d.year}년</text>
              </g>
            ))}

            {/* Line and Dots for Complaint */}
            {data.length > 1 && <polyline points={complaintPoints} fill="none" stroke="#fca5a5" strokeWidth="2.5" />}
            {data.map((d, i) => (
              <g key={`comp-dot-${i}`}>
                <circle cx={getX(i)} cy={getY(d.complaint)} r="4" fill="#fca5a5" />
                <text x={getX(i)} y={getY(d.complaint) - 10} textAnchor="middle" fontSize="13" fill="#fca5a5" fontWeight="bold">{d.complaint}</text>
              </g>
            ))}
          </>
        )}

        {/* Legend */}
        <g transform={`translate(${w/2 - 80}, ${h - 2})`}>
          {type === 'mixed' ? (
            <>
              <rect x="0" y="-8" width="16" height="6" fill="#3b82f6" opacity="0.9" />
              <text x="22" y="-2" fontSize="12" fill="#4b5563" fontWeight="bold">A/S접수건수</text>
              <polyline points="95,-5 115,-5" fill="none" stroke="#ef4444" strokeWidth="2" />
              <circle cx="105" cy="-5" r="4" fill="#ef4444" />
              <text x="120" y="-2" fontSize="12" fill="#4b5563" fontWeight="bold">고객불만</text>
            </>
          ) : (
            <>
              <polyline points="0,-5 20,-5" fill="none" stroke="#b91c1c" strokeWidth="2" />
              <circle cx="10" cy="-5" r="4" fill="#b91c1c" />
              <text x="26" y="-2" fontSize="12" fill="#4b5563" fontWeight="bold">A/S접수건수</text>
              
              <polyline points="95,-5 115,-5" fill="none" stroke="#fca5a5" strokeWidth="2" />
              <circle cx="105" cy="-5" r="4" fill="#fca5a5" />
              <text x="120" y="-2" fontSize="12" fill="#4b5563" fontWeight="bold">고객불만</text>
            </>
          )}
        </g>
      </svg>
    </div>
  );
};

const HorizontalBarChart = ({ data, color }) => {
  if (!data || data.length === 0) return <div className="text-gray-400 text-sm py-4 text-center">데이터가 없습니다.</div>;
  const maxVal = Math.max(...data.map(d => d.value));

  return (
    <div className="space-y-2.5 w-full">
      {data.map((item, i) => (
        <div key={i} className="flex items-center text-xs">
          <div className="w-24 text-right pr-3 font-medium text-gray-700 truncate" title={item.label}>{item.label}</div>
          <div className="flex-1 flex items-center gap-2">
            <div
              className={`h-4 rounded-sm ${color || 'bg-blue-500'}`}
              style={{ width: `${maxVal > 0 ? (item.value / maxVal) * 100 : 0}%`, minWidth: item.value > 0 ? '4px' : '0' }}
            ></div>
            <span className="text-gray-600 font-bold w-6">{item.value}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

const ModelHorizontalBarChart = ({ data }) => {
  if (!data || data.length === 0) return <div className="text-sm text-gray-400 flex items-center justify-center h-full w-full">데이터가 없습니다.</div>;

  const maxVal = Math.max(...data.map(d => d.total));

  return (
    <div className="space-y-3 w-full px-2 h-full overflow-y-auto hide-scrollbar">
      {data.map((item, i) => (
        <div key={i} className="flex items-center text-xs">
          <div className="w-16 text-right pr-2 font-bold text-gray-700 truncate" title={item.label}>{item.label}</div>
          <div className="flex-1 flex items-center gap-1">
            <div 
              className="h-4 rounded-sm flex" 
              style={{ 
                width: `${maxVal > 0 ? (item.total / maxVal) * 100 : 0}%`, 
                minWidth: item.total > 0 ? '4px' : '0',
                backgroundColor: item.color 
              }}
            ></div>
            <span className="text-gray-900 font-bold w-8 text-left pl-1">{item.total}</span>
          </div>
        </div>
      ))}
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
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isCapsLockOn, setIsCapsLockOn] = useState(false);

  const [data, setData] = useState([]); 
  const [activeTab, setActiveTab] = useState('전체'); 
  const [dashboardTab, setDashboardTab] = useState('종합 지표');
  const [totalChartType, setTotalChartType] = useState('donut');
  const [modelChartType, setModelChartType] = useState({}); 
  const [buChartType, setBuChartType] = useState({}); 
  const [yearlyTabChartType, setYearlyTabChartType] = useState({}); 
  const [selectedDashboardStatus, setSelectedDashboardStatus] = useState('all');
  
  const [user, setUser] = useState(null);
  
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
  
  const [pendingUploadData, setPendingUploadData] = useState(null);
  const [showPtBoardModal, setShowPtBoardModal] = useState(false);
  
  const fileInputRef = useRef(null);

  const customAlert = (message) => setAlertMessage(message);
  const isQM = currentUserRole?.name === '품질경영팀';

  const todayStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  }, []);

  const handleLogin = (e) => {
    e.preventDefault();
    const role = ACCESS_ROLES[loginPassword];
    if (role) {
      setCurrentUserRole(role);
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
      if (!isQM && (activeTab === '전체' || activeTab === '휴지통' || activeTab === '보고서' || activeTab === '미입력')) {
        setActiveTab(currentUserRole.tabs[0]);
      } else if (currentUserRole.tabs !== 'ALL' && !currentUserRole.tabs.includes(activeTab) && activeTab !== '집계') {
        setActiveTab(currentUserRole.tabs[0]);
      }
    }
  }, [currentUserRole, activeTab, isQM]);

  useEffect(() => {
    setSelectedDashboardStatus('all');
  }, [activeTab]);

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
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
      
      const mappedRecords = records.map(d => {
        let bu = d.businessUnit;
        if (bu === 'UHP') {
          bu = (d.orderNumber || '').toUpperCase().startsWith('P3') ? 'PG' : 'SMT';
        }
        return { ...d, businessUnit: bu };
      });
      
      mappedRecords.sort((a, b) => {
        const numA = a.asNumber || '';
        const numB = b.asNumber || '';
        return numB.localeCompare(numA); 
      });
      setData(mappedRecords);
    }, (error) => console.error("Firestore Error:", error));
    return () => unsubscribe();
  }, [user]);

  const activeRecords = useMemo(() => data.filter(d => !d.deletedAt), [data]);
  const deletedRecords = useMemo(() => data.filter(d => d.deletedAt), [data]);

  const processedData = useMemo(() => {
    return activeRecords.map(item => ({
      ...item,
      receiptDate: formatDisplayDate(item.receiptDate),
      reqDeliveryDate: formatDisplayDate(item.reqDeliveryDate),
      processDate: formatDisplayDate(item.processDate),
      releaseDate: formatDisplayDate(item.releaseDate),
      complianceStatus: calculateCompliance(formatDisplayDate(item.reqDeliveryDate), formatDisplayDate(item.processDate)),
      duration: calculateDuration(formatDisplayDate(item.receiptDate), formatDisplayDate(item.processDate))
    }));
  }, [activeRecords]);

  const processedDeletedData = useMemo(() => {
    return deletedRecords.map(item => ({
      ...item,
      receiptDate: formatDisplayDate(item.receiptDate),
      reqDeliveryDate: formatDisplayDate(item.reqDeliveryDate),
      processDate: formatDisplayDate(item.processDate),
      releaseDate: formatDisplayDate(item.releaseDate),
      complianceStatus: calculateCompliance(formatDisplayDate(item.reqDeliveryDate), formatDisplayDate(item.processDate)),
      duration: calculateDuration(formatDisplayDate(item.receiptDate), formatDisplayDate(item.processDate))
    }));
  }, [deletedRecords]);

  // -------------------------------------------------------------
  // [집계 데이터 구성 로직] : 접수번호 1개 + 일반/고객불만별 1건 중복 방지 처리
  // -------------------------------------------------------------
  const uniqueClaimsData = useMemo(() => {
    const map = new Map();
    processedData.forEach(item => {
      const claim = item.claimType === '고객불만' ? '고객불만' : '일반 A/S';
      const key = item.asNumber ? `${item.asNumber.trim().toUpperCase()}_${claim}` : `doc_${item.id}_${claim}`;
      
      if (!map.has(key)) {
        map.set(key, {
          ...item,
          mergedCauses: new Set(item.causeAnalysisTypes || []),
          mergedProcesses: new Set(item.processDetailType ? [item.processDetailType] : [])
        });
      } else {
        const existing = map.get(key);
        (item.causeAnalysisTypes || []).forEach(c => existing.mergedCauses.add(c));
        if (item.processDetailType) existing.mergedProcesses.add(item.processDetailType);
      }
    });

    return Array.from(map.values()).map(item => ({
      ...item,
      causeAnalysisTypes: Array.from(item.mergedCauses),
      processDetailTypes: Array.from(item.mergedProcesses)
    }));
  }, [processedData]);

  const allowedProcessedData = useMemo(() => {
    if (!currentUserRole || currentUserRole.tabs === 'ALL') return uniqueClaimsData;
    return uniqueClaimsData.filter(item => currentUserRole.tabs.includes(item.businessUnit));
  }, [uniqueClaimsData, currentUserRole]);

  const currentYear = new Date().getFullYear();
  const targetYears = [String(currentYear - 2), String(currentYear - 1), String(currentYear)];

  const allowedAggOrder = useMemo(() => {
    const order = ['PMD', 'TMD', 'FLD', 'SMT', 'PG', 'PT (ZMDI)', 'PT (N)', 'UPT900'];
    if (!currentUserRole || currentUserRole.tabs === 'ALL') return order;
    return order.filter(bu => {
      if (bu.startsWith('PT')) return currentUserRole.tabs.includes('PT');
      return currentUserRole.tabs.includes(bu);
    });
  }, [currentUserRole]);

  const aggregatedStats = useMemo(() => {
    const stats = {};
    allowedAggOrder.forEach(unit => stats[unit] = { unit, normal: 0, complaint: 0 });

    allowedProcessedData.forEach(item => {
      let unit = item.businessUnit === 'PT' ? `PT (${item.ptBoardType === 'ZMDI' ? 'ZMDI' : 'N'})` : (item.businessUnit || '미분류');
      if (!stats[unit] && allowedAggOrder.includes(unit)) stats[unit] = { unit, normal: 0, complaint: 0 }; 
      if (stats[unit]) {
        if (item.claimType === '고객불만') stats[unit].complaint += 1;
        else stats[unit].normal += 1;
      }
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
      const indexA = allowedAggOrder.indexOf(a.unit);
      const indexB = allowedAggOrder.indexOf(b.unit);
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
  }, [allowedProcessedData, allowedAggOrder]);

  const allowedTrendUnits = useMemo(() => {
    if (!currentUserRole || currentUserRole.tabs === 'ALL') return TREND_UNITS;
    return TREND_UNITS.filter(bu => currentUserRole.tabs.includes(bu));
  }, [currentUserRole]);

  const yearlyStats = useMemo(() => {
    const stats = {};
    targetYears.forEach(y => {
       let histTotal = 0;
       let histComp = 0;
       let isHistorical = false;
       
       TREND_UNITS.forEach(bu => {
          if (HISTORICAL_YEARLY[bu]?.[y]) {
             histTotal += HISTORICAL_YEARLY[bu][y].total;
             histComp += HISTORICAL_YEARLY[bu][y].complaint;
             isHistorical = true;
          }
       });
       
       stats[y] = { year: y, total: histTotal, complaint: histComp, isHistorical };
    });

    allowedProcessedData.forEach(item => {
      if (!item.receiptDate) return;
      const year = getYearFromDate(item.receiptDate);
      if (!year || !targetYears.includes(year)) return;
      if (stats[year].isHistorical) return; 

      stats[year].total += 1;
      if (item.claimType === '고객불만') stats[year].complaint += 1;
    });

    return targetYears.map(y => ({ year: y, total: stats[y].total, complaint: stats[y].complaint }));
  }, [allowedProcessedData, targetYears, allowedTrendUnits]);

  const buYearlyStats = useMemo(() => {
    const stats = {};
    TREND_UNITS.forEach(bu => {
      stats[bu] = {};
      targetYears.forEach(y => {
        stats[bu][y] = { 
          year: y, 
          total: HISTORICAL_YEARLY[bu]?.[y]?.total || 0, 
          complaint: HISTORICAL_YEARLY[bu]?.[y]?.complaint || 0,
          isHistorical: !!HISTORICAL_YEARLY[bu]?.[y]
        };
      });
    });

    allowedProcessedData.forEach(item => {
      const unit = item.businessUnit || '미분류';
      if (!TREND_UNITS.includes(unit)) return;
      const year = getYearFromDate(item.receiptDate);
      if (!year || !targetYears.includes(year)) return;
      if (stats[unit][year].isHistorical) return;

      stats[unit][year].total += 1;
      if (item.claimType === '고객불만') stats[unit][year].complaint += 1;
    });

    const result = {};
    Object.keys(stats).forEach(bu => {
      result[bu] = targetYears.map(y => stats[bu][y]);
    });
    return result;
  }, [allowedProcessedData, targetYears, allowedTrendUnits]);

  const allowedFixedUnits = useMemo(() => {
    if (!currentUserRole || currentUserRole.tabs === 'ALL') return FIXED_UNITS_ORDER;
    return FIXED_UNITS_ORDER.filter(bu => currentUserRole.tabs.includes(bu));
  }, [currentUserRole]);

  const dashboardStats = useMemo(() => {
    const stats = {};
    allowedFixedUnits.forEach(bu => stats[bu] = { unit: bu, total: 0, models: {} });

    allowedProcessedData.forEach(item => {
      const bu = FIXED_UNITS_ORDER.includes(item.businessUnit) ? item.businessUnit : '기타사업부';
      if (!allowedFixedUnits.includes(bu)) return;

      const groupLabel = getModelGroup(item.businessUnit, item.model, item.ptBoardType);
      
      if (!stats[bu]) stats[bu] = { unit: bu, total: 0, models: {} };
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
      let ia = allowedFixedUnits.indexOf(a.unit);
      let ib = allowedFixedUnits.indexOf(b.unit);
      if (ia === -1) ia = 99; if (ib === -1) ib = 99;
      return ia - ib;
    });
  }, [allowedProcessedData, allowedFixedUnits]);

  const groupedCauseStats = useMemo(() => {
    const normalStats = {};
    const complaintStats = {};

    const groups = ['설치조건', '취급부주의', '품질보증기간', '영업 검토 미흡', '설계 미흡', '생산 불량', '품질 검사 미흡', '공급자 불량', '운송 중 충격', '원인분석 불가', '정상', '연구 및 개선', '기타'];
    groups.forEach(g => {
      normalStats[g] = 0;
      complaintStats[g] = 0;
    });

    allowedProcessedData.forEach(item => {
      if (Array.isArray(item.causeAnalysisTypes)) {
        item.causeAnalysisTypes.forEach(causeId => {
          const group = getCauseGroup(causeId);
          if (item.claimType === '고객불만') complaintStats[group] += 1;
          else normalStats[group] += 1;
        });
      }
    });

    const formatChartData = (statsObj) => {
      return Object.entries(statsObj)
        .filter(([_, value]) => value > 0)
        .sort((a, b) => b[1] - a[1])
        .map(([label, value], idx) => ({
          label,
          value,
          color: CHART_COLORS[idx % CHART_COLORS.length]
        }));
    };

    return {
      normalData: formatChartData(normalStats),
      complaintData: formatChartData(complaintStats)
    };
  }, [allowedProcessedData]);

  const causeAndProcessStats = useMemo(() => {
    const stats = {};
    allowedFixedUnits.forEach(bu => {
      stats[bu] = { unit: bu, totalCauses: 0, causes: {}, totalProcesses: 0, processes: {} };
    });

    allowedProcessedData.forEach(item => {
       const bu = allowedFixedUnits.includes(item.businessUnit) ? item.businessUnit : '기타사업부';
       if (!stats[bu]) return;

       if (Array.isArray(item.causeAnalysisTypes)) {
         item.causeAnalysisTypes.forEach(causeId => {
           const label = CAUSE_LABEL_MAP[causeId] || causeId;
           if (!stats[bu].causes[label]) stats[bu].causes[label] = 0;
           stats[bu].causes[label]++;
           stats[bu].totalCauses++;
         });
       }

       if (Array.isArray(item.processDetailTypes)) {
          item.processDetailTypes.forEach(pLabel => {
             if (!stats[bu].processes[pLabel]) stats[bu].processes[pLabel] = 0;
             stats[bu].processes[pLabel]++;
             stats[bu].totalProcesses++;
          });
       }
    });

    return Object.values(stats).map(buStat => {
       const causesArr = Object.entries(buStat.causes)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
       const processesArr = Object.entries(buStat.processes)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value);
       return { ...buStat, causesArr, processesArr };
    }).filter(buStat => buStat.totalCauses > 0 || buStat.totalProcesses > 0);
  }, [allowedProcessedData, allowedFixedUnits]);

  // -------------------------------------------------------------
  // [메인 테이블 조회용 데이터 탭 처리]
  // -------------------------------------------------------------
  const visibleBusinessUnits = useMemo(() => {
    if (!currentUserRole) return [];
    if (isQM) return ['전체', ...FIXED_UNITS_ORDER, '미입력', '집계'];
    return [...currentUserRole.tabs, '집계'];
  }, [currentUserRole, isQM]);
  
  const tabFilteredData = useMemo(() => {
    if (activeTab === '휴지통') return processedDeletedData;

    let baseData = processedData; 
    if (!isQM) {
      baseData = processedData.filter(item => currentUserRole?.tabs.includes(item.businessUnit));
    }

    if (activeTab === '전체' || activeTab === '집계' || activeTab === '보고서') return baseData;
    if (activeTab === '미입력') return baseData.filter(isIncomplete);

    return baseData.filter(item => {
      if (item.businessUnit !== activeTab) return false;
      if (activeTab === 'PT' && filterPtBoard !== 'all') {
        if (item.ptBoardType !== filterPtBoard) return false;
      }
      return true;
    });
  }, [processedData, processedDeletedData, activeTab, filterPtBoard, isQM, currentUserRole]);

  const agencies = ['all', ...Array.from(new Set(tabFilteredData.map(d => d.agencyName).filter(Boolean)))].sort();
  const models = ['all', ...Array.from(new Set(tabFilteredData.map(d => d.model).filter(Boolean)))].sort();

  const filteredData = useMemo(() => {
    return tabFilteredData.filter(item => {
      if (activeTab === '집계') return true; 
      
      if (selectedDashboardStatus !== 'all' && selectedDashboardStatus !== null) {
         const status = item.currentStatus || '접수 대기';
         if (status !== selectedDashboardStatus) return false;
      }

      if (filterAgency !== 'all' && item.agencyName !== filterAgency) return false;
      if (filterModel !== 'all' && item.model !== filterModel) return false;
      
      if (filterExcludeReport === 'exclude') {
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
        const serial = (item.serialNo || '').toLowerCase();

        const orderNumDigits = orderNum.replace(/\D/g, '');
        const asNumLast = asNum.split('-').pop() || '';
        const serialDigits = serial.replace(/\D/g, '');

        const isNormalMatch = 
          asNum.includes(query) || orderNum.includes(query) ||
          comp.includes(query) || agency.includes(query) || mod.includes(query) || serial.includes(query);

        const isDigitMatch = queryDigits.length > 0 && (
          orderNumDigits.includes(queryDigits) || asNumLast.includes(queryDigits) || serialDigits.includes(queryDigits)
        );

        return isNormalMatch || isDigitMatch;
      }
      return true;
    });
  }, [tabFilteredData, activeTab, filterAgency, filterModel, filterExcludeReport, searchQuery, selectedDashboardStatus]);

  const renderStatusBadge = (row) => {
    const status = row.currentStatus || '접수 대기';
    const config = DASHBOARD_CONFIG.find(c => c.status === status);
    const hexColor = config ? config.hex : '#D9D5D2';
    
    const badgeStyle = { backgroundColor: hexColor, color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.2)' };
    const delayedStyle = { backgroundColor: '#ef4444', color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.2)' };
    const onTimeStyle = { backgroundColor: '#10b981', color: '#fff', textShadow: '0 1px 1px rgba(0,0,0,0.2)' };

    if (status === '종결') {
      if (row.complianceStatus === '준수') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-sm" style={onTimeStyle}><CheckCircle2 className="w-3.5 h-3.5 mr-1" />준수</span>;
      if (row.complianceStatus === '지연') return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-sm" style={delayedStyle}><AlertCircle className="w-3.5 h-3.5 mr-1" />지연</span>;
      return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-sm" style={badgeStyle}><Archive className="w-3.5 h-3.5 mr-1" />종결</span>;
    }

    let Icon = config ? config.icon : Clock;
    return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold shadow-sm" style={badgeStyle}><Icon className="w-3.5 h-3.5 mr-1" />{status}</span>;
  };

  const handleOpenForm = (record = null) => {
    if (record) {
      setFormData({ 
        ptBoardType: 'N', claimType: '일반 A/S', repairMethod: '', 
        causeAnalysisTypes: [], processDetailType: '',
        ...record 
      });
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
        processType: '', cost: '', ptBoardType: 'N',
        claimType: '일반 A/S', repairMethod: '',
        causeAnalysisTypes: [], processDetailType: '',
        currentStatus: '접수 대기'
      });
    }
    setIsFormOpen(true);
  };

  const handleFormChange = (e) => {
    const { name, value, type } = e.target;
    let finalValue = value;
    
    if (type === 'date' && value) {
      const [y, m, d] = value.split('-');
      finalValue = `${y.slice(2)}.${m}.${d}`;
    }

    setFormData(prev => {
      const newData = { ...prev, [name]: finalValue };
      if (name === 'orderNumber') {
        const orderNum = finalValue.toUpperCase();
        if (orderNum.startsWith('P1')) newData.businessUnit = 'PMD';
        else if (orderNum.startsWith('UHP')) newData.businessUnit = 'SMT';
        else if (orderNum.startsWith('P3')) newData.businessUnit = 'PG';
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

  const handleCauseCheckbox = (id) => {
    setFormData(prev => {
      const types = prev.causeAnalysisTypes || [];
      if (types.includes(id)) {
        return { ...prev, causeAnalysisTypes: types.filter(t => t !== id) };
      } else {
        return { ...prev, causeAnalysisTypes: [...types, id] };
      }
    });
  };

  const handleFormSubmitInternal = async (e) => {
    e.preventDefault();
    if (!user) {
      customAlert('데이터베이스에 연결 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }

    const docId = String(formData.id || Date.now());
    await setDoc(doc(db, getCollectionPath(), docId), { ...formData, id: docId });
    setIsFormOpen(false);
  };

  const handleDeletePrepare = (id, e) => {
    if (e) e.stopPropagation();
    setItemToDelete(id);
  };

  const executeDelete = async () => {
    if (!user || !itemToDelete || !isQM) return;
    await updateDoc(doc(db, getCollectionPath(), String(itemToDelete)), { deletedAt: Date.now() });
    setItemToDelete(null);
    setSelectedRow(null);
  };

  const handlePermanentDeletePrepare = (id, e) => {
    if (e) e.stopPropagation();
    setItemToPermanentDelete(id);
  };

  const executePermanentDelete = async () => {
    if (!user || !itemToPermanentDelete || !isQM) return;
    await deleteDoc(doc(db, getCollectionPath(), String(itemToPermanentDelete)));
    setItemToPermanentDelete(null);
    setSelectedRow(null);
  };

  const handleRestore = async (id, e) => {
    if (e) e.stopPropagation();
    if (!user || !isQM) return;
    await updateDoc(doc(db, getCollectionPath(), String(id)), { deletedAt: null });
    setSelectedRow(null);
    customAlert('데이터가 성공적으로 복구되었습니다.');
  };

  const handlePtBoardTypeChange = (id, newType) => {
    setPendingUploadData(prev => 
      prev.map(item => item.id === id ? { ...item, ptBoardType: newType } : item)
    );
  };

  const executeUpload = (records) => {
    if (!user) {
      customAlert('데이터베이스 연결이 안되어 업로드할 수 없습니다.');
      return;
    }
    records.forEach(async (record) => {
      await setDoc(doc(db, getCollectionPath(), String(record.id)), record);
    });
    customAlert(`${records.length}건의 데이터를 성공적으로 업로드 중입니다.`);
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
      let hasPT = false;

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
          else repairMethod = '';

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
            else if (orderNum.startsWith('UHP')) bu = 'SMT';
            else if (orderNum.startsWith('P3')) bu = 'PG';
            else if (orderNum.startsWith('P4')) bu = 'PT';
            else if (orderNum.startsWith('T')) bu = 'TMD';
            else if (orderNum.startsWith('F')) bu = 'FLD'; 
          }

          if (bu === 'PT') hasPT = true;

          let ptBoard = '';
          if (!hasBUColumnAt2 && cols[26]) ptBoard = cols[26].trim();
          if (!ptBoard) ptBoard = (bu === 'PT' ? defaultPtBoard : 'N');

          let defectContent = cols[6 + offset] ? cols[6 + offset].trim() : '';
          let qtyDefect = parseInt(cols[5 + offset]) || 1;

          if (defectContent.includes('성적서 발행') || defectContent.includes('성적서발행')) {
            if (cost === null || cost === 0) cost = qtyDefect * 1000;
            if (!repairMethod || repairMethod === '') repairMethod = '유상수리';
          }

          let receiptDate = formatDisplayDate(cols[13 + offset] ? cols[13 + offset].trim() : '');
          let reqDeliveryDate = formatDisplayDate(cols[14 + offset] ? cols[14 + offset].trim() : '');
          let processDate = formatDisplayDate(cols[15 + offset] ? cols[15 + offset].trim() : '');
          let releaseDate = formatDisplayDate(cols[8 + offset] ? cols[8 + offset].trim() : '');

          if (receiptDate && !reqDeliveryDate) {
            reqDeliveryDate = addBusinessDays(receiptDate, 5);
          }
          
          let currentStatus = '접수 대기';
          if (processDate) currentStatus = '종결';
          else if (processType) currentStatus = '수리 중';

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
            releaseDate: releaseDate,
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
            causeAnalysisTypes: [],
            processDetailType: '',
            currentStatus: currentStatus,
            deletedAt: null 
          });
        }
      }
      
      if(newRecords.length > 0) {
         if (hasPT) {
           setPendingUploadData(newRecords);
           setShowPtBoardModal(true);
         } else {
           executeUpload(newRecords);
         }
      } else {
         customAlert('업로드할 유효한 데이터 항목을 찾지 못했습니다.');
      }
    };
    
    reader.readAsText(file, 'euc-kr');
    e.target.value = null;
  };

  const handleCopyChart = (containerId) => {
    const el = document.getElementById(containerId);
    if (!el) return;
    
    const clone = el.cloneNode(true);
    const btns = clone.querySelectorAll('button');
    btns.forEach(btn => btn.remove());

    const html = clone.outerHTML;
    const text = clone.innerText;

    if (navigator.clipboard && window.ClipboardItem) {
      try {
        const htmlBlob = new Blob([html], { type: 'text/html' });
        const textBlob = new Blob([text], { type: 'text/plain' });
        const item = new window.ClipboardItem({
          'text/html': htmlBlob,
          'text/plain': textBlob
        });
        navigator.clipboard.write([item]).then(() => {
          customAlert('그래프가 클립보드에 복사되었습니다.');
        }).catch(() => fallbackCopy(text));
      } catch (e) {
        fallbackCopy(text);
      }
    } else {
      fallbackCopy(text);
    }
  };

  const fallbackCopy = (text) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      customAlert('그래프가 클립보드에 텍스트로 복사되었습니다.');
    } catch (err) {}
    document.body.removeChild(textArea);
  };

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredData.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / itemsPerPage) || 1;
  const maxVisiblePages = 5;
  const currentBlock = Math.ceil(currentPage / maxVisiblePages) || 1;
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
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6"><Lock className="w-8 h-8 text-blue-600" /></div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">A/S 관리대장 로그인</h1>
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
                className="w-full px-4 py-3 border rounded-xl text-center text-lg tracking-widest focus:ring-2 focus:ring-blue-500"
                required
              />
              {isCapsLockOn && (
                <p className="text-orange-500 text-sm font-bold mt-2 animate-pulse">
                  캡스락(Caps Lock)을 풀어주세요.
                </p>
              )}
            </div>
            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}
            <button type="submit" className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition-colors shadow-sm">시스템 접속</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 font-sans text-gray-900">
      <div className="max-w-[1400px] mx-auto space-y-6">
        
        {/* 헤더 */}
        <header className="flex items-center justify-between bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h1 className="text-2xl font-bold flex items-center gap-2"><FileText className="text-blue-600" /> A/S 처리 관리대장</h1>
          <div className="flex gap-2">
            <input type="file" accept=".csv" ref={fileInputRef} onChange={importFromCSV} className="hidden" />
            <button onClick={handleLogout} className="px-4 py-2 bg-red-50 text-red-600 rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-red-100"><LogOut className="w-4 h-4" /> 로그아웃</button>
          </div>
        </header>

        {/* 탭 & 대시보드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex border-b border-gray-200 overflow-x-auto hide-scrollbar px-2">
            {visibleBusinessUnits.map(unit => (
              <button key={unit} onClick={() => { setActiveTab(unit); setCurrentPage(1); }} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === unit ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>{unit}</button>
            ))}
            {isQM && (
              <>
                <button onClick={() => setActiveTab('보고서')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === '보고서' ? 'border-gray-800 text-gray-900 bg-gray-50' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>보고서</button>
                <button onClick={() => setActiveTab('휴지통')} className={`px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${activeTab === '휴지통' ? 'border-gray-800 text-gray-900 bg-gray-50' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>휴지통 (3일)</button>
              </>
            )}
          </div>

          {activeTab !== '집계' && activeTab !== '휴지통' && activeTab !== '보고서' && (
            <div className="p-4 bg-gray-50/50 border-b border-gray-200 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {DASHBOARD_CONFIG.map(config => {
                  const count = getUniqueCount(tabFilteredData, config.status);
                  const isSelected = selectedDashboardStatus === (config.status === '전체' ? 'all' : config.status);
                  return (
                    <div key={config.status} onClick={() => setSelectedDashboardStatus(config.status === '전체' ? 'all' : config.status)} className="p-3 bg-white rounded-xl border-2 cursor-pointer transition-all" style={{ borderColor: config.hex, boxShadow: isSelected ? `0 0 10px ${config.hex}50` : 'none', transform: isSelected ? 'scale(1.03)' : 'none' }}>
                      <div className="flex items-center gap-2 mb-1">
                        <config.icon className="w-4 h-4" style={{ color: config.hex }} />
                        <span className="text-[11px] font-bold text-gray-500">{config.label}</span>
                      </div>
                      <div className="text-xl font-black">{count}<span className="text-xs ml-0.5 text-gray-400">건</span></div>
                    </div>
                  );
                })}
              </div>

              {/* 상세 필터 */}
              <div className="flex flex-wrap items-center gap-5 text-sm pt-2">
                <div className="flex items-center gap-2"><Search className="w-4 h-4 text-gray-400" /> <input type="text" placeholder="접수번호, 대리점, 모델 검색..." className="border rounded-md px-3 py-1.5 w-60 focus:ring-2 focus:ring-blue-500" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} /></div>
                <div className="flex items-center gap-2"><span>대리점:</span> <select value={filterAgency} onChange={e => setFilterAgency(e.target.value)} className="border rounded-md px-2 py-1.5 w-40">{agencies.map(a => <option key={a} value={a}>{a === 'all' ? '전체 대리점' : a}</option>)}</select></div>
                <div className="flex items-center gap-2"><span>모델명:</span> <select value={filterModel} onChange={e => setFilterModel(e.target.value)} className="border rounded-md px-2 py-1.5 w-40">{models.map(m => <option key={m} value={m}>{m === 'all' ? '전체 모델' : m}</option>)}</select></div>
                <div className="flex items-center gap-3 border-l pl-4 border-gray-300">
                  <span className="font-bold text-gray-600">성적서 건:</span>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="rpt" checked={filterExcludeReport === 'all'} onChange={() => setFilterExcludeReport('all')} /> 포함</label>
                  <label className="flex items-center gap-1 cursor-pointer"><input type="radio" name="rpt" checked={filterExcludeReport === 'exclude'} onChange={() => setFilterExcludeReport('exclude')} /> 제외</label>
                </div>
                
                <div className="ml-auto">
                   <button onClick={() => handleOpenForm()} className="px-4 py-1.5 bg-blue-600 text-white rounded-lg font-bold text-sm flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-sm"><Plus className="w-4 h-4" /> 새 데이터 추가</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 메인 내용: 집계 화면 또는 데이터 테이블 */}
        {activeTab === '집계' ? (
          <div className="space-y-6 animate-in fade-in duration-500">
            {/* 집계 서브 탭 */}
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              {['종합 지표', '모델별 현황', '원인별 분석', '년도별 현황'].map(tab => (
                 <button key={tab} onClick={() => setDashboardTab(tab)} className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${dashboardTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{tab}</button>
              ))}
            </div>

            {dashboardTab === '종합 지표' && (
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                 <div className="bg-white p-6 rounded-xl border border-gray-200 flex flex-col items-center shadow-sm relative group">
                    <div className="flex justify-between items-start w-full mb-6">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <PieChart className="w-5 h-5 text-blue-600" /> 전체 A/S 종합 현황
                      </h3>
                      <div className="flex bg-gray-100 p-0.5 rounded-md relative z-10 shrink-0">
                        <button onClick={() => setTotalChartType('donut')} className={`p-1.5 rounded ${totalChartType === 'donut' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="도넛 차트 보기"><PieChart className="w-4 h-4" /></button>
                        <button onClick={() => setTotalChartType('trend')} className={`p-1.5 rounded ${totalChartType === 'trend' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="연도별 트렌드 보기"><TrendingUp className="w-4 h-4" /></button>
                      </div>
                    </div>
                    
                    <div className="flex-1 flex flex-col items-center justify-center w-full relative z-0">
                      {totalChartType === 'donut' ? (
                        <DonutChart normal={aggregatedStats.reduce((a,c) => a+c.normal, 0)} complaint={aggregatedStats.reduce((a,c) => a+c.complaint, 0)} size={180} strokeWidth={16} />
                      ) : (
                        <YearlyTrendChart data={yearlyStats} type="mixed" />
                      )}
                    </div>

                    {totalChartType === 'donut' && (
                      <div className="w-full mt-8 space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-blue-500"></span><span className="font-medium text-gray-700">일반 A/S</span></div>
                          <span className="font-bold text-gray-900">{aggregatedStats.reduce((a,c) => a+c.normal, 0)}건</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="font-medium text-gray-700">고객불만</span></div>
                          <span className="font-bold text-red-600">{aggregatedStats.reduce((a,c) => a+c.complaint, 0)}건</span>
                        </div>
                      </div>
                    )}
                 </div>
                 
                 <div className="lg:col-span-3 bg-white p-6 rounded-xl border border-gray-200 shadow-sm relative group" id="sub-chart-container">
                    <h3 className="font-bold mb-8 flex items-center gap-2 text-gray-600"><BarChart3 className="w-5 h-5" /> 사업부별 상세 비율</h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                       {aggregatedStats.filter(s => !s.isTotal).map(stat => (
                         <div key={stat.unit} className="flex flex-col items-center p-4 border rounded-xl hover:shadow-lg transition-all bg-gray-50/30">
                            <div className="w-full flex justify-between items-center pb-3 mb-4 border-b border-gray-100">
                              <h4 className="font-bold text-gray-800 text-sm">{stat.unit}</h4>
                              <div className="flex bg-gray-50 p-0.5 rounded-md relative z-10 shrink-0">
                                <button onClick={() => setBuChartType(prev => ({...prev, [stat.unit]: 'donut'}))} className={`p-1 rounded ${buChartType[stat.unit] !== 'trend' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="도넛 차트 보기"><PieChart className="w-3 h-3" /></button>
                                <button onClick={() => setBuChartType(prev => ({...prev, [stat.unit]: 'trend'}))} className={`p-1 rounded ${buChartType[stat.unit] === 'trend' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="연도별 트렌드 보기"><TrendingUp className="w-3 h-3" /></button>
                              </div>
                            </div>

                            <div className="flex-1 flex w-full items-center justify-center min-h-[120px] relative z-0">
                              {buChartType[stat.unit] === 'trend' ? (
                                <YearlyTrendChart data={buYearlyStats[stat.unit] || []} heightClass="h-[120px]" type="mixed" />
                              ) : (
                                <DonutChart normal={stat.normal} complaint={stat.complaint} size={110} strokeWidth={12} />
                              )}
                            </div>

                            {buChartType[stat.unit] !== 'trend' && (
                              <div className="w-full mt-4 space-y-2 text-xs">
                                <div className="flex justify-between items-center bg-blue-50/50 px-2 py-1.5 rounded text-blue-900">
                                  <span className="font-medium">일반</span>
                                  <span className="font-bold">{stat.normal}건 <span className="text-blue-600 font-normal">({stat.normalRate}%)</span></span>
                                </div>
                                <div className="flex justify-between items-center bg-red-50/50 px-2 py-1.5 rounded text-red-900">
                                  <span className="font-medium">불만</span>
                                  <span className="font-bold text-red-600">{stat.complaint}건 <span className="text-red-500 font-normal">({stat.complaintRate}%)</span></span>
                                </div>
                              </div>
                            )}
                         </div>
                       ))}
                    </div>
                    <button onClick={() => handleCopyChart('sub-chart-container')} className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4" /></button>
                 </div>
              </div>
            )}

            {dashboardTab === '모델별 현황' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                {dashboardStats.map(buStat => (
                  <div key={buStat.unit} id={`model-chart-${buStat.unit}`} className="bg-white rounded-xl border p-6 flex flex-col items-center shadow-sm relative group">
                    <div className="flex justify-between items-center w-full mb-6 border-b border-gray-100 pb-4">
                      <h3 className="text-sm font-bold text-gray-800 text-center">{buStat.unit} 모델군 집계</h3>
                      <div className="flex bg-gray-100 p-0.5 rounded-md relative z-10 shrink-0">
                        <button onClick={() => setModelChartType(prev => ({...prev, [buStat.unit]: 'donut'}))} className={`p-1 rounded ${modelChartType[buStat.unit] !== 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="도넛 차트 보기"><PieChart className="w-3.5 h-3.5" /></button>
                        <button onClick={() => setModelChartType(prev => ({...prev, [buStat.unit]: 'bar'}))} className={`p-1 rounded ${modelChartType[buStat.unit] === 'bar' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="가로 막대 차트 보기"><BarChart3 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                    
                    <div className="flex justify-center mb-8 w-full h-[180px] items-center relative z-0">
                      {modelChartType[buStat.unit] === 'bar' ? (
                        <ModelHorizontalBarChart data={buStat.modelsArr} />
                      ) : (
                        <MultiDonutChart data={buStat.modelsArr.map(m => ({ label: m.label, value: m.total, color: m.color }))} size={160} strokeWidth={22} />
                      )}
                    </div>
                    
                    <div className="w-full mt-2 space-y-1.5 overflow-y-auto max-h-40 hide-scrollbar">
                      {buStat.modelsArr.map(m => (
                        <div key={m.label} className="flex justify-between text-[11px] px-2 py-1.5 bg-gray-50 rounded">
                          <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{backgroundColor: m.color}}></span>{m.label}</span>
                          <span className="font-bold">{m.total}건</span>
                        </div>
                      ))}
                    </div>
                    <button onClick={() => handleCopyChart(`model-chart-${buStat.unit}`)} className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            )}

            {dashboardTab === '원인별 분석' && (
              <div className="space-y-6">
                <div id="grouped-cause-chart" className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative group">
                  <h3 className="text-lg font-bold text-gray-900 mb-6 text-center border-b border-gray-100 pb-4">전체 원인 분석 요약</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="flex flex-col items-center">
                      <h4 className="text-sm font-bold text-gray-700 mb-6 bg-gray-50 px-4 py-2 rounded-md w-full text-center">일반 A/S 원인 분석</h4>
                      <MultiDonutChart data={groupedCauseStats.normalData} size={200} strokeWidth={28} />
                      <div className="w-full mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-xs px-4">
                        {groupedCauseStats.normalData.map(d => (
                          <div key={d.label} className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: d.color}}></span><span className="text-gray-600 truncate">{d.label}</span></div><span className="font-bold text-gray-900">{d.value}</span></div>
                        ))}
                      </div>
                    </div>
                    <div className="flex flex-col items-center">
                      <h4 className="text-sm font-bold text-red-700 mb-6 bg-red-50 px-4 py-2 rounded-md w-full text-center">고객불만 원인 분석</h4>
                      <MultiDonutChart data={groupedCauseStats.complaintData} size={200} strokeWidth={28} />
                      <div className="w-full mt-6 grid grid-cols-2 gap-x-4 gap-y-2 text-xs px-4">
                        {groupedCauseStats.complaintData.map(d => (
                          <div key={d.label} className="flex items-center justify-between"><div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{backgroundColor: d.color}}></span><span className="text-gray-600 truncate">{d.label}</span></div><span className="font-bold text-gray-900">{d.value}</span></div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleCopyChart('grouped-cause-chart')} className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4" /></button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {causeAndProcessStats.map(buStat => (
                    <div key={buStat.unit} id={`cause-chart-${buStat.unit}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative group">
                      <h3 className="text-lg font-bold text-gray-900 mb-4 text-center border-b border-gray-100 pb-4">{buStat.unit} 상세 집계</h3>
                      <div className="space-y-6 flex-1">
                        <div>
                          <div className="text-sm font-bold text-gray-700 bg-gray-50 px-3 py-2 rounded-md mb-3">원인 분석 (상위 항목)</div>
                          <HorizontalBarChart data={buStat.causesArr} color="bg-indigo-500" />
                        </div>
                        <div className="pt-4 border-t border-gray-100">
                          <div className="text-sm font-bold text-gray-700 bg-gray-50 px-3 py-2 rounded-md mb-3">처리 내역</div>
                          <HorizontalBarChart data={buStat.processesArr} color="bg-teal-500" />
                        </div>
                      </div>
                      <button onClick={() => handleCopyChart(`cause-chart-${buStat.unit}`)} className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"><Copy className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {dashboardTab === '년도별 현황' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {allowedTrendUnits.map(bu => {
                  const unitData = buYearlyStats[bu] || [];
                  return (
                    <div key={bu} id={`yearly-chart-${bu}`} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col relative group">
                      <div className="flex justify-between items-center w-full mb-6 border-b border-gray-100 pb-4">
                        <h3 className="text-lg font-bold text-gray-900">
                          {bu} 사업부
                        </h3>
                        <div className="flex bg-gray-100 p-0.5 rounded-md relative z-10 shrink-0">
                          <button onClick={() => setYearlyTabChartType(prev => ({...prev, [bu]: 'line'}))} className={`p-1 rounded ${yearlyTabChartType[bu] !== 'mixed' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="다중 꺾은선 차트 보기"><LineChart className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setYearlyTabChartType(prev => ({...prev, [bu]: 'mixed'}))} className={`p-1 rounded ${yearlyTabChartType[bu] === 'mixed' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-400 hover:text-gray-600'}`} title="막대-꺾은선 혼합 차트 보기"><TrendingUp className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                      
                      <div className="flex-1 flex flex-col items-center justify-center w-full relative z-0">
                        <YearlyTrendChart data={unitData} type={yearlyTabChartType[bu] === 'mixed' ? 'mixed' : 'line'} />
                      </div>
                      
                      <button onClick={() => handleCopyChart(`yearly-chart-${bu}`)} className="absolute bottom-4 right-4 p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-md opacity-0 group-hover:opacity-100 transition-opacity" title="차트 복사"><Copy className="w-4 h-4" /></button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === '보고서' && isQM ? (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10 animate-in fade-in duration-300">
             <h2 className="text-2xl font-bold text-gray-900 mb-2">데이터 백업 및 내보내기</h2>
             <p className="text-gray-500 mb-8">현재 필터 조건에 맞는 <span className="font-bold text-blue-600">{filteredData.length}건</span>의 데이터를 백업할 수 있습니다.</p>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                <div onClick={() => fileInputRef.current.click()} className="p-8 border rounded-2xl hover:border-blue-500 hover:shadow-lg cursor-pointer bg-white group flex flex-col items-center">
                  <div className="w-14 h-14 bg-blue-50 rounded-full flex items-center justify-center mb-3"><Upload className="w-6 h-6 text-blue-600" /></div>
                  <h3 className="font-bold">CSV 업로드</h3>
                </div>
                <div onClick={exportToExcel} className="p-8 border rounded-2xl hover:border-green-500 hover:shadow-lg cursor-pointer bg-white group flex flex-col items-center">
                  <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mb-3"><FileSpreadsheet className="w-6 h-6 text-green-600" /></div>
                  <h3 className="font-bold">Excel 다운로드</h3>
                </div>
                <div onClick={exportToCSV} className="p-8 border rounded-2xl hover:border-gray-400 hover:shadow-md cursor-pointer bg-gray-50 group flex flex-col items-center">
                  <div className="w-14 h-14 bg-gray-200 rounded-full flex items-center justify-center mb-3"><Download className="w-6 h-6 text-gray-600" /></div>
                  <h3 className="font-bold">CSV 다운로드</h3>
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
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
             <div className="overflow-x-auto">
               <table className="min-w-full divide-y divide-gray-200">
                 <thead className="bg-gray-50 text-[11px] font-bold text-gray-500 uppercase tracking-wider border-b">
                   <tr>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">사업부</th>
                     <th scope="col" className="px-4 py-3 text-center whitespace-nowrap">상태</th>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">접수번호</th>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">수주번호</th>
                     <th scope="col" className="px-2 py-3 text-left whitespace-nowrap">대리점</th>
                     <th scope="col" className="px-2 py-3 text-left whitespace-nowrap">업체명</th>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">모델명</th>
                     <th scope="col" className="px-4 py-3 text-right whitespace-nowrap">수량</th>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">하자내용</th>
                     <th scope="col" className="px-2 py-3 text-left whitespace-nowrap">기존 주문정보</th>
                     <th scope="col" className="px-2 py-3 text-left whitespace-nowrap">처리방식</th>
                     <th scope="col" className="px-2 py-3 text-right whitespace-nowrap">처리방법</th>
                     <th scope="col" className="px-4 py-3 text-left whitespace-nowrap">일정</th>
                     <th scope="col" className="px-4 py-3 text-center whitespace-nowrap">관리</th>
                   </tr>
                 </thead>
                 <tbody className="bg-white divide-y divide-gray-100">
                   {paginatedData.length > 0 ? (
                     paginatedData.map((row) => (
                       <tr key={row.id} onClick={() => setSelectedRow(row)} className="hover:bg-blue-50/50 transition-colors cursor-pointer text-sm">
                         <td className="px-4 py-3 font-medium text-gray-900">{row.businessUnit}</td>
                         <td className="px-4 py-3 text-center">{renderStatusBadge(row)}</td>
                         <td className="px-4 py-3 text-blue-600 font-bold">{row.asNumber}</td>
                         <td className="px-4 py-3 text-gray-500">{row.orderNumber}</td>
                         <td className="px-2 py-3 text-gray-900 max-w-[120px] truncate" title={row.agencyName}>{row.agencyName}</td>
                         <td className="px-2 py-3 text-gray-500 max-w-[120px] truncate" title={row.companyName}>{row.companyName}</td>
                         <td className="px-4 py-3 font-bold">{row.model}</td>
                         <td className="px-4 py-3 text-right">{row.qtyDefect}</td>
                         <td className="px-4 py-3 text-gray-500 max-w-[150px] truncate">
                           <span className="inline-block px-1.5 py-0.5 bg-gray-100 text-gray-600 text-[10px] rounded mr-1 mb-1">{row.claimType || '일반 A/S'}</span>
                           <div className="truncate" title={row.defectContent}>{row.defectContent || '-'}</div>
                         </td>
                         <td className="px-2 py-3">
                           <div className="flex flex-col gap-1 text-xs">
                             <div className="flex items-center"><span className="text-gray-400 w-8">S/N:</span> <span className="text-gray-900 max-w-[100px] truncate" title={row.serialNo}>{row.serialNo || '-'}</span></div>
                             <div className="flex items-center"><span className="text-gray-400 w-8">출고:</span> <span className="text-gray-900">{row.releaseDate || '-'}</span></div>
                             <div className="flex items-center"><span className="text-gray-400 w-8">수주:</span> <span className="text-gray-900 max-w-[100px] truncate" title={row.originalOrderNumber}>{row.originalOrderNumber || '-'}</span></div>
                           </div>
                         </td>
                         <td className="px-2 py-3 text-xs text-gray-500">{row.processType || '-'}</td>
                         <td className="px-2 py-3 text-xs text-right align-middle">
                           {row.repairMethod === '유상수리' ? (
                             <div>
                               <span className="font-medium text-blue-700">{row.repairMethod}</span>
                               <span className="block text-gray-500">₩ {row.cost != null && row.cost !== '' ? Number(row.cost).toLocaleString() : '0'}</span>
                             </div>
                           ) : (
                             <span className="font-medium text-gray-700">{row.repairMethod || '-'}</span>
                           )}
                         </td>
                         <td className="px-4 py-3">
                           <div className="flex flex-col gap-1 text-xs">
                             <div className="flex items-center"><span className="text-gray-400 w-8">접수:</span> <span className="text-gray-900">{row.receiptDate}</span></div>
                             <div className="flex items-center"><span className="text-gray-400 w-8">요구:</span> <span className="text-red-500 font-bold">{row.reqDeliveryDate}</span></div>
                             <div className="flex items-center"><span className="text-gray-400 w-8">납기:</span> <span className="text-gray-900">{row.processDate || '-'}</span></div>
                             <div className="flex items-center"><span className="text-gray-400 w-8">소요:</span> <span className="text-gray-900">{row.duration}</span></div>
                           </div>
                         </td>
                         <td className="px-4 py-3 text-center align-middle whitespace-nowrap">
                           <div className="flex items-center justify-center gap-1">
                              <button onClick={e => { e.stopPropagation(); handleOpenForm(row); }} className="p-1.5 hover:bg-blue-100 rounded-md text-blue-600 transition-colors"><Edit className="w-4 h-4" /></button>
                              {isQM && <button onClick={e => { e.stopPropagation(); handleDeletePrepare(row.id); }} className="p-1.5 hover:bg-red-100 rounded-md text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>}
                           </div>
                         </td>
                       </tr>
                     ))
                   ) : (
                     <tr>
                       <td colSpan="14" className="px-6 py-12 text-center text-gray-500">조건에 맞는 데이터가 없습니다. 필터를 변경해보세요.</td>
                     </tr>
                   )}
                 </tbody>
               </table>
             </div>
             
             {/* 페이지네이션 */}
             {filteredData.length > 0 && (
               <div className="p-4 bg-white border-t flex items-center justify-between text-sm text-gray-600">
                  <span>총 <strong>{filteredData.length}</strong>건</span>
                  <div className="flex gap-2">
                     <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all font-medium">이전</button>
                     <div className="flex gap-1 overflow-x-auto max-w-[200px] md:max-w-none hide-scrollbar">
                        {currentBlock > 1 && <button onClick={() => setCurrentPage(startPage - 1)} className="px-2 py-1.5 text-gray-500 hover:text-gray-700 bg-white font-bold">...</button>}
                        {visiblePages.map(page => (
                          <button key={page} onClick={() => setCurrentPage(page)} className={`px-3 py-1.5 border rounded-md text-sm font-medium ${currentPage === page ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-300 text-gray-700 bg-white hover:bg-gray-50'}`}>{page}</button>
                        ))}
                        {endPage < totalPages && <button onClick={() => setCurrentPage(endPage + 1)} className="px-2 py-1.5 text-gray-500 hover:text-gray-700 bg-white font-bold">...</button>}
                     </div>
                     <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="px-3 py-1.5 border rounded-lg hover:bg-gray-50 disabled:opacity-30 transition-all font-medium">다음</button>
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
              <div className="bg-gray-50 p-4 rounded-xl flex items-center justify-between border border-gray-100">
                <div>
                  <div className="text-sm text-gray-500 mb-1">현재 상태</div>
                  <div className="flex items-center gap-3">
                    {renderStatusBadge(selectedRow)}
                    <span className="text-sm font-medium text-gray-900">{selectedRow.processType || '미처리'}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-gray-500 mb-1">납기 일정</div>
                  <div className="text-sm font-medium text-gray-900">요구: <span className="text-red-600">{selectedRow.reqDeliveryDate}</span> / 완료: {selectedRow.processDate || '미정'}</div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3 border-b pb-2">기본 정보</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <DetailItem label="사업부" value={selectedRow.businessUnit === 'PT' ? `${selectedRow.businessUnit} (${selectedRow.ptBoardType || 'N'})` : selectedRow.businessUnit} />
                  <DetailItem label="대리점명" value={selectedRow.agencyName} />
                  <DetailItem label="업체명" value={selectedRow.companyName} />
                  <DetailItem label="접수번호" value={selectedRow.asNumber} />
                  <DetailItem label="수주번호" value={selectedRow.orderNumber} />
                  <DetailItem label="접수일" value={selectedRow.receiptDate} />
                </div>
              </div>

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
                    <div className="text-sm font-bold text-gray-800">처리 결과: <span className="text-blue-700 ml-2">{selectedRow.repairMethod || '-'}</span></div>
                    {selectedRow.repairMethod === '유상수리' && <div className="text-sm font-bold text-gray-900 bg-white px-3 py-1.5 rounded border border-gray-200 shadow-sm">청구 금액: ₩ {selectedRow.cost != null && selectedRow.cost !== '' ? Number(selectedRow.cost).toLocaleString() : '0'}</div>}
                  </div>
                </div>
              </div>
            </div>

            <div className={`px-6 py-4 border-t border-gray-100 bg-gray-50 flex ${isQM ? 'justify-between' : 'justify-end'} shrink-0 rounded-b-2xl`}>
              {isQM && <button onClick={() => handleDeletePrepare(selectedRow.id)} className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center text-sm font-medium"><Trash2 className="w-4 h-4 mr-2" /> 삭제</button>}
              <div className="flex gap-2">
                <button onClick={() => handleOpenForm(selectedRow)} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center text-sm font-medium"><Edit className="w-4 h-4 mr-2" /> 이 데이터 수정하기</button>
                <button onClick={() => setSelectedRow(null)} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors text-sm font-medium">닫기</button>
              </div>
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

            <form onSubmit={handleFormSubmitInternal} className="flex-1 overflow-y-auto p-6 space-y-6">
               <div className="mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <label className="block text-sm font-bold text-gray-700 mb-3">진행 상태</label>
                  <div className="flex flex-wrap gap-2">
                    {STATUS_STEPS.map(status => {
                      const config = DASHBOARD_CONFIG.find(c => c.status === status);
                      const hexColor = config ? config.hex : '#3b82f6';
                      const isSelected = formData.currentStatus === status;
                      const isDisabled = !isQM && ['접수 대기', '접수 완료', '종결'].includes(status);
                      
                      return (
                        <button
                          type="button"
                          key={status}
                          disabled={isDisabled}
                          onClick={() => {
                            if (isDisabled) return;
                            setFormData(prev => {
                              const newData = { ...prev, currentStatus: status };
                              if (status === '종결' && !newData.processDate) {
                                const today = new Date();
                                const yy = String(today.getFullYear()).slice(-2);
                                const mm = String(today.getMonth() + 1).padStart(2, '0');
                                const dd = String(today.getDate()).padStart(2, '0');
                                newData.processDate = `${yy}.${mm}.${dd}`;
                              }
                              return newData;
                            });
                          }}
                          className={`px-4 py-2 text-sm font-bold rounded-lg transition-all border ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                          style={{
                            backgroundColor: isSelected ? hexColor : '#ffffff',
                            color: isSelected ? '#ffffff' : '#4b5563',
                            borderColor: isSelected ? hexColor : '#d1d5db',
                            boxShadow: isSelected ? `0 4px 10px ${hexColor}50` : 'none',
                            textShadow: isSelected ? '0 1px 2px rgba(0,0,0,0.2)' : 'none'
                          }}
                        >
                          {status}
                        </button>
                      )
                    })}
                  </div>
               </div>

               {formData.businessUnit === 'PT' && (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex items-center gap-6">
                    <label className="block text-sm font-bold text-indigo-900">PT 보드 구분 선택</label>
                    <div className="flex gap-6">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ptBoardType" value="ZMDI" checked={formData.ptBoardType === 'ZMDI'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" disabled={!isQM} />
                        <span className="text-sm font-medium text-gray-900">ZMDI</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="ptBoardType" value="N" checked={formData.ptBoardType === 'N'} onChange={handleFormChange} className="w-4 h-4 text-indigo-600 focus:ring-indigo-500" disabled={!isQM} />
                        <span className="text-sm font-medium text-gray-900">N</span>
                      </label>
                    </div>
                  </div>
               )}

               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormGroup label="사업부">
                    <select name="businessUnit" value={formData.businessUnit} onChange={handleFormChange} className="form-input" required disabled={!isQM}>
                      {FIXED_UNITS_ORDER.map(u => <option key={u} value={u}>{u}</option>)}
                    </select>
                  </FormGroup>
                  <FormGroup label="접수번호"><input type="text" name="asNumber" value={formData.asNumber} onChange={handleFormChange} className="form-input" required disabled={!isQM} /></FormGroup>
                  <FormGroup label="수주번호"><input type="text" name="orderNumber" value={formData.orderNumber} onChange={handleFormChange} className="form-input" disabled={!isQM} /></FormGroup>
                  <FormGroup label="처리방식 (접수단계)">
                    <select name="processType" value={formData.processType} onChange={handleFormChange} className="form-input" disabled={!isQM}>
                      <option value="">선택안함</option>
                      <option value="견적 후 착수">견적 후 착수</option>
                      <option value="선조치">선조치</option>
                      <option value="출장">출장</option>
                    </select>
                  </FormGroup>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-4 border-b border-gray-100 pb-4">
                  <FormGroup label="접수일자 (클릭 시 달력)"><input type="date" name="receiptDate" value={formatForDateInput(formData.receiptDate)} max={todayStr} onChange={handleFormChange} className="form-input cursor-pointer" disabled={!isQM} /></FormGroup>
                  <FormGroup label="납기요구일 (자동 5영업일 계산)"><input type="date" name="reqDeliveryDate" value={formatForDateInput(formData.reqDeliveryDate)} onChange={handleFormChange} className="form-input cursor-pointer" disabled={!isQM} /></FormGroup>
                  <FormGroup label="처리완료일"><input type="date" name="processDate" value={formData.processDate === '-' ? '' : formatForDateInput(formData.processDate)} max={todayStr} onChange={handleFormChange} className="form-input cursor-pointer" disabled={!isQM} /></FormGroup>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                  <FormGroup label="대리점명"><input type="text" name="agencyName" value={formData.agencyName} onChange={handleFormChange} className="form-input" disabled={!isQM} /></FormGroup>
                  <FormGroup label="업체명"><input type="text" name="companyName" value={formData.companyName} onChange={handleFormChange} className="form-input" disabled={!isQM} /></FormGroup>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <FormGroup label="MODEL"><input type="text" name="model" value={formData.model} onChange={handleFormChange} className="form-input" disabled={!isQM} /></FormGroup>
                  <FormGroup label="불량 수량"><input type="number" name="qtyDefect" value={formData.qtyDefect} onChange={handleFormChange} className="form-input" min="1" /></FormGroup>
                  <FormGroup label="출고일자 (달력 선택)"><input type="date" name="releaseDate" value={formatForDateInput(formData.releaseDate)} max={todayStr} onChange={handleFormChange} className="form-input cursor-pointer" disabled={!isQM} /></FormGroup>
                  <FormGroup label="기존수주번호"><input type="text" name="originalOrderNumber" value={formData.originalOrderNumber} onChange={handleFormChange} className="form-input" disabled={!isQM} /></FormGroup>
               </div>
               
               <FormGroup label="Serial No. (여러 개일 경우 줄바꿈 가능)"><textarea name="serialNo" value={formData.serialNo} onChange={handleFormChange} className="form-input h-16" /></FormGroup>

               <div className="border-t border-gray-200 pt-6 space-y-4">
                 <div className="flex gap-6 mb-2">
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-sm"><input type="radio" name="claimType" value="일반 A/S" checked={formData.claimType === '일반 A/S'} onChange={handleFormChange} className="w-4 h-4 text-blue-600 focus:ring-blue-500" disabled={!isQM} /> 일반 A/S</label>
                    <label className="flex items-center gap-2 font-bold cursor-pointer text-red-600 text-sm"><input type="radio" name="claimType" value="고객불만" checked={formData.claimType === '고객불만'} onChange={handleFormChange} className="w-4 h-4 text-red-600 focus:ring-red-500" disabled={!isQM} /> 고객 불만</label>
                 </div>
                 <FormGroup label="하자 내용"><textarea name="defectContent" value={formData.defectContent} onChange={handleFormChange} className="form-input h-20 text-sm" disabled={!isQM} /></FormGroup>
                 <FormGroup label="원인 분석"><textarea name="causeAnalysis" value={formData.causeAnalysis} onChange={handleFormChange} className="form-input h-20 text-sm" /></FormGroup>
                 
                 {isQM && ['PMD', 'TMD', 'FLD', 'SMT', 'PG', 'PT', 'UPT900'].includes(formData.businessUnit) && (() => {
                    const config = getCauseTableConfig(formData.businessUnit);
                    return (
                      <div className="overflow-x-auto border rounded-md mt-3">
                        <table className="w-full text-[10px] text-center border-collapse">
                          <thead>
                            <tr><th colSpan={config.totalCols} className="bg-[#eef4ea] py-1.5 font-bold border">원인 분석 결과 (중복 선택 가능)</th></tr>
                            <tr>
                              <th colSpan="3" rowSpan="2" className="border bg-[#eef4ea]">고객<br/>(대리점 또는 사용자)</th>
                              <th colSpan={config.wiseCols} className="border bg-[#eef4ea]">WISE</th>
                              <th colSpan={config.otherGroupCols} className="border bg-[#eef4ea]">기타</th>
                            </tr>
                            <tr>
                              <th className="border bg-[#eef4ea] p-1">영업</th><th className="border bg-[#eef4ea] p-1">설계</th>
                              <th colSpan={config.prodCols} className="border bg-[#eef4ea] p-1">생산</th>
                              <th className="border bg-[#eef4ea] p-1">품질</th><th className="border bg-[#eef4ea] p-1">공급자</th>
                              <th colSpan={config.otherCols} className="border bg-[#eef4ea] p-1">기타</th>
                            </tr>
                            <tr>
                              {config.headers.map(h => <th key={h.id} className="border bg-[#eef4ea] py-1 px-0.5 whitespace-pre-wrap font-normal">{h.label}</th>)}
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              {config.headers.map(h => (
                                <td key={h.id} className="border p-1.5">
                                  <input type="checkbox" checked={(formData.causeAnalysisTypes || []).includes(h.id)} onChange={() => handleCauseCheckbox(h.id)} className="w-3.5 h-3.5 text-blue-600" />
                                </td>
                              ))}
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    );
                  })()}

                 <FormGroup label="처리 내역 및 대책">
                   <textarea name="processDetails" value={formData.processDetails} onChange={handleFormChange} className="form-input h-24 text-sm" />
                 </FormGroup>
                 
                 {isQM && ['PMD', 'TMD', 'FLD', 'SMT', 'PG', 'PT', 'UPT900'].includes(formData.businessUnit) && (
                    <div className="overflow-x-auto border rounded-md mt-3">
                      <table className="w-full text-[11px] text-center border-collapse">
                        <thead>
                          <tr><th colSpan="5" className="bg-[#eef4ea] py-1.5 font-bold border">처리 내역</th></tr>
                          <tr>{PROCESS_HEADERS.map(h => <th key={h.id} className="border bg-[#eef4ea] py-1 px-2 whitespace-pre-wrap font-normal">{h.label}</th>)}</tr>
                        </thead>
                        <tbody>
                          <tr>
                            {PROCESS_HEADERS.map(h => (
                              <td key={h.id} className="border p-2">
                                <input type="radio" name="processDetailType" value={h.value} checked={formData.processDetailType === h.value} onChange={handleFormChange} className="w-4 h-4 text-blue-600" />
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}

                 <div className="pt-4 border-t border-gray-100 bg-gray-50 p-4 rounded-xl mt-4">
                    <label className="block text-sm font-bold text-gray-700 mb-3">수리 결과 및 방법 선택</label>
                    <div className="flex flex-wrap items-center gap-6">
                      {['무상수리', '유상수리', '수리불가', '수리취소'].map(m => (
                        <label key={m} className="flex items-center gap-2 cursor-pointer text-sm font-medium"><input type="radio" name="repairMethod" value={m} checked={formData.repairMethod === m} onChange={handleFormChange} className="w-4 h-4 text-blue-600" disabled={!isQM} /> {m}</label>
                      ))}
                      {formData.repairMethod === '유상수리' && <div className="ml-auto flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded-md border shadow-sm"><span className="font-bold text-gray-700">금액 (₩)</span><input type="number" name="cost" value={formData.cost === null || formData.cost === undefined ? '' : formData.cost} onChange={handleFormChange} placeholder="0" className="form-input w-32 py-1" min="0" disabled={!isQM} /></div>}
                    </div>
                 </div>
               </div>
            </form>
            <div className="p-6 border-t flex justify-end gap-3 bg-gray-50 rounded-b-2xl">
               <button onClick={() => setIsFormOpen(false)} className="px-6 py-2 border rounded-lg font-bold bg-white hover:bg-gray-100">취소</button>
               <button onClick={handleFormSubmitInternal} className="px-8 py-2 bg-blue-600 text-white rounded-lg font-bold shadow-md hover:bg-blue-700 transition-all flex items-center gap-2"><Save className="w-4 h-4" /> 저장하기</button>
            </div>
          </div>
        </div>
      )}

      {/* 삭제 확인 모달 */}
      {itemToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
           <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-200">
              <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">데이터를 삭제하시겠습니까?</h3>
              <p className="text-gray-500 text-sm mb-6">삭제된 데이터는 품질팀 관리하에 복구가 가능할 때까지 보관됩니다.</p>
              <div className="flex gap-3 mt-6">
                 <button onClick={() => setItemToDelete(null)} className="flex-1 py-3 border rounded-xl font-bold hover:bg-gray-50">취소</button>
                 <button onClick={executeDelete} className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold shadow-lg hover:bg-red-700">삭제하기</button>
              </div>
           </div>
        </div>
      )}

      {alertMessage && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[200] bg-gray-900/90 text-white px-8 py-3.5 rounded-full shadow-2xl animate-in slide-in-from-bottom-5 duration-300 flex items-center gap-3">
           <CheckCircle className="text-green-400 w-5 h-5" /> {alertMessage}
           <button onClick={() => setAlertMessage('')} className="ml-2 hover:text-gray-300"><X className="w-4 h-4" /></button>
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .form-input {
          display: block; width: 100%; padding: 0.5rem 0.75rem; font-size: 0.875rem;
          line-height: 1.25rem; border: 1px solid #d1d5db; border-radius: 0.375rem; outline: none; transition: border-color .15s;
        }
        .form-input:focus { border-color: #3b82f6; box-shadow: 0 0 0 1px #3b82f6; }
        .form-input:disabled { background-color: #f3f4f6; color: #9ca3af; cursor: not-allowed; }
        input[type="radio"]:disabled { opacity: 0.5; cursor: not-allowed; }
      `}} />
    </div>
  );
}

function DetailItem({ label, value, isMultiline = false }) {
  if (!value || value === 0 || value === '-') value = '-';
  return (
    <div>
      <div className="text-[10px] text-gray-400 font-black uppercase mb-1">{label}</div>
      <div className={`text-sm text-gray-900 font-bold ${isMultiline ? 'whitespace-pre-wrap leading-relaxed' : ''}`}>{value}</div>
    </div>
  );
}

function FormGroup({ label, children }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-black text-gray-600 ml-1">{label}</label>
      {children}
    </div>
  );
}