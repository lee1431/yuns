const API = (window.STUDIO_API_BASE || "").replace(/\/$/, "");
let siteData = {categories: [], photos: []};

async function loadSite(){
  try{
    const res = await fetch(`${API}/api/site`);
    if(!res.ok) throw new Error("API");
    siteData = await res.json();
    render();
  }catch(e){
    console.warn("백엔드 연결 실패. 관리자에서 사진을 등록하고 API 주소를 확인하세요.");
    render();
  }
}

function visibleCategories(){
  return (siteData.categories || []).filter(c => c.visible);
}

function visiblePhotos(){
  return (siteData.photos || []).filter(p => p.visible);
}

function render(){
  const cats = visibleCategories();
  const photos = visiblePhotos();

  const featured = photos.find(p => p.featured) || photos[0];
  if(featured){
    document.getElementById("heroMedia").innerHTML = `<img src="${escapeAttr(featured.image_url)}" alt="${escapeAttr(featured.title || "대표 사진")}">`;
  }

  const drawer = document.getElementById("drawerCategories");
  drawer.innerHTML = cats.map(c => `<a href="#works" data-filter="${c.id}">${escapeHtml(c.name)}</a>`).join("");

  const serviceGrid = document.getElementById("serviceGrid");
  serviceGrid.innerHTML = cats.map(c => {
    const cover = photos.find(p => p.category_id === c.id);
    return `<article class="service-card" data-filter="${c.id}">
      ${cover ? `<img src="${escapeAttr(cover.image_url)}" alt="${escapeAttr(c.name)}">` : `<div class="placeholder hero-placeholder"></div>`}
      <div class="service-overlay"><small>${escapeHtml(c.slug || "STUDIO")}</small><strong>${escapeHtml(c.name)}</strong></div>
    </article>`;
  }).join("");

  const chips = document.getElementById("filterChips");
  chips.innerHTML = `<button class="chip active" data-filter="all">ALL</button>` +
    cats.map(c => `<button class="chip" data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join("");

  bindFilters();
  renderGallery("all");
}

function renderGallery(filter){
  const cats = new Map(visibleCategories().map(c => [c.id, c]));
  const items = visiblePhotos().filter(p => filter === "all" || String(p.category_id) === String(filter));
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("emptyState");
  gallery.innerHTML = items.map(p => `<figure class="gallery-item">
    <img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.title || "스튜디오 촬영 사진")}" loading="lazy">
    <figcaption class="gallery-caption">
      <small>${escapeHtml((cats.get(p.category_id) || {}).name || "")}</small>
      <strong>${escapeHtml(p.title || "")}</strong>
    </figcaption>
  </figure>`).join("");
  empty.hidden = items.length > 0;
}

function bindFilters(){
  document.querySelectorAll("[data-filter]").forEach(el => {
    el.addEventListener("click", () => {
      const id = el.dataset.filter;
      document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x.dataset.filter === id));
      renderGallery(id);
      if(el.closest(".drawer")) closeDrawer();
    });
  });
}

function escapeHtml(v=""){
  return String(v).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[ch]));
}
function escapeAttr(v=""){ return escapeHtml(v); }

const drawer = document.getElementById("drawer");
function openDrawer(){drawer.classList.add("open"); drawer.setAttribute("aria-hidden","false")}
function closeDrawer(){drawer.classList.remove("open"); drawer.setAttribute("aria-hidden","true")}
document.getElementById("menuBtn").addEventListener("click", openDrawer);
document.getElementById("drawerClose").addEventListener("click", closeDrawer);

loadSite();
