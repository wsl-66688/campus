(function(root){
'use strict';
const CATEGORIES = ['全部', '生活服务', '校园活动', '学习教务', '校园出行', '其他'];
const CAMPUSES = ['全校', '主校区', '南校区', '北校区', '东校区', '其他校区'];
const PLACES = ['松园', '柳园', '荷园', '菊园', '南校区', '北校区', '东校区', '主校区'];
const MAX_RECORDS = 500;
const TOPICS = [
  ['热水', '开水', '打水', '茶炉房', '锅炉房'], ['洗澡', '洗浴', '浴池', '淋浴'],
  ['食堂', '餐厅', '吃饭'], ['快递', '驿站'], ['校车', '交通车', '电瓶车'],
  ['图书馆', '借书'], ['自习', '自习室'], ['考试'], ['讲座', '报告会'],
  ['比赛', '竞赛'], ['社团', '招募'], ['校门', '出入校'], ['校园卡', '学生卡'],
  ['水电', '充值'], ['维修', '报修'], ['停水', '停供'], ['停电']
];
function dayInShanghai(now) {
  return new Date((now == null ? Date.now() : new Date(now).getTime()) + 8 * 3600000).toISOString().slice(0, 10);
}
function isLive(record, day) {
  const current = day || dayInShanghai();
  return record.status === 'published' && (!record.validFrom || record.validFrom <= current) && (!record.validUntil || record.validUntil >= current);
}
function normalize(value) {
  return String(value || '').toLowerCase().replace(/[\s，。？！、；：“”‘’（）【】《》,.?!;:'"()[\]{}<>\/\\\-—_]/g, '');
}
function unique(values) { return Array.from(new Set(values)); }
function queryInfo(query) {
  const q = normalize(query);
  const places = PLACES.filter(place => q.indexOf(place) !== -1);
  const topics = TOPICS.filter(group => group.some(word => q.indexOf(word) !== -1));
  let remaining = q;
  places.forEach(word => { remaining = remaining.split(word).join(''); });
  remaining = remaining.replace(/郑州大学|郑大|学校|校园|请问|我想知道|我想问|能不能|有没有|是不是|什么时候|什么时间|到几点|几点|怎么样|哪里|怎么|如何|多少|哪些|现在|今天|最近|本周|周末|明天|供应|开放|时间|可以|一下|这个|那个|还有|关于|什么|是否|的|了|吗|呢|有|在|是|能|我|问/g, '');
  const grams = [];
  for (let i = 0; i < remaining.length - 1; i += 1) grams.push(remaining.slice(i, i + 2));
  const activity = /活动/.test(q) && topics.length === 0;
  const ambiguous = q.indexOf('热水') !== -1 && !/开水|锅炉房|茶炉房|浴池|洗澡|洗浴|淋浴|宿舍/.test(q);
  const place = places.find(p => /园$/.test(p)) || '';
  return {q, places, topics, grams:unique(grams), activity, clarification:ambiguous ? {message:'你想查询打开水，还是洗浴用的热水？', suggestions:[place + '茶炉房开水供应时间', place + '浴池洗浴开放时间']} : null};
}
function searchRecords(records, query, options) {
  const settings = options || {}, day = settings.day || dayInShanghai();
  const filtered = records.filter(record => isLive(record, day))
    .filter(record => !settings.category || settings.category === '全部' || record.category === settings.category)
    .filter(record => !settings.campus || settings.campus === '全校' || record.campus === '全校' || record.campus === settings.campus);
  if (!String(query || '').trim()) return {records:filtered.sort((a,b) => String(b.updatedAt).localeCompare(String(a.updatedAt))), clarification:null};
  const info = queryInfo(query);
  if (info.clarification) return {records:[], clarification:info.clarification};
  const scored = filtered.map(record => {
    const title = normalize(record.title), body = normalize(record.content), location = normalize([record.campus, record.location, record.title].join(''));
    if (info.places.some(place => location.indexOf(place) === -1 && body.indexOf(place) === -1)) return {record, score:0};
    if (/茶炉房|锅炉房|开水|打水/.test(info.q) && !/茶炉房|锅炉房|开水|打水/.test(title + body)) return {record,score:0};
    if (/浴池|洗浴|洗澡|淋浴/.test(info.q) && !/浴池|洗浴|洗澡|淋浴/.test(title + body)) return {record,score:0};
    const matchedTopics = info.topics.filter(group => group.some(word => (title + body).indexOf(word) !== -1));
    if (info.topics.length && !matchedTopics.length) return {record, score:0};
    let score = title.indexOf(info.q) !== -1 ? 80 : 0;
    matchedTopics.forEach(group => { score += group.some(word => title.indexOf(word) !== -1) ? 14 : 7; });
    info.grams.forEach(word => { score += title.indexOf(word) !== -1 ? 5 : body.indexOf(word) !== -1 ? 2 : 0; });
    if (!info.topics.length && !info.grams.length && info.places.length) score += 8;
    if (info.activity && record.category === '校园活动') score += 12;
    return {record, score};
  }).filter(row => row.score >= 6).sort((a,b) => b.score - a.score || String(b.record.updatedAt).localeCompare(String(a.record.updatedAt)));
  return {records:scored.slice(0, 10).map(row => row.record), clarification:null};
}
function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
function validateRecord(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('资料格式不正确。');
  function text(key, limit) {
    if (input[key] != null && typeof input[key] !== 'string') throw new Error('资料字段格式不正确。');
    const value = String(input[key] || '').trim();
    if (value.length > limit) throw new Error('资料内容太长，请分成几条后保存。');
    return value;
  }
  const row = {
    title:text('title',160), content:text('content',20000), category:text('category',30) || '其他',
    campus:text('campus',30) || '全校', location:text('location',120), sourceName:text('sourceName',160),
    sourceUrl:text('sourceUrl',2000), validFrom:text('validFrom',10), validUntil:text('validUntil',10), status:text('status',20) || 'draft'
  };
  if (!row.title) throw new Error('请填写资料标题。');
  if (CATEGORIES.slice(1).indexOf(row.category) === -1 || CAMPUSES.indexOf(row.campus) === -1) throw new Error('请选择有效的分类与校区。');
  if (['draft','published'].indexOf(row.status) === -1) throw new Error('资料状态无效。');
  if (row.status === 'published' && (!row.content || (!row.sourceName && !row.sourceUrl))) throw new Error('发布前请填写正文和信息来源。');
  if (row.sourceUrl && (!/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(row.sourceUrl) || /^https?:\/\/[^/]*@/i.test(row.sourceUrl))) throw new Error('来源链接须为有效的 http:// 或 https:// 地址。');
  [row.validFrom,row.validUntil].forEach(date => { if (date && !validDate(date)) throw new Error('请填写有效的日期。'); });
  if (row.validFrom && row.validUntil && row.validFrom > row.validUntil) throw new Error('结束日期应在生效日期之后。');
  return row;
}
function makeId() { return 'record_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,12); }
function displayRecord(record) {
  const row = Object.assign({},record);
  row.id = row.id || row._id;
  row.sourceLabel = row.sourceName || '原始来源';
  row.timeLabel = row.validUntil ? '有效至 ' + row.validUntil : row.updatedAt ? '更新于 ' + dayInShanghai(row.updatedAt) : '未标注更新时间';
  row.statusLabel = row.status === 'draft' ? '草稿' : isLive(row) ? '可查询' : row.validFrom > dayInShanghai() ? '未生效' : '已过期';
  row.excerpt = row.content.slice(0,90) + (row.content.length > 90 ? '…' : '');
  return row;
}
function summary(record) { return Object.assign({},record,{content:record.content.slice(0,90),hasMoreContent:record.content.length > 90}); }
function prepareImport(payload) {
  const rows = Array.isArray(payload) ? payload : payload && payload.records;
  if (!Array.isArray(rows) || !rows.length || rows.length > 20) throw new Error('每次请导入1至20条资料。支持本站导出的JSON备份格式。');
  return rows.map(row => Object.assign(validateRecord(Object.assign({},row,{status:'draft'})),{id:makeId()}));
}
const core = {CATEGORIES,CAMPUSES,MAX_RECORDS,dayInShanghai,isLive,searchRecords,validateRecord,makeId,displayRecord,summary,prepareImport};

if(typeof module!=="undefined" && module.exports)module.exports=core;else root.CampusCore=core;
})(typeof globalThis!=="undefined"?globalThis:this);
