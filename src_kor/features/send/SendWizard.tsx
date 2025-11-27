import React, { useState, useMemo } from 'react';
import { 
  Box, Button, Input, VStack, Select, useToast, Heading, Text, 
  Card, CardBody, SimpleGrid, FormControl, FormLabel, Divider,
  HStack, Radio, RadioGroup, Stack, Textarea, Circle, Icon, Tooltip
} from '@chakra-ui/react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCheck } from 'react-icons/fa';

// Utils & ABI
import { importPublicKeyFromPem, encryptDataPacket } from '../../utils/crypto';
import { RailXCompliance721Abi } from '../../shared/abi/RailXCompliance721';
import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { KR_BOP_CODES, US_INCOME_TYPES, RELATIONSHIPS } from '../../utils/complianceConstants';
import type { ComplianceLog } from './types';
import type { TransactionMetadata } from './types';
import type { TxPurposeOption } from './types';
import type { TxPurposeCategory } from './types';
import { TX_PURPOSE_OPTIONS } from './types';

import { ComplianceScanModal } from '../../components/ComplianceScanModal';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const steps = [
  { title: 'Basic', description: '금액 및 수신처' },
  { title: 'Entity', description: '수취인 상세' },
  { title: 'Report', description: '신고 데이터' },
];

export function SendWizard() {
  const { address } = useAccount();
  const toast = useToast();
  const { writeContractAsync } = useWriteContract();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);

  // 🔥 [핵심 수정 1] TOKEN_MAP을 컴포넌트 안으로 가져오고 useMemo 사용
  // 이렇게 하면 환경변수 로딩 시점 이슈를 방지하고, 확실하게 값을 잡습니다.
  const tokenMap = useMemo(() => ({
    USDC: import.meta.env.VITE_USDC_ADDRESS as `0x${string}`,
    USDT: import.meta.env.VITE_USDT_ADDRESS as `0x${string}`,
    RLUSD: import.meta.env.VITE_RLUSD_ADDRESS as `0x${string}`,
  }), []);

  // --- 통합 Form State ---
  const [formData, setFormData] = useState<TransactionMetadata>({
    token: 'USDC', // 기본값
    amount: '',
    senderAddress: '',
    recipientAddress: '',
    timestamp: '',
    recipientName: '',
    recipientType: 'CORPORATE',
    recipientCountry: 'US',
    relationship: 'UNRELATED',
    purposeCategory: 'SERVICE_TRADE',
    purposeDetail: '',
    regulatoryCodes: {
      kr_bop_code: '',
      us_income_code: '',
      invoice_number: '',
      contract_date: ''
    }
  });

  // --- Handlers ---
  const handleNext = () => setActiveStep(p => Math.min(p + 1, steps.length - 1));
  const handleBack = () => setActiveStep(p => Math.max(p - 1, 0));
  
  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleRegChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      regulatoryCodes: { ...prev.regulatoryCodes, [field]: value }
    }));
  };

  const onSendButtonClick = () => {
    if (!formData.recipientAddress || !formData.amount) {
      toast({ title: "정보를 입력해주세요", status: "warning" });
      return;
    }
    setIsScanning(true);
  };

  const handleScanComplete = async (auditLogs: ComplianceLog[]) => {
    setIsScanning(false);
    await handleFinalSend(auditLogs);
  };

  // ★ 최종 송금 및 NFT 발행
  const handleFinalSend = async (auditLogs: ComplianceLog[]) => {
    if (!address) return;
    setLoading(true);
    try {
      const nftAddress = import.meta.env.VITE_RAILX_NFT_ADDRESS as `0x${string}`;
      
      // 🔥 [핵심 수정 2] 현재 formData.token 값과 매핑된 주소를 확실하게 가져옴
      const selectedTokenSymbol = formData.token;
      const selectedTokenAddress = tokenMap[selectedTokenSymbol];

      // 디버깅용 로그 (브라우저 콘솔 확인 필수)
      console.log(`🔍 Token Selection Check:`);
      console.log(` - Selected Symbol: ${selectedTokenSymbol}`);
      console.log(` - Mapped Address: ${selectedTokenAddress}`);
      
      if (!selectedTokenAddress || !selectedTokenAddress.startsWith("0x")) {
        throw new Error(`선택한 토큰(${selectedTokenSymbol})의 컨트랙트 주소가 올바르지 않습니다. .env를 확인하세요.`);
      }

      const targetAddress = formData.recipientAddress.trim().toLowerCase();
      const amountBigInt = parseUnits(formData.amount, 18); 

      // 1. 수신자 공개키 조회
      const { data: profile } = await supabase
        .from('profiles')
        .select('public_key')
        .eq('wallet_address', targetAddress)
        .single();
      
      if (!profile) throw new Error("수신자가 RailX에 등록되지 않았습니다 (Keys Setup 필요).");

      // 2. 데이터 패키징
      const compliancePacket: TransactionMetadata = {
        ...formData,
        senderAddress: address,
        timestamp: new Date().toISOString(),
        recipientAddress: targetAddress,
        complianceAudit: {
          senderChecked: true,
          senderCheckTime: new Date().toISOString(),
          logs: auditLogs,
          riskScore: 0,
        }
      };
      
      // 3. 암호화
      const recipientPubKey = await importPublicKeyFromPem(profile.public_key);
      const encryptedData = await encryptDataPacket(compliancePacket, recipientPubKey);

      // 4. 업로드
      const fileName = `${Date.now()}_${address}.json`;
      await supabase.storage.from('railx-secure-data').upload(fileName, JSON.stringify(encryptedData));
      const uri = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/railx-secure-data/${fileName}`;

      // 5. 자금 전송 (ERC20)
      toast({ title: `${selectedTokenSymbol} 전송 서명 요청...`, status: "info" });
      
      // 🔥 [핵심 수정 3] 확인된 주소(selectedTokenAddress)를 사용
      const txHash = await writeContractAsync({
        address: selectedTokenAddress, 
        abi: MockERC20Abi,
        functionName: 'transfer',
        args: [targetAddress as `0x${string}`, amountBigInt]
      });

      console.log("✅ Transfer Tx:", txHash);

      // 6. 증빙 NFT 발행
      toast({ title: "컴플라이언스 토큰 발행 중...", status: "info" });
      
      const nftTx = await writeContractAsync({
        address: nftAddress,
        abi: RailXCompliance721Abi,
        functionName: 'mintComplianceRecord',
        args: [targetAddress as `0x${string}`, uri, txHash],
        gas: 500000n
      });

      toast({ status: "success", title: "전송 완료!", description: "자금과 증빙 데이터가 전송되었습니다." });

    } catch (e: any) {
      console.error("❌ Send Failed:", e);
      toast({ status: "error", title: "실패", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Custom Stepper Render ---
  const renderStepper = () => {
    return (
      <HStack mb={8} spacing={0} justify="space-between" position="relative">
          <Box position="absolute" top="15px" left="0" right="0" h="2px" bg="railx.700" zIndex={0} />
          <Box position="absolute" top="15px" left="0" h="2px" bg="railx.accent" zIndex={0} 
               width={`${(activeStep / (steps.length - 1)) * 100}%`} transition="width 0.3s" />

          {steps.map((step, index) => {
            const isCompleted = index < activeStep;
            const isActive = index === activeStep;
            return (
              <VStack key={index} spacing={1} zIndex={1} bg="railx.900" px={2}>
                <Circle 
                  size="30px" 
                  bg={isCompleted || isActive ? 'railx.accent' : 'railx.700'} 
                  color={isCompleted || isActive ? 'black' : 'gray.500'}
                  fontWeight="bold"
                  borderWidth="2px"
                  borderColor={isActive ? 'white' : 'transparent'}
                >
                  {isCompleted ? <Icon as={FaCheck} /> : index + 1}
                </Circle>
                <Text fontSize="xs" color={isActive ? 'white' : 'gray.500'} fontWeight={isActive ? 'bold' : 'normal'}>
                  {step.title}
                </Text>
              </VStack>
            )
          })}
      </HStack>
    );
  };

  // --- Step Renders ---

  // 1단계: 기본 정보
  const renderStep1 = () => (
    <VStack spacing={4} align="stretch">
      <FormControl isRequired>
        <FormLabel>수취인 지갑 주소 (Recipient Address)</FormLabel>
        <Input 
          placeholder="0x..." 
          value={formData.recipientAddress} 
          onChange={(e) => handleChange('recipientAddress', e.target.value)} 
        />
      </FormControl>
      <HStack>
        <FormControl isRequired>
          <FormLabel>보낼 수량 (Amount)</FormLabel>
          <Input 
            type="number" 
            placeholder="0.00" 
            value={formData.amount} 
            onChange={(e) => handleChange('amount', e.target.value)} 
          />
        </FormControl>
        <FormControl w="140px">
          <FormLabel>Token</FormLabel>
          <Select 
            value={formData.token} 
            // 🔥 [확인] 여기서 변경 시 formData.token이 확실히 바뀝니다.
            onChange={(e) => handleChange('token', e.target.value)} 
            bg="railx.800"
          >
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
            <option value="RLUSD">RLUSD</option>
          </Select>
        </FormControl>
      </HStack>
    </VStack>
  );

  const renderStep2 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="gray.400">수취인 실명 정보</Heading>
      <FormControl>
        <FormLabel>유형 (Type)</FormLabel>
        <RadioGroup value={formData.recipientType} onChange={(v) => handleChange('recipientType', v)}>
          <Stack direction='row'>
            <Radio value='CORPORATE'>법인</Radio>
            <Radio value='INDIVIDUAL'>개인</Radio>
          </Stack>
        </RadioGroup>
      </FormControl>
      <FormControl isRequired>
        <FormLabel>이름/법인명 (Official Name)</FormLabel>
        <Input 
          placeholder="예: Apple Inc. or Hong Gil Dong" 
          value={formData.recipientName} 
          onChange={(e) => handleChange('recipientName', e.target.value)} 
        />
      </FormControl>
      <HStack>
        <FormControl isRequired>
          <FormLabel>국가 (Country)</FormLabel>
          <Select 
            value={formData.recipientCountry} 
            onChange={(e) => handleChange('recipientCountry', e.target.value)}
            bg="railx.800"
          >
            <option value="US">미국 (USA)</option>
            <option value="KR">한국 (Korea)</option>
            <option value="HK">홍콩 (Hong Kong)</option>
            <option value="SG">싱가포르 (Singapore)</option>
            <option value="VN">베트남 (Vietnam)</option>
          </Select>
        </FormControl>
        <FormControl>
          <FormLabel>관계 (Relationship)</FormLabel>
          <Select 
            value={formData.relationship} 
            onChange={(e) => handleChange('relationship', e.target.value)}
            bg="railx.800"
          >
            {RELATIONSHIPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </FormControl>
      </HStack>
    </VStack>
  );

  const renderStep3 = () => (
    <VStack spacing={4} align="stretch">
      <HStack spacing={2} align="center">
        <Heading size="sm" color="railx.accent">
          거래 증빙 데이터
        </Heading>
        <Tooltip
          label="본 거래 증빙 데이터는 프라이버시 보호 메세징(ZK-E2EE)으로 송신자와 수취인만 복호화 가능하며 양측 거래 증빙에 활용됩니다."
          hasArrow
          placement="right"
        >
          <Circle
            size="18px"
            borderWidth="1px"
            borderColor="railx.accent"
            bg="railx.800"
            color="railx.accent"
            fontSize="xs"
            cursor="default"
          >
            ?
          </Circle>
        </Tooltip>
      </HStack>
      <FormControl isRequired>
        <FormLabel>거래 목적 (Category)</FormLabel>
        <Select
          value={formData.purposeCategory}
          onChange={(e) => handleChange('purposeCategory', e.target.value as TxPurposeCategory)}
          bg="railx.800"
        >
          {TX_PURPOSE_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>🇰🇷 한국은행 지급사유코드 (KR BOP Code)</FormLabel>
        <Select 
          placeholder="코드 선택 (해당 시)" 
          value={formData.regulatoryCodes.kr_bop_code}
          onChange={(e) => handleRegChange('kr_bop_code', e.target.value)}
          bg="railx.800"
        >
          {KR_BOP_CODES
            .filter(c => c.category === formData.purposeCategory)
            .map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)
          }
        </Select>
      </FormControl>

      <FormControl>
        <FormLabel>🇺🇸 미국 소득 구분 (US Income Type)</FormLabel>
        <Select 
          placeholder="소득 유형 선택 (해당 시)" 
          value={formData.regulatoryCodes.us_income_code}
          onChange={(e) => handleRegChange('us_income_code', e.target.value)}
          bg="railx.800"
        >
          {US_INCOME_TYPES.map(c => <option key={c.code} value={c.code}>{`[${c.code}] ${c.label}`}</option>)}
        </Select>
      </FormControl>

      <SimpleGrid columns={2} spacing={4}>
        <FormControl>
          <FormLabel>인보이스/계약서 번호</FormLabel>
          <Input 
            placeholder="INV-2024-001"
            value={formData.regulatoryCodes.invoice_number}
            onChange={(e) => handleRegChange('invoice_number', e.target.value)}
          />
        </FormControl>
        <FormControl>
          <FormLabel>계약일 (Contract Date)</FormLabel>
          <Input 
            type="date"
            value={formData.regulatoryCodes.contract_date}
            onChange={(e) => handleRegChange('contract_date', e.target.value)}
          />
        </FormControl>
      </SimpleGrid>

      <FormControl>
        <FormLabel>상세 적요 (Description)</FormLabel>
        <Textarea 
          placeholder="거래에 대한 구체적인 설명을 입력하세요 (세무 소명용)"
          value={formData.purposeDetail}
          onChange={(e) => handleChange('purposeDetail', e.target.value)}
          bg="railx.900"
        />
      </FormControl>
    </VStack>
  );

  return (
    <Card maxW="650px" mx="auto" mt={4} bg="railx.900" borderColor="railx.700" borderWidth="1px">
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
          // 🔥 이 부분이 빠져있거나, nameState 변수에 값이 없는지 확인하세요!
          recipientName={formData.recipientName}
          type="SENDER"
        />
      </CardBody>
    </Card>
  );
}