export type Currency = 'USDC' | 'USDT' | 'DAI';

export type TxPurposeCategory = 
  | 'GOODS_EXPORT_IMPORT'
  | 'SERVICE_TRADE'
  | 'CAPITAL_TRANSFER'
  | 'INDIVIDUAL_REMITTANCE';

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
}