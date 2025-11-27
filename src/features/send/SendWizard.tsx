import React, { useState, useEffect, useMemo } from 'react';
import { 
  Box, Button, Input, VStack, Select, useToast, Heading, Text, 
  Card, CardBody, SimpleGrid, FormControl, FormLabel, Divider,
  HStack, Radio, RadioGroup, Stack, Textarea, Circle, Icon, Tooltip,
  Badge, Spinner
} from '@chakra-ui/react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCheck, FaInfoCircle } from 'react-icons/fa';
import { ArrowDownIcon } from '@chakra-ui/icons';

import { importPublicKeyFromPem, encryptDataPacket } from '../../utils/crypto';
import { RailXCompliance721Abi } from '../../shared/abi/RailXCompliance721';
import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { KR_BOP_CODES, US_INCOME_TYPES, RELATIONSHIPS } from '../../utils/complianceConstants';
import type { TransactionMetadata, ComplianceLog, TxPurposeCategory, Currency } from './types';
import { TX_PURPOSE_OPTIONS } from './types';
import { ComplianceScanModal } from '../../components/ComplianceScanModal';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const steps = [
  { title: 'Exchange', description: 'Rates & Amount' },
  { title: 'Entity', description: 'Recipient Details' },
  { title: 'Report', description: 'Regulatory Data' },
];

// 토큰 매핑
const TOKEN_LIST: Currency[] = ['KRWK', 'JPYC', 'XSGD', 'USDC', 'USDT', 'RLUSD'];
const TOKEN_MAP: Record<string, `0x${string}`> = {
  USDC: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`,
  USDT: import.meta.env.VITE_USDT_ADDRESS as `0x${string}`,
  RLUSD: import.meta.env.VITE_RLUSD_ADDRESS as `0x${string}`,
  KRWK: import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`,
  JPYC: import.meta.env.VITE_JPYC_ADDRESS as `0x${string}`,
  XSGD: import.meta.env.VITE_XSGD_ADDRESS as `0x${string}`,
};

export function SendWizard() {
  const { address } = useAccount();
  const toast = useToast();
  const { writeContractAsync } = useWriteContract();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // 환전 상태
  const [isQuoting, setIsQuoting] = useState(false);
  const [estimatedRate, setEstimatedRate] = useState<number>(0);
  const [estimatedReceive, setEstimatedReceive] = useState<string>('');
  const [matchedLP, setMatchedLP] = useState<string | null>(null);

  // 폼 상태
  const [formData, setFormData] = useState<TransactionMetadata>({
    fromToken: 'KRWK',
    token: 'USDC',
    amount: '',
    fxTolerance: '0.5',
    senderAddress: '',
    recipientAddress: '',
    timestamp: '',
    recipientName: '',
    recipientType: 'CORPORATE',
    recipientCountry: 'US',
    relationship: 'UNRELATED',
    purposeCategory: 'SERVICE_TRADE',
    purposeDetail: '',
    regulatoryCodes: { kr_bop_code: '', us_income_code: '', invoice_number: '', contract_date: '' }
  });

  // --- Handlers ---
  const handleNext = () => setActiveStep(p => Math.min(p + 1, steps.length - 1));
  const handleBack = () => setActiveStep(p => Math.max(p - 1, 0));
  const handleChange = (field: string, value: any) => setFormData(prev => ({ ...prev, [field]: value }));
  const handleRegChange = (field: string, value: any) => setFormData(prev => ({ ...prev, regulatoryCodes: { ...prev.regulatoryCodes, [field]: value } }));

  // 실시간 견적 조회
  useEffect(() => {
  const fetchQuote = async () => {
      const { fromToken, token, amount } = formData;
      
      // 기본 초기화
      if (!amount || Number(amount) <= 0) {
        setEstimatedRate(0);
        setEstimatedReceive('');
        setMatchedLP(null);
        return;
      }

      // 같은 토큰이면 1:1 (직접 전송)
      if (fromToken === token) {
        setEstimatedRate(1);
        setEstimatedReceive(amount);
        setMatchedLP(null);
        return;
      }

      setIsQuoting(true);
      try {
        // 1. DB에서 해당 페어(Pair)를 지원하는 LP 검색 (조건: from=보내는돈, to=받는돈)
        // 주의: LP 입장에서는 'Buying(From)'이 Sender의 'FromToken'이고, 'Selling(To)'가 Sender의 'ToToken'임
        const { data, error } = await supabase
          .from('liquidity_orders')
          .select('*')
          .eq('from_token', fromToken) 
          .eq('to_token', token)       
          .eq('is_active', true)
          .order('min_rate', { ascending: true }) // 일단 가장 싼 MinRate를 가진 LP부터 조회
          .limit(1);

        if (error) throw error;

        if (data && data.length > 0) {
          const bestLP = data[0];
          
          // --- 🔥 [Logic] Dynamic Pricing & Cap Check ---
          
          // A. 필요 수량 계산 (대략적)
          // LP가 팔고 있는 자산(token)이 available_amount임.
          // Rate 정의: 1 'TargetToken'의 가격 (예: 1 USDC = 1350 KRW)
          // 따라서 Sender가 받을 양(Target)이 LP의 available_amount보다 작아야 함.
          
          // (단순화를 위해 min_rate를 기준으로 1차 계산)
          const tempRate = Number(bestLP.min_rate);
          const requestedTargetAmount = Number(amount) / tempRate; // 받을 양
          const maxSupply = Number(bestLP.available_amount);

          // B. 유동성 초과 체크 (Cap)
          if (requestedTargetAmount > maxSupply) {
             setEstimatedRate(0);
             setEstimatedReceive(`Max Supply Exceeded (Limit: ${maxSupply.toLocaleString()} ${token})`);
             setMatchedLP(null);
             return; // 더 이상 진행 불가
          }

          // C. 가격 결정 (Linear Interpolation)
          // 물량을 많이 가져갈수록 가격(Rate)이 Min -> Max로 이동
          const utilizationRate = requestedTargetAmount / maxSupply; // 0 ~ 1 사이
          const minR = Number(bestLP.min_rate);
          const maxR = Number(bestLP.max_rate);
          
          // 실제 적용 환율 = Min + (Diff * Utilization)
          const dynamicRate = minR + ((maxR - minR) * utilizationRate);
          
          // D. 최종 수령액 계산
          const finalReceiveAmt = Number(amount) / dynamicRate;

          setEstimatedRate(Number(dynamicRate.toFixed(2))); // 소수점 2자리
          setEstimatedReceive(finalReceiveAmt.toFixed(2));
          setMatchedLP(bestLP.lp_wallet_address);

        } else {
          setEstimatedRate(0);
          setEstimatedReceive('No Liquidity Found');
          setMatchedLP(null);
        }
      } catch (e) {
        console.error("Quote Error:", e);
      } finally {
        setIsQuoting(false);
      }
    };

    const timer = setTimeout(() => fetchQuote(), 500);
    return () => clearTimeout(timer);
  }, [formData.fromToken, formData.token, formData.amount]);

  const onSendButtonClick = () => {
    if (!formData.recipientAddress || !formData.amount) return toast({ title: "필수 정보 입력 필요", status: "warning" });
    if (!matchedLP && formData.fromToken !== formData.token) return toast({ title: "매칭된 LP가 없습니다.", status: "error" });
    setIsScanning(true);
  };

  const handleScanComplete = async (auditLogs: ComplianceLog[]) => {
    setIsScanning(false);
    await handleFinalSend(auditLogs);
  };

// ★ 최종 요청 전송 (분기 처리: Direct Transfer vs Vault Swap)
  const handleFinalSend = async (auditLogs: ComplianceLog[]) => {
    if (!address) return;
    setLoading(true);
    try {
      // 1. 환경변수 및 주소 검증
      const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;
      const nftAddress = import.meta.env.VITE_RAILX_NFT_ADDRESS as `0x${string}`;
      const tokenInAddress = TOKEN_MAP[formData.fromToken];

      if (!vaultAddress || !nftAddress || !tokenInAddress) {
        throw new Error("주소 설정 오류: .env 파일 및 TOKEN_MAP을 확인하세요.");
      }

      const finalRecipient = formData.recipientAddress.trim().toLowerCase();
      const amountInWei = parseUnits(formData.amount, 18);

      // 2. 환전 여부 확인 (같은 토큰이면 Direct, 다르면 Swap)
      const isDirectTransfer = formData.fromToken === formData.token;

      // -------------------------------------------------------
      // [공통] 데이터 패키징 & 암호화 & 업로드 (Direct/Swap 공통 수행)
      // -------------------------------------------------------
      
      // 수신자 공개키 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('public_key')
        .eq('wallet_address', finalRecipient)
        .single();
      
      if (!profile?.public_key) throw new Error("수신자가 RailX에 등록되지 않았습니다.");

      // 메타데이터 생성
      const compliancePacket = {
        ...formData,
        senderAddress: address,
        timestamp: new Date().toISOString(),
        recipientAddress: finalRecipient,
        matchedLP: isDirectTransfer ? 'DIRECT_P2P' : matchedLP, // LP 정보
        estimatedRate: isDirectTransfer ? 1 : estimatedRate,
        complianceAudit: { senderChecked: true, logs: auditLogs }
      };

      // 암호화
      const recipientPubKey = await importPublicKeyFromPem(profile.public_key);
      const encryptedData = await encryptDataPacket(compliancePacket, recipientPubKey);

      // Supabase Storage 업로드
      const fileName = `${Date.now()}_${address}.json`;
      const { error: uploadError } = await supabase.storage
        .from('railx-secure-data')
        .upload(fileName, JSON.stringify(encryptedData));
      
      if (uploadError) throw uploadError;

      const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/railx-secure-data/${fileName}`;

      // -------------------------------------------------------
      // [Case A] 직접 송금 (USDC -> USDC)
      // -------------------------------------------------------
      if (isDirectTransfer) {
        console.log("🚀 Direct Transfer Mode");

        // A-1. 자금 전송 (Transfer)
        toast({ title: "1/2. 자금 전송 중...", description: "Recipient에게 직접 송금합니다.", status: "info" });
        
        const txHash = await writeContractAsync({
          address: tokenInAddress,
          abi: MockERC20Abi,
          functionName: 'transfer',
          args: [finalRecipient as `0x${string}`, amountInWei]
        });

        console.log("✅ Transfer Tx:", txHash);

        // A-2. NFT 발행 (실제 이체 TxHash 연결)
        toast({ title: "2/2. 규제 증빙 NFT 발행", status: "info" });
        
        await writeContractAsync({
          address: nftAddress,
          abi: RailXCompliance721Abi,
          functionName: 'mintComplianceRecord',
          args: [finalRecipient as `0x${string}`, fileUrl, txHash],
          gas: 500000n
        });

        toast({ status: "success", title: "송금 완료!", description: "자금과 증빙 데이터가 전송되었습니다." });
      } 
      
      // -------------------------------------------------------
      // [Case B] 환전 스왑 (KRWK -> USDC via Vault)
      // -------------------------------------------------------
      else {
        console.log("💱 Vault Swap Mode");
        
        if (!matchedLP) throw new Error("매칭된 LP가 없습니다.");

        // B-1. Vault 승인 (Approve)
        // "나중에 거래가 성사되면 내 돈(KRW)을 가져가라"고 승인
        toast({ title: "1/2. 스왑 승인 (Approve)", description: "Vault가 환전할 수 있게 승인합니다.", status: "info" });
        
        await writeContractAsync({
            address: tokenInAddress,
            abi: MockERC20Abi,
            functionName: 'approve',
            args: [vaultAddress, amountInWei]
        });

        // B-2. NFT 발행 (거래 요청서 발송)
        // 🔥 [수정] 고정된 문자열 대신 '고유한 요청 ID'를 생성하여 사용합니다.
        // (Contract에서 중복 체크를 하므로 매번 달라야 함)
        const randomBytes = new Uint8Array(32);
        window.crypto.getRandomValues(randomBytes);
        const uniqueReqId = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;

        toast({ title: "2/2. 거래 요청서(NFT) 발송", description: "수신자에게 암호화된 전문을 보냅니다.", status: "info" });
        
        const nftTx = await writeContractAsync({
            address: nftAddress,
            abi: RailXCompliance721Abi,
            functionName: 'mintComplianceRecord',
            args: [finalRecipient as `0x${string}`, fileUrl, uniqueReqId], // 유니크 ID 사용
            gas: 800000n // 가스비 넉넉하게
        });

        // B-3. DB 등록 (수신자가 Inbox에서 확인 후 실행하도록)
        await supabase.from('trade_requests').insert({
            sender_address: address.toLowerCase(),
            lp_address: matchedLP,
            recipient_address: finalRecipient,
            from_token: formData.fromToken,
            to_token: formData.token,
            from_amount: Number(formData.amount),
            to_amount: Number(estimatedReceive),
            applied_rate: estimatedRate,
            status: 'WAITING_RECIPIENT',
            encrypted_compliance_data: fileUrl,
            tx_hash: nftTx
        });

        toast({ status: "success", title: "요청 완료!", description: "수신자가 승인(Execute)하면 자금이 이동합니다." });
      }

    } catch (e: any) {
      console.error("Send Failed:", e);
      toast({ status: "error", title: "실패", description: e.message || "알 수 없는 오류 발생" });
    } finally {
      setLoading(false);
    }
  };

  // Step 1: 환전 UI (고도화)
  const renderStep1 = () => (
    <VStack spacing={6} align="stretch">
      {/* 1. 보내는 자산 (Source) */}
      <Box p={5} bg="blackAlpha.400" borderRadius="xl" border="1px solid" borderColor="railx.700">
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.400">YOU SEND</Text>
          <Text fontSize="xs" color="gray.500">Balance: -</Text>
        </HStack>
        <HStack>
          <Input 
            variant="unstyled" placeholder="0.00" fontSize="3xl" fontWeight="bold" color="white"
            value={formData.amount} onChange={(e) => handleChange('amount', e.target.value)}
          />
          <Select 
            w="120px" variant="filled" bg="railx.800" color="white" size="lg" fontWeight="bold" fontSize="sm"
            value={formData.fromToken} 
            onChange={(e) => handleChange('fromToken', e.target.value)}
          >
            {TOKEN_LIST.map(t => <option key={t} value={t} style={{color:'black'}}>{t}</option>)}
          </Select>
        </HStack>
      </Box>

      {/* 환율 표시 */}
      <HStack justify="center" spacing={4} position="relative">
        <Divider w="40%" borderColor="railx.700" />
        <VStack spacing={0} zIndex={1}>
          <Circle size="32px" bg="railx.800" border="1px solid" borderColor={matchedLP ? "railx.accent" : "railx.700"}>
            {isQuoting ? <Spinner size="xs" color="railx.accent"/> : <Icon as={ArrowDownIcon} color={matchedLP ? "railx.accent" : "gray.500"} />}
          </Circle>
          {estimatedRate > 0 && (
            <Badge mt={2} variant="outline" colorScheme="yellow" fontSize="xs" bg="railx.900">
              1 {formData.token} ≈ {estimatedRate} {formData.fromToken}
            </Badge>
          )}
        </VStack>
        <Divider w="40%" borderColor="railx.700" />
      </HStack>

      {/* 2. 받는 자산 (Target) */}
      <Box p={5} bg="blackAlpha.400" borderRadius="xl" border="1px solid" borderColor={matchedLP ? "railx.accent" : "railx.700"}>
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.400">RECIPIENT GETS</Text>
          {matchedLP && <Badge colorScheme="green" fontSize="xs">BEST QUOTE FOUND</Badge>}
        </HStack>
        <HStack>
          <Input 
            variant="unstyled" fontSize="3xl" fontWeight="bold" readOnly
            color={matchedLP ? "railx.accent" : "gray.600"}
            value={estimatedReceive}
            placeholder="0.00"
          />
          <Select 
            w="120px" variant="filled" bg="railx.800" color="white" size="lg" fontWeight="bold" fontSize="sm"
            value={formData.token} 
            onChange={(e) => handleChange('token', e.target.value)}
          >
            {TOKEN_LIST.map(t => <option key={t} value={t} style={{color:'black'}}>{t}</option>)}
          </Select>
        </HStack>
      </Box>

      {/* 3. 수취인 주소 */}
      <FormControl isRequired mt={2}>
        <FormLabel fontSize="sm" color="gray.400">Recipient Wallet Address</FormLabel>
        <Input 
          placeholder="0x..." value={formData.recipientAddress} 
          onChange={(e) => handleChange('recipientAddress', e.target.value)} bg="railx.900"
        />
      </FormControl>
    </VStack>
  );

  const renderStep2 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="gray.400">Recipient Details</Heading>
      <FormControl>
        <FormLabel>User Type</FormLabel>
        <RadioGroup value={formData.recipientType} onChange={(v) => handleChange('recipientType', v)}>
          <Stack direction='row'><Radio value='CORPORATE'>Corporate</Radio><Radio value='INDIVIDUAL'>Individual</Radio></Stack>
        </RadioGroup>
      </FormControl>
      <FormControl isRequired><FormLabel>Official Name</FormLabel><Input value={formData.recipientName} onChange={(e) => handleChange('recipientName', e.target.value)} /></FormControl>
      <HStack><FormControl isRequired><FormLabel>Country</FormLabel><Select value={formData.recipientCountry} onChange={(e) => handleChange('recipientCountry', e.target.value)} bg="railx.800"><option value="US">USA</option><option value="KR">Korea</option><option value="HK">Hong Kong</option><option value="SG">Singapore</option></Select></FormControl><FormControl><FormLabel>Relationship</FormLabel><Select value={formData.relationship} onChange={(e) => handleChange('relationship', e.target.value)} bg="railx.800">{RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}</Select></FormControl></HStack>
    </VStack>
  );

  const renderStep3 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="railx.accent">Transaction Data</Heading>
      <FormControl isRequired><FormLabel>Purpose</FormLabel><Select value={formData.purposeCategory} onChange={(e) => handleChange('purposeCategory', e.target.value as TxPurposeCategory)} bg="railx.800">{TX_PURPOSE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</Select></FormControl>
      <FormControl><FormLabel>KR BOP Code</FormLabel><Select value={formData.regulatoryCodes.kr_bop_code} onChange={(e) => handleRegChange('kr_bop_code', e.target.value)} bg="railx.800">{KR_BOP_CODES.filter(c => c.category === formData.purposeCategory).map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)}</Select></FormControl>
      <FormControl><FormLabel>US Income Code</FormLabel><Select value={formData.regulatoryCodes.us_income_code} onChange={(e) => handleRegChange('us_income_code', e.target.value)} bg="railx.800">{US_INCOME_TYPES.map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)}</Select></FormControl>
      <SimpleGrid columns={2} spacing={4}><FormControl><FormLabel>Invoice No.</FormLabel><Input value={formData.regulatoryCodes.invoice_number} onChange={(e) => handleRegChange('invoice_number', e.target.value)} /></FormControl><FormControl><FormLabel>Contract Date</FormLabel><Input type="date" value={formData.regulatoryCodes.contract_date} onChange={(e) => handleRegChange('contract_date', e.target.value)} /></FormControl></SimpleGrid>
      <FormControl><FormLabel>Description</FormLabel><Textarea value={formData.purposeDetail} onChange={(e) => handleChange('purposeDetail', e.target.value)} bg="railx.900" /></FormControl>
    </VStack>
  );

  return (
    <Card maxW="650px" mx="auto" mt={4} bg="railx.900" borderColor="railx.700" borderWidth="1px">
      <CardBody>
        {/* Simple Stepper */}
        <HStack mb={8} spacing={0} justify="space-between" position="relative">
          <Box position="absolute" top="15px" left="0" right="0" h="2px" bg="railx.700" zIndex={0} />
          <Box position="absolute" top="15px" left="0" h="2px" bg="railx.accent" zIndex={0} width={`${(activeStep / (steps.length - 1)) * 100}%`} transition="width 0.3s" />
          {steps.map((step, index) => (
            <VStack key={index} spacing={1} zIndex={1} bg="railx.900" px={2}>
              <Circle size="30px" bg={index <= activeStep ? 'railx.accent' : 'railx.700'} color={index <= activeStep ? 'black' : 'gray.500'} fontWeight="bold">
                {index < activeStep ? <Icon as={FaCheck} /> : index + 1}
              </Circle>
              <Text fontSize="xs" color={index === activeStep ? 'white' : 'gray.500'} fontWeight={index === activeStep ? 'bold' : 'normal'}>{step.title}</Text>
            </VStack>
          ))}
        </HStack>

        <Box minH="400px" py={4}>
          {activeStep === 0 && renderStep1()}
          {activeStep === 1 && renderStep2()}
          {activeStep === 2 && renderStep3()}
        </Box>

        <Divider my={6} borderColor="railx.700" />

        <HStack justify="space-between">
          <Button isDisabled={activeStep === 0} onClick={handleBack} variant="ghost">Back</Button>
          {activeStep < steps.length - 1 ? (
            <Button colorScheme="yellow" onClick={handleNext} px={8}>Next</Button>
          ) : (
            <Button colorScheme="yellow" onClick={onSendButtonClick} isLoading={loading} loadingText="Processing..." px={8}>
              Sign & Send
            </Button>
          )}
        </HStack>

        <ComplianceScanModal 
          isOpen={isScanning} onClose={() => setIsScanning(false)}
          onComplete={handleScanComplete}
          targetAddress={formData.recipientAddress} recipientName={formData.recipientName} type="SENDER"
        />
      </CardBody>
    </Card>
  );
}