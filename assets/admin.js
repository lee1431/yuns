const API = (window.STUDIO_API_BASE || "").replace(/\/$/, "");
let token = sessionStorage.getItem("studio_admin_token") || "";
let state = {categories: [], photos: []};
let categorySortable = null;
let photoSortables = [];

const $ = s => document.querySelector(s);
const board = $("#categoryBoard");

function authHeaders(extra={}) {
  return token ? {...extra, Authorization:`Bearer ${token}`} : extra;
}
async function api(path, options={}){
  const opts = {...options};
  opts.headers = authHeaders(opts.headers || {});
  const res = await fetch(`${API}${path}`, opts);
  if(res.status === 401){
    logout();
    throw new Error("로그인이 만료되었습니다.");
  }
  if(!res.ok){
    let msg = "요청 처리에 실패했습니다.";
    try{ msg = (await res.json()).error || msg; }catch{}
    throw new Error(msg);
  }
  const type = res.headers.get("content-type") || "";
  return type.includes("application/json") ? res.json() : res.text();
}

async function login(password){
  const res = await fetch(`${API}/api/admin/login`, {
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({password})
  });
  if(!res.ok) throw new Error("비밀번호를 확인하세요.");
  const data = await res.json();
  token = data.token;
  sessionStorage.setItem("studio_admin_token", token);
  await enterAdmin();
}
function logout(){
  token = "";
  sessionStorage.removeItem("studio_admin_token");
  $("#adminView").hidden = true;
  $("#loginView").hidden = false;
}
async function enterAdmin(){
  $("#loginView").hidden = true;
  $("#adminView").hidden = false;
  try{
    await refresh();
    $("#syncState").textContent = "서버 연결됨";
  }catch(e){
    $("#syncState").textContent = "연결 오류";
    toast(e.message);
  }
}
async function refresh(){
  state = await api("/api/admin/state");
  renderBoard();
  populateCategorySelect();
}

function renderBoard(){
  const q = $("#searchInput").value.trim().toLowerCase();
  board.innerHTML = "";
  const cats = [...state.categories].sort((a,b)=>a.sort_order-b.sort_order);
  let visibleCount = 0;
  cats.forEach(cat => {
    const photos = state.photos
      .filter(p => p.category_id === cat.id)
      .filter(p => !q || (p.title || "").toLowerCase().includes(q))
      .sort((a,b)=>a.sort_order-b.sort_order);
    visibleCount += photos.length;
    const col = document.createElement("article");
    col.className = "category-column";
    col.dataset.categoryId = cat.id;
    col.innerHTML = `
      <header class="category-head">
        <div class="category-title">
          <span class="category-handle">⠿</span>
          <strong>${esc(cat.name)}</strong>
          <small>${photos.length}</small>
          ${cat.visible ? "" : "<small>숨김</small>"}
        </div>
        <div class="category-menu">
          <button class="mini-btn edit-category" title="카테고리 수정">수정</button>
          <button class="mini-btn delete-category" title="카테고리 삭제">삭제</button>
        </div>
      </header>
      <div class="photo-list" data-category-id="${cat.id}">
        ${photos.map(photoCard).join("")}
        ${photos.length ? "" : `<div class="drop-hint">여기로 사진을 끌어오세요</div>`}
      </div>`;
    col.querySelector(".edit-category").onclick = () => openCategoryDialog(cat);
    col.querySelector(".delete-category").onclick = () => deleteCategory(cat);
    board.appendChild(col);
  });
  $("#photoCount").textContent = state.photos.length;
  initSortables();
}

function photoCard(p){
  return `<article class="photo-card" data-photo-id="${p.id}">
    <div class="photo-thumb">
      <img src="${escAttr(p.image_url)}" alt="">
      <div class="badges">
        ${p.featured ? `<span class="badge">★ 대표</span>` : ""}
        ${p.visible ? "" : `<span class="badge off">숨김</span>`}
      </div>
    </div>
    <div class="photo-meta">
      <strong>${esc(p.title || "제목 없음")}</strong>
      <div class="photo-actions">
        <button class="edit-photo" title="수정">수정</button>
        <button class="delete-photo" title="삭제">삭제</button>
      </div>
    </div>
  </article>`;
}

function initSortables(){
  if(categorySortable) categorySortable.destroy();
  photoSortables.forEach(s=>s.destroy());
  photoSortables = [];

  categorySortable = Sortable.create(board, {
    animation:180,
    handle:".category-handle",
    draggable:".category-column",
    ghostClass:"dragging",
    onEnd: saveCategoryOrder
  });

  document.querySelectorAll(".photo-list").forEach(list => {
    const s = Sortable.create(list, {
      group:"photos",
      animation:180,
      draggable:".photo-card",
      ghostClass:"dragging",
      onEnd: savePhotoLayout
    });
    photoSortables.push(s);
  });

  document.querySelectorAll(".edit-photo").forEach(btn => {
    btn.onclick = e => {
      const id = Number(e.target.closest(".photo-card").dataset.photoId);
      openPhotoDialog(state.photos.find(p=>p.id===id));
    };
  });
  document.querySelectorAll(".delete-photo").forEach(btn => {
    btn.onclick = e => {
      const id = Number(e.target.closest(".photo-card").dataset.photoId);
      deletePhoto(state.photos.find(p=>p.id===id));
    };
  });
}

async function savePhotoLayout(){
  const layout = [];
  document.querySelectorAll(".photo-list").forEach(list => {
    const category_id = Number(list.dataset.categoryId);
    [...list.querySelectorAll(".photo-card")].forEach((card, index) => {
      layout.push({photo_id:Number(card.dataset.photoId), category_id, sort_order:index});
    });
  });
  try{
    await api("/api/admin/photos/reorder", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({layout})
    });
    toast("사진 순서를 저장했습니다.");
    await refresh();
  }catch(e){ toast(e.message); await refresh(); }
}

async function saveCategoryOrder(){
  const order = [...document.querySelectorAll(".category-column")].map((el,index)=>({
    category_id:Number(el.dataset.categoryId), sort_order:index
  }));
  try{
    await api("/api/admin/categories/reorder", {
      method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({order})
    });
    toast("카테고리 순서를 저장했습니다.");
    await refresh();
  }catch(e){toast(e.message);}
}

function populateCategorySelect(){
  $("#photoCategory").innerHTML = state.categories
    .sort((a,b)=>a.sort_order-b.sort_order)
    .map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join("");
}

function openPhotoDialog(p=null){
  $("#photoDialogTitle").textContent = p ? "사진 수정" : "사진 추가";
  $("#photoId").value = p?.id || "";
  $("#photoFile").value = "";
  $("#photoCategory").value = p?.category_id || state.categories[0]?.id || "";
  $("#photoTitle").value = p?.title || "";
  $("#photoDescription").value = p?.description || "";
  $("#photoVisible").checked = p ? !!p.visible : true;
  $("#photoFeatured").checked = p ? !!p.featured : false;
  $("#photoDialog").showModal();
}

function openCategoryDialog(c=null){
  $("#categoryDialogTitle").textContent = c ? "카테고리 수정" : "카테고리 추가";
  $("#categoryId").value = c?.id || "";
  $("#categoryName").value = c?.name || "";
  $("#categorySlug").value = c?.slug || "";
  $("#categoryVisible").checked = c ? !!c.visible : true;
  $("#categoryDialog").showModal();
}

async function deletePhoto(p){
  if(!confirm(`"${p.title || "이 사진"}"을 삭제할까요?\n원본 파일도 서버에서 삭제됩니다.`)) return;
  try{
    await api(`/api/admin/photos/${p.id}`, {method:"DELETE"});
    toast("사진을 삭제했습니다.");
    await refresh();
  }catch(e){toast(e.message);}
}

async function deleteCategory(c){
  const count = state.photos.filter(p=>p.category_id===c.id).length;
  if(count){
    alert("사진이 들어있는 카테고리는 삭제할 수 없습니다. 먼저 사진을 다른 카테고리로 이동하세요.");
    return;
  }
  if(!confirm(`"${c.name}" 카테고리를 삭제할까요?`)) return;
  try{
    await api(`/api/admin/categories/${c.id}`, {method:"DELETE"});
    toast("카테고리를 삭제했습니다.");
    await refresh();
  }catch(e){toast(e.message);}
}

$("#loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  $("#loginError").textContent = "";
  try{ await login($("#passwordInput").value); }
  catch(err){ $("#loginError").textContent = err.message; }
});
$("#logoutBtn").onclick = logout;
$("#addPhotoBtn").onclick = () => {
  if(!state.categories.length){ alert("먼저 카테고리를 하나 만들어 주세요."); return; }
  openPhotoDialog();
};
$("#addCategoryBtn").onclick = () => openCategoryDialog();
$("#searchInput").addEventListener("input", renderBoard);

$("#photoForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("#photoId").value;
  const file = $("#photoFile").files[0];
  if(!id && !file){ alert("사진 파일을 선택하세요."); return; }
  const fd = new FormData();
  if(file) fd.append("image", file);
  fd.append("category_id", $("#photoCategory").value);
  fd.append("title", $("#photoTitle").value);
  fd.append("description", $("#photoDescription").value);
  fd.append("visible", $("#photoVisible").checked ? "1" : "0");
  fd.append("featured", $("#photoFeatured").checked ? "1" : "0");
  try{
    await api(id ? `/api/admin/photos/${id}` : "/api/admin/photos", {method:id?"PUT":"POST", body:fd});
    $("#photoDialog").close();
    toast(id ? "사진을 수정했습니다." : "사진을 추가했습니다.");
    await refresh();
  }catch(err){toast(err.message);}
});

$("#categoryForm").addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("#categoryId").value;
  const body = {
    name:$("#categoryName").value.trim(),
    slug:$("#categorySlug").value.trim(),
    visible:$("#categoryVisible").checked
  };
  try{
    await api(id ? `/api/admin/categories/${id}` : "/api/admin/categories", {
      method:id?"PUT":"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body)
    });
    $("#categoryDialog").close();
    toast(id ? "카테고리를 수정했습니다." : "카테고리를 추가했습니다.");
    await refresh();
  }catch(err){toast(err.message);}
});

function toast(msg){
  const el=$("#toast"); el.textContent=msg; el.classList.add("show");
  clearTimeout(toast.t); toast.t=setTimeout(()=>el.classList.remove("show"),2200);
}
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function escAttr(v=""){return esc(v)}

if(token) enterAdmin();
