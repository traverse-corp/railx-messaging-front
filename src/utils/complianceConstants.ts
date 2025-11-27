// Bank of Korea Balance of Payments (BOP) reason codes – example mapping
export const KR_BOP_CODES = [
  // 1) Individual remittance (INDIVIDUAL_REMITTANCE)
  {
    code: '101',
    label: 'Overseas tuition remittance',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Tuition and other school-related education fees',
  },
  {
    code: '102',
    label: 'Living expenses / family support',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Living expenses and family support for students or dependents abroad',
  },
  {
    code: '103',
    label: 'Long-term study / stay lodging & living costs',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Dormitory fees, rent and other long-term stay expenses',
  },
  {
    code: '302',
    label: 'Pension / retirement / insurance payments',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Pension income, retirement benefits, severance payments and insurance payouts',
  },
  {
    code: '301',
    label: 'Salary / labor compensation (individual)',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Salary and freelance service fees paid to individuals residing overseas',
  },
  {
    code: '501',
    label: 'Travel expense remittance',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Business or leisure travel expenses, accommodation and other travel costs',
  },
  {
    code: '502',
    label: 'Medical / treatment expenses',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Payments to overseas hospitals and medical institutions',
  },
  {
    code: '503',
    label: 'Event expenses (wedding / funeral, etc.)',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Costs related to overseas weddings, funerals and similar family events',
  },
  {
    code: '601',
    label: 'Gifts / inheritance remittance',
    category: 'INDIVIDUAL_REMITTANCE',
    description: 'Gifts between family members and inheritance transfers',
  },

  // 2) Goods export / import (GOODS_EXPORT_IMPORT)
  {
    code: '401',
    label: 'Import payment (goods import)',
    category: 'GOODS_EXPORT_IMPORT',
    description: 'Customs-cleared import payments and intermediary trade imports',
  },
  {
    code: '40201',
    label: 'Export proceeds receipt',
    category: 'GOODS_EXPORT_IMPORT',
    description: 'Receipt of export proceeds and settlement of trade receivables',
  },

  // 3) Services & fees (SERVICE_TRADE)
  {
    code: '402',
    label: 'Service fees / charges',
    category: 'SERVICE_TRADE',
    description: 'Consulting, marketing, IT/SaaS, maintenance, education services and similar fees',
  },
  {
    code: '403',
    label: 'Royalties / license fees',
    category: 'SERVICE_TRADE',
    description: 'IP license fees, copyright and trademark royalties',
  },
  {
    code: '404',
    label: 'Advertising / promotion expenses',
    category: 'SERVICE_TRADE',
    description: 'Overseas advertising spend and online marketing costs',
  },
  {
    code: '405',
    label: 'Professional service fees',
    category: 'SERVICE_TRADE',
    description: 'Legal, accounting, tax, design, engineering and other professional services',
  },

  // 4) Capital transactions (CAPITAL_TRANSFER)
  {
    code: '201',
    label: 'Overseas financial investment (stocks / bonds / funds)',
    category: 'CAPITAL_TRANSFER',
    description: 'Investments in listed/unlisted shares, bonds and funds abroad',
  },
  {
    code: '202',
    label: 'Overseas real estate acquisition / investment',
    category: 'CAPITAL_TRANSFER',
    description: 'Purchase or development of real estate located overseas',
  },
  {
    code: '203',
    label: 'Equity investment / capital injection in foreign entities',
    category: 'CAPITAL_TRANSFER',
    description: 'Establishment or capital increase of overseas subsidiaries and equity investments',
  },
  {
    code: '204',
    label: 'Loans / lending to foreign entities or individuals',
    category: 'CAPITAL_TRANSFER',
    description: 'Execution of loan principals and mid-/long-term lending to overseas borrowers',
  },
  {
    code: '205',
    label: 'Recovery of overseas investments / principal & interest repayment',
    category: 'CAPITAL_TRANSFER',
    description: 'Recovery of investment principal and repayment of loan principal and interest',
  },

  // 5) Other (fallback when category is unclear)
  {
    code: '999',
    label: 'Other (bank consultation required)',
    category: 'SERVICE_TRADE',
    description:
      'Use when none of the above codes apply; confirm the exact BOP code with the bank before reporting',
  },
];

// U.S. source income types (e.g. Form 1042-S)
export const US_INCOME_TYPES = [
  // 1) Passive income – interest & dividends
  {
    code: '01',
    label: 'Interest income – general interest from U.S. obligors',
    group: 'PASSIVE',
    description: 'Ordinary interest paid by U.S. corporations or financial institutions',
  },
  {
    code: '02',
    label: 'Interest income – real estate mortgage interest',
    group: 'PASSIVE',
    description: 'Interest from U.S. real-estate mortgage loans',
  },
  {
    code: '29',
    label: 'Deposit interest',
    group: 'PASSIVE',
    description: 'Interest earned on deposits at U.S. financial institutions',
  },
  {
    code: '06',
    label: 'Dividend income – ordinary dividends from U.S. corporations',
    group: 'PASSIVE',
    description: 'Dividends paid from U.S. stocks or funds',
  },
  {
    code: '07',
    label: 'Dividend income – treaty-qualified dividends',
    group: 'PASSIVE',
    description: 'Dividends that qualify for reduced withholding rates under tax treaties',
  },
  {
    code: '08',
    label: 'Dividend income – dividends from foreign corporations',
    group: 'PASSIVE',
    description: 'Dividends from foreign corporations treated as U.S.-source dividends',
  },

  // 2) Royalty / IP-related income
  {
    code: '10',
    label: 'Industrial royalties',
    group: 'ROYALTY',
    description: 'Royalties for patents, know-how and other industrial property',
  },
  {
    code: '11',
    label: 'Film / media copyright royalties',
    group: 'ROYALTY',
    description: 'Royalties for movies, TV programs and other media content',
  },
  {
    code: '12',
    label: 'Other copyright / software / branding royalties',
    group: 'ROYALTY',
    description: 'Software, trademarks, image/likeness rights, advertising/model fees and similar royalties',
  },

  // 3) Real property & capital gains
  {
    code: '14',
    label: 'Real-property rents and natural resource royalties',
    group: 'REAL_PROPERTY',
    description: 'Rental income from real property and royalties from minerals or natural resources',
  },
  {
    code: '09',
    label: 'Capital gains',
    group: 'REAL_PROPERTY',
    description: 'U.S.-source capital gains from the disposition of assets',
  },

  // 4) Pension / retirement income
  {
    code: '15',
    label: 'Pensions, annuities and similar income',
    group: 'PENSION',
    description: 'Pensions, annuity-type payments and certain insurance-related payments',
  },

  // 5) Scholarship / fellowship
  {
    code: '16',
    label: 'Scholarship / fellowship income',
    group: 'SCHOLARSHIP',
    description: 'Taxable and non-taxable scholarships, fellowships and research grants',
  },

  // 6) Service income (personal services)
  {
    code: '17',
    label: 'Compensation for independent personal services',
    group: 'SERVICE',
    description: 'Service fees paid to freelancers, consultants and other independent contractors',
  },
  {
    code: '18',
    label: 'Compensation for dependent personal services',
    group: 'SERVICE',
    description: 'Salary-type compensation under an employment-like relationship',
  },
  {
    code: '19',
    label: 'Compensation for teaching',
    group: 'SERVICE',
    description: 'Income from teaching, lectures, seminars and other educational services',
  },
  {
    code: '20',
    label: 'Compensation during training',
    group: 'SERVICE',
    description: 'Compensation paid during training, internship or research programs',
  },
  {
    code: '42',
    label: 'Artist / athlete income (general)',
    group: 'SERVICE',
    description: 'Income of artists and athletes from performances, events and competitions',
  },
  {
    code: '43',
    label: 'Artist / athlete income (central withholding agreements)',
    group: 'SERVICE',
    description: 'Artist/athlete income covered by an IRS Central Withholding Agreement',
  },

  // 7) Other income
  {
    code: '23',
    label: 'Other U.S.-source FDAP income',
    group: 'OTHER',
    description: 'U.S.-source FDAP income not specifically classified under other codes',
  },
  {
    code: '28',
    label: 'Gambling winnings',
    group: 'OTHER',
    description: 'Casino, lottery and other gambling or gaming winnings',
  },
  {
    code: '35',
    label: 'Substitute payments – other',
    group: 'OTHER',
    description: 'Substitute payments arising from securities lending, swaps and similar transactions',
  },
  {
    code: '50',
    label: 'Income previously reported under escrow procedures',
    group: 'OTHER',
    description: 'Amounts previously reported in earlier years under escrow arrangements',
  },
  {
    code: '59',
    label: 'Consent fees (loan / debt modification fees)',
    group: 'OTHER',
    description: 'Fees paid in connection with modifications of loan or debt terms',
  },
  {
    code: '60',
    label: 'Loan syndication fees',
    group: 'OTHER',
    description: 'Fees for arranging or syndicating loan facilities',
  },
  {
    code: '61',
    label: 'Settlement payments',
    group: 'OTHER',
    description: 'Payments made in connection with legal settlements and dispute resolutions',
  },
];

// Counterparty relationship
export const RELATIONSHIPS = [
  { value: 'UNRELATED', label: 'Unrelated party' },
  { value: 'SUBSIDIARY', label: 'Subsidiary' },
  { value: 'PARENT', label: 'Parent company' },
  { value: 'FAMILY', label: 'Family' },
];
