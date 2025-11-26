export type Currency = 'USDC' | 'USDT' | 'RLUSD';

export interface TxPurposeOption {
  value: TxPurposeCategory;
  label: string;
  description: string;
}

export const TX_PURPOSE_OPTIONS: TxPurposeOption[] = [
  {
    value: 'GOODS_EXPORT_IMPORT',
    label: '재화 수출입 대금',
    description: '완제품·원자재 수출입, 무역대금, 통관 수입·수출 대금 등'
  },
  {
    value: 'SERVICE_TRADE',
    label: '용역·서비스 거래',
    description: '컨설팅·IT/SaaS·마케팅·교육·로열티 등 서비스 수수료'
  },
  {
    value: 'CAPITAL_TRANSFER',
    label: '자본거래 (투자·대출·지분 등)',
    description: '해외 증권·펀드·부동산 투자, 해외법인 대여금·증자 등'
  },
  {
    value: 'INDIVIDUAL_REMITTANCE',
    label: '개인 송금 (생활비·증여·연금 등)',
    description: '학비·생활비·연금·급여·증여·여행/의료비 등 개인 목적'
  }
];

export type TxPurposeCategory = 
  | 'GOODS_EXPORT_IMPORT'
  | 'SERVICE_TRADE'
  | 'CAPITAL_TRANSFER'
  | 'INDIVIDUAL_REMITTANCE';

// [추가] 컴플라이언스 검증 로그 구조
export interface ComplianceLog {
  step: 'KYC' | 'KYT' | 'SOURCE_OF_FUNDS';
  status: 'PASS' | 'FAIL' | 'WARNING';
  timestamp: string;
  details: string; // 예: "Clear (TranSight DB v2.4)"
}

export interface TransactionMetadata {
  // 1. 기본 트랜잭션 정보
  token: Currency;
  amount: string;
  senderAddress: string;
  timestamp: string;  
  // 🔥 [수정] 여기서 한 번만 정의합니다 (필수 값)
  recipientAddress: string; 

  // 2. 수취인 상세
  recipientName: string;
  recipientType: 'INDIVIDUAL' | 'CORPORATE';
  recipientCountry: string;
  // recipientAddress: string; <-- ❌ 중복 삭제 (위에서 정의했음)

  // 3. 거래 관계
  relationship: 'UNRELATED' | 'SUBSIDIARY' | 'PARENT' | 'PARTNER' | 'FAMILY';
  
  // 4. 상세 신고 데이터
  purposeCategory: TxPurposeCategory;
  purposeDetail: string;
  
  regulatoryCodes: {
    kr_bop_code?: string;
    us_income_code?: string;
    invoice_number?: string;
    contract_date?: string;
  };

  complianceAudit?: {
    senderChecked: boolean;
    senderCheckTime: string;
    logs: ComplianceLog[];
    riskScore: number; // 0 (Safe) ~ 100 (Risky)
    recipientChecked?: boolean; // 수신자가 나중에 채울 필드
    recipientCheckTime?: string;
  };
}