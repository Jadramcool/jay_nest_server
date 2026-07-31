export interface NoticeSeedData {
  title: string
  content: string
  type: 'NOTICE' | 'INFO' | 'ACTIVITY'
  authorId: number
  status: number
  isPinned: boolean
  isMandatory: boolean
  scopeType: string
  publishedAt?: Date
  createdTime: Date
}

export const notices: NoticeSeedData[] = [
  {
    title: '系统升级维护通知',
    content: '亲爱的用户，系统将于本周六凌晨 2:00-6:00 进行升级维护，届时部分服务将暂时不可用，请提前安排好工作。',
    type: 'NOTICE',
    authorId: 1,
    status: 1,
    isPinned: true,
    isMandatory: true,
    scopeType: 'ALL',
    publishedAt: new Date('2026-07-20T10:00:00Z'),
    createdTime: new Date('2026-07-19T09:00:00Z'),
  },
  {
    title: '第二季度团建活动报名',
    content: '公司将于 8 月中旬组织第二季度团建活动，地点为黄山，请各部门统计参加人数，于 7 月 30 日前提交至行政部。',
    type: 'ACTIVITY',
    authorId: 1,
    status: 1,
    isPinned: false,
    isMandatory: false,
    scopeType: 'ALL',
    publishedAt: new Date('2026-07-22T08:00:00Z'),
    createdTime: new Date('2026-07-21T14:00:00Z'),
  },
  {
    title: '新员工入职培训安排',
    content: '本月新员工入职培训将于 7 月 28 日（周四）下午 14:00 在 3 楼会议室举行，请通知相关新员工准时参加。',
    type: 'INFO',
    authorId: 1,
    status: 0,
    isPinned: false,
    isMandatory: false,
    scopeType: 'DEPARTMENT',
    createdTime: new Date('2026-07-23T08:30:00Z'),
  },
]
