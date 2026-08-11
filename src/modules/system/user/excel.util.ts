import { Workbook } from 'exceljs';

/** 性别显示映射 */
const SEX_LABELS: Record<string, string> = {
  MALE: '男',
  FEMALE: '女',
  OTHER: '其他',
};

interface ExportUserRow {
  username: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  sex?: string | null;
  status: number;
  roles?: string[];
  departmentName?: string | null;
  position?: string | null;
  createdTime: Date;
}

/** 导出列定义 */
const EXPORT_COLUMNS = [
  { header: '用户名', key: 'username', width: 18 },
  { header: '姓名', key: 'name', width: 14 },
  { header: '手机号', key: 'phone', width: 16 },
  { header: '邮箱', key: 'email', width: 26 },
  { header: '性别', key: 'sex', width: 8 },
  { header: '状态', key: 'status', width: 8 },
  { header: '角色', key: 'roles', width: 22 },
  { header: '部门', key: 'departmentName', width: 14 },
  { header: '职位', key: 'position', width: 14 },
  { header: '创建时间', key: 'createdTime', width: 22 },
];

/** 导入模板列(与 parseUserImport 的解析顺序一致) */
const IMPORT_COLUMNS = [
  { header: '用户名*', key: 'username', width: 18 },
  { header: '姓名', key: 'name', width: 14 },
  { header: '密码(默认123456)', key: 'password', width: 16 },
  { header: '手机号', key: 'phone', width: 16 },
  { header: '邮箱', key: 'email', width: 26 },
  { header: '性别(男/女/其他)', key: 'sex', width: 14 },
  { header: '职位', key: 'position', width: 14 },
  { header: '部门名称', key: 'departmentName', width: 14 },
];

function styleHeaderRow(sheet: import('exceljs').Worksheet) {
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).height = 20;
}

/** 构建用户导出工作簿 */
export function buildUserExportWorkbook(rows: ExportUserRow[]) {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('用户列表');

  sheet.columns = EXPORT_COLUMNS;
  styleHeaderRow(sheet);

  for (const row of rows) {
    sheet.addRow({
      username: row.username,
      name: row.name ?? '',
      phone: row.phone ?? '',
      email: row.email ?? '',
      sex: SEX_LABELS[row.sex ?? 'OTHER'] ?? '',
      status: row.status === 1 ? '启用' : '禁用',
      roles: row.roles?.join('、') ?? '',
      departmentName: row.departmentName ?? '',
      position: row.position ?? '',
      createdTime: row.createdTime.toISOString().replace('T', ' ').slice(0, 19),
    });
  }

  return workbook;
}

/** 构建用户导入模板工作簿(表头 + 示例行) */
export function buildUserImportTemplateWorkbook() {
  const workbook = new Workbook();
  const sheet = workbook.addWorksheet('用户导入');

  sheet.columns = IMPORT_COLUMNS;
  styleHeaderRow(sheet);
  sheet.addRow({
    username: 'zhangsan',
    name: '张三',
    password: '123456',
    phone: '13800138000',
    email: 'zhangsan@example.com',
    sex: '男',
    position: '前端开发工程师',
    departmentName: '前端组',
  });

  return workbook;
}

export interface ImportUserRow {
  username: string;
  name?: string;
  password?: string;
  phone?: string;
  email?: string;
  sex?: string;
  position?: string;
  departmentName?: string;
}

/** 解析导入文件(第一行为表头,从第二行开始读取) */
export async function parseUserImport(
  buffer: Buffer,
): Promise<ImportUserRow[]> {
  const workbook = new Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    return [];
  }

  const rows: ImportUserRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }
    const cell = (index: number) => row.getCell(index).value;
    const text = (value: unknown) =>
      typeof value === 'string' || typeof value === 'number'
        ? String(value).trim()
        : '';

    const username = text(cell(1));
    if (!username) {
      return; // 跳过空行
    }

    const sexText = text(cell(6)).toUpperCase();
    const sex =
      sexText === '男' || sexText === 'MALE'
        ? 'MALE'
        : sexText === '女' || sexText === 'FEMALE'
          ? 'FEMALE'
          : sexText === '其他' || sexText === 'OTHER'
            ? 'OTHER'
            : undefined;

    rows.push({
      username,
      name: text(cell(2)) || undefined,
      password: text(cell(3)) || undefined,
      phone: text(cell(4)) || undefined,
      email: text(cell(5)) || undefined,
      sex,
      position: text(cell(7)) || undefined,
      departmentName: text(cell(8)) || undefined,
    });
  });

  return rows;
}
