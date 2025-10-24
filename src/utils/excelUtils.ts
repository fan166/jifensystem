import * as XLSX from 'xlsx';

export interface RewardImportData {
  userId: string;
  userName: string;
  rewardType: string;
  score: number;
  awardDate: string;
  description?: string;
  awardedBy?: string;
}

export interface ImportResult {
  success: boolean;
  data?: RewardImportData[];
  errors?: string[];
}

/**
 * 解析Excel或CSV文件
 * @param file 文件对象
 * @returns 解析结果
 */
export const parseExcelFile = async (file: File): Promise<ImportResult> => {
  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length < 2) {
      return {
        success: false,
        errors: ['文件内容为空或格式不正确']
      };
    }

    const headers = jsonData[0] as string[];
    const rows = jsonData.slice(1) as any[][];

    // 验证必需的列
    const requiredColumns = ['用户ID', '用户姓名', '奖励类型', '积分', '颁发日期'];
    const missingColumns = requiredColumns.filter(col => !headers.includes(col));
    
    if (missingColumns.length > 0) {
      return {
        success: false,
        errors: [`缺少必需的列: ${missingColumns.join(', ')}`]
      };
    }

    const data: RewardImportData[] = [];
    const errors: string[] = [];

    rows.forEach((row, index) => {
      const rowNum = index + 2; // Excel行号从2开始（第1行是标题）
      
      try {
        const userId = row[headers.indexOf('用户ID')]?.toString().trim();
        const userName = row[headers.indexOf('用户姓名')]?.toString().trim();
        const rewardType = row[headers.indexOf('奖励类型')]?.toString().trim();
        const score = parseFloat(row[headers.indexOf('积分')]);
        const awardDate = row[headers.indexOf('颁发日期')];
        const description = row[headers.indexOf('描述')]?.toString().trim() || '';
        const awardedBy = row[headers.indexOf('颁发人')]?.toString().trim() || '';

        // 验证必需字段
        if (!userId) {
          errors.push(`第${rowNum}行：用户ID不能为空`);
          return;
        }
        if (!userName) {
          errors.push(`第${rowNum}行：用户姓名不能为空`);
          return;
        }
        if (!rewardType) {
          errors.push(`第${rowNum}行：奖励类型不能为空`);
          return;
        }
        if (isNaN(score) || score <= 0) {
          errors.push(`第${rowNum}行：积分必须是大于0的数字`);
          return;
        }
        if (!awardDate) {
          errors.push(`第${rowNum}行：颁发日期不能为空`);
          return;
        }

        // 处理日期格式
        let formattedDate: string;
        if (typeof awardDate === 'number') {
          // Excel日期序列号
          const date = XLSX.SSF.parse_date_code(awardDate);
          formattedDate = `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
        } else {
          // 字符串日期
          const date = new Date(awardDate);
          if (isNaN(date.getTime())) {
            errors.push(`第${rowNum}行：日期格式不正确`);
            return;
          }
          formattedDate = date.toISOString().split('T')[0];
        }

        data.push({
          userId,
          userName,
          rewardType,
          score,
          awardDate: formattedDate,
          description,
          awardedBy
        });
      } catch (error) {
        errors.push(`第${rowNum}行：数据解析错误 - ${error}`);
      }
    });

    if (errors.length > 0) {
      return {
        success: false,
        errors
      };
    }

    return {
      success: true,
      data
    };
  } catch (error) {
    return {
      success: false,
      errors: [`文件解析失败: ${error}`]
    };
  }
};

/**
 * 生成Excel模板
 * @returns Excel文件的Blob对象
 */
export const generateExcelTemplate = (): Blob => {
  const templateData = [
    ['用户ID', '用户姓名', '奖励类型', '积分', '颁发日期', '描述', '颁发人'],
    ['user001', '张三', '优秀员工', '100', '2024-01-15', '年度优秀员工奖励', '李经理'],
    ['user002', '李四', '创新奖励', '50', '2024-01-20', '技术创新贡献奖', '王总监']
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(templateData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '奖励积分模板');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/**
 * 下载Excel模板
 */
export const downloadExcelTemplate = () => {
  const blob = generateExcelTemplate();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '绩效奖励积分导入模板.xlsx';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};