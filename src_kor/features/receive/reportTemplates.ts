import type { TransactionMetadata } from '../send/types';

export interface ReportField {
  key: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  fields: ReportField[];
  // 우리 데이터를 템플릿으로 변환하는 매퍼 함수
  mapper: (data: TransactionMetadata) => Record<string, string>;
}

// 1. 한국: 외국환거래계산서 (지급/수령) - 관세청/은행 제출용
const KR_FX_REPORT: ReportTemplate = {
  id: 'KR_FX',
  name: '🇰🇷 한국 - 외국환거래계산서 (Foreign Exchange Transaction)',
  description: '외국환거래법에 따른 지급/수령 신고용 기초 데이터입니다.',
  fields: [
    { key: 'tx_date', label: '거래일자 (Date)', required: true },
    { key: 'sender_name', label: '송금인 성명/상호 (Remitter)', required: true },
    { key: 'recipient_name', label: '수취인 성명/상호 (Beneficiary)', required: true },
    { key: 'currency', label: '통화 (Currency)', required: true },
    { key: 'amount', label: '금액 (Amount)', required: true },
    { key: 'exchange_rate', label: '적용환율 (Ex. Rate)', placeholder: '예: 1350.50' }, // 수동 입력 가능성
    { key: 'krw_amount', label: '원화환산액 (KRW Amount)' },
    { key: 'purpose_code', label: '지급사유코드 (BOP Code)', required: true },
    { key: 'description', label: '거래내용 (Description)' },
    { key: 'bank_code', label: '은행코드 (Bank Code)', placeholder: '필요 시 입력' },
  ],
  mapper: (data) => ({
    tx_date: data.timestamp.split('T')[0],
    sender_name: data.senderAddress, // 실제론 프로필 이름이 좋으나 일단 주소
    recipient_name: data.recipientName,
    currency: data.token,
    amount: data.amount,
    exchange_rate: '', // 보통 수취 시점 은행 고시 환율을 씀 (공란)
    krw_amount: '', // 환율 입력 시 자동 계산되게 하거나 공란
    purpose_code: data.regulatoryCodes.kr_bop_code || '',
    description: `${data.purposeCategory} - ${data.purposeDetail}`,
    bank_code: ''
  })
};

// 2. 미국: Form 1042-S / 8949 참고용 (Tax)
const US_TAX_REPORT: ReportTemplate = {
  id: 'US_TAX',
  name: '🇺🇸 미국 - IRS Tax Reporting Data',
  description: 'IRS 소득 신고(Form 1042-S 등)를 위한 기초 데이터입니다.',
  fields: [
    { key: 'income_code', label: 'Income Code (Box 1)', required: true },
    { key: 'gross_income', label: 'Gross Income (Box 2)', required: true },
    { key: 'tax_rate', label: 'Tax Rate (Box 3b)', placeholder: 'e.g. 30.00' },
    { key: 'recipient_tin', label: 'Recipient TIN', placeholder: 'Taxpayer ID' },
    { key: 'recipient_name', label: 'Recipient Name' },
    { key: 'payout_date', label: 'Date of Payment' },
  ],
  mapper: (data) => ({
    income_code: data.regulatoryCodes.us_income_code || '',
    gross_income: data.amount,
    tax_rate: '',
    recipient_tin: '', // 민감정보라 온체인 메타엔 없을 수 있음 (수동)
    recipient_name: data.recipientName,
    payout_date: data.timestamp.split('T')[0],
  })
};

// 3. 홍콩: 회계/세무용 (Inland Revenue Dept)
const HK_ACC_REPORT: ReportTemplate = {
  id: 'HK_ACC',
  name: '🇭🇰 홍콩 - Accounting & Tax Record',
  description: '홍콩 법인세(Profits Tax) 신고를 위한 회계 기초 자료입니다.',
  fields: [
    { key: 'date', label: 'Transaction Date' },
    { key: 'counterparty', label: 'Counterparty' },
    { key: 'nature_of_tx', label: 'Nature of Transaction' },
    { key: 'amount_hkd', label: 'Amount (HKD Equiv.)', placeholder: 'Rate required' },
    { key: 'amount_usd', label: 'Amount (Original Token)' },
    { key: 'invoice_ref', label: 'Invoice Reference' },
    { key: 'source_location', label: 'Source of Profits (Location)', placeholder: 'Onshore/Offshore' }
  ],
  mapper: (data) => ({
    date: data.timestamp.split('T')[0],
    counterparty: data.recipientName,
    nature_of_tx: data.purposeCategory,
    amount_hkd: '',
    amount_usd: data.amount,
    invoice_ref: data.regulatoryCodes.invoice_number || '',
    source_location: 'Offshore' // 기본값
  })
};

// 4. 싱가포르: GST 및 법인세용
const SG_GST_REPORT: ReportTemplate = {
  id: 'SG_GST',
  name: '🇸🇬 싱가포르 - GST & Tax Record',
  description: 'IRAS 신고용 GST 및 소득 구분 데이터입니다.',
  fields: [
    { key: 'supply_date', label: 'Date of Supply' },
    { key: 'customer_name', label: 'Customer Name' },
    { key: 'supply_type', label: 'Supply Type (Standard/Zero-rated)', placeholder: 'Zero-rated (Export)' },
    { key: 'amount_sgd', label: 'Amount (SGD)', placeholder: 'Exchange rate needed' },
    { key: 'gst_amount', label: 'GST Amount' },
    { key: 'digital_token_type', label: 'Token Type', placeholder: 'Payment Token' }
  ],
  mapper: (data) => ({
    supply_date: data.timestamp.split('T')[0],
    customer_name: data.recipientName,
    supply_type: 'Zero-rated', // 수출 전제
    amount_sgd: '',
    gst_amount: '0',
    digital_token_type: 'Payment Token (DPT)'
  })
};

export const TEMPLATES = [KR_FX_REPORT, US_TAX_REPORT, HK_ACC_REPORT, SG_GST_REPORT];