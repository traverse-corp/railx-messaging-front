import React, { useState } from 'react';
import { 
  Box, Button, Input, VStack, Select, useToast, Heading, Text, 
  Card, CardBody, SimpleGrid, FormControl, FormLabel, Divider,
  HStack, Radio, RadioGroup, Stack, Textarea, Circle, Icon
} from '@chakra-ui/react';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { createClient } from '@supabase/supabase-js';
import { FaCheck } from 'react-icons/fa'; // 아이콘 추가

// Utils & ABI
import { importPublicKeyFromPem, encryptDataPacket } from '../../utils/crypto';
import { RailXCompliance721Abi } from '../../shared/abi/RailXCompliance721';
import { MockERC20Abi } from '../../shared/abi/MockERC20';
import { KR_BOP_CODES, US_INCOME_TYPES, RELATIONSHIPS } from '../../utils/complianceConstants';
import type { TransactionMetadata } from './types';

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
  
  // Stepper State
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // --- 통합 Form State ---
  const [formData, setFormData] = useState<TransactionMetadata>({
    token: 'USDC',
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

  // ★ 최종 송금 및 NFT 발행
  const handleFinalSend = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const targetAddress = formData.recipientAddress.trim().toLowerCase();

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
        recipientAddress: targetAddress
      };
      
      // 3. 암호화 (E2EE)
      const recipientPubKey = await importPublicKeyFromPem(profile.public_key);
      const encryptedData = await encryptDataPacket(compliancePacket, recipientPubKey);

      // 4. 업로드
      const fileName = `${Date.now()}_${address}.json`;
      await supabase.storage.from('railx-secure-data').upload(fileName, JSON.stringify(encryptedData));
      const uri = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/railx-secure-data/${fileName}`;

      // 5. 자금 전송 (ERC20)
      toast({ title: "자금 전송 중...", status: "info" });
      const txHash = await writeContractAsync({
        address: import.meta.env.VITE_KRWK_ADDRESS as `0x${string}`,
        abi: MockERC20Abi,
        functionName: 'transfer',
        args: [targetAddress as `0x${string}`, parseUnits(formData.amount, 18)]
      });

      // 6. 증빙 NFT 발행
      toast({ title: "규제 증빙 NFT 발행 중...", status: "info" });
      await writeContractAsync({
        address: import.meta.env.VITE_RAILX_NFT_ADDRESS as `0x${string}`,
        abi: RailXCompliance721Abi,
        functionName: 'mintComplianceRecord',
        args: [targetAddress as `0x${string}`, uri, txHash],
        gas: 500000n
      });

      toast({ status: "success", title: "송금 및 신고 데이터 전송 완료!" });

    } catch (e: any) {
      console.error(e);
      toast({ status: "error", title: "실패", description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Custom Stepper Render ---
  const renderStepper = () => {
    return (
      <HStack mb={8} spacing={0} justify="space-between" position="relative">
          {/* Progress Line Background */}
          <Box position="absolute" top="15px" left="0" right="0" h="2px" bg="railx.700" zIndex={0} />
          {/* Active Progress Line */}
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
        <FormControl w="120px">
          <FormLabel>Token</FormLabel>
          <Select value={formData.token} onChange={(e) => handleChange('token', e.target.value)} bg="railx.800">
            <option value="USDC">USDC</option>
            <option value="USDT">USDT</option>
          </Select>
        </FormControl>
      </HStack>
    </VStack>
  );

  // 2단계: 수취인 상세
  const renderStep2 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="gray.400">수취인 실명 정보</Heading>
      <Text fontSize="xs" color="gray.500" mb={2}>
        * FATF Travel Rule 및 세무 신고를 위해 상대방의 실명/법인명 정보를 정확히 입력해야 합니다.
      </Text>

      <FormControl>
        <FormLabel>유형 (Type)</FormLabel>
        <RadioGroup value={formData.recipientType} onChange={(v) => handleChange('recipientType', v)}>
          <Stack direction='row'>
            <Radio value='CORPORATE'>법인 (Corporate)</Radio>
            <Radio value='INDIVIDUAL'>개인 (Individual)</Radio>
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

  // 3단계: 규제/세무 데이터
  const renderStep3 = () => (
    <VStack spacing={4} align="stretch">
      <Heading size="sm" color="railx.accent">규제 및 세무 데이터 (Regulatory Data)</Heading>
      
      <FormControl isRequired>
        <FormLabel>거래 목적 (Category)</FormLabel>
        <Select 
          value={formData.purposeCategory} 
          onChange={(e) => handleChange('purposeCategory', e.target.value)}
          bg="railx.800"
        >
          <option value="SERVICE_TRADE">용역/서비스 대금 (Service)</option>
          <option value="GOODS_EXPORT_IMPORT">수출입 대금 (Goods)</option>
          <option value="CAPITAL_TRANSFER">투자/대출 (Capital)</option>
          <option value="INDIVIDUAL_REMITTANCE">개인 송금 (Personal)</option>
        </Select>
      </FormControl>

      {/* 한국 BOP 코드 */}
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

      {/* 미국 소득 코드 */}
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
        {/* 커스텀 Stepper 렌더링 */}
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
              onClick={handleFinalSend} 
              isLoading={loading} 
              loadingText="Processing..."
              px={8}
            >
              Sign & Send
            </Button>
          )}
        </HStack>
      </CardBody>
    </Card>
  );
}