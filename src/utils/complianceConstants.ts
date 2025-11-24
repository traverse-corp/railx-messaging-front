// 한국은행 지급사유코드 (Balance of Payment) 매핑 예시
export const KR_BOP_CODES = [
  { code: '101000', label: '수출입 대금 (Goods Export/Import)', category: 'GOODS_EXPORT_IMPORT' },
  { code: '721000', label: '일반 용역비/컨설팅 (General Services)', category: 'SERVICE_TRADE' },
  { code: '722000', label: '법률/회계 자문비 (Legal/Accounting)', category: 'SERVICE_TRADE' },
  { code: '711000', label: '운송/물류비 (Transport)', category: 'SERVICE_TRADE' },
  { code: '732000', label: '저작권/특허권 사용료 (Royalties)', category: 'SERVICE_TRADE' },
  { code: '221000', label: '해외 직접 투자 (Direct Investment)', category: 'CAPITAL_TRANSFER' },
  { code: '121000', label: '증여성 송금 (Donation/Gift)', category: 'INDIVIDUAL_REMITTANCE' },
];

// 미국 소득 유형 (1042-S 등)
export const US_INCOME_TYPES = [
  { code: '01', label: 'Interest Income (이자 소득)' },
  { code: '09', label: 'Capital Gains (자본 이득)' },
  { code: '12', label: 'Royalties (로열티)' },
  { code: '17', label: 'Compensation for Services (용역 보상)' },
  { code: '50', label: 'Other Income (기타)' },
];

// 거래 관계
export const RELATIONSHIPS = [
  { value: 'UNRELATED', label: '제3자 (Unrelated Party)' },
  { value: 'SUBSIDIARY', label: '자회사 (Subsidiary)' },
  { value: 'PARENT', label: '모회사 (Parent Company)' },
  { value: 'FAMILY', label: '가족/친족 (Family)' },
];