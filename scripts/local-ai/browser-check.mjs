import { chromium } from '@playwright/test';
import fs from 'node:fs';
const browser=await chromium.launch();
const results=[];
const replay=process.argv.includes('--replay');
try {
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  if(replay) {
    const saved=JSON.parse(fs.readFileSync('docs/step18/browser-results.json','utf8'));
    await page.route('**/api/local-ai/**',route=>{
      const operation=route.request().url().split('/').at(-1);
      const json=operation==='classify' ? {rows:[{label:'Rent Roll',valid:true}]} : operation==='chat' ? {text:saved[1].answer} : {verified_calculation:true,result:JSON.parse(saved[2].calculation)};
      return route.fulfill({json});
    });
    results.push('UI replay using saved live outputs; no additional model evaluation');
  }
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5178');
  const panel=page.getByRole('region',{name:'Local AI prototype'});
  await panel.locator('summary').click();
  await panel.getByLabel('Document excerpt',{exact:true}).fill('Real Estate Rent Roll\nUnit Number | Tenant Name | Rent Amount | Expiration of Lease');
  await panel.getByRole('button',{name:'Suggest document type'}).click();
  await panel.getByText('Model suggestion received.',{exact:false}).waitFor({timeout:180000});
  if(await panel.getByLabel('Suggested type (editable)').inputValue()!=='Rent Roll') throw Error('Live model classification failed');
  await panel.getByLabel('Suggested type (editable)').selectOption('Other');
  await panel.getByRole('button',{name:'Confirm document type'}).click();
  await panel.getByText('Confirmed: Other.',{exact:false}).waitFor();
  results.push('Live repaired 1.7B classification, user override and confirmation passed');
  await panel.getByLabel('Your question or document excerpt').fill('In two sentences, explain why a rent roll and T-12 can disagree. Do not calculate any numbers.');
  await panel.getByRole('button',{name:'Ask assistant',exact:true}).click();
  await panel.getByRole('heading',{name:'AI explanation · unverified'}).waitFor({timeout:180000});
  const answer=await panel.locator('.local-ai-output').first().innerText();
  if(answer.length<20) throw Error('Empty 4B response');
  results.push({check:'Live existing 4B assistant returned an explanation',answer});
  const inputs={gross_potential_rent_usd_annual:96000,vacancy_rate:0.05,credit_loss_rate:0,concessions_usd_annual:0,other_income_usd_annual:2400,operating_expenses_usd_annual:{expenses:31200},management_fee_rate_of_egi:null,management_fee_usd_annual:0};
  const editor=panel.getByLabel('Reviewed inputs (annual USD, rates as decimals)');
  await editor.fill(JSON.stringify(inputs,null,2));
  const calculate=panel.getByRole('button',{name:'Calculate approved inputs'});
  if(!await calculate.isDisabled()) throw Error('Human review gate missing');
  await panel.getByRole('checkbox').check();
  await calculate.click();
  await panel.getByRole('heading',{name:'Verified deterministic calculation'}).waitFor();
  const calculation=await panel.locator('.local-ai-output').last().innerText();
  if(!calculation.includes('62400')) throw Error('Expected NOI 62400 missing');
  await editor.fill(JSON.stringify({...inputs,other_income_usd_annual:2401}));
  if(!await calculate.isDisabled() || await panel.getByRole('checkbox').isChecked()) throw Error('Edited values retained approval');
  results.push({check:'Live deterministic NOI = 62400; editing invalidates approval',calculation});
  await page.screenshot({path:'docs/step18/desktop.png'});
  await page.setViewportSize({width:390,height:844});
  if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)) throw Error('Mobile horizontal overflow');
  await page.screenshot({path:'docs/step18/mobile.png'});
  if(errors.length) throw Error(errors.join('\n'));
  results.push('Desktop/mobile rendering; no page errors or mobile horizontal overflow');
  // Invalid model strings are displayed as Unknown and never interpreted as markup.
  await page.route('**/api/local-ai/classify',route=>route.fulfill({json:{rows:[{label:'<script>bad()</script>',valid:true}]}}));
  await panel.getByRole('button',{name:'Suggest document type'}).click();
  await page.waitForResponse('**/api/local-ai/classify');
  await page.waitForTimeout(150);
  if(await panel.getByLabel('Suggested type (editable)').inputValue()!=='Unknown') throw Error('Unsafe output accepted');
  results.push('Malformed model label fails closed to Unknown');
  const recorded=replay ? results.map(x=>typeof x==='string'?x.replace(/^Live /,'Replayed '):{...x,check:x.check.replace(/^Live /,'Replayed ')}) : results;
  fs.writeFileSync(replay?'docs/step18/browser-replay-results.json':'docs/step18/browser-results.json',JSON.stringify(recorded,null,2));
  console.log('Browser checks passed:',recorded.length,'mode:',replay?'saved-output replay':'live');
} finally { await browser.close(); }
