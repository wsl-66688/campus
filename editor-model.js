(function(root,factory){if(typeof module!=='undefined'&&module.exports)module.exports=factory(require('./knowledge-core.js'));else root.CampusModel=factory(root.CampusCore);})(typeof globalThis!=='undefined'?globalThis:this,function(core){
  'use strict';
  function readRecords(payload){
    const rows=Array.isArray(payload)?payload:payload&&payload.records;
    if(!Array.isArray(rows)||rows.length>core.MAX_RECORDS)throw new Error('资料文件格式不正确，或超过500条资料上限。');
    const seen=new Set();
    return rows.map(input=>{const row=core.validateRecord(input);const id=typeof input.id==='string'&&input.id.length<=128?input.id:core.makeId();if(seen.has(id))throw new Error('资料文件存在重复编号，请检查后重新导入。');seen.add(id);return Object.assign(row,{id,createdAt:validTimestamp(input.createdAt),updatedAt:validTimestamp(input.updatedAt)});});
  }
  function validTimestamp(value){return typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():'';}
  function parseFile(text){let value=String(text).replace(/^\uFEFF/,'').trim();if(value.startsWith('window.CAMPUS_DATA')){const match=value.match(/^window\.CAMPUS_DATA\s*=\s*([\s\S]*?)\s*;?\s*$/);if(!match)throw new Error('请使用本项目导出的data.js或JSON文件。');value=match[1];}let payload;try{payload=JSON.parse(value);}catch(error){throw new Error('文件格式不正确，请选择本项目的JSON备份或data.js。');}return readRecords(payload);}
  function importDrafts(existing,incoming){if(existing.length+incoming.length>core.MAX_RECORDS)throw new Error('导入后超过500条上限，请先整理旧资料。');const now=new Date().toISOString();return existing.concat(incoming.map(row=>Object.assign({},core.validateRecord(Object.assign({},row,{status:'draft'})),{id:core.makeId(),createdAt:now,updatedAt:now})));}
  function publicPayload(rows,now){const normalized=readRecords(rows);return{schemaVersion:1,updatedAt:now||new Date().toISOString(),records:normalized.filter(row=>row.status==='published')};}
  function serializePublic(rows,now){return 'window.CAMPUS_DATA = '+JSON.stringify(publicPayload(rows,now),null,2).replace(/</g,'\\u003c').replace(/\u2028/g,'\\u2028').replace(/\u2029/g,'\\u2029')+';\n';}
  function saveRecord(rows,input,status){const row=core.validateRecord(Object.assign({},input,{status}));const current=rows.find(value=>value.id===input.id);if(!current&&rows.length>=core.MAX_RECORDS)throw new Error('首版最多500条资料，请先整理旧资料。');const now=new Date().toISOString(),next=Object.assign({},row,{id:input.id||core.makeId(),createdAt:current?current.createdAt:now,updatedAt:now});return{records:rows.filter(value=>value.id!==next.id).concat([next]),record:next};}
  return{readRecords,parseFile,importDrafts,publicPayload,serializePublic,saveRecord};
});
