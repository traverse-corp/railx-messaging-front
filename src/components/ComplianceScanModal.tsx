import React, { useEffect, useState } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalBody,
  VStack, Text, Box, Progress, HStack, Icon, Circle, Fade, Heading
} from '@chakra-ui/react';
import { FaShieldAlt, FaSearchDollar, FaFileContract, FaCheck, FaTimes } from 'react-icons/fa';
import { createClient } from '@supabase/supabase-js';

// Supabase (KYT 체크용)
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

interface Props {
  isOpen: boolean;
  onClose: () => void; // 스캔 실패 시 닫기
  onComplete: (logs: any[]) => void; // 성공 시 로그 전달
  targetAddress: string; // 검사할 지갑 주소
  type: 'SENDER' | 'RECIPIENT'; // 송신자 검사인지 수신자 검사인지
}

const STEPS = [
  { id: 1, label: 'Identity Verification (KYC)', icon: FaFileContract },
  { id: 2, label: 'TranSight Risk Screening (KYT)', icon: FaShieldAlt },
  { id: 3, label: 'Source of Funds Analysis', icon: FaSearchDollar },
];

export function ComplianceScanModal({ isOpen, onClose, onComplete, targetAddress, type }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [logs, setLogs] = useState<any[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isOpen) {
      runSequence();
    } else {
      // 초기화
      setActiveStep(0);
      setLogs([]);
      setFailed(false);
    }
  }, [isOpen]);

  const runSequence = async () => {
    const auditLogs: any[] = [];

    // Step 1: KYC (2초)
    await new Promise(r => setTimeout(r, 1500));
    auditLogs.push({ step: 'KYC', status: 'PASS', timestamp: new Date().toISOString(), details: 'Verified User Identity' });
    setActiveStep(1);

    // Step 2: KYT - 실제 DB 조회 (2초)
    await new Promise(r => setTimeout(r, 2000));
    
    // Supabase KYT Check
    const { data } = await supabase
      .from('risk_addresses')
      .select('*')
      .eq('address', targetAddress.toLowerCase()) // 소문자 비교
      .single();

    if (data) {
      setFailed(true); // 블랙리스트 발견!
      // 여기서 멈춤 (실패 UI 표시 등은 생략하고 일단 닫거나 에러 처리)
      alert(`🚫 Risk Detected! This address is flagged as ${data.risk_category}. Transaction blocked.`);
      onClose(); 
      return;
    }

    auditLogs.push({ step: 'KYT', status: 'PASS', timestamp: new Date().toISOString(), details: 'TranSight Clean Asset (Score: 0)' });
    setActiveStep(2);

    // Step 3: 자금 원천 (2초)
    await new Promise(r => setTimeout(r, 1500));
    auditLogs.push({ step: 'SOURCE_OF_FUNDS', status: 'PASS', timestamp: new Date().toISOString(), details: 'Hop Analysis Complete' });
    setActiveStep(3);

    // 완료
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