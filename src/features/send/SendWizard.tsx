import React, { useState, useEffect } from 'react';
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

// Utils & ABI
import { importPublicKeyFromPem, encryptDataPacket } from '../../utils/crypto';
import { RailXCompliance721Abi } from '../../shared/abi/RailXCompliance721';
import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { KR_BOP_CODES, US_INCOME_TYPES, RELATIONSHIPS } from '../../utils/complianceConstants';
import type { TransactionMetadata, ComplianceLog, TxPurposeCategory, Currency } from './types';
import { TX_PURPOSE_OPTIONS } from './types';
import { ComplianceScanModal } from '../../components/ComplianceScanModal';
import { OrderBookWidget } from '../../components/OrderBookWidget';
import { getLiveOracleRate } from '../../utils/mockOracle';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);
const steps = [
  { title: 'Exchange', description: 'Rates & Amount' },
  { title: 'Entity', description: 'Recipient Details' },
  { title: 'Report', description: 'Regulatory Data' },
];

const TOKEN_LIST: Currency[] = ['KRWK', 'JPYC', 'XSGD', 'USDC', 'USDT', 'RLUSD'];

// 토큰 주소 매핑
const TOKEN_MAP: Record<string, `0x${string}`> = {
  USDC: (import.meta.env.VITE_USDC_ADDRESS || "") as `0x${string}`,
  USDT: (import.meta.env.VITE_USDT_ADDRESS || "") as `0x${string}`,
  RLUSD: (import.meta.env.VITE_RLUSD_ADDRESS || "") as `0x${string}`,
  KRWK: (import.meta.env.VITE_KRWK_ADDRESS || "") as `0x${string}`,
  JPYC: (import.meta.env.VITE_JPYC_ADDRESS || "") as `0x${string}`,
  XSGD: (import.meta.env.VITE_XSGD_ADDRESS || "") as `0x${string}`,
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

  // 🔥 [복구] 금액 변경 핸들러
  const handleAmountChange = (val: string) => {
    handleChange('amount', val);
  };

  // 실시간 견적 조회
  useEffect(() => {
    const fetchQuote = async () => {
      const { fromToken, token, amount } = formData;
      const amountToSend = Number(amount);

      if (!amountToSend || amountToSend <= 0 || fromToken === token) {
        setEstimatedRate(fromToken === token ? 1 : 0);
        setEstimatedReceive(fromToken === token && amount ? amount : '');
        setMatchedLP(null);
        return;
      }

      setIsQuoting(true);
      try {
        const { data: allOrders } = await supabase
          .from('liquidity_orders')
          .select('*')
          .eq('from_token', fromToken)
          .eq('to_token', token)
          .eq('is_active', true)
          .gt('available_amount', 0);

        if (!allOrders || allOrders.length === 0) {
          setEstimatedRate(0);
          setEstimatedReceive('No Liquidity');
          setMatchedLP(null);
          return;
        }

        const currentOracle = getLiveOracleRate(`${token}/${fromToken}`);
        
        const processedOrders = allOrders.map(o => {
          let price = Number(o.min_rate);
          if (o.strategy_type === 'ORACLE') {
            price = currentOracle * (1 + Number(o.spread_bps)/10000);
          }
          return { ...o, price, available: Number(o.available_amount), lp: o.lp_wallet_address };
        });

        // LP별 그룹핑 및 Waterfall 로직
        const lpGroups: Record<string, typeof processedOrders> = {};
        processedOrders.forEach(o => {
          if (!lpGroups[o.lp]) lpGroups[o.lp] = [];
          lpGroups[o.lp].push(o);
        });

        let bestLP = null;
        let bestAvgRate = Infinity;
        let bestReceiveAmt = 0;

        for (const lpAddr in lpGroups) {
          const orders = lpGroups[lpAddr].sort((a, b) => a.price - b.price);
          let remainingInput = amountToSend;
          let totalOutput = 0;
          let possible = false;

          for (const order of orders) {
            const maxInputFromOrder = order.available * order.price; 
            if (remainingInput <= maxInputFromOrder) {
              const output = remainingInput / order.price;
              totalOutput += output;
              remainingInput = 0;
              possible = true;
              break; 
            } else {
              totalOutput += order.available;
              remainingInput -= maxInputFromOrder;
            }
          }

          if (possible) {
            const avgRate = amountToSend / totalOutput;
            if (avgRate < bestAvgRate) {
              bestAvgRate = avgRate;
              bestReceiveAmt = totalOutput;
              bestLP = lpAddr;
            }
          }
        }

        if (bestLP) {
          setEstimatedRate(Number(bestAvgRate.toFixed(2)));
          setEstimatedReceive(bestReceiveAmt.toFixed(2));
          setMatchedLP(bestLP);
        } else {
          setEstimatedRate(0);
          setEstimatedReceive('Insufficient Liquidity');
          setMatchedLP(null);
        }

      } catch (e) { console.error(e); } 
      finally { setIsQuoting(false); }
    };

    const timer = setTimeout(() => fetchQuote(), 500);
    return () => clearTimeout(timer);
  }, [formData.fromToken, formData.token, formData.amount]);

  const onSendButtonClick = () => {
    if (!formData.recipientAddress || !formData.amount) return toast({ title: "정보 입력 필요", status: "warning" });
    if (!matchedLP && formData.fromToken !== formData.token) return toast({ title: "거래 불가: 매칭된 LP가 없습니다.", status: "error" });
    setIsScanning(true);
  };

  const handleScanComplete = async (auditLogs: ComplianceLog[]) => {
    setIsScanning(false);
    await handleFinalSend(auditLogs);
  };

  const handleFinalSend = async (auditLogs: ComplianceLog[]) => {
    if (!address) return;
    setLoading(true);
    try {
      const vaultAddress = import.meta.env.VITE_RAILX_VAULT_ADDRESS as `0x${string}`;
      const nftAddress = import.meta.env.VITE_RAILX_NFT_ADDRESS as `0x${string}`;
      const tokenInAddress = TOKEN_MAP[formData.fromToken];

      if (!vaultAddress || !nftAddress || !tokenInAddress) throw new Error("주소 설정 오류");

      const finalRecipient = formData.recipientAddress.trim().toLowerCase();
      const amountInWei = parseUnits(formData.amount, 18);
      const isDirectTransfer = formData.fromToken === formData.token;

      // 1. 수신자 공개키 조회
      const { data: profile } = await supabase.from('profiles').select('public_key').eq('wallet_address', finalRecipient).single();
      if (!profile?.public_key) throw new Error("수신자가 RailX에 등록되지 않았습니다.");

      // 2. 데이터 패키징 & 암호화
      const compliancePacket = {
        ...formData,
        senderAddress: address,
        timestamp: new Date().toISOString(),
        recipientAddress: finalRecipient,
        matchedLP: isDirectTransfer ? 'DIRECT_P2P' : matchedLP,
        estimatedRate: isDirectTransfer ? 1 : estimatedRate,
        complianceAudit: { senderChecked: true, logs: auditLogs }
      };
      const recipientPubKey = await importPublicKeyFromPem(profile.public_key);
      const encryptedData = await encryptDataPacket(compliancePacket, recipientPubKey);

      const fileName = `req_${Date.now()}_${address}.json`;
      await supabase.storage.from('railx-secure-data').upload(fileName, JSON.stringify(encryptedData));
      const fileUrl = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/railx-secure-data/${fileName}`;

      // 3. 실행 분기
      if (isDirectTransfer) {
        toast({ title: "자금 전송 중...", status: "info" });
        const txHash = await writeContractAsync({
          address: tokenInAddress, abi: MockERC20Abi, functionName: 'transfer',
          args: [finalRecipient as `0x${string}`, amountInWei]
        });
        await writeContractAsync({
          address: nftAddress, abi: RailXCompliance721Abi, functionName: 'mintComplianceRecord',
          args: [finalRecipient as `0x${string}`, fileUrl, txHash], gas: 500000n
        });
        toast({ status: "success", title: "송금 완료!" });
      } else {
        toast({ title: "1/2. 스왑 승인 (Approve)", status: "info" });
        await writeContractAsync({
          address: tokenInAddress, abi: MockERC20Abi, functionName: 'approve',
          args: [vaultAddress, amountInWei]
        });

        // 랜덤 Unique ID 생성
        const randomBytes = new Uint8Array(32);
        window.crypto.getRandomValues(randomBytes);
        const uniqueReqId = `0x${Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('')}`;

        toast({ title: "2/2. 거래 요청서 발송", status: "info" });
        const nftTx = await writeContractAsync({
          address: nftAddress, abi: RailXCompliance721Abi, functionName: 'mintComplianceRecord',
          args: [finalRecipient as `0x${string}`, fileUrl, uniqueReqId], gas: 800000n
        });

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
        toast({ status: "success", title: "요청 완료!", description: "수신자 승인 대기 중" });
      }

    } catch (e: any) {
      console.error(e);
      toast({ status: "error", title: "실패", description: e.message });
    } finally { setLoading(false); }
  };

  const renderStepper = () => (
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
  );

// Step 1: 환전 UI (UI 수정됨: 환율 및 로딩 인디케이터 복구)
  const renderStep1 = () => (
    <VStack spacing={6} align="stretch">
      
      {/* 1. 보내는 자산 (Source) */}
      <Box p={5} bg="blackAlpha.400" borderRadius="xl" border="1px solid" borderColor="railx.700">
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.400">YOU SEND (Origin)</Text>
          <Text fontSize="xs" color="gray.500">Balance: -</Text>
        </HStack>
        <HStack>
          <Input 
            variant="unstyled" 
            placeholder="0.00" 
            fontSize="3xl" 
            fontWeight="bold" 
            color="white"
            value={formData.amount}
            onChange={(e) => handleAmountChange(e.target.value)}
          />
          <Select 
            w="110px" 
            variant="filled" 
            bg="railx.800" 
            color="white" 
            size="md" 
            fontSize="sm" 
            fontWeight="bold"
            value={formData.fromToken} 
            onChange={(e) => handleChange('fromToken', e.target.value)}
          >
            {TOKEN_LIST.map(t => <option key={t} value={t} style={{color:'black'}}>{t}</option>)}
          </Select>
        </HStack>
      </Box>

      {/* 🔥 [복구] 환율 표시 및 로딩 애니메이션 */}
      <HStack justify="center" spacing={4} position="relative" h="40px">
        {/* 왼쪽 선 */}
        <Divider w="35%" borderColor="railx.700" />
        
        {/* 중앙 아이콘 (로딩 중이면 스피너, 아니면 화살표) */}
        <VStack spacing={0} zIndex={1} bg="railx.900" px={2}>
          <Circle 
            size="36px" 
            bg="railx.800" 
            border="1px solid" 
            borderColor={matchedLP ? "railx.accent" : "railx.700"}
            boxShadow={matchedLP ? "0 0 10px rgba(201, 176, 55, 0.3)" : "none"}
          >
            {isQuoting ? (
              <Spinner size="xs" color="railx.accent" speed="0.6s" />
            ) : (
              <Icon as={ArrowDownIcon} color={matchedLP ? "railx.accent" : "gray.500"} boxSize={5} />
            )}
          </Circle>
          
          {/* 환율 배지 (LP 매칭 시 표시) */}
          {estimatedRate > 0 && !isQuoting && (
            <Badge 
              position="absolute" 
              top="36px"
              variant="subtle" 
              colorScheme="yellow" 
              fontSize="0.65rem" 
              borderRadius="full"
              px={2}
              bg="railx.800"
              border="1px solid"
              borderColor="railx.accent"
            >
              1 {formData.token} ≈ {estimatedRate.toLocaleString()} {formData.fromToken}
            </Badge>
          )}
        </VStack>
        
        {/* 오른쪽 선 */}
        <Divider w="35%" borderColor="railx.700" />
      </HStack>

      {/* 2. 받는 자산 (Target) */}
      <Box p={5} bg="blackAlpha.400" borderRadius="xl" border="1px solid" borderColor={matchedLP ? "railx.accent" : "railx.700"}>
        <HStack justify="space-between" mb={2}>
          <Text fontSize="xs" color="gray.400">RECIPIENT GETS (Est.)</Text>
          {matchedLP && <Badge colorScheme="green" fontSize="xs">BEST QUOTE FOUND</Badge>}
        </HStack>
        <HStack>
          <Input 
            variant="unstyled" 
            fontSize="3xl" 
            fontWeight="bold" 
            readOnly
            color={matchedLP ? "railx.accent" : "gray.600"}
            value={estimatedReceive}
            placeholder="0.00"
          />
          <Select 
            w="110px" 
            variant="filled" 
            bg="railx.700" 
            color="white" 
            size="md" 
            fontSize="sm" 
            fontWeight="bold"
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
          placeholder="0x..." 
          value={formData.recipientAddress} 
          onChange={(e) => handleChange('recipientAddress', e.target.value)} 
          bg="railx.900"
        />
      </FormControl>
    </VStack>
  );

  // 🔥 [복구] 상세 입력 폼 복원
  const renderStep2 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="gray.400">Recipient Details</Heading>
      <FormControl>
        <FormLabel>User Type</FormLabel>
        <RadioGroup value={formData.recipientType} onChange={(v) => handleChange('recipientType', v)}>
          <Stack direction='row'><Radio value='CORPORATE'>Corporate</Radio><Radio value='INDIVIDUAL'>Individual</Radio></Stack>
        </RadioGroup>
      </FormControl>
      <FormControl isRequired>
        <FormLabel>Official Name</FormLabel>
        <Input placeholder="Legal Name" value={formData.recipientName} onChange={(e) => handleChange('recipientName', e.target.value)} />
      </FormControl>
      <HStack>
        <FormControl isRequired>
          <FormLabel>Country</FormLabel>
          <Select value={formData.recipientCountry} onChange={(e) => handleChange('recipientCountry', e.target.value)} bg="railx.800">
            <option value="US">USA</option><option value="KR">Korea</option><option value="HK">Hong Kong</option><option value="SG">Singapore</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>Relationship</FormLabel>
          <Select value={formData.relationship} onChange={(e) => handleChange('relationship', e.target.value)} bg="railx.800">
            {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </FormControl>
      </HStack>
    </VStack>
  );

  const renderStep3 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="railx.accent">Transaction Data</Heading>
      <FormControl isRequired>
        <FormLabel>Purpose</FormLabel>
        <Select value={formData.purposeCategory} onChange={(e) => handleChange('purposeCategory', e.target.value as TxPurposeCategory)} bg="railx.800">
          {/* TX_PURPOSE_OPTIONS가 있다면 map, 없으면 직접 옵션 */}
          <option value="SERVICE_TRADE">Service Payment</option>
          <option value="GOODS_EXPORT_IMPORT">Goods Payment</option>
          <option value="CAPITAL_TRANSFER">Investment</option>
          <option value="INDIVIDUAL_REMITTANCE">Personal</option>
        </Select>
      </FormControl>
      <FormControl>
        <FormLabel>KR BOP Code</FormLabel>
        <Select placeholder="Optional" value={formData.regulatoryCodes.kr_bop_code} onChange={(e) => handleRegChange('kr_bop_code', e.target.value)} bg="railx.800">
          {KR_BOP_CODES.filter(c => c.category === formData.purposeCategory).map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)}
        </Select>
      </FormControl>
      <FormControl>
        <FormLabel>US Income Code</FormLabel>
        <Select placeholder="Optional" value={formData.regulatoryCodes.us_income_code} onChange={(e) => handleRegChange('us_income_code', e.target.value)} bg="railx.800">
          {US_INCOME_TYPES.map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)}
        </Select>
      </FormControl>
      <SimpleGrid columns={2} spacing={4}>
        <FormControl>
          <FormLabel>Invoice No.</FormLabel>
          <Input value={formData.regulatoryCodes.invoice_number} onChange={(e) => handleRegChange('invoice_number', e.target.value)} />
        </FormControl>
        <FormControl>
          <FormLabel>Contract Date</FormLabel>
          <Input type="date" value={formData.regulatoryCodes.contract_date} onChange={(e) => handleRegChange('contract_date', e.target.value)} />
        </FormControl>
      </SimpleGrid>
      <FormControl>
        <FormLabel>Description</FormLabel>
        <Textarea placeholder="Payment details..." value={formData.purposeDetail} onChange={(e) => handleChange('purposeDetail', e.target.value)} bg="railx.900" />
      </FormControl>
    </VStack>
  );

  return (
    <SimpleGrid columns={{ base: 1, lg: 3 }} spacing={6} maxW="container.xl" mx="auto" mt={4}>
      
      {/* [Left] Wizard (Span 2) */}
      <Box gridColumn={{ lg: "span 2" }}>
        <Card bg="railx.900" borderColor="railx.700" borderWidth="1px">
          <CardBody>
            {renderStepper()}

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
                <Button 
                  colorScheme="yellow" 
                  onClick={onSendButtonClick}
                  isLoading={loading} 
                  loadingText="Processing..."
                  px={8}
                >
                  Sign & Send
                </Button>
              )}
            </HStack>

            <ComplianceScanModal 
              isOpen={isScanning} 
              onClose={() => setIsScanning(false)}
              onComplete={handleScanComplete}
              targetAddress={formData.recipientAddress} 
              recipientName={formData.recipientName}
              type="SENDER"
            />
          </CardBody>
        </Card>
      </Box>

      {/* [Right] Order Book Widget (Span 1) */}
      <Box gridColumn={{ lg: "span 1" }}>
         {/* 🔥 우측 호가창 위젯 (이게 안 보였던 문제를 해결) */}
         <OrderBookWidget 
            fromToken={formData.fromToken} 
            toToken={formData.token} 
            currentAmount={formData.amount} 
         />
      </Box>
    </SimpleGrid>
  );
}