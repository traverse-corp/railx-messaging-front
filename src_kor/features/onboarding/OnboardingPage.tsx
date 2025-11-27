import React, { useState, useEffect } from 'react';
import { 
  Box, Button, Heading, Text, VStack, useToast, Card, CardBody, 
  HStack, FormControl, FormLabel, Select, Divider, SimpleGrid, Icon, Input,
  Flex, Circle, Progress, Alert, AlertIcon, Spinner
} from '@chakra-ui/react';
import { useAccount, useSignMessage } from 'wagmi';
import { createClient } from '@supabase/supabase-js';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaBuilding, FaLock, FaCheck, FaUnlock, FaShieldAlt } from 'react-icons/fa';

// Utils & Constants
import { 
  generateRSAKeyPair, deriveKeyFromSignature, lockPrivateKey, exportPublicKeyToPem,
  unlockPrivateKey, encryptDataPacket, decryptDataPacket, importPublicKeyFromPem
} from '../../utils/crypto';
import { RAILX_SIGNING_MESSAGE } from '../../utils/constants';

// Types
import type { UserType, KycData, UserSettings } from '../../types/onboarding';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const steps = [
  { title: 'Type', description: '유저 유형' },
  { title: 'KYC', description: '기본 정보' },
  { title: 'Settings', description: '리포트 설정' },
  { title: 'Security', description: '키 관리' },
];

export function OnboardingPage() {
  const { address } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const toast = useToast();
  const navigate = useNavigate();
  
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  
  // --- 상태 관리: 잠금 모드 & 데이터 존재 여부 ---
  const [isChecking, setIsChecking] = useState(true); // 초기 로딩
  const [hasProfile, setHasProfile] = useState(false); // 프로필 존재 여부
  const [isLocked, setIsLocked] = useState(false); // 잠김 상태
  const [myPrivateKey, setMyPrivateKey] = useState<CryptoKey | null>(null); // 메모리에 로드된 키

  // --- 폼 데이터 State ---
  const [userType, setUserType] = useState<UserType>('INDIVIDUAL');
  const [kycData, setKycData] = useState<KycData>({
    name: '', country: 'KR', city: '', address: '',
    dob: '', nationalId: '',
    incorporationDate: '', bizRegNumber: '', contactName: '', contactEmail: ''
  });
  const [settings, setSettings] = useState<UserSettings>({
      reportJurisdiction: 'KR',
      accountingStandard: 'K-IFRS',
      baseCurrency: 'KRW',
      fiscalYearEnd: '12-31',
      includeTaxReports: true,
      includeFxReports: true
    });
  // --- 1. 초기 진입 시 프로필 확인 ---
  useEffect(() => {
    if (!address) return;
    const checkProfile = async () => {
      setIsChecking(true);
      const targetAddress = address.toLowerCase();
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', targetAddress)
        .single();

      if (data && !error) {
        console.log("🔒 Encrypted Profile Found");
        setHasProfile(true);
        setIsLocked(true); // 데이터가 있으면 일단 잠금
      } else {
        setHasProfile(false);
        setIsLocked(false); // 없으면 신규 가입 모드
      }
      setIsChecking(false);
    };
    checkProfile();
  }, [address]);


  // --- 2. 잠금 해제 (Unlock & Decrypt) ---
  const handleUnlock = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const targetAddress = address.toLowerCase();
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('wallet_address', targetAddress)
        .single();

      if (!data) throw new Error("프로필을 찾을 수 없습니다.");

      // 1) 지갑 서명으로 개인키 복구
      const message = `${RAILX_SIGNING_MESSAGE}${targetAddress}`;
      const sig = await signMessageAsync({ message });
      const derivedKey = await deriveKeyFromSignature(sig, targetAddress);
      const privKey = await unlockPrivateKey(data.encrypted_rsa_private_key, derivedKey);
      
      setMyPrivateKey(privKey); // 메모리에 키 로드

      // 2) 암호화된 KYC/Settings 데이터 복호화
      // kyc_data 컬럼에 암호화 패킷이 들어있다고 가정 (구조: { encrypted: true, packet: ... })
      if (data.kyc_data && data.kyc_data.encrypted) {
        const decryptedPayload = await decryptDataPacket(data.kyc_data.packet, privKey);
        
        // 복구된 데이터로 폼 채우기
        if (decryptedPayload.userType) setUserType(decryptedPayload.userType);
        if (decryptedPayload.kycData) setKycData(decryptedPayload.kycData);
        if (decryptedPayload.settings) setSettings(decryptedPayload.settings);
        
        toast({ status: 'success', title: '잠금 해제됨', description: '정보를 수정할 수 있습니다.' });
      } else {
        // 레거시 데이터(평문)인 경우 (이전 버전 호환성)
        if (data.user_type) setUserType(data.user_type);
        if (data.kyc_data) setKycData(data.kyc_data);
        if (data.settings) setSettings(data.settings);
        toast({ status: 'warning', title: '레거시 데이터', description: '저장 시 암호화되어 업데이트됩니다.' });
      }

      setIsLocked(false); // 잠금 풀림 -> 수정 화면으로

    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: '해제 실패', description: '서명이 일치하지 않거나 데이터가 손상되었습니다.' });
    } finally {
      setLoading(false);
    }
  };


  // --- 3. 저장 / 업데이트 (Encrypt & Save) ---
// ★ 핵심: 키 생성 및 최종 저장 로직 (수정됨)
  const handleFinalize = async () => {
    if (!address) return;
    setLoading(true);
    try {
      const targetAddress = address.toLowerCase();
      
      let encryptionKey: CryptoKey; // 데이터를 암호화할 공개키
      let pubKeyPemToSave: string | undefined = undefined;
      let lockedPrivKeyToSave: string | undefined = undefined;

      // (A) 신규 유저 (또는 키가 없는 경우): 키 새로 생성
      if (!hasProfile) {
        // 1. 키 생성
        const keyPair = await generateRSAKeyPair();
        
        // 2. 서명 (비밀번호)
        const message = `${RAILX_SIGNING_MESSAGE}${targetAddress}`;
        const sig = await signMessageAsync({ message });

        // 3. 개인키 잠그기
        const derivedKey = await deriveKeyFromSignature(sig, targetAddress);
        const lockedPrivKey = await lockPrivateKey(keyPair.privateKey, derivedKey);
        const pubKeyPem = await exportPublicKeyToPem(keyPair.publicKey);

        // 저장할 변수 설정
        encryptionKey = keyPair.publicKey;
        pubKeyPemToSave = pubKeyPem;
        lockedPrivKeyToSave = lockedPrivKey;
        
        // 메모리에 로드 (바로 쓸 수 있게)
        setMyPrivateKey(keyPair.privateKey); 
      } 
      // (B) 기존 유저: DB에 있는 내 공개키 가져오기
      else {
        // DB에서 내 Public Key 조회
        const { data, error } = await supabase
          .from('profiles')
          .select('public_key')
          .eq('wallet_address', targetAddress)
          .single();
          
        if (error || !data?.public_key) {
          throw new Error("기존 프로필의 공개키를 찾을 수 없습니다. 초기화가 필요할 수 있습니다.");
        }

        // PEM -> CryptoKey 변환 (암호화에 사용하기 위해)
        encryptionKey = await importPublicKeyFromPem(data.public_key);
      }

      // (C) 데이터 암호화 (E2EE)
      // 내 공개키(encryptionKey)로 내 데이터 패킷을 암호화
      const payload = { userType, kycData, settings };
      const encryptedPacket = await encryptDataPacket(payload, encryptionKey);

      // (D) Supabase 저장 (Upsert)
      const upsertData: any = {
        wallet_address: targetAddress,
        // 암호화된 데이터 구조 저장
        kyc_data: { encrypted: true, packet: encryptedPacket }, 
        settings: { encrypted: true }, 
        user_type: userType,
      };

      // 신규 가입일 때만 키 정보(공개키/암호화된 개인키)를 덮어씀
      if (!hasProfile && pubKeyPemToSave && lockedPrivKeyToSave) {
        upsertData.public_key = pubKeyPemToSave;
        upsertData.encrypted_rsa_private_key = lockedPrivKeyToSave;
      }

      const { error } = await supabase.from('profiles').upsert(upsertData);

      if(error) throw error;

      toast({ 
        status: 'success', 
        title: hasProfile ? '정보 업데이트 완료' : '온보딩 완료', 
        description: '모든 정보가 안전하게 암호화되어 저장되었습니다.' 
      });
      
      // 업데이트 후에는 잠금 상태를 풀거나 유지 (여기서는 앱으로 이동)
      navigate('/app');

    } catch (e: any) {
      console.error(e);
      toast({ status: 'error', title: '저장 실패', description: e.message });
    } finally {
      setLoading(false);
    }
  };

  // --- Handlers ---
  const handleNext = () => setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  const handleBack = () => setActiveStep((prev) => Math.max(prev - 1, 0));
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setKycData(prev => ({ ...prev, [name]: value }));
  };

  // --- Render Stepper ---
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
              <VStack key={index} spacing={1} zIndex={1} bg="railx.900" px={2}>
                <Circle 
                  size="30px" 
                  bg={isCompleted || isActive ? 'railx.accent' : 'railx.700'} 
                  color={isCompleted || isActive ? 'black' : 'gray.500'}
                  fontWeight="bold" borderWidth="2px" borderColor={isActive ? 'white' : 'transparent'}
                >
                  {isCompleted ? <Icon as={FaCheck} size="sm" /> : index + 1}
                </Circle>
                <Text fontSize="xs" fontWeight="bold" color={isActive ? 'white' : 'gray.500'}>{step.title}</Text>
              </VStack>
            );
          })}
        </Flex>
      </Box>
    );
  };

  // --- Render Steps (Content) ---
  const renderStep1 = () => (
    <SimpleGrid columns={2} spacing={6} w="full">
      <Card 
        cursor="pointer" bg={userType === 'INDIVIDUAL' ? 'whiteAlpha.200' : 'railx.800'}
        borderColor={userType === 'INDIVIDUAL' ? 'railx.accent' : 'railx.700'} borderWidth="2px"
        onClick={() => setUserType('INDIVIDUAL')} _hover={{ bg: 'whiteAlpha.100' }}
      >
        <CardBody textAlign="center" py={10}>
          <Icon as={FaUser} boxSize={10} color={userType === 'INDIVIDUAL' ? 'railx.accent' : 'gray.500'} mb={4} />
          <Heading size="md" color="white">개인 (Individual)</Heading>
        </CardBody>
      </Card>
      <Card 
        cursor="pointer" bg={userType === 'CORPORATE' ? 'whiteAlpha.200' : 'railx.800'}
        borderColor={userType === 'CORPORATE' ? 'railx.accent' : 'railx.700'} borderWidth="2px"
        onClick={() => setUserType('CORPORATE')} _hover={{ bg: 'whiteAlpha.100' }}
      >
        <CardBody textAlign="center" py={10}>
          <Icon as={FaBuilding} boxSize={10} color={userType === 'CORPORATE' ? 'railx.accent' : 'gray.500'} mb={4} />
          <Heading size="md" color="white">법인 (Corporate)</Heading>
        </CardBody>
      </Card>
    </SimpleGrid>
  );

// Step 2: KYC / IVMS101 Data Form
  const renderStep2 = () => (
    <VStack spacing={6} w="full" align="stretch">
      <Box>
        <Heading size="sm" color="gray.300" mb={2}>
          {userType === 'INDIVIDUAL' ? '개인 신원 정보 (IVMS101)' : '법인 정보 (IVMS101)'}
        </Heading>
        <Text fontSize="xs" color="gray.500">
          * FATF Travel Rule 및 외환거래법 준수를 위해 상세 주소와 식별 번호를 정확히 입력해주세요.
        </Text>
      </Box>
      
      {/* 공통 필드: 이름, 국가 */}
      <SimpleGrid columns={2} spacing={4}>
        <FormControl isRequired>
          <FormLabel color="gray.400" fontSize="sm">
            {userType === 'INDIVIDUAL' ? '성명 (Full Legal Name)' : '법인명 (Entity Name)'}
          </FormLabel>
          <Input 
            name="name" 
            value={kycData.name} 
            onChange={handleInputChange} 
            placeholder={userType === 'INDIVIDUAL' ? '여권상 영문 성명' : '등기부상 영문 법인명'}
            bg="railx.900"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel color="gray.400" fontSize="sm">국가 (Country)</FormLabel>
          <Select 
            name="country" 
            value={kycData.country} 
            onChange={handleInputChange} 
            bg="railx.900"
          >
            <option value="KR">대한민국 (South Korea)</option>
            <option value="US">미국 (United States)</option>
            <option value="HK">홍콩 (Hong Kong)</option>
            <option value="SG">싱가포르 (Singapore)</option>
            {/* 필요시 국가 추가 */}
          </Select>
        </FormControl>
      </SimpleGrid>

      {/* 공통 필드: 도시, 상세주소 (FATF 필수) */}
      <SimpleGrid columns={2} spacing={4}>
        <FormControl isRequired>
          <FormLabel color="gray.400" fontSize="sm">도시 (City)</FormLabel>
          <Input 
            name="city" 
            value={kycData.city} 
            onChange={handleInputChange} 
            placeholder="Seoul"
            bg="railx.900"
          />
        </FormControl>
        <FormControl isRequired>
          <FormLabel color="gray.400" fontSize="sm">우편번호 (Zip Code)</FormLabel>
          <Input 
            name="zipCode" // KycData 타입에 zipCode가 없다면 address에 포함하거나 타입 추가 필요
            placeholder="06234"
            bg="railx.900"
            // 임시로 address 뒤에 붙이거나 별도 필드로 처리 (여기선 예시)
          />
        </FormControl>
      </SimpleGrid>

      <FormControl isRequired>
        <FormLabel color="gray.400" fontSize="sm">상세 주소 (Street Address)</FormLabel>
        <Input 
          name="address" 
          value={kycData.address} 
          onChange={handleInputChange} 
          placeholder="123 Teheran-ro, Gangnam-gu"
          bg="railx.900"
        />
      </FormControl>

      <Divider borderColor="railx.700" />

      {/* 타입별 고유 필드 */}
      {userType === 'INDIVIDUAL' ? (
        // [개인] 생년월일, 식별번호
        <SimpleGrid columns={2} spacing={4}>
          <FormControl isRequired>
            <FormLabel color="gray.400" fontSize="sm">생년월일 (Date of Birth)</FormLabel>
            <Input 
              type="date" 
              name="dob" 
              value={kycData.dob} 
              onChange={handleInputChange} 
              bg="railx.900"
            />
          </FormControl>
          <FormControl>
            <FormLabel color="gray.400" fontSize="sm">여권/주민번호 (National ID)</FormLabel>
            <Input 
              name="nationalId" 
              value={kycData.nationalId} 
              onChange={handleInputChange} 
              placeholder="암호화되어 저장됩니다"
              bg="railx.900"
            />
          </FormControl>
        </SimpleGrid>
      ) : (
        // [법인] 설립일, 사업자번호, 담당자
        <>
          <SimpleGrid columns={2} spacing={4}>
            <FormControl isRequired>
              <FormLabel color="gray.400" fontSize="sm">설립일 (Date of Incorp.)</FormLabel>
              <Input 
                type="date" 
                name="incorporationDate" 
                value={kycData.incorporationDate} 
                onChange={handleInputChange} 
                bg="railx.900"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="gray.400" fontSize="sm">사업자/법인 번호 (Biz Reg. No / LEI)</FormLabel>
              <Input 
                name="bizRegNumber" 
                value={kycData.bizRegNumber} 
                onChange={handleInputChange} 
                placeholder="123-45-67890"
                bg="railx.900"
              />
            </FormControl>
          </SimpleGrid>

          <SimpleGrid columns={2} spacing={4}>
            <FormControl isRequired>
              <FormLabel color="gray.400" fontSize="sm">담당자 성명 (Contact Person)</FormLabel>
              <Input 
                name="contactName" 
                value={kycData.contactName} 
                onChange={handleInputChange} 
                bg="railx.900"
              />
            </FormControl>
            <FormControl isRequired>
              <FormLabel color="gray.400" fontSize="sm">담당자 이메일 (Contact Email)</FormLabel>
              <Input 
                type="email"
                name="contactEmail" 
                value={kycData.contactEmail} 
                onChange={handleInputChange} 
                bg="railx.900"
              />
            </FormControl>
          </SimpleGrid>
        </>
      )}
    </VStack>
  );

// Step 3: Settings (Enhanced)
  const renderStep3 = () => {
    // 국가별 제공되는 리포트 모듈 (시각적 표시용)
    const reportModules = {
      KR: ['외국환거래계산서 (지급/수령)', '거주자 계정 신고서', '법인세 과표 산출 내역'],
      US: ['IRS Form 8949 (Sales/Dispositions)', 'FBAR Worksheet', 'Schedule D Output'],
      HK: ['Profits Tax Return Support', 'Significant Controller Register'],
      SG: ['GST F5 Return Data', 'IRAS Corp Tax Schedule'],
    };

    const currentModules = reportModules[settings.reportJurisdiction as keyof typeof reportModules] || [];

    return (
      <VStack spacing={6} w="full" align="stretch">
        <Heading size="sm" color="gray.300">Compliance & Reporting Preferences</Heading>
        
        <SimpleGrid columns={2} spacing={4}>
          <FormControl>
            <FormLabel color="gray.400">신고 관할 (Jurisdiction)</FormLabel>
            <Select 
              value={settings.reportJurisdiction} 
              onChange={(e) => {
                const val = e.target.value as any;
                // 관할 변경 시 통화/회계기준 자동 추천
                const defaults: any = {
                  KR: { curr: 'KRW', std: 'K-IFRS' },
                  US: { curr: 'USD', std: 'US-GAAP' },
                  HK: { curr: 'HKD', std: 'IFRS' },
                  SG: { curr: 'SGD', std: 'SFRS' }
                };
                setSettings({
                  ...settings, 
                  reportJurisdiction: val,
                  baseCurrency: defaults[val].curr,
                  accountingStandard: defaults[val].std
                });
              }}
              bg="railx.900"
            >
              <option value="KR">South Korea (KR)</option>
              <option value="US">United States (US)</option>
              <option value="HK">Hong Kong (HK)</option>
              <option value="SG">Singapore (SG)</option>
            </Select>
          </FormControl>

          <FormControl>
            <FormLabel color="gray.400">회계 기준 (Standard)</FormLabel>
            <Select 
              value={settings.accountingStandard} 
              onChange={(e) => setSettings({...settings, accountingStandard: e.target.value as any})}
              bg="railx.900"
            >
              <option value="K-IFRS">K-IFRS</option>
              <option value="IFRS">IFRS (International)</option>
              <option value="US-GAAP">US GAAP</option>
              <option value="SFRS">SFRS (Singapore)</option>
            </Select>
          </FormControl>
        </SimpleGrid>

        <SimpleGrid columns={2} spacing={4}>
          <FormControl>
            <FormLabel color="gray.400">기준 통화 (Base Currency)</FormLabel>
            <Select 
              value={settings.baseCurrency} 
              onChange={(e) => setSettings({...settings, baseCurrency: e.target.value as any})}
              bg="railx.900"
            >
              <option value="KRW">KRW (₩)</option>
              <option value="USD">USD ($)</option>
              <option value="HKD">HKD (HK$)</option>
              <option value="SGD">SGD (S$)</option>
            </Select>
          </FormControl>

          {userType === 'CORPORATE' && (
            <FormControl>
              <FormLabel color="gray.400">회계연도 종료 (Fiscal Year End)</FormLabel>
              <Input 
                placeholder="MM-DD" 
                value={settings.fiscalYearEnd} 
                onChange={(e) => setSettings({...settings, fiscalYearEnd: e.target.value})}
              />
            </FormControl>
          )}
        </SimpleGrid>

        <Divider borderColor="railx.700" />

        {/* Active Modules Display */}
        <Box bg="whiteAlpha.50" p={4} borderRadius="md">
          <Text fontSize="xs" color="railx.accent" mb={3} fontWeight="bold">
            INCLUDED REGULATORY PACKAGES ({settings.reportJurisdiction})
          </Text>
          <VStack align="start" spacing={2}>
            {currentModules.map((mod, idx) => (
              <HStack key={idx}>
                <Icon as={FaCheck} color="green.400" boxSize={3} />
                <Text fontSize="sm" color="gray.300">{mod}</Text>
              </HStack>
            ))}
            <HStack>
              <Icon as={FaCheck} color="green.400" boxSize={3} />
              <Text fontSize="sm" color="gray.300">Real-time AML/KYT Monitoring</Text>
            </HStack>
          </VStack>
        </Box>
      </VStack>
    );
  };

  const renderStep4 = () => (
    <VStack spacing={6} w="full" textAlign="center" py={4}>
      <Icon as={FaShieldAlt} boxSize={12} color="railx.accent" />
      <Box>
        <Heading size="md" color="white" mb={2}>{hasProfile ? '정보 수정 및 재암호화' : '보안 키 생성 및 저장'}</Heading>
        <Text color="gray.400" fontSize="sm">
          {hasProfile 
            ? '변경된 정보를 귀하의 공개키로 다시 암호화하여 저장합니다. 서버는 내용을 볼 수 없습니다.'
            : '지갑 서명을 통해 보안 키를 생성하고, 정보를 암호화하여 저장합니다.'}
        </Text>
      </Box>
    </VStack>
  );

  // --- 0. 로딩 화면 ---
  if (isChecking) {
    return <Flex h="50vh" justify="center" align="center"><Spinner color="railx.accent" /></Flex>;
  }

  // --- 1. 잠금 화면 (Locked View) ---
  if (isLocked) {
    return (
      <Box maxW="container.md" mx="auto" py={10} px={4}>
        <Card bg="railx.800" borderColor="railx.700" borderWidth="1px" py={10}>
          <CardBody textAlign="center">
            <VStack spacing={6}>
              <Icon as={FaLock} boxSize={16} color="gray.500" />
              <Heading size="lg" color="white">Profile Locked</Heading>
              <Text color="gray.400" maxW="md">
                안전하게 암호화된 프로필 정보가 있습니다.<br/>
                내용을 확인하거나 수정하려면 <b>지갑 서명</b>으로 잠금을 해제하세요.
              </Text>
              <Button 
                size="lg" 
                colorScheme="yellow" 
                leftIcon={<FaUnlock />} 
                onClick={handleUnlock}
                isLoading={loading}
                loadingText="Decrypting..."
              >
                Unlock with Wallet
              </Button>
            </VStack>
          </CardBody>
        </Card>
      </Box>
    );
  }

  // --- 2. 위저드 화면 (Unlocked or New) ---
  return (
    <Box maxW="container.md" mx="auto" py={10} px={4}>
      <Card bg="railx.900" borderColor="railx.700" borderWidth="1px">
        <CardBody>
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
                loadingText={hasProfile ? "Updating..." : "Creating..."}
                px={8}
              >
                {hasProfile ? 'Update Profile' : 'Create & Encrypt'}
              </Button>
            )}
          </HStack>
        </CardBody>
      </Card>
    </Box>
  );
}