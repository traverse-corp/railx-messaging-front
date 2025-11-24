export function downloadCSV(filename: string, headers: string[], rows: Record<string, string>[]) {
  // 1. CSV 헤더 생성
  const headerRow = headers.join(',');

  // 2. CSV 행 생성 (콤마가 들어간 데이터는 따옴표로 감싸기)
  const dataRows = rows.map(row => {
    return Object.values(row).map(val => {
      const stringVal = String(val || '');
      if (stringVal.includes(',')) return `"${stringVal}"`;
      return stringVal;
    }).join(',');
  });

  const csvContent = [headerRow, ...dataRows].join('\n');

  // 3. BOM 추가 (엑셀 한글 깨짐 방지)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // 4. 다운로드 트리거
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}