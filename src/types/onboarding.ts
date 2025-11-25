export type UserType = 'INDIVIDUAL' | 'CORPORATE';

export interface KycData {
  // 공통
  name: string; // 이름 또는 법인명
  country: string; // 국적 또는 설립국가
  city: string;
  address: string; // 상세 주소
  
  // 개인 전용
  dob?: string; // 생년월일 (YYYY-MM-DD)
  nationalId?: string; // (선택) 주민/여권 번호 (해시 저장 권장이나 일단 입력 필드)

  // 법인 전용
  incorporationDate?: string; // 설립일
  bizRegNumber?: string; // 사업자번호 / BIC / LEI
  contactName?: string; // 담당자 이름
  contactEmail?: string; // 담당자 이메일
}

export interface UserSettings {
  reportJurisdiction: 'KR' | 'US' | 'HK' | 'SG'; // 싱가포르 추가
  accountingStandard: 'K-IFRS' | 'IFRS' | 'US-GAAP' | 'SFRS'; // SFRS(싱가포르) 추가
  baseCurrency: 'KRW' | 'USD' | 'HKD' | 'SGD'; // 기준 통화
  fiscalYearEnd?: string; // 회계연도 종료일 (법인용, MM-DD)
  includeTaxReports: boolean; // 세무 리포트 자동 생성 여부
  includeFxReports: boolean; // 외환 리포트 자동 생성 여부
}