// DÁN URL GOOGLE APPS SCRIPT CỦA BẠN VÀO DÒNG DƯỚI
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwoORCcnrsQkYbhyAw1gl63gRyHUaryC3ICGtE56R6QCGEUBLptp8xGi_QG2aWxpUo2GA/exec";

const $ = id => document.getElementById(id);
const fmtTime = s => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
const fmtDuration = s => `${Math.floor(s/60)} phút ${s%60} giây`;

function shuffleArray(array){
  const arr=[...array];
  for(let i=arr.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[arr[i],arr[j]]=[arr[j],arr[i]];}
  return arr;
}
function prepare(qObj){
  const correct=qObj.options[qObj.a], options=shuffleArray(qObj.options);
  return {...qObj, options, a:options.indexOf(correct)};
}
const LEVEL_LABEL={easy:'Dễ',medium:'Vừa',hard:'Khó'};

/* ---------- Engine dùng chung ---------- */
function renderQuestions(container, qs, name, cardId, optsClass, headBadge, onChange){
  container.innerHTML = qs.map((q,idx)=>`
    <div class="q-card" id="${cardId}${idx}">
      ${headBadge(q)}
      <div class="q-title">Câu ${idx+1}: ${q.q}</div>
      <div class="q-options">${q.options.map((o,i)=>
        `<label><input type="radio" name="${name}${idx}" value="${i}"><span>${o}</span></label>`).join('')}</div>
    </div>`).join('');
  container.addEventListener('change', onChange);
}
function updateProgress(qs,name,cardId,barId,textId){
  let n=0;
  qs.forEach((_,i)=>{
    if(document.querySelector(`input[name="${name}${i}"]:checked`)){
      n++; $(cardId+i)?.classList.remove('unanswered');
    }
  });
  const p=Math.round(n/qs.length*100);
  $(barId).style.width=p+'%';
  $(textId).textContent=`Đã làm: ${n} / ${qs.length} câu (${p}%)`;
}
function findUnanswered(qs,name,cardId){
  let first=-1;
  qs.forEach((_,i)=>{
    const done=document.querySelector(`input[name="${name}${i}"]:checked`);
    $(cardId+i)?.classList.toggle('unanswered',!done);
    if(!done && first===-1) first=i;
  });
  if(first!==-1){
    alert(`Bạn chưa hoàn thành câu hỏi số ${first+1}! Các câu chưa chọn đã được đánh dấu đỏ.`);
    $(cardId+first).scrollIntoView({behavior:'smooth',block:'center'});
  }
  return first!==-1;
}
function gradeQuestions(qs,name,cardId,showChoice){
  let score=0; const details=[];
  qs.forEach((q,i)=>{
    const sel=document.querySelector(`input[name="${name}${i}"]:checked`);
    const choice=sel?q.options[+sel.value]:'Bỏ trống';
    const ok=sel && +sel.value===q.a, ans=q.options[q.a];
    if(ok){score++; details.push(`Câu ${i+1}: Đúng [Chọn: ${choice}]`);}
    else details.push(`Câu ${i+1}: Sai [Chọn: ${choice} | ĐÚNG: ${ans}]`);
    const fb=document.createElement('div');
    fb.className='feedback '+(ok?'ok':'bad');
    fb.innerHTML = ok ? `✓ Đúng! ${showChoice?'Đã chọn: '+choice:ans}`
      : `✗ Sai!${showChoice?' Đã chọn: '+choice+'<br>➔':''} Đáp án đúng: <b>${ans}</b>`;
    $(cardId+i).appendChild(fb);
  });
  document.querySelectorAll(`input[name^="${name}"]`).forEach(r=>r.disabled=true);
  return {score,details};
}
function startTimer(seconds,display,onEnd){
  let left=seconds; display.textContent=fmtTime(left);
  const id=setInterval(()=>{
    left--; display.textContent=fmtTime(Math.max(left,0));
    if(left<=0){clearInterval(id); onEnd();}
  },1000);
  return id;
}
function sendToSheet(data){
  if(!GOOGLE_SCRIPT_URL || !GOOGLE_SCRIPT_URL.includes('script.google.com')) return;
  const fd=new URLSearchParams();
  Object.entries(data).forEach(([k,v])=>fd.append(k,v));
  fetch(GOOGLE_SCRIPT_URL,{method:'POST',mode:'no-cors',
    headers:{'Content-Type':'application/x-www-form-urlencoded'},body:fd.toString()})
    .catch(e=>console.error('Lỗi gửi dữ liệu:',e));
}

/* ---------- TEST 1: IQ ---------- */
const pick=(lv,n)=>shuffleArray(rawQuestionBank.filter(q=>q.level===lv)).slice(0,n);
const questions = shuffleArray([...pick('easy',5),...pick('medium',6),...pick('hard',4)]).map(prepare);
const t1Start=new Date();
let t1Timer, t1Done=false;

renderQuestions($('questions-container'),questions,'q','q-card-','',
  q=>`<span class="badge ${q.level}">Mức độ: ${LEVEL_LABEL[q.level]}</span>`,
  ()=>updateProgress(questions,'q','q-card-','progress-bar','progress-text'));
updateProgress(questions,'q','q-card-','progress-bar','progress-text');

function classifyIQ(iq){
  if(iq>=130) return 'Very Superior (Xuất sắc)';
  if(iq>=120) return 'Superior (Rất thông minh)';
  if(iq>=110) return 'High Average (Trên trung bình)';
  if(iq>=90)  return 'Average (Trung bình)';
  if(iq>=80)  return 'Low Average (Trung bình thấp)';
  return 'Borderline / Low (Cần hỗ trợ)';
}

function submitQuiz(force=false){
  if(t1Done) return;
  const name=$('user_name').value.trim(), email=$('user_email').value.trim();
  if(!name||!email){alert('Vui lòng điền đầy đủ Họ tên và Email trước khi nộp bài!');return;}
  if(!force && findUnanswered(questions,'q','q-card-')) return;

  t1Done=true; clearInterval(t1Timer);
  const secs=Math.round((new Date()-t1Start)/1000), dur=fmtDuration(secs);
  const {score,details}=gradeQuestions(questions,'q','q-card-',true);
  const total=questions.length;
  const iq=Math.round(100+15*((score-total/2)/2.8));
  const cls=classifyIQ(iq);

  $('btn-submit1').style.display='none';
  $('timer').style.display='none';
  $('result-screen').hidden=false;
  $('res-score').textContent=`Điểm thô: ${score} / ${total} câu đúng`;
  $('res-iq').textContent=`IQ: ${iq}`;
  $('res-class').textContent=`Phân loại: ${cls}`;
  $('res-time').textContent=`Thời gian hoàn thành: ${dur}`;

  sendToSheet({name,email,rawScore:`${score} / ${total}`,iq,classification:cls,durationSeconds:dur,details:details.join(' | ')});
  $('test2-launch').hidden=false;
  window.scrollTo({top:0,behavior:'smooth'});
}
$('btn-submit1').addEventListener('click',()=>submitQuiz());
t1Timer=startTimer(1200,$('time-display'),()=>{alert('Đã hết thời gian làm bài!');submitQuiz(true);});

/* ---------- TEST 2: Tư duy sáng tạo ---------- */
let t2Questions=[], t2Started=false, t2Done=false, t2Timer, t2Start;

function startTest2(){
  if(t2Started) return; t2Started=true;
  $('test2-launch').hidden=true;
  $('test2-wrapper').hidden=false;
  t2Questions=shuffleArray(creativeQuestionBank100).slice(0,32).map(prepare);
  renderQuestions($('test2-questions-container'),t2Questions,'t2q','test2-q-card-','',
    q=>`<span class="badge">${q.cat}</span>`,
    ()=>updateProgress(t2Questions,'t2q','test2-q-card-','test2-progress-bar','test2-progress-text'));
  updateProgress(t2Questions,'t2q','test2-q-card-','test2-progress-bar','test2-progress-text');
  t2Start=new Date();
  t2Timer=startTimer(900,$('test2-time-display'),()=>{alert('Đã hết thời gian Test 2!');submitTest2(true);});
  $('test2-wrapper').scrollIntoView({behavior:'smooth'});
}
function classifyTest2(s){return s<16?'Thấp (A)':s<=20?'Dưới trung bình (B)':'Trung bình (C)';}

function submitTest2(force=false){
  if(t2Done) return;
  if(!force && findUnanswered(t2Questions,'t2q','test2-q-card-')) return;
  t2Done=true; clearInterval(t2Timer);
  const {score,details}=gradeQuestions(t2Questions,'t2q','test2-q-card-',false);
  const total=t2Questions.length;
  const dur=fmtDuration(Math.max(0,Math.round((new Date()-t2Start)/1000)));
  const cls=classifyTest2(score);

  $('btn-submit2').style.display='none';
  $('test2-timer').style.display='none';
  $('test2-result').hidden=false;
  $('test2-res-score').textContent=`Điểm: ${score} / ${total} câu đúng`;
  $('test2-res-class').textContent=`Mức độ: ${cls}`;
  $('test2-res-time').textContent=`Thời gian hoàn thành: ${dur}`;
  $('test2-result').scrollIntoView({behavior:'smooth'});

  sendToSheet({test:'Test 2 - Tư duy sáng tạo TSD-Z (mô phỏng)',
    name:$('user_name').value.trim(),email:$('user_email').value.trim(),
    rawScore:`${score} / ${total}`,classification:cls,durationSeconds:dur,details:details.join(' | ')});
}
$('btn-start2').addEventListener('click',startTest2);
$('btn-submit2').addEventListener('click',()=>submitTest2());
