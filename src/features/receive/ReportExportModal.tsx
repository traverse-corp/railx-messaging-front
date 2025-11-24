import React, { useState, useEffect } from 'react';
import {
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Button, Select, VStack, FormControl, FormLabel, Input, SimpleGrid,
  Text, Table, Thead, Tbody, Tr, Th, Td, Box, useToast, Divider
} from '@chakra-ui/react';
import { DownloadIcon } from '@chakra-ui/icons';
import type { TransactionMetadata } from '../send/types';
import { TEMPLATES} from './reportTemplates';
import type { ReportTemplate } from './reportTemplates';
import { downloadCSV } from '../../utils/csvHelper';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  decryptedData: TransactionMetadata | null;
}

export function ReportExportModal({ isOpen, onClose, decryptedData }: Props) {
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(TEMPLATES[0].id);
  const [reportData, setReportData] = useState<Record<string, string>>({});
  const toast = useToast();

  // 템플릿 선택 시 데이터 자동 매핑
  useEffect(() => {
    if (decryptedData && selectedTemplateId) {
      const template = TEMPLATES.find(t => t.id === selectedTemplateId);
      if (template) {
        // 1. 자동 매핑 실행
        const autoFilled = template.mapper(decryptedData);
        // 2. 상태 업데이트
        setReportData(autoFilled);
      }
    }
  }, [selectedTemplateId, decryptedData]);

  const handleInputChange = (key: string, value: string) => {
    setReportData(prev => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    const template = TEMPLATES.find(t => t.id === selectedTemplateId);
    if (!template) return;

    // 헤더(라벨)와 데이터 준비
    const headers = template.fields.map(f => f.label);
    
    // 현재 reportData는 키-값 쌍이므로, 템플릿 순서대로 값을 정렬해야 함
    // 하지만 csvHelper는 row 객체를 받으므로, 여기서는 단일 행 CSV를 만듭니다.
    // (여러 건을 한 번에 뽑는 기능은 나중에 확장 가능)
    
    // CSV용 행 데이터 만들기 (Key 대신 Label 순서에 맞춰 값을 정렬하거나, 객체를 넘김)
    // 여기서는 csvHelper가 단순히 Object.values를 쓰면 순서가 보장 안 될 수 있으므로
    // 순서가 보장된 객체를 새로 만듭니다.
    const orderedRow: Record<string, string> = {};
    template.fields.forEach(f => {
      orderedRow[f.label] = reportData[f.key] || '';
    });

    downloadCSV(`RailX_Report_${template.id}_${Date.now()}.csv`, headers, [orderedRow]);
    
    toast({ title: '다운로드 완료', status: 'success', duration: 2000 });
    onClose();
  };

  const currentTemplate = TEMPLATES.find(t => t.id === selectedTemplateId);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" scrollBehavior="inside">
      <ModalOverlay backdropFilter="blur(5px)" />
      <ModalContent bg="railx.800" borderColor="railx.700" border="1px solid" color="white">
        <ModalHeader>Export Compliance Report</ModalHeader>
        <ModalBody>
          <VStack spacing={6} align="stretch">
            
            {/* 1. 템플릿 선택 */}
            <FormControl>
              <FormLabel color="gray.400">Select Jurisdiction & Format</FormLabel>
              <Select 
                bg="railx.900" 
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
              >
                {TEMPLATES.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </Select>
              <Text fontSize="sm" color="gray.500" mt={2}>
                {currentTemplate?.description}
              </Text>
            </FormControl>

            <Divider borderColor="railx.700" />

            {/* 2. 데이터 미리보기 및 수정 */}
            <Box>
              <Text mb={4} fontWeight="bold" color="railx.accent">Data Preview & Edit</Text>
              <Table variant="simple" size="sm">
                <Thead>
                  <Tr>
                    <Th color="gray.400">Field</Th>
                    <Th color="gray.400">Value</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {currentTemplate?.fields.map((field) => (
                    <Tr key={field.key}>
                      <Td color="gray.300" w="40%">{field.label} {field.required && '*'}</Td>
                      <Td>
                        <Input 
                          size="sm" 
                          variant="flushed" 
                          placeholder={field.placeholder || '-'}
                          value={reportData[field.key] || ''}
                          onChange={(e) => handleInputChange(field.key, e.target.value)}
                          color="white"
                          borderColor="gray.600"
                          _focus={{ borderColor: 'railx.accent' }}
                        />
                      </Td>
                    </Tr>
                  ))}
                </Tbody>
              </Table>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter borderTop="1px solid" borderColor="railx.700">
          <Button variant="ghost" mr={3} onClick={onClose}>Cancel</Button>
          <Button 
            colorScheme="yellow" 
            leftIcon={<DownloadIcon />} 
            onClick={handleExport}
          >
            Export CSV
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}