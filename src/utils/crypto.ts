// src/utils/crypto.ts

// ==================================================================
// 1. 안전한 Base64 변환 유틸리티
// ==================================================================

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  if (!base64) {
    throw new Error("Base64 string is null or undefined");
  }
  
  const cleanBase64 = base64.replace(/[\s\n]/g, ''); // 공백, 줄바꿈 제거
  
  try {
    const binary_string = atob(cleanBase64);
    const len = binary_string.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes;
  } catch (e) {
    console.error("Base64 decoding failed:", base64);
    throw new Error("Invalid Base64 string");
  }
}

// ==================================================================
// 2. 키 관리 함수들
// ==================================================================

export async function generateRSAKeyPair() {
  return await window.crypto.subtle.generateKey(
    {
      name: "RSA-OAEP",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function deriveKeyFromSignature(signature: string, salt: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await window.crypto.subtle.importKey(
    "raw",
    enc.encode(signature),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: enc.encode(salt),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function lockPrivateKey(privateKey: CryptoKey, derivedKey: CryptoKey): Promise<string> {
  const jwk = await window.crypto.subtle.exportKey("jwk", privateKey);
  const jwkString = JSON.stringify(jwk);
  
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedJwk = new TextEncoder().encode(jwkString);
  
  const encryptedBuffer = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    encodedJwk
  );

  const combined = new Uint8Array(iv.length + encryptedBuffer.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encryptedBuffer), iv.length);
  
  return arrayBufferToBase64(combined.buffer);
}

export async function unlockPrivateKey(encryptedBase64: string, derivedKey: CryptoKey): Promise<CryptoKey> {
  const combined = base64ToUint8Array(encryptedBase64);
  
  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12);

  const decryptedBuffer = await window.crypto.subtle.decrypt(
    { name: "AES-GCM", iv: iv },
    derivedKey,
    ciphertext
  );

  const jwkString = new TextDecoder().decode(decryptedBuffer);
  const jwk = JSON.parse(jwkString);

  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["decrypt"]
  );
}

export async function exportPublicKeyToPem(key: CryptoKey): Promise<string> {
  const exported = await window.crypto.subtle.exportKey("spki", key);
  const exportedAsBase64 = arrayBufferToBase64(exported);
  return `-----BEGIN PUBLIC KEY-----\n${exportedAsBase64}\n-----END PUBLIC KEY-----`;
}

export async function importPublicKeyFromPem(pem: string): Promise<CryptoKey> {
  const pemContents = pem.replace(/-----BEGIN PUBLIC KEY-----|-----END PUBLIC KEY-----|\s/g, "");
  const binaryDer = base64ToUint8Array(pemContents);

  return await window.crypto.subtle.importKey(
    "spki",
    // 🔥 [FIX] 여기서 발생하는 에러를 'as any'로 무시
    binaryDer.buffer as any, 
    { name: "RSA-OAEP", hash: "SHA-256" },
    true,
    ["encrypt"]
  );
}
// ... (상단 import 및 다른 함수들은 그대로 유지)

// ==================================================================
// 3. 데이터 암복호화 (디버깅 강화 버전)
// ==================================================================
export async function encryptDataPacket(data: any, recipientPublicKey: CryptoKey) {
  const aesKey = await window.crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt"]
  );

  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(JSON.stringify(data));
  
  const encryptedContent = await window.crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encodedData
  );

  const rawAesKey = await window.crypto.subtle.exportKey("raw", aesKey);
  const encryptedAesKey = await window.crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    recipientPublicKey,
    rawAesKey
  );

  return {
    iv: arrayBufferToBase64(iv.buffer),
    content: arrayBufferToBase64(encryptedContent),
    key: arrayBufferToBase64(encryptedAesKey)
  };
}

export async function decryptDataPacket(packet: any, myPrivateKey: CryptoKey) {
  console.log("📦 [Decrypt Debug] Received Packet:", packet);

  // 1. 패킷 유효성 검사
  if (!packet) {
    throw new Error("Decryption Failed: Packet is null or undefined");
  }

  // 2. 데이터 추출 (구조가 다를 경우를 대비해 유연하게 처리)
  // Supabase Storage에서 JSON을 불러올 때, 가끔 { "iv": "...", ... } 형태가 아니라
  // { "data": { "iv": "..." } } 처럼 한 번 더 감싸져 있을 수 있음
  const data = packet.data || packet; 

  const keyStr = data.key || data.encryptedAesKey; // 변수명 호환성 체크
  const ivStr = data.iv;
  const contentStr = data.content || data.encryptedContent; // 변수명 호환성 체크

  // 3. 필수 필드 검사
  if (!keyStr || !ivStr || !contentStr) {
    console.error("❌ [Decrypt Error] Missing fields in packet:", data);
    throw new Error(
      `Decryption Failed: Missing required fields. (Found: key=${!!keyStr}, iv=${!!ivStr}, content=${!!contentStr})`
    );
  }

  try {
    // 4. Base64 디코딩
    const encryptedAesKey = base64ToUint8Array(keyStr);
    const iv = base64ToUint8Array(ivStr);
    const encryptedContent = base64ToUint8Array(contentStr);

    // 5. (A) AES 키 복호화 (Unwrap)
    const rawAesKey = await window.crypto.subtle.decrypt(
      { name: "RSA-OAEP" },
      myPrivateKey,
      encryptedAesKey
    );
    
    const aesKey = await window.crypto.subtle.importKey(
      "raw",
      rawAesKey,
      { name: "AES-GCM" },
      false,
      ["decrypt"]
    );

    // 6. (B) 콘텐츠 복호화
    const decryptedBuffer = await window.crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      aesKey,
      encryptedContent
    );

    const result = JSON.parse(new TextDecoder().decode(decryptedBuffer));
    console.log("✅ [Decrypt Success] Result:", result);
    return result;

  } catch (e: any) {
    console.error("❌ [Decrypt Failed] Internal Error:", e);
    throw new Error(`Decryption process failed: ${e.message}`);
  }
}