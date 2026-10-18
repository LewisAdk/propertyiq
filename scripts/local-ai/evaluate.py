"""Five public document excerpts, two views each, plus separate ambiguity checks. No prompt tuning."""
import hashlib, json, time
from pathlib import Path
import bridge as B

PUBLIC = [
    ('greylock','Rent Roll','https://www.greylockinvestment.com/content/docs/Real_Estate_Rent_Roll.pdf',
     'Real Estate Rent Roll','Unit Number | Tenant Name | Rented Since | Rent Amount | Term of Lease | Expiration of Lease | Rent Paid Through | Heat Paid by Tenant Landlord'),
    ('crescent-rent','Rent Roll','https://crescope.com/sample/reconcile',
     'Rent Roll','Total pads listed 80. Occupied 74. Vacant 6. Physical occupancy 92.5%. Monthly lot rent billed $31,080. The roll runs from pad 1 to pad 80.'),
    ('crescent-t12','T-12','https://crescope.com/sample/reconcile',
     'T-12. Trailing twelve months','Gross potential lot rent $403,200. Vacancy and credit loss ($28,224). Other income $22,000. Effective gross income $396,976. Total operating expenses ($171,000). Net operating income $225,976. Twelve months of operations, Jul 2025 through Jun 2026.'),
    ('crescent-om','Offering Memorandum','https://crescope.com/sample/reconcile',
     'Offering Memorandum','Financial highlights. Sites 84. Asking price $3,250,000. Pro forma net operating income $270,136. Pro forma reflects ownership\'s estimate of stabilized operations, including the expansion sites. Buyer to verify all figures.'),
    ('irs','Other','https://www.irs.gov/pub/irs-pdf/fw9.pdf',
     'Form W-9','Request for Taxpayer Identification Number and Certification. Give form to the requester. Do not send to the IRS.'),
]

def main():
    out=Path(__file__).resolve().parents[2]/'docs/step18'
    out.mkdir(exist_ok=True)
    cases=[]
    for key,label,url,title,text in PUBLIC:
        for view,content in [('titled',title+'\n'+text),('body',text)]:
            cases.append(dict(id=key+'-'+view,document=key,view=view,label=label,source=url,text=content,sha256=hashlib.sha256(content.encode()).hexdigest()))
    cases += [dict(id='empty-evidence',document='stress',view='stress',label='Unknown',source='synthetic ambiguity control',text='Page 3. Continued.'),dict(id='ambiguous',document='stress',view='stress',label='Unknown',source='synthetic ambiguity control',text='Annual summary. Additional information pending.')]
    path=out/'classification-results.json'
    if path.exists(): raise SystemExit('Evaluation exists; do not silently repeat or overwrite')
    start=time.monotonic();measured=B.classify([c['text'] for c in cases])
    for case,row in zip(cases,measured['rows'],strict=True):
        row['suggestion']=row.pop('label');row.update(case);row['expected']=row.pop('label')
        row['correct']=row['suggestion']==row['expected'];row['baseline']=B.baseline(case['text'])
    measured.update(seconds=round(time.monotonic()-start,3),public_documents=5,public_views=10,stress_cases=2,notes='Excerpt-only smoke evaluation; paired views are not independent documents. No accuracy gate for production.')
    path.write_text(json.dumps(measured,indent=2))
    print(json.dumps({k:v for k,v in measured.items() if k!='rows'}))
    for row in measured['rows']:print(row['id'],row['suggestion'],row['correct'],row['valid'],row['seconds'])

if __name__=='__main__': main()
