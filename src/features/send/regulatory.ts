// regulatory.ts 등

import type { TxPurposeCategory } from './types';

export interface KrBopCode {
  code: string;
  label: string;        // 셀렉트에 노출할 한국어 라벨
  category: TxPurposeCategory;
  description?: string; // 선택 시 툴팁 등으로 써도 됨
}

/**
 * 실무 자주 사용 영역 중심으로 정리한 축약 BOP 코드 테이블.
 * 실제 신고 시에는 각 은행/한국은행 최신 코드표와 매핑해서 사용해야 함.
 */
export const KR_BOP_CODES: KrBopCode[] = [
  // 1) 개인 송금 (INDIVIDUAL_REMITTANCE)
  {
    code: '101',
    label: '해외 학비 송금',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '등록금, 학교 납부금 등 교육비'
  },
  {
    code: '102',
    label: '생활비·가족 부양 송금',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '유학생·가족 생활비, 생계비'
  },
  {
    code: '103',
    label: '유학·장기체재 숙박·생활비',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '기숙사비, 렌트비, 기타 체재비'
  },
  {
    code: '302',
    label: '연금·퇴직금·보험금 지급',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '연금, 퇴직소득, 퇴직 위로금, 보험금'
  },
  {
    code: '301',
    label: '급여·노무 대가 지급 (개인)',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '해외 거주 개인에게 지급하는 급여·프리랜서 노무비'
  },
  {
    code: '501',
    label: '여행경비 송금',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '출장/관광 경비, 체류비 등'
  },
  {
    code: '502',
    label: '의료·치료비 송금',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '해외 병원·의료기관 비용'
  },
  {
    code: '503',
    label: '결혼·장례 등 행사 경비',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '해외 결혼식·장례식 관련 비용'
  },
  {
    code: '601',
    label: '증여·상속 자금 송금',
    category: 'INDIVIDUAL_REMITTANCE',
    description: '가족 간 증여, 상속 재산 이전 등'
  },

  // 2) 재화 수출입 (GOODS_EXPORT_IMPORT)
  {
    code: '401',
    label: '수입대금 결제 (재화 수입)',
    category: 'GOODS_EXPORT_IMPORT',
    description: '통관 수입대금, 중계무역 수입 등'
  },
  {
    code: '40201',
    label: '수출 대금 수령',
    category: 'GOODS_EXPORT_IMPORT',
    description: '재화 수출대금 영수, 무역대금 회수'
  },

  // 3) 용역·서비스 거래 (SERVICE_TRADE)
  {
    code: '402',
    label: '용역 대가·서비스 수수료',
    category: 'SERVICE_TRADE',
    description: '컨설팅, 마케팅, IT/SaaS, 유지보수, 교육서비스 등'
  },
  {
    code: '403',
    label: '로열티·라이선스 사용료',
    category: 'SERVICE_TRADE',
    description: 'IP 라이선스, 저작권·상표권 사용료'
  },
  {
    code: '404',
    label: '광고·프로모션 비용',
    category: 'SERVICE_TRADE',
    description: '해외 광고·온라인 마케팅 집행료'
  },
  {
    code: '405',
    label: '전문서비스 수수료',
    category: 'SERVICE_TRADE',
    description: '법률, 회계, 세무, 디자인, 엔지니어링 등 전문 용역'
  },

  // 4) 자본거래 (CAPITAL_TRANSFER)
  {
    code: '201',
    label: '해외 금융투자 (주식·채권·펀드)',
    category: 'CAPITAL_TRANSFER',
    description: '상장/비상장주식, 채권, 펀드 투자자금'
  },
  {
    code: '202',
    label: '해외 부동산 취득·투자',
    category: 'CAPITAL_TRANSFER',
    description: '해외 부동산 매입, 개발자금'
  },
  {
    code: '203',
    label: '해외법인 출자·증자',
    category: 'CAPITAL_TRANSFER',
    description: '해외 자회사 설립·증자, 지분투자'
  },
  {
    code: '204',
    label: '해외법인·개인에 대한 대출·금전대여',
    category: 'CAPITAL_TRANSFER',
    description: '대출원금 실행, 중·장기 금전대여'
  },
  {
    code: '205',
    label: '해외투자 회수·원리금 상환',
    category: 'CAPITAL_TRANSFER',
    description: '투자 회수금, 대출원금·이자 상환'
  },

  // 5) 기타 (카테고리와 애매할 때 백업용)
  {
    code: '999',
    label: '기타 (은행 협의 필요)',
    category: 'SERVICE_TRADE',
    description: '상기 코드로 분류되지 않는 경우, 실제 신고 전 은행과 코드 확인 필요'
  }
];

// regulatory.ts 등

export type UsIncomeGroup =
  | 'PASSIVE'        // 이자·배당 등 포트폴리오 FDAP
  | 'ROYALTY'        // 로열티성
  | 'SERVICE'        // 인적용역·급여 등
  | 'SCHOLARSHIP'    // 장학금·연구비
  | 'PENSION'        // 연금·퇴직 등
  | 'REAL_PROPERTY'  // 부동산 임대 등
  | 'OTHER';         // 그 외

export interface UsIncomeType {
  code: string;       // 1042-S Box 1 Income Code (예: '01', '06', '16' 등)
  label: string;      // UI용 라벨 (한국어+간단한 영문)
  group: UsIncomeGroup;
  description?: string;
}

/**
 * 1042-S Appendix A Income Code를 실무에서 자주 쓰는 항목 위주로 정리한 테이블.
 * 세무보고 시엔 IRS 원문 코드표를 반드시 함께 참조할 것.
 */
export const US_INCOME_TYPES: UsIncomeType[] = [
  // 1) 이자·배당 등 PASSIVE 소득
  {
    code: '01',
    label: '이자소득 – 미국 내 채무기관 일반이자 (Interest – U.S. obligors)',
    group: 'PASSIVE',
    description: '미국 법인/기관이 지급하는 일반 이자'
  },
  {
    code: '02',
    label: '이자소득 – 부동산 모기지 이자',
    group: 'PASSIVE',
    description: '미국 부동산 담보대출 이자'
  },
  {
    code: '29',
    label: '예금 이자 (Deposit interest)',
    group: 'PASSIVE',
    description: '미국 금융기관 예금에서 발생하는 이자'
  },
  {
    code: '06',
    label: '배당소득 – 미국 법인 일반 배당',
    group: 'PASSIVE',
    description: '미국 주식/펀드에서 지급되는 배당'
  },
  {
    code: '07',
    label: '배당소득 – 조약상 우대배당 (Qualified dividend)',
    group: 'PASSIVE',
    description: '조세조약 요건을 충족하는 경우'
  },
  {
    code: '08',
    label: '배당소득 – 외국법인 배당 (Dividend from foreign corp.)',
    group: 'PASSIVE',
    description: '미국 소스 배당으로 분류되는 외국법인 배당'
  },

  // 2) 로열티·IP 관련
  {
    code: '10',
    label: '산업재산권 로열티 (Industrial royalties)',
    group: 'ROYALTY',
    description: '특허·노하우 등 산업재산권 사용료'
  },
  {
    code: '11',
    label: '영상·콘텐츠 저작권 로열티',
    group: 'ROYALTY',
    description: '영화·TV 프로그램 등의 저작권 사용료'
  },
  {
    code: '12',
    label: '기타 저작권·소프트웨어·브랜딩 로열티',
    group: 'ROYALTY',
    description: '소프트웨어, 상표권, 초상권·광고 모델료 등'
  },

  // 3) 부동산·실물 관련
  {
    code: '14',
    label: '부동산 임대·자원 로열티',
    group: 'REAL_PROPERTY',
    description: '부동산 임대료, 광물·천연자원 사용료 등'
  },
  {
    code: '09',
    label: '자본이득 (Capital gains)',
    group: 'REAL_PROPERTY',
    description: '자산 처분으로 발생한 미국 소스 양도차익'
  },

  // 4) 연금·퇴직
  {
    code: '15',
    label: '연금·연금형 지급·보험 관련 수령액',
    group: 'PENSION',
    description: '연금, 연금형 보험, 일부 alimony 등'
  },

  // 5) 장학금·연구비
  {
    code: '16',
    label: '장학금·펠로우십 (Scholarship/Fellowship)',
    group: 'SCHOLARSHIP',
    description: '학비·연구비 등 비과세/과세 장학금 모두 포함'
  },

  // 6) 인적용역·급여 (Service Income)
  {
    code: '17',
    label: '독립 인적용역 대가 (Independent personal services)',
    group: 'SERVICE',
    description: '프리랜서, 컨설턴트 등의 용역대가'
  },
  {
    code: '18',
    label: '종속 인적용역 대가 (Dependent personal services)',
    group: 'SERVICE',
    description: '고용관계에 가까운 급여성 보수'
  },
  {
    code: '19',
    label: '교수·강의 활동 대가 (Compensation for teaching)',
    group: 'SERVICE',
    description: '강의·세미나·교육서비스 대가'
  },
  {
    code: '20',
    label: '연수·트레이닝 중 보수 (Compensation during training)',
    group: 'SERVICE',
    description: '연수·연구과정 중 지급되는 보수'
  },
  {
    code: '42',
    label: '아티스트·운동선수 소득 (일반)',
    group: 'SERVICE',
    description: '공연·경기 등 예술·스포츠 활동 소득'
  },
  {
    code: '43',
    label: '아티스트·운동선수 소득 (중앙 원천징수 계약 포함)',
    group: 'SERVICE',
    description: 'IRS와 별도 계약이 있는 경우'
  },

  // 7) 기타
  {
    code: '23',
    label: '기타 FDAP 소득 (Other income)',
    group: 'OTHER',
    description: '다른 코드에 명시되지 않은 미국 소스 FDAP'
  },
  {
    code: '28',
    label: '겜블링 당첨금 (Gambling winnings)',
    group: 'OTHER',
    description: '카지노·복권 등 도박·게임 당첨금'
  },
  {
    code: '35',
    label: '대체 지급 – 기타 (Substitute payment – other)',
    group: 'OTHER',
    description: '증권 대차·스왑 등에서 발생하는 대체 지급'
  },
  {
    code: '50',
    label: '에스크로 절차 하에서 이전에 보고된 소득',
    group: 'OTHER',
    description: '이전 연도 에스크로 절차에 따라 이미 보고된 항목'
  },
  {
    code: '59',
    label: 'Consent fee (대출·채무 조건 변경 수수료 등)',
    group: 'OTHER',
    description: '채무 조건 변경 등과 관련된 수수료'
  },
  {
    code: '60',
    label: 'Loan syndication fee (대출 주선 수수료)',
    group: 'OTHER',
    description: '신디케이트론 주선 보수'
  },
  {
    code: '61',
    label: 'Settlement payment (합의금·분쟁 해결금 등)',
    group: 'OTHER',
    description: '분쟁 조정·합의와 관련된 지급'
  }
];
