import {chromium} from '@playwright/test';
import fs from 'node:fs';
const out='docs/step18-1';
const browser=await chromium.launch();
const checks=[];const responses=[];
const replay=process.argv.includes('--replay-classification');
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  if(replay){
    const saved=JSON.parse(fs.readFileSync(out+'/workflow-results.json','utf8'));
    const body=saved.responses.find(x=>x.url.endsWith('/classify')).body;
    await page.route('**/api/local-ai/classify',route=>route.fulfill({json:body}));
    checks.push('Classification response replayed from the preceding live CPU run; session and calculator remain live');
  }
  page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('response',async response=>{
    if(response.url().includes('/api/local-ai/') && !response.url().endsWith('/session')) {
      try{responses.push({url:response.url(),status:response.status(),body:await response.json()});}catch{}
    }
  });
  await page.goto('http://127.0.0.1:5178');
  const panel=page.getByRole('region',{name:'Local AI prototype'});
  await panel.locator('summary').click();
  await panel.getByLabel('Document file',{exact:true}).setInputFiles(out+'/noi-reviewed-fixture.csv');
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('textarea')).some(e=>e.value.includes('gross potential rent')));
  await panel.getByLabel('Classification device').selectOption('cpu');
  await panel.getByRole('button',{name:'Suggest document type'}).click();
  await panel.getByRole('button',{name:'Confirm document type'}).waitFor({state:'visible'});
  await page.waitForFunction(()=>!Array.from(document.querySelectorAll('button')).find(b=>b.textContent==='Suggest document type')?.disabled,null,{timeout:250000});
  const suggestion=await panel.getByLabel('Suggested type (editable)').inputValue();
  checks.push({check:'Live uploaded CSV classification via explicit CPU fallback',suggestion});
  await panel.getByLabel('Suggested type (editable)').selectOption('T-12');
  await panel.getByRole('button',{name:'Confirm document type'}).click();
  const review=panel.getByRole('region',{name:'Financial extraction review'});
  await review.getByRole('button',{name:'Extract financial rows'}).click();
  await review.getByLabel('value · row 6',{exact:true}).fill('2500');
  await review.getByRole('button',{name:'Prepare reviewed calculator inputs'}).click();
  const editor=panel.getByLabel('Reviewed inputs (annual USD, rates as decimals)');
  const value=JSON.parse(await editor.inputValue());
  if(value.other_income_usd_annual!=='2500' || value.credit_loss_rate!==0)throw Error('Incorrect extracted values');
  const calculate=panel.getByRole('button',{name:'Calculate approved inputs'});
  if(!await calculate.isDisabled())throw Error('Approval missing');
  await panel.getByRole('checkbox').check();await calculate.click();
  await panel.getByRole('heading',{name:'Verified deterministic calculation'}).waitFor();
  await panel.getByText('Inputs, calculation steps and source provenance',{exact:true}).click();
  const rendered=JSON.parse(await panel.locator('.local-ai-output').last().innerText());
  if(rendered.result.results.net_operating_income_usd_annual.value!=='62500.00')throw Error('Wrong deterministic NOI');
  if(rendered.provenance.rows[4].original!=='2400'||rendered.provenance.rows[4].value!=='2500'||rendered.provenance.rows[4].start!=='2025-01-01'||rendered.provenance.sha256.length!==64)throw Error('Source provenance lost');
  checks.push({check:'Upload -> classify -> correct type -> extract -> correct amount -> approve -> deterministic NOI 62500 with provenance',result:rendered});
  await panel.getByText('Inputs, calculation steps and source provenance',{exact:true}).click();
  await panel.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  await page.screenshot({path:out+'/workflow-desktop.png'});
  await page.setViewportSize({width:390,height:844});
  await panel.evaluate(node=>{node.scrollTop=node.scrollHeight;});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1))throw Error('Mobile overflow');
  await page.screenshot({path:out+'/workflow-mobile.png'});
  await review.getByLabel('value · row 6',{exact:true}).fill('');
  if(!await calculate.isDisabled()||await panel.getByRole('checkbox').isChecked())throw Error('Approval survived changed source values');
  await review.getByRole('button',{name:'Prepare reviewed calculator inputs'}).click();
  await review.getByRole('alert').waitFor();
  if((await editor.inputValue())!=='')throw Error('Incomplete extraction produced financial inputs');
  checks.push('Blank source value blocks preparation and clears approval/result');
  await panel.getByLabel('Document file',{exact:true}).setInputFiles({name:'unsupported.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4')});
  await panel.getByText('Use TXT, CSV or XLSX',{exact:true}).waitFor();
  if(await review.count())throw Error('Unsupported document retained prior source');
  checks.push('PDF unsupported error clears previous financial source/approval');
  const fixture=fs.readFileSync(out+'/noi-reviewed-fixture.csv','utf8');
  // XLSX parser is the existing worker; use an already installed library only for the test fixture.
  const {zipSync,strToU8}=await import('fflate');
  const rows=fixture.trim().split('\n').map(line=>line.split(','));
  const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;');
  const xml='<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>'+rows.map((row,i)=>'<row r="'+(i+1)+'">'+row.map((value,j)=>'<c r="'+String.fromCharCode(65+j)+(i+1)+'" t="inlineStr"><is><t>'+escape(value)+'</t></is></c>').join('')+'</row>').join('')+'</sheetData></worksheet>';
  const entries={
    '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml':'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Reviewed" sheetId="1" r:id="rId1"/></sheets></workbook>',
    'xl/_rels/workbook.xml.rels':'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml':xml,
  };
  const bytes=zipSync(Object.fromEntries(Object.entries(entries).map(([name,text])=>[name,strToU8(text)])));
  await panel.getByLabel('Document file',{exact:true}).setInputFiles({name:'reviewed.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(bytes)});
  await page.waitForFunction(()=>Array.from(document.querySelectorAll('textarea')).some(e=>e.value.includes('gross potential rent')));
  await panel.getByRole('button',{name:'Confirm document type'}).click();
  await panel.getByRole('button',{name:'Extract financial rows'}).click();
  await panel.getByRole('button',{name:'Prepare reviewed calculator inputs'}).click();
  if(JSON.parse(await editor.inputValue()).gross_potential_rent_usd_annual!=='96000')throw Error('XLSX extraction failed');
  checks.push('XLSX upload uses existing worker and preserves source rows/values; manual Unknown type confirmation allowed');
  await page.route('**/api/local-ai/classify',route=>route.fulfill({status:409,json:{error:'Local AI busy; another request is running.'}}));
  await panel.getByRole('button',{name:'Suggest document type'}).click();
  await panel.getByText('Busy — use CPU fallback or retry when the active request finishes',{exact:true}).waitFor();
  checks.push('Readable busy status after a competing request; no automatic inference retry');
  if(errors.length)throw Error(errors.join('\n'));
  fs.writeFileSync(out+(replay?'/workflow-final-results.json':'/workflow-results.json'),JSON.stringify({checks,responses},null,2));
  console.log('Workflow checks passed:',checks.length);
} finally {await browser.close();}
