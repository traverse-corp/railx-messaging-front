import React, { useEffect, useRef } from 'react';
import createGlobe from 'cobe';
import { Box, Button, Container, Heading, Text, VStack } from '@chakra-ui/react';
import { useNavigate } from 'react-router-dom';

export function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let phi = 0;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const setupGlobe = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      // 실제 화면에서의 canvas 크기
      const { width, height } = parent.getBoundingClientRect();

      // canvas의 실제 픽셀 버퍼 크기 세팅 (이게 제일 중요)
      canvas.width = width * dpr;
      canvas.height = height * dpr;

      // 기존 globe 있으면 제거
      globeRef.current?.destroy();

      globeRef.current = createGlobe(canvas, {
        devicePixelRatio: dpr,
        width: canvas.width,
        height: canvas.height,
        phi: 0,
        theta: 0,
        dark: 1,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 6,
        baseColor: [0.1, 0.1, 0.1],
        markerColor: [0.8, 0.7, 0.2],
        glowColor: [0.1, 0.1, 0.15],
        markers: [
          { location: [37.5665, 126.9780], size: 0.1 },
          { location: [35.6762, 139.6503], size: 0.1 },
        ],
        onRender: (state) => {
          state.phi = phi;
          phi += 0.002;
        },
      });
    };

    setupGlobe();
    window.addEventListener('resize', setupGlobe);

    return () => {
      window.removeEventListener('resize', setupGlobe);
      globeRef.current?.destroy();
    };
  }, []);

  return (
    <Box w="100vw" h="100vh" overflow="hidden" bg="#1f1f1fff" position="relative">
      {/* 배경 지구본 */}
      <Box
        position="absolute"
        top="50%"
        left="50%"
        transform="translate(-50%, -50%)"
        w={{ base: "800px", md: "1600px", lg: "1400px" }}
        h={{ base: "800px", md: "1600px", lg: "1400px" }}
        zIndex={0}
        opacity={0.5}
        pointerEvents="none"
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
          }}
        />
      </Box>

      {/* 콘텐츠 */}
      <Container centerContent position="relative" zIndex={1} h="full" justifyContent="center">
        <VStack spacing={8}>
          <Heading
            as="h1"
            size="4xl"
            bgGradient="linear(to-r, #fff, #aaa)"
            bgClip="text"
            letterSpacing="tighter"
            textAlign="center"
          >
            RailX
          </Heading>
          <Text fontSize="xl" color="gray.400" maxW="xl" textAlign="center">
            The Fastest, Safest and most Compliant Stablecoin FX Protocol.<br />
          </Text>

          <Button
            size="lg"
            variant="primary"
            h="60px"
            px={10}
            fontSize="lg"
            onClick={() => navigate('/app')}
            boxShadow="0 0 30px rgba(201, 176, 55, 0.4)"
          >
            Initialize Protocol
          </Button>
        </VStack>
      </Container>
    </Box>
  );
}
