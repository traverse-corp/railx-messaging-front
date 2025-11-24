import React, { useState } from 'react';
import { 
  Box, Button, Heading, Text, VStack, useToast, Card, CardBody, 
  HStack, FormControl, FormLabel, Select, Divider, SimpleGrid, Icon, Input,
  Flex, Circle, Progress
} from '@chakra-ui/react';
import { useAccount, useSignMessage } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaBuilding, FaLock, FaCheckCircle, FaCheck } from 'react-icons/fa';

// Utils & Constants
import { 
  generateRSAKeyPair, deriveKeyFromSignature, lockPrivateKey, exportPublicKeyToPem 
} from '../../utils/crypto';
import { RAILX_SIGNING_MESSAGE } from '../../utils/constants';

// Types (import type 필수)
import type { UserType, KycData, UserSettings } from '../../types/onboarding';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const steps = [
  { title: 'Type', description: '유저 유형' },
  { title: 'KYC', description: '기본 정보' },
  { title: 'Settings', description: '리포트 설정' },
  { title: 'Security', description: '키 생성' },
];

export function OnboardingPage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);

  // --- State ---
  const [userType, setUserType] = useState<UserType>('INDIVIDUAL');
  
  const [kycData, setKycData] = useState<KycData>({
    name: '', country: 'KR', city: '', address: '',
    dob: '', nationalId: '',
    incorporationDate: '', bizRegNumber: '', contactName: '', contactEmail: ''
  });

  const [settings, setSettings] = useState<UserSettings>({
    reportJurisdiction: 'KR',
    accountingStandard: 'K-IFRS'
  });

  // --- Handlers ---
  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setKycData(prev => ({ ...prev, [name]: value }));
  };

  // ★ 핵심: 키 생성 및 저장
  const handleFinalize = async () => {
    if (!address) return;
    setLoading(true);
    try {
      // 1. 키 생성
      const keyPair = await generateRSAKeyPair();
      
      // 2. 서명 요청
      const message = `${RAILX_SIGNING_MESSAGE}${address.toLowerCase()}`;
      const sig = await signMessageAsync({ message });

      // 3. 키 암호화
      const derivedKey = await deriveKeyFromSignature(sig, address.toLowerCase());
      const lockedPrivKey = await lockPrivateKey(keyPair.privateKey, derivedKey);
      const pubKeyPem = await exportPublicKeyToPem(keyPair.publicKey);

      // 4. Supabase 저장
      const { error } = await supabase.from('profiles').upsert({
        wallet_address: address.toLowerCase(),
        public_key: pubKeyPem,
        encrypted_rsa_private_key: lockedPrivKey,
        user_type: userType,
        kyc_data: kycData,
        settings: settings
      });

      if(error) throw error;

      toast({ 
        status: 'success', 
        title: '온보딩 완료!', 
        description: '보안 키가 안전하게 생성되었습니다. 이제 서비스를 이용할 수 있습니다.' 
      });
      
      navigate('/app');

    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: '설정 실패', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Render Custom Stepper (Chakra v2 Compatible) ---
  const renderStepper = () => {
    const progress = (activeStep / (steps.length - 1)) * 100;

    return (
      <Box position="relative" mb={10}>
        <Progress value={progress} size="xs" colorScheme="yellow" borderRadius="full" mb={4} bg="railx.700" />
        <Flex justify="space-between">
          {steps.map((step, index) => {
            const isCompleted = index < activeStep;
            const isActive = index === activeStep;
            return (
              <VStack key={index} spacing={1} zIndex={1}>
                <Circle 
                  size="30px" 
                  bg={isCompleted ? 'railx.accent' : isActive ? 'railx.accent' : 'railx.700'} 
                  color={isCompleted || isActive ? 'black' : 'gray.500'}
                  fontWeight="bold"
                  borderWidth="2px"
                  borderColor={isActive ? 'white' : 'transparent'}
                >
                  {isCompleted ? <Icon as={FaCheck} size="sm" /> : index + 1}
                </Circle>
                <Text fontSize="xs" fontWeight="bold" color={isActive ? 'white' : 'gray.500'}>
                  {step.title}
                </Text>
              </VStack>
            );
          })}
        </Flex>
      </Box>
    );
  };

  // --- Render Steps ---

  const renderStep1 = () => (
    <SimpleGrid columns={2} spacing={6} w="full">
      <Card 
        cursor="pointer" 
        bg={userType === 'INDIVIDUAL' ? 'whiteAlpha.200' : 'railx.800'}
        borderColor={userType === 'INDIVIDUAL' ? 'railx.accent' : 'railx.700'}
        borderWidth="2px"
        onClick={() => setUserType('INDIVIDUAL')}
        _hover={{ bg: 'whiteAlpha.100' }}
      >
        <CardBody textAlign="center" py={10}>
          <Icon as={FaUser} boxSize={10} color={userType === 'INDIVIDUAL' ? 'railx.accent' : 'gray.500'} mb={4} />
          <Heading size="md" color="white">개인 (Individual)</Heading>
          <Text fontSize="sm" color="gray.400" mt={2}>프리랜서, 개인 투자자</Text>
        </CardBody>
      </Card>
      <Card 
        cursor="pointer" 
        bg={userType === 'CORPORATE' ? 'whiteAlpha.200' : 'railx.800'}
        borderColor={userType === 'CORPORATE' ? 'railx.accent' : 'railx.700'}
        borderWidth="2px"
        onClick={() => setUserType('CORPORATE')}
        _hover={{ bg: 'whiteAlpha.100' }}
      >
        <CardBody textAlign="center" py={10}>
          <Icon as={FaBuilding} boxSize={10} color={userType === 'CORPORATE' ? 'railx.accent' : 'gray.500'} mb={4} />
          <Heading size="md" color="white">법인 (Corporate)</Heading>
          <Text fontSize="sm" color="gray.400" mt={2}>스타트업, 기업, DAO</Text>
        </CardBody>
      </Card>
    </SimpleGrid>
  );

  const renderStep2 = () => (
    <VStack spacing={4} w="full">
      <Heading size="sm" color="gray.300" alignSelf="start">
        {userType === 'INDIVIDUAL' ? '개인 신원 정보 (IVMS101)' : '법인 정보 (IVMS101)'}
      </Heading>
      <SimpleGrid columns={2} spacing={4} w="full">
        <FormControl isRequired>
          <FormLabel>{userType === 'INDIVIDUAL' ? '이름 (Name)' : '법인명 (Entity Name)'}</FormLabel>
          <Input name="name" value={kycData.name} onChange={handleInputChange} />
        </FormControl>
        <FormControl isRequired>
          <FormLabel>국가 (Country)</FormLabel>
          <Select name="country" value={kycData.country} onChange={handleInputChange} bg="railx.900">
            <option value="KR">South Korea</option>
            <option value="US">United States</option>
            <option value="HK">Hong Kong</option>
            <option value="SG">Singapore</option>
          </Select>
        </FormControl>
      </SimpleGrid>
      <SimpleGrid columns={2} spacing={4} w="full">
        <FormControl isRequired>
          <FormLabel>도시 (City)</FormLabel>
          <Input name="city" value={kycData.city} onChange={handleInputChange} />
        </FormControl>
        <FormControl>
          <FormLabel>상세 주소 (Address) (선택)</FormLabel>
          <Input name="address" value={kycData.address} onChange={handleInputChange} />
        </FormControl>
      </SimpleGrid>
      {userType === 'INDIVIDUAL' ? (
        <SimpleGrid columns={2} spacing={4} w="full">
          <FormControl isRequired>
            <FormLabel>생년월일 (DOB)</FormLabel>
            <Input type="date" name="dob" value={kycData.dob} onChange={handleInputChange} />
          </FormControl>
          <FormControl>
            <FormLabel>주민/여권번호 (선택)</FormLabel>
            <Input name="nationalId" value={kycData.nationalId} onChange={handleInputChange} placeholder="Optional" />
          </FormControl>
        </SimpleGrid>
      ) : (
        <>
          <SimpleGrid columns={2} spacing={4} w="full">
            <FormControl isRequired>
              <FormLabel>설립일 (Date of Inc)</FormLabel>
              <Input type="date" name="incorporationDate" value={kycData.incorporationDate} onChange={handleInputChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>사업자번호 / LEI</FormLabel>
              <Input name="bizRegNumber" value={kycData.bizRegNumber} onChange={handleInputChange} />
            </FormControl>
          </SimpleGrid>
          <SimpleGrid columns={2} spacing={4} w="full">
            <FormControl isRequired>
              <FormLabel>담당자 이름</FormLabel>
              <Input name="contactName" value={kycData.contactName} onChange={handleInputChange} />
            </FormControl>
            <FormControl isRequired>
              <FormLabel>담당자 이메일</FormLabel>
              <Input name="contactEmail" value={kycData.contactEmail} onChange={handleInputChange} />
            </FormControl>
          </SimpleGrid>
        </>
      )}
    </VStack>
  );

  const renderStep3 = () => (
    <VStack spacing={6} w="full">
      <Heading size="sm" color="gray.300" alignSelf="start">리포팅 및 회계 설정</Heading>
      <FormControl>
        <FormLabel>신고/보고 관할 (Jurisdiction)</FormLabel>
        <Select 
          value={settings.reportJurisdiction} 
          onChange={(e) => setSettings({...settings, reportJurisdiction: e.target.value as any})}
          bg="railx.900"
        >
          <option value="KR">대한민국 (KR)</option>
          <option value="US">미국 (US)</option>
          <option value="HK">홍콩 (HK)</option>
        </Select>
      </FormControl>
      <FormControl>
        <FormLabel>회계 기준 (Accounting Standard)</FormLabel>
        <Select 
          value={settings.accountingStandard} 
          onChange={(e) => setSettings({...settings, accountingStandard: e.target.value as any})}
          bg="railx.900"
        >
          <option value="K-IFRS">K-IFRS</option>
          <option value="IFRS">IFRS</option>
          <option value="US-GAAP">US GAAP</option>
        </Select>
      </FormControl>
    </VStack>
  );

  const renderStep4 = () => (
    <VStack spacing={6} w="full" textAlign="center" py={4}>
      <Icon as={FaLock} boxSize={12} color="railx.accent" />
      <Box>
        <Heading size="md" color="white" mb={2}>보안 키 생성 및 서명</Heading>
        <Text color="gray.400" fontSize="sm">
          마지막 단계입니다.<br/>
          지갑 서명을 통해 <b>RailX 전용 암호화 키</b>를 생성하고 안전하게 연결합니다.<br/>
          <br/>
          <b>키는 별도로 다운로드되지 않으며, 오직 지갑 서명으로만 접근 가능합니다.</b>
        </Text>
      </Box>
      
      <HStack bg="green.900" p={4} borderRadius="md" spacing={4}>
        <Icon as={FaCheckCircle} color="green.300" />
        <Text fontSize="xs" textAlign="left" color="green.100">
          <b>Wallet-Based Security:</b> 지갑이 곧 열쇠입니다. 별도의 파일을 관리할 필요가 없습니다.
        </Text>
      </HStack>
    </VStack>
  );

  return (
    <Box maxW="container.md" mx="auto" py={10} px={4}>
      <Card bg="railx.900" borderColor="railx.700" borderWidth="1px">
        <CardBody>
          {/* Custom Stepper Render */}
          {renderStepper()}

          <Box minH="300px" display="flex" alignItems="center" justifyContent="center">
            {activeStep === 0 && renderStep1()}
            {activeStep === 1 && renderStep2()}
            {activeStep === 2 && renderStep3()}
            {activeStep === 3 && renderStep4()}
          </Box>

          <Divider my={8} borderColor="railx.700" />

          <HStack justify="space-between">
            <Button isDisabled={activeStep === 0} onClick={handleBack} variant="ghost">Back</Button>
            {activeStep < steps.length - 1 ? (
              <Button colorScheme="yellow" onClick={handleNext} px={8}>Next</Button>
            ) : (
              <Button 
                colorScheme="yellow" 
                onClick={handleFinalize} 
                isLoading={loading} 
                loadingText="Setting up..."
                px={8}
              >
                Complete & Connect
              </Button>
            )}
          </HStack>
        </CardBody>
      </Card>
    </Box>
  );
}