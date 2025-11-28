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
  // Mapper function to transform our metadata into each country’s reporting template
  mapper: (data: TransactionMetadata) => Record<string, string>;
}

// 1. Korea: Foreign Exchange Transaction Report (Bank/Customs)
const KR_FX_REPORT: ReportTemplate = {
  id: 'KR_FX',
  name: '🇰🇷 Korea - Foreign Exchange Transaction',
  description:
    'Metadata for the Korean Foreign Exchange Transaction Report in accordance with FX regulations.',
  fields: [
    { key: 'tx_date', label: 'Date', required: true },
    { key: 'sender_name', label: 'Remitter Name', required: true },
    { key: 'recipient_name', label: 'Beneficiary Name', required: true },
    { key: 'currency', label: 'Currency', required: true },
    { key: 'amount', label: 'Amount', required: true },
    { key: 'exchange_rate', label: 'Exchange Rate', placeholder: 'e.g., 1350.50' },
    { key: 'krw_amount', label: 'KRW Amount' },
    { key: 'purpose_code', label: 'BOP Code', required: true },
    { key: 'description', label: 'Description' },
    { key: 'bank_code', label: 'Bank Code', placeholder: '(Optional)' },
  ],
  mapper: (data) => ({
    tx_date: data.timestamp.split('T')[0],
    sender_name: data.senderAddress,
    recipient_name: data.recipientName,
    currency: data.token,
    amount: data.amount,
    exchange_rate: '',
    krw_amount: '',
    purpose_code: data.regulatoryCodes.kr_bop_code || '',
    description: `${data.purposeCategory} - ${data.purposeDetail}`,
    bank_code: '',
  }),
};

// 2. United States: IRS Reporting (1042-S / 8949 Reference Data)
const US_TAX_REPORT: ReportTemplate = {
  id: 'US_TAX',
  name: '🇺🇸 United States - IRS Tax Reporting Data',
  description:
    'Basic metadata used for IRS income reporting (e.g., Form 1042-S).',
  fields: [
    { key: 'income_code', label: 'Income Code (Box 1)', required: true },
    { key: 'gross_income', label: 'Gross Income (Box 2)', required: true },
    { key: 'tax_rate', label: 'Tax Rate (Box 3b)', placeholder: 'e.g. 30.00' },
    { key: 'recipient_tin', label: 'Recipient TIN', placeholder: 'Taxpayer ID' },
    { key: 'recipient_name', label: 'Recipient Name' },
    { key: 'payout_date', label: 'Payment Date' },
  ],
  mapper: (data) => ({
    income_code: data.regulatoryCodes.us_income_code || '',
    gross_income: data.amount,
    tax_rate: '',
    recipient_tin: '',
    recipient_name: data.recipientName,
    payout_date: data.timestamp.split('T')[0],
  }),
};

// 3. Hong Kong: Accounting / Profits Tax (IRD)
const HK_ACC_REPORT: ReportTemplate = {
  id: 'HK_ACC',
  name: '🇭🇰 Hong Kong - Accounting & Tax Record',
  description:
    'Base accounting data for preparing Hong Kong Profits Tax filings (IRD).',
  fields: [
    { key: 'date', label: 'Transaction Date' },
    { key: 'counterparty', label: 'Counterparty' },
    { key: 'nature_of_tx', label: 'Nature of Transaction' },
    { key: 'amount_hkd', label: 'Amount (HKD Equivalent)', placeholder: 'Exchange rate required' },
    { key: 'amount_usd', label: 'Amount (Original Token)' },
    { key: 'invoice_ref', label: 'Invoice Reference' },
    { key: 'source_location', label: 'Source of Profits (Location)', placeholder: 'Onshore/Offshore' },
  ],
  mapper: (data) => ({
    date: data.timestamp.split('T')[0],
    counterparty: data.recipientName,
    nature_of_tx: data.purposeCategory,
    amount_hkd: '',
    amount_usd: data.amount,
    invoice_ref: data.regulatoryCodes.invoice_number || '',
    source_location: 'Offshore',
  }),
};

// 4. Singapore: GST & Corporate Tax (IRAS)
const SG_GST_REPORT: ReportTemplate = {
  id: 'SG_GST',
  name: '🇸🇬 Singapore - GST & Tax Record',
  description:
    'GST and income classification metadata for IRAS reporting.',
  fields: [
    { key: 'supply_date', label: 'Date of Supply' },
    { key: 'customer_name', label: 'Customer Name' },
    { key: 'supply_type', label: 'Supply Type (Standard/Zero-rated)', placeholder: 'Zero-rated (Export)' },
    { key: 'amount_sgd', label: 'Amount (SGD)', placeholder: 'Exchange rate required' },
    { key: 'gst_amount', label: 'GST Amount' },
    { key: 'digital_token_type', label: 'Digital Token Type', placeholder: 'Payment Token' },
  ],
  mapper: (data) => ({
    supply_date: data.timestamp.split('T')[0],
    customer_name: data.recipientName,
    supply_type: 'Zero-rated',
    amount_sgd: '',
    gst_amount: '0',
    digital_token_type: 'Payment Token (DPT)',
  }),
};

export const TEMPLATES = [
  KR_FX_REPORT,
  US_TAX_REPORT,
  HK_ACC_REPORT,
  SG_GST_REPORT,
];
