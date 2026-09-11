(() => {
  const get = (id) => document.getElementById(id);
  const say = (message) => { get("status").textContent = message; };
  if (!window.supabase) { say("登录组件未加载，请检查网络后刷新（需要访问 jsDelivr）。"); return; }
  const client = window.supabase.createClient("https://oyzntmhfyawvkdbqrgix.supabase.co", "sb_publishable_5NESn4fHlrZjcB8Bjez73A_ajMrpFd1", {auth:{storageKey:"stellar-cloud-auth-v1"}});
  let user;
  let room;
  let selected;
  let refreshing = false;
  let busy = false;
  let birthMass;
  const progressKey = () => `stellar-cloud-progress:${user.id}:${room.id}`;
  const parse = (value) => { try { return JSON.parse(value); } catch { return null; } };
  const self = () => room?.stars.find(star => star.id === room.self_id);
  async function rpc(action, payload = {}) {
    const {data,error} = await client.rpc("stellar_classroom", {action,payload});
    if (error) throw new Error(error.message);
    return data;
  }
  async function run(work) {
    if (busy) return;
    busy = true;
    const buttons = [...document.querySelectorAll("form button,#claim,#submit")];
    buttons.forEach(button => { button.disabled = true; });
    try { await work(); } catch(error) { say(`操作未完成：${error.message}`); }
    finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
  }
  function details(star) {
    get("detailTitle").textContent = star.star_name;
    const partner = room.stars.find(item => item.id === star.partner_id);
    get("detailText").textContent = `位置：${star.row}排${star.col}列\n初始质量：${star.initial_mass} M☉\n当前状态：${star.ending || "成长中"}\n最终质量：${star.final_mass ?? "尚未登记"}\n寄语：${star.epitaph || "尚未填写"}${partner ? `\n双星伙伴：${partner.star_name}（${partner.row}-${partner.col}）` : ""}`;
    get("detail").showModal();
  }
  function draw() {
    get("entry").hidden = true; get("teacher").hidden = true; get("classroom").hidden = false;
    get("classTitle").textContent = room.name;
    get("classCode").textContent = `课堂码：${room.code} · ${room.stars.length}/36颗恒星`;
    const mine = self();
    get("instructions").textContent = room.is_teacher ? "教师大屏：点击恒星查看寄语与双星伙伴。" : mine ? "你的位置已锁定。完成课件后登记，系统自动寻找相邻伙伴。" : "点击空格选位置，再确认栽种。上下左右相邻可形成双星。";
    get("grid").replaceChildren();
    for (let row=1;row<=6;row++) for (let col=1;col<=6;col++) {
      const star = room.stars.find(item => item.row === row && item.col === col);
      const button = document.createElement("button");
      button.textContent = star ? `${star.partner_id ? "✦↔✦" : "★"}\n${star.star_name}\n${row}-${col}` : `＋\n${row}-${col}`;
      button.style.whiteSpace = "pre-line";
      button.setAttribute("aria-label", `${row}排${col}列 ${star?.star_name || "空位"}`);
      button.className = star ? star.partner_id ? "paired" : star.completed_at ? "complete" : "growing" : selected?.row === row && selected?.col === col ? "selected" : "";
      button.onclick = () => {
        if (star) return details(star);
        if (room.is_teacher || mine) return;
        selected = {row,col}; get("selection").textContent = `已选择第${row}排、第${col}列`; draw();
      };
      get("grid").append(button);
    }
    get("plant").hidden = !!mine || room.is_teacher;
    get("play").hidden = !mine || room.is_teacher;
    const progress = parse(localStorage.getItem(progressKey()));
    get("finish").hidden = !!mine?.completed_at || !progress?.finished;
    get("binary").hidden = !mine?.partner_id;
    if (mine?.partner_id) {
      const partner = room.stars.find(star => star.id === mine.partner_id);
      get("binary").textContent = `隐藏结局：不要小瞧我们之间的羁绊啊！\n你与「${partner?.star_name || "邻座恒星"}」组成双星系统。\n课堂情境：白矮星从伴星吸积物质，在适当条件下可能发生Ia型超新星。相邻位置是游戏规则，不代表必然爆发。`;
    }
  }
  async function enter(snapshot) {
    room = snapshot; selected = null;
    localStorage.setItem(`stellar-cloud-room:${user.id}`, room.id);
    const draftKey = `stellar-cloud-draft:${user.id}:${room.id}`;
    birthMass = Number(localStorage.getItem(draftKey));
    if (!(birthMass >= 0.03 && birthMass <= 30)) {
      birthMass = Math.random() < .08 ? (3 + Math.floor(Math.random()*5))/100 : (8+Math.floor(Math.random()*2993))/100;
      localStorage.setItem(draftKey,String(birthMass));
    }
    get("mass").textContent = `初始质量：${birthMass.toFixed(2)} M☉（扩展到30 M☉，保留黑洞路线；确认后可在游戏中吸积调整）`;
    get("game").hidden = true; get("game").removeAttribute("src");
    get("epitaph").value = localStorage.getItem(progressKey()+":epitaph") || "";
    draw(); say("已连接课堂。星图每5秒自动刷新。");
  }
  async function refresh() {
    if (!room || refreshing || busy || document.hidden) return;
    refreshing = true;
    const id = room.id;
    try { const next = await rpc("snapshot",{classroom_id:id}); if(room?.id === id) {room=next;draw();say("星图已同步 · "+new Date().toLocaleTimeString());} }
    catch(error) { say(`同步暂时失败，保留当前星图，稍后重试：${error.message}`); }
    finally {refreshing=false;}
  }
  async function showTeacher() {
    get("teacher").hidden = !!user.is_anonymous;
    if(user.is_anonymous) return;
    const rooms=await rpc("list"); get("rooms").replaceChildren();
    rooms.forEach(item => {const button=document.createElement("button");button.textContent=`${item.name} · ${item.code}`;button.onclick=()=>run(async()=>enter(await rpc("snapshot",{classroom_id:item.id})));get("rooms").append(button);});
  }
  get("joinForm").onsubmit = event => {event.preventDefault();run(async()=>enter(await rpc("join",{code:get("code").value.trim()})));};
  get("loginForm").onsubmit = event => {event.preventDefault();run(async()=>{
    const {data,error}=await client.auth.signInWithPassword({email:get("email").value.trim(),password:get("password").value});
    if(error) throw error; user=data.user; get("password").value=""; await showTeacher(); say("教师登录成功。");
  });};
  get("createForm").onsubmit=event=>{event.preventDefault();run(async()=>{const created=await rpc("create",{name:get("roomName").value.trim()});await enter(await rpc("snapshot",{classroom_id:created.id}));});};
  get("claim").onclick=()=>run(async()=>{
    if(!selected) throw new Error("请先选择一个空格");
    room=await rpc("claim",{classroom_id:room.id,...selected,initial_mass:birthMass,star_name:get("starName").value.trim()});draw();say("栽种成功！可以打开课件了。");
  });
  get("startGame").onclick=()=>{
    if(!get("game").getAttribute("src")) get("game").src="game/index.html";
    get("game").hidden=!get("game").hidden;
  };
  window.addEventListener("message",event=>{
    if(event.origin!==location.origin || event.source!==get("game").contentWindow || !room || !self()) return;
    if(event.data?.type==="stellar-ready") {
      get("game").contentWindow.postMessage({type:"stellar-init",star:self(),classroom:room.name,storageKey:progressKey()+":game"},location.origin);
    }
    if(event.data?.type==="stellar-register") {
      get("game").hidden=true;
      get("finish").scrollIntoView({behavior:"smooth"});
    }
    if(event.data?.type==="stellar-progress") {
      const mass=Number(event.data.mass);
      if(!Number.isFinite(mass)||mass<.01||mass>60) return;
      const previous=parse(localStorage.getItem(progressKey()));
      const finished=Boolean(previous?.finished || event.data.finished);
      localStorage.setItem(progressKey(),JSON.stringify({mass,finished})); draw();
    }
  });
  get("submit").onclick=()=>run(async()=>{
    const progress=parse(localStorage.getItem(progressKey()));
    if(!progress?.finished) throw new Error("请先完成恒星结局");
    room=await rpc("finish",{classroom_id:room.id,final_mass:progress.mass,epitaph:get("epitaph").value});draw();say("宇宙登记成功，已自动检测双星伙伴。");
  });
  get("epitaph").oninput=()=>{if(room)localStorage.setItem(progressKey()+":epitaph",get("epitaph").value);};
  get("refresh").onclick=refresh;
  get("closeDetail").onclick=()=>get("detail").close();
  get("leave").onclick=()=>run(async()=>{room=null;get("game").removeAttribute("src");get("classroom").hidden=true;get("entry").hidden=false;localStorage.removeItem(`stellar-cloud-room:${user.id}`);await showTeacher();});
  get("logout").onclick=()=>run(async()=>{
    if(user.is_anonymous&&!confirm("匿名身份退出后可能无法找回原来的恒星。确定退出吗？"))return;
    const {error}=await client.auth.signOut();if(error)throw error;location.reload();
  });
  run(async()=>{
    if(location.protocol==="file:")throw new Error("云端实验版需通过 localhost 或 HTTPS 打开，不能直接打开本地HTML文件。");
    let {data,error}=await client.auth.getSession(); if(error)throw error;
    if(!data.session) {const signed=await client.auth.signInAnonymously();if(signed.error)throw signed.error;user=signed.data.user;}else user=data.session.user;
    const last=localStorage.getItem(`stellar-cloud-room:${user.id}`);
    if(last) {try {await enter(await rpc("snapshot",{classroom_id:last}));get("epitaph").value=localStorage.getItem(progressKey()+":epitaph")||"";return;}catch{localStorage.removeItem(`stellar-cloud-room:${user.id}`);}}
    await showTeacher();say("连接成功，请输入老师提供的课堂码。");
  });
  setInterval(refresh,5000);
})();
