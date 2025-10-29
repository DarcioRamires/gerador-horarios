// Data models stored in localStorage; works on GitHub Pages (static)
const STORAGE_KEY = 'brc_horarios_v1'
let state = {
  escolas: [],
  professores: [],
  turmas: [],
  disciplinas: [],
  aulas: [], // each: {id, escola, turma, disciplina, professor, ambiente, dia, periodo, slot, tipo}
  colors: {}, // discipline color map
  settings: { periodSlots: {manha:5,tarde:5,noite:5}, maxSameDiscPerDay:2 }
}

function loadState(){ const s = localStorage.getItem(STORAGE_KEY); if(s){ state=JSON.parse(s);} }
function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

// utilities
function uid(prefix='id'){ return prefix + Math.random().toString(36).slice(2,9) }
function seedColor(name){ // deterministic-ish color for discipline
  let h=0; for(let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i))%360
  return `hsl(${h} 70% 45%)`
}

// init
loadState()
document.addEventListener('DOMContentLoaded', ()=> {
  bindButtons()
  refreshSelects()
  renderEmptyTable()
})

// Bind UI buttons
function bindButtons(){
  document.getElementById('btn-add-escola').onclick = addEscola
  document.getElementById('btn-add-professor').onclick = addProfessor
  document.getElementById('btn-add-turma').onclick = addTurma
  document.getElementById('btn-add-disciplina').onclick = addDisciplina
  document.getElementById('btn-add-aula').onclick = addAula

  document.getElementById('btn-salvar').onclick = ()=>{ saveState(); alert('Salvo!') }
  document.getElementById('btn-imprimir').onclick = ()=> printGradeFull()
  document.getElementById('btn-analise-disponibilidade').onclick = analiseDisponibilidade
  document.getElementById('btn-analise-conflitos').onclick = analiseConflitos
  document.getElementById('btn-experimental').onclick = ()=> alert('Modo experimental (placeholder)')
  document.getElementById('btn-backup').onclick = exportBackup
  document.getElementById('btn-restore').onclick = importBackup
  document.getElementById('btn-divulgar').onclick = ()=> alert('Opção divulgar (compartilhar link) - use export backup')
  document.getElementById('btn-integracao').onclick = ()=> alert('Integração com SIS - placeholder')
  document.getElementById('btn-verificar').onclick = verificarHorario
  document.getElementById('btn-duplicar').onclick = duplicarHorario
  document.getElementById('btn-eliminar').onclick = eliminarHorario
}

// CRUD functions
function addEscola(){
  const name = document.getElementById('input-escola').value.trim()
  if(!name) return alert('Informe o nome da escola')
  const id = uid('escola_'); state.escolas.push({id,name}); saveState(); refreshSelects(); document.getElementById('input-escola').value=''; alert('Escola adicionada')
}
function addProfessor(){
  const name = document.getElementById('input-professor').value.trim()
  if(!name) return alert('Informe nome do professor')
  const id = uid('prof_'); state.professores.push({id,name,restricoes:[]}); saveState(); refreshSelects(); document.getElementById('input-professor').value=''; alert('Professor adicionado')
}
function addTurma(){
  const name = document.getElementById('input-turma').value.trim()
  if(!name) return alert('Informe a turma')
  const id = uid('tur_'); state.turmas.push({id,name}); saveState(); refreshSelects(); document.getElementById('input-turma').value=''; alert('Turma adicionada')
}
function addDisciplina(){
  const name = document.getElementById('input-disciplina').value.trim()
  if(!name) return alert('Informe a disciplina')
  const id = uid('disc_'); state.disciplinas.push({id,name}); state.colors[id]=seedColor(name); saveState(); refreshSelects(); document.getElementById('input-disciplina').value=''; alert('Disciplina adicionada')
}

// refresh selects
function refreshSelects(){
  const selEs = document.getElementById('select-escola'); selEs.innerHTML=''
  state.escolas.forEach(e=> selEs.add(new Option(e.name,e.id)))
  const selProf = document.getElementById('select-professor'); selProf.innerHTML=''
  state.professores.forEach(p=> selProf.add(new Option(p.name,p.id)))
  const selTur = document.getElementById('select-turma'); selTur.innerHTML=''
  state.turmas.forEach(t=> selTur.add(new Option(t.name,t.id)))
  const selDisc = document.getElementById('select-disciplina'); selDisc.innerHTML=''
  state.disciplinas.forEach(d=> selDisc.add(new Option(d.name,d.id)))
}

// render empty grade table to show structure
function renderEmptyTable(){
  const area = document.getElementById('grades-area'); area.innerHTML=''
  const tbl = document.createElement('table'); tbl.className='table-grade'
  const thead = tbl.createTHead(); const hrow = thead.insertRow()
  ['Horário','Segunda','Terça','Quarta','Quinta','Sexta'].forEach(h=>{ let th=document.createElement('th'); th.textContent=h; hrow.appendChild(th)})
  const tbody = tbl.createTBody()
  for(let i=0;i< state.settings.periodSlots.manha + state.settings.periodSlots.tarde + state.settings.periodSlots.noite; i++){
    const tr = tbody.insertRow(); for(let c=0;c<6;c++){ tr.insertCell().textContent = c===0 ? ('Slot '+(i+1)) : '' }
  }
  area.appendChild(tbl)
}

// Add aula with validation and conflict checks
function addAula(){
  const escola = document.getElementById('select-escola').value
  const turma = document.getElementById('select-turma').value
  const disciplina = document.getElementById('select-disciplina').value
  const professor = document.getElementById('select-professor').value
  const ambiente = document.getElementById('input-ambiente').value.trim() || '—'
  const dia = document.getElementById('select-dia').value
  const periodo = document.getElementById('select-periodo').value
  const slot = parseInt(document.getElementById('select-slot').value,10)
  const tipo = parseInt(document.getElementById('select-tipo').value,10)
  const intervalos = parseInt(document.getElementById('select-intervalos').value,10)

  if(!escola||!turma||!disciplina||!professor) return alert('Preencha escola, turma, disciplina e professor')

  // period slot limits
  const maxSlot = state.settings.periodSlots[periodo]
  if(slot>maxSlot) return alert('Slot selecionado inválido para o período')

  // check conflicts: same professor at same day+period+slot (or overlapping for dupla)
  const conflicts = findConflictsFor(professor, dia, periodo, slot, tipo, ambiente, turma, disciplina)
  if(conflicts.length>0){
    return alert('Conflito detectado: '+conflicts.join('; '))
  }

  // check limit: same professor cannot have more than 2 classes of same discipline per day
  const sameDiscCount = state.aulas.filter(a=> a.professor===professor && a.disciplina===disciplina && a.dia===dia).length
  if(sameDiscCount + tipo > state.settings.maxSameDiscPerDay){
    return alert('Limite diário por disciplina excedido para esse professor')
  }

  // push aula(s)
  const aulaId = uid('aula_')
  state.aulas.push({id:aulaId,escola,turma,disciplina,professor,ambiente,dia,periodo,slot,tipo,intervalos})
  // if dupla, also occupy next slot if available
  if(tipo===2){
    if(slot+1 > state.settings.periodSlots[periodo]) return alert('Não há slot disponível para aula dupla nesse período')
    state.aulas.push({id: aulaId+'_2',escola,turma,disciplina,professor,ambiente,dia,periodo,slot:slot+1,tipo:2,intervalos})
  }
  saveState()
  renderGrade('turma')
  alert('Aula adicionada')
}

// find conflicts
function findConflictsFor(professor, dia, periodo, slot, tipo, ambiente, turma, disciplina){
  const msgs=[]
  // professor busy?
  state.aulas.forEach(a=>{
    if(a.dia===dia && a.periodo===periodo && a.slot===slot){
      if(a.professor===professor) msgs.push('Professor ocupado no mesmo horário (turma '+getTurmaName(a.turma)+')')
      if(a.ambiente===ambiente) msgs.push('Ambiente ocupado por '+getTurmaName(a.turma))
      if(a.turma===turma) msgs.push('Turma já tem aula nesse horário')
      if(a.disciplina===disciplina && a.professor===professor) msgs.push('Mesmo professor já ministra essa disciplina nesse horário')
    }
    // overlapping for dupla: check slot-1 and slot+1 as needed
    if(tipo===2 && a.dia===dia && a.periodo===periodo && (a.slot===slot+1)){
      if(a.professor===professor) msgs.push('Professor ocupado no slot seguinte (impede dupla)')
    }
  })
  // dedupe
  return [...new Set(msgs)]
}

function getTurmaName(id){ const t = state.turmas.find(x=>x.id===id); return t? t.name: id }
function getProfName(id){ const p = state.professores.find(x=>x.id===id); return p? p.name: id }
function getDiscName(id){ const d = state.disciplinas.find(x=>x.id===id); return d? d.name: id }
function getEscolaName(id){ const e = state.escolas.find(x=>x.id===id); return e? e.name: id }

// Rendering grade views
function renderGrade(type){
  const area = document.getElementById('grades-area'); area.innerHTML=''
  if(type==='turma' || type==='turma-rel'){
    state.turmas.forEach(t=>{
      const h = document.createElement('h3'); h.textContent = 'Turma: '+t.name; area.appendChild(h)
      area.appendChild(makeGradeTableFor({filter:{turma:t.id}, title: t.name, type}))
    })
  } else if(type==='disciplina'){
    state.disciplinas.forEach(d=>{
      const h = document.createElement('h3'); h.textContent = 'Disciplina: '+d.name; area.appendChild(h)
      area.appendChild(makeGradeTableFor({filter:{disciplina:d.id}, title:d.name, type}))
    })
  } else if(type==='professor' || type==='professor-dia'){
    state.professores.forEach(p=>{
      const h = document.createElement('h3'); h.textContent = 'Professor: '+p.name; area.appendChild(h)
      area.appendChild(makeGradeTableFor({filter:{professor:p.id}, title:p.name, type}))
    })
  }
}

// make table for given filter
function makeGradeTableFor({filter={}, title='', type='turma'}){
  const tbl = document.createElement('table'); tbl.className='table-grade'; const thead = tbl.createTHead(); const hrow = thead.insertRow()
  ['Horário','Segunda','Terça','Quarta','Quinta','Sexta'].forEach(h=>{ let th=document.createElement('th'); th.textContent=h; hrow.appendChild(th)})
  const tbody = tbl.createTBody()
  const periods = ['manha','tarde','noite']
  periods.forEach(periodo=>{
    const slots = state.settings.periodSlots[periodo]
    for(let s=1;s<=slots;s++){
      const tr = tbody.insertRow(); tr.insertCell().textContent = periodo.toUpperCase()+' - Slot '+s
      ['Segunda','Terça','Quarta','Quinta','Sexta'].forEach(d=>{
        const td = tr.insertCell()
        const aula = state.aulas.find(a=> matchesFilter(a,filter) && a.periodo===periodo && a.slot===s && a.dia===d)
        if(aula){
          const discName = getDiscName(aula.disciplina)
          td.innerHTML = `<div class="cell" title="${discName} - ${getProfName(aula.professor)} - ${aula.ambiente}">${discName}<br><small>${getProfName(aula.professor)} | ${aula.ambiente}</small></div>`
          const color = state.colors[aula.disciplina] || seedColor(discName)
          td.style.background = color; td.style.color = '#fff'
        }
      })
      tbody.appendChild(tr)
    }
  })
  return tbl
}

function matchesFilter(a,filter){
  for(const k in filter){ if(filter[k] && a[k]!==filter[k]) return false }
  return true
}

// analysis
function analiseDisponibilidade(){
  // list professors with free slots count
  const report = state.professores.map(p=>{
    const busy = state.aulas.filter(a=> a.professor===p.id).length
    return `${p.name}: ${busy} horários ocupados`
  }).join('\n')
  alert('Disponibilidade\n'+report)
}

function analiseConflitos(){
  // simple detect where professor has two aulas same day/period/slot
  const msgs=[]
  state.aulas.forEach((a,i)=>{
    state.aulas.slice(i+1).forEach(b=>{
      if(a.dia===b.dia && a.periodo===b.periodo && a.slot===b.slot){
        if(a.professor===b.professor) msgs.push('Professor '+getProfName(a.professor)+' com conflito em '+a.dia+' '+a.periodo+' slot '+a.slot)
        if(a.ambiente===b.ambiente) msgs.push('Ambiente '+a.ambiente+' conflito em '+a.dia+' '+a.periodo+' slot '+a.slot)
        if(a.turma===b.turma) msgs.push('Turma '+getTurmaName(a.turma)+' com duas aulas simultâneas')
      }
    })
  })
  if(msgs.length===0) alert('Nenhum conflito detectado')
  else alert('Conflitos:\n'+ [...new Set(msgs)].join('\n'))
}

// verifica horário (validação)
function verificarHorario(){
  const problems=[]
  // more than 2 same discipline per day per professor
  state.professores.forEach(p=>{
    const byDay = {}
    state.aulas.filter(a=>a.professor===p.id).forEach(a=>{
      const key = p.id+'|'+a.dia+'|'+a.disciplina
      byDay[key] = (byDay[key]||0)+1
    })
    for(const k in byDay) if(byDay[k] > state.settings.maxSameDiscPerDay) problems.push('Professor '+getProfName(p.id)+' excede limite de disciplina em '+k.split('|')[1])
  })
  if(problems.length) alert('Problemas:\n'+problems.join('\n'))
  else alert('Verificação OK')
}

// duplicar e eliminar (simple)
function duplicarHorario(){ const copy = JSON.parse(JSON.stringify(state.aulas)); copy.forEach(a=>{ a.id = uid('aula_'); state.aulas.push(a) }); saveState(); renderGrade('turma'); alert('Horário duplicado (cópia total)') }
function eliminarHorario(){ if(confirm('Eliminar todo o horário?')){ state.aulas=[]; saveState(); renderEmptyTable(); alert('Horário eliminado') } }

// backup/export
function exportBackup(){
  const data = JSON.stringify(state)
  const blob = new Blob([data],{type:'application/json'})
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href=url; a.download = 'backup_horarios.json'; a.click(); URL.revokeObjectURL(url)
}
function importBackup(){
  const inp = document.createElement('input'); inp.type='file'; inp.accept='application/json'
  inp.onchange = e=>{
    const f = e.target.files[0]; const reader = new FileReader()
    reader.onload = ev=>{ try{ state = JSON.parse(ev.target.result); saveState(); refreshSelects(); renderGrade('turma'); alert('Backup restaurado') }catch(er){ alert('Arquivo inválido') } }
    reader.readAsText(f)
  }
  inp.click()
}

// print functions (full grade, by professor, by room)
function printGradeFull(){
  const html = buildPrintHtml('Grade completa', makePrintableTable(state.aulas))
  const w = window.open('','','width=900,height=700'); w.document.write(html); w.document.close()
}
function makePrintableTable(aulas){
  // build simple html table string
  let html = '<table border="1" style="border-collapse:collapse;width:100%"><tr><th>Dia</th><th>Período</th><th>Slot</th><th>Turma</th><th>Disciplina</th><th>Professor</th><th>Ambiente</th></tr>'
  aulas.forEach(a=>{
    html += `<tr><td>${a.dia}</td><td>${a.periodo}</td><td>${a.slot}</td><td>${getTurmaName(a.turma)}</td><td>${getDiscName(a.disciplina)}</td><td>${getProfName(a.professor)}</td><td>${a.ambiente}</td></tr>`
  })
  html += '</table>'
  return html
}
function buildPrintHtml(title, contentHtml){
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title><style>body{font-family:Arial;padding:20px}table,th,td{border:1px solid #ccc;border-collapse:collapse;padding:6px}</style></head><body><h2>${title}</h2>${contentHtml}<script>window.print()</script></body></html>`
}

// conflict resolver recommendation (simple auto-resolve attempt)
function resolverConflitos(){
  // naive: try to move conflicting aula to next available slot in same period, else next period
  const conflicts = []
  const aulas = [...state.aulas]
  for(let i=0;i<aulas.length;i++){
    for(let j=i+1;j<aulas.length;j++){
      const a = aulas[i], b = aulas[j]
      if(a.dia===b.dia && a.periodo===b.periodo && a.slot===b.slot){
        conflicts.push({a,b})
      }
    }
  }
  conflicts.forEach(pair=>{
    const b = pair.b
    // attempt move b to next slot
    const max = state.settings.periodSlots[b.periodo]
    if(b.slot < max && !state.aulas.find(x=> x.dia===b.dia && x.periodo===b.periodo && x.slot===b.slot+1 && (x.professor===b.professor || x.turma===b.turma || x.ambiente===b.ambiente))){
      // move
      const target = state.aulas.find(x=> x.id===b.id); if(target) target.slot = b.slot+1
    } else {
      // try other periods same day
      const periods = ['manha','tarde','noite']
      for(const p of periods){
        if(p===b.periodo) continue
        const freeSlot = [...Array(state.settings.periodSlots[p]).keys()].map(i=>i+1).find(s=> !state.aulas.find(x=> x.dia===b.dia && x.periodo===p && x.slot===s))
        if(freeSlot){
          const target = state.aulas.find(x=> x.id===b.id); if(target){ target.periodo=p; target.slot=freeSlot; break }
        }
      }
    }
  })
  saveState(); renderGrade('turma'); alert('Tentativa de resolver conflitos executada (verifique resultados)')
}

// wrapper for user action
function analiseConflitos(){ analiseConflitosBasic(); resolverConflitos(); }
function analiseConflitosBasic(){
  const msgs=[]
  state.aulas.forEach((a,i)=>{
    state.aulas.slice(i+1).forEach(b=>{
      if(a.dia===b.dia && a.periodo===b.periodo && a.slot===b.slot){
        if(a.professor===b.professor) msgs.push('Professor '+getProfName(a.professor)+' conflito')
        if(a.ambiente===b.ambiente) msgs.push('Ambiente '+a.ambiente+' conflito')
      }
    })
  })
  if(msgs.length) alert('Conflitos:\n'+[...new Set(msgs)].join('\n'))
  else alert('Nenhum conflito detectado')
}

// verify horario function earlier referenced
function verificarHorario(){ verificarHorarioDetailed() }
function verificarHorarioDetailed(){
  const msgs=[]
  // more than 2 same discipline per day per professor
  state.professores.forEach(p=>{
    const byDay = {}
    state.aulas.filter(a=>a.professor===p.id).forEach(a=>{
      const key = p.id+'|'+a.dia+'|'+a.disciplina
      byDay[key] = (byDay[key]||0)+1
    })
    for(const k in byDay) if(byDay[k] > state.settings.maxSameDiscPerDay) msgs.push('Professor '+getProfName(p.id)+' tem '+byDay[k]+' aulas da mesma disciplina em '+k.split('|')[1])
  })
  if(msgs.length) alert('Problemas:\n'+msgs.join('\n'))
  else alert('Verificação OK')
}

// initial dummy data (optional)
if(state.disciplinas.length===0){
  ['Matemática','Português','História','Geografia','Física','Química'].forEach(name=>{
    const id = uid('disc_'); state.disciplinas.push({id,name}); state.colors[id]=seedColor(name)
  })
  saveState()
  refreshSelects()
}

// helper color generator
function seedColor(name){
  let h=0; for(let i=0;i<name.length;i++) h = (h*31 + name.charCodeAt(i))%360
  return 'linear-gradient(180deg, hsl('+h+' 65% 50%) , hsl('+((h+20)%360)+' 60% 40%))'
}
