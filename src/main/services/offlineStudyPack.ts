import type { LessonResource } from '@shared/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textBlock(value: string | null): string {
  return value ? escapeHtml(value).replace(/\n/g, '<br>') : ''
}

function safeJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}

/**
 * A single-file student study pack. Everything interactive is inline, so the file can
 * be copied to a phone/laptop and used without EduBoard, a server or internet access.
 * Only teacher-approved AI materials are included.
 */
export function offlineStudyPackHtml(resource: LessonResource): string {
  const guide =
    resource.studyGuide && resource.aiApproved?.studyGuide ? resource.studyGuide : null
  const cards =
    resource.flashcards?.length && resource.aiApproved?.flashcards ? resource.flashcards : []
  const quiz =
    resource.practiceQuiz?.length && resource.aiApproved?.practiceQuiz
      ? resource.practiceQuiz
      : []

  const source =
    resource.type === 'link' && resource.url
      ? `<section><h2>Original resource</h2><p><a href="${escapeHtml(resource.url)}" target="_blank" rel="noopener noreferrer">Open the original resource when you have internet</a></p></section>`
      : resource.type === 'file'
        ? '<section><h2>Original resource</h2><p>The original file is not embedded in this study pack. Ask your teacher for it if you need it.</p></section>'
        : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(resource.title)} · EduBoard Study Pack</title>
<style>
*{box-sizing:border-box}body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;background:#f6f7fb;color:#111827}
main{max-width:820px;margin:auto;padding:24px 16px 64px}.hero{padding:24px;border-radius:20px;background:#4f46e5;color:white}
.hero p{margin:6px 0 0;opacity:.86}.badge{display:inline-block;margin-top:12px;padding:5px 9px;border-radius:999px;background:rgba(255,255,255,.18);font-size:.78rem}
section{margin-top:14px;padding:18px;border:1px solid #e5e7eb;border-radius:16px;background:white}
h1{margin:0;font-size:1.8rem}h2{margin:0 0 10px;font-size:1rem}p{line-height:1.55}.muted{color:#6b7280}
.card{border:1px solid #e5e7eb;border-radius:14px;padding:16px;margin:10px 0;cursor:pointer}.card .back{display:none;margin-top:10px;color:#374151}.card.open .back{display:block}
.row{display:flex;gap:8px;flex-wrap:wrap}.btn{border:0;border-radius:10px;padding:10px 13px;background:#4f46e5;color:#fff;font:inherit;font-weight:650;cursor:pointer}
.btn.secondary{background:#eef2ff;color:#4338ca}.option{width:100%;text-align:left;margin:5px 0;border:1px solid #d1d5db;background:white;color:#111827;border-radius:10px;padding:11px;font:inherit}
.option.good{border-color:#10b981;background:#ecfdf5}.option.bad{border-color:#ef4444;background:#fef2f2}.explain{display:none;margin-top:8px}.quiz-item.answered .explain{display:block}
.progress{font-size:.85rem;color:#6b7280;margin-top:8px}.footer{text-align:center;color:#6b7280;font-size:.8rem;margin-top:22px}
@media(prefers-color-scheme:dark){body{background:#0b1120;color:#e5e7eb}section,.card{background:#111827;border-color:#263042}.card .back,.muted,.progress,.footer{color:#9ca3af}.option{background:#111827;color:#e5e7eb;border-color:#374151}.option.good{background:#052e24}.option.bad{background:#3f1114}.btn.secondary{background:#1e1b4b;color:#c7d2fe}}
</style>
</head>
<body><main>
<div class="hero"><h1>${escapeHtml(resource.title)}</h1><p>Offline Study Pack</p><span class="badge">Works without internet</span></div>
${resource.notes ? `<section><h2>Notes</h2><p>${textBlock(resource.notes)}</p></section>` : ''}
${guide ? `<section><h2>Study guide</h2><p>${textBlock(guide)}</p></section>` : ''}
${cards.length ? `<section><h2>Flashcards</h2><p class="muted">Tap a card to reveal the answer. Mark it “Got it” or “Again”; progress stays on this device.</p><div id="cards"></div><div id="card-progress" class="progress"></div></section>` : ''}
${quiz.length ? `<section><h2>Practice quiz</h2><p class="muted">Choose an answer to check it immediately.</p><div id="quiz"></div><div id="quiz-score" class="progress"></div></section>` : ''}
${source}
<section><div class="row"><button class="btn secondary" id="reset" type="button">Reset my progress</button></div></section>
<p class="footer">Made with EduBoard · This file stores progress only on this device.</p>
<script>
const cards=${safeJson(cards)}
const quiz=${safeJson(quiz)}
const key='eduboard-study-pack:'+location.pathname+':'+${safeJson(resource.id)}
let state={}
try{state=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
state.cards=state.cards||{}
state.quiz=state.quiz||{}

function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{}}
function renderCards(){
  const root=document.getElementById('cards'); if(!root)return
  root.innerHTML=''
  cards.forEach((c,i)=>{
    const el=document.createElement('div'); el.className='card'
    el.innerHTML='<strong></strong><div class="back"></div><div class="row" style="margin-top:12px"><button class="btn secondary" data-again type="button">Again</button><button class="btn" data-got type="button">Got it</button></div>'
    el.querySelector('strong').textContent=c.front
    el.querySelector('.back').textContent=c.back
    el.onclick=(e)=>{if(e.target.tagName!=='BUTTON')el.classList.toggle('open')}
    el.querySelector('[data-again]').onclick=(e)=>{e.stopPropagation();state.cards[i]='again';save();renderCards()}
    el.querySelector('[data-got]').onclick=(e)=>{e.stopPropagation();state.cards[i]='got';save();renderCards()}
    if(state.cards[i]) el.style.opacity=state.cards[i]==='got'?'.65':'1'
    root.appendChild(el)
  })
  const got=Object.values(state.cards).filter(v=>v==='got').length
  document.getElementById('card-progress').textContent=got+' of '+cards.length+' marked “Got it”'
}
function renderQuiz(){
  const root=document.getElementById('quiz'); if(!root)return
  root.innerHTML=''
  quiz.forEach((q,i)=>{
    const wrap=document.createElement('div');wrap.className='quiz-item'
    const h=document.createElement('p');h.innerHTML='<strong>'+(i+1)+'. </strong>';h.append(document.createTextNode(q.question));wrap.appendChild(h)
    q.options.forEach((opt,oi)=>{
      const b=document.createElement('button');b.type='button';b.className='option';b.textContent=opt
      if(state.quiz[i]!==undefined){wrap.classList.add('answered');b.disabled=true;if(oi===q.answerIndex)b.classList.add('good');else if(oi===state.quiz[i])b.classList.add('bad')}
      b.onclick=()=>{state.quiz[i]=oi;save();renderQuiz()}
      wrap.appendChild(b)
    })
    const ex=document.createElement('p');ex.className='explain';ex.textContent=q.explanation;wrap.appendChild(ex);root.appendChild(wrap)
  })
  const answered=Object.keys(state.quiz).length
  const right=Object.entries(state.quiz).filter(([i,v])=>quiz[Number(i)]&&quiz[Number(i)].answerIndex===v).length
  document.getElementById('quiz-score').textContent=answered?right+' correct out of '+answered+' answered':'No questions answered yet'
}
document.getElementById('reset').onclick=()=>{state={cards:{},quiz:{}};save();renderCards();renderQuiz()}
renderCards();renderQuiz()
</script>
</main></body></html>`
}
