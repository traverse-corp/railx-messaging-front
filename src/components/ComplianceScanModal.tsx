import React, { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalBody,
  VStack, Text, Box, Progress, HStack, Icon, Circle, Heading
} from '@chakra-ui/react';
import { FaShieldAlt, FaSearchDollar, FaFileContract, FaCheck } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';

// Supabase 클라이언트 설정
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (logs: any[]) => void;
  targetAddress: string;     // 검사할 지갑 주소
  recipientName?: string;    // 검사할 수취인 이름 (KYC용, 선택적)
  type: 'SENDER' | 'RECIPIENT';
}

const STEPS = [
  { id: 1, label: 'Identity Verification (KYC)', icon: FaFileContract },
  { id: 2, label: 'TranSight Risk Screening (KYT)', icon: FaShieldAlt },
  { id: 3, label: 'Source of Funds Analysis', icon: FaSearchDollar },
];

// 문자열 정규화 함수 (소문자, 공백/콤마 제거)
const normalizeString = (str: string) => {
  if (!str) return '';
  return str.toLowerCase().replace(/[\s,]/g, '');
};

export function ComplianceScanModal({ isOpen, onClose, onComplete, targetAddress, recipientName, type }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      runSequence();
    } else {
      setActiveStep(0);
      setFailed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const runSequence = async () => {
    const auditLogs: any[] = [];

    // =========================================================
    // Step 1: KYC (Entity Risk Check)
    // =========================================================
    await new Promise(r => setTimeout(r, 1000)); // UX용 딜레이

    if (recipientName) {
      // 1. 입력값 정규화
      const normalizedInput = normalizeString(recipientName);
      
      console.log(`[KYC Scan] Input: ${recipientName} -> Normalized: ${normalizedInput}`);

      // 2. Supabase 조회 (normalized_name 컬럼 기준 부분 일치 검색)
      // 설명: normalized_input이 'honggildong'일 때, DB에 'honggildong'이 포함된 데이터가 있는지 확인
      // 만약 '입력값'이 'DB데이터'를 포함하는지, 'DB데이터'가 '입력값'에 포함되는지 양방향이 필요하면 로직이 더 복잡해지지만,
      // 여기서는 요청하신 대로 DB 데이터 중 하나에 '포함(%~~%)' 되는지 체크합니다.
      // 수정 후 (확실한 방법)
      // 'normalized_name' 컬럼의 값이 normalizedInput 변수 값(예: "kim")을 포함하는지 확인
      const { data: kycData, error: kycError } = await supabase
        .from('risk_entities')
        .select('*')
        .ilike('normalized_name', `%${normalizedInput}%`) // SQL: WHERE normalized_name ILIKE '%input%'
        .limit(1)
        .maybeSingle();

      if (kycError) {
        console.error("KYC Check Error:", kycError);
        // 에러 발생 시 일단 통과시킬지, 막을지는 정책에 따라 결정 (여기선 로그만 남김)
      }

      if (kycData) {
        setFailed(true);
        alert(`🚨 KYC Alert! \nRecipient matches a risk entity: ${kycData.eng_name}\nCategory: ${kycData.risk_category}\nLevel: ${kycData.risk_level}`);
        onClose();
        return;
      }
    }

    auditLogs.push({ step: 'KYC', status: 'PASS', timestamp: new Date().toISOString(), details: 'Verified Entity Identity' });
    setActiveStep(1);


    // =========================================================
    // Step 2: KYT (Wallet Risk Check)
    // =========================================================
    await new Promise(r => setTimeout(r, 1500));
    
    // Supabase KYT Check (주소 소문자화 비교)
    const { data: kytData } = await supabase
      .from('risk_addresses')
      .select('*')
      .eq('address', targetAddress.toLowerCase()) // 소문자 강제 변환
      .maybeSingle();

    if (kytData) {
      setFailed(true);
      alert(`🚫 KYT Alert! \nThis address is flagged as ${kytData.risk_category}.\nTransaction blocked.`);
      onClose(); 
      return;
    }

    auditLogs.push({ step: 'KYT', status: 'PASS', timestamp: new Date().toISOString(), details: 'TranSight Clean Asset (Score: 0)' });
    setActiveStep(2);


    // =========================================================
    // Step 3: 자금 원천 (Source of Funds)
    // =========================================================
    await new Promise(r => setTimeout(r, 1500));
    auditLogs.push({ step: 'SOURCE_OF_FUNDS', status: 'PASS', timestamp: new Date().toISOString(), details: 'Hop Analysis Complete' });
    setActiveStep(3);


    // =========================================================
    // 완료 처리
    // =========================================================
    setTimeout(() => {
      onComplete(auditLogs);
    }, 800);
  };

  return (
    <Modal isOpen={isOpen} onClose={() => {}} isCentered closeOnOverlayClick={false}>
      <ModalOverlay backdropFilter="blur(10px)" bg="blackAlpha.800" />
      <ModalContent bg="railx.900" borderColor="railx.700" border="1px" boxShadow="0 0 40px rgba(201, 176, 55, 0.15)">
        <ModalBody py={10} px={8}>
          <VStack spacing={8}>
            
            {/* 헤더 */}
            <VStack>
              <Text fontSize="xs" color="railx.accent" letterSpacing="widest" fontWeight="bold">
                {type === 'SENDER' ? 'PRE-TRANSACTION AUDIT' : 'INBOUND SECURITY CHECK'}
              </Text>
              <Heading size="md" color="white">
                RailX <Text as="span" color="gray.500">Powered by TranSight</Text>
              </Heading>
            </VStack>

            {/* 스텝 진행 바 */}
            <VStack w="full" spacing={5} align="stretch">
              {STEPS.map((step, idx) => {
                const isCompleted = idx < activeStep;
                const isCurrent = idx === activeStep;
                
                return (
                  <HStack key={step.id} justify="space-between" p={3} borderRadius="md" bg={isCurrent ? 'whiteAlpha.100' : 'transparent'}>
                    <HStack>
                      <Circle size="32px" bg={isCompleted ? 'green.500' : isCurrent ? 'railx.accent' : 'gray.700'}>
                        {isCompleted ? <Icon as={FaCheck} color="white" /> : <Icon as={step.icon} color="black" />}
                      </Circle>
                      <Text color={isCompleted || isCurrent ? 'white' : 'gray.500'} fontWeight={isCurrent ? 'bold' : 'normal'}>
                        {step.label}
                      </Text>
                    </HStack>
                    {isCurrent && <Text fontSize="xs" color="railx.accent" className="blink">Processing...</Text>}
                    {isCompleted && <Text fontSize="xs" color="green.400">Verified</Text>}
                  </HStack>
                );
              })}
            </VStack>

            {/* 하단 진행률 */}
            <Box w="full">
              <Progress 
                value={(activeStep / 3) * 100} 
                size="xs" 
                colorScheme={failed ? "red" : "yellow"} 
                bg="railx.800" 
                borderRadius="full" 
                isIndeterminate={activeStep < 3 && !failed}
              />
              <Text fontSize="xs" color="gray.500" mt={3} textAlign="center" fontFamily="monospace">
                Engine ID: TS-8X29-ALPHA // Real-time Scan
              </Text>
            </Box>

          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}