const API = (window.STUDIO_API_BASE || "").replace(/\/$/, "");
let siteData = {categories: [], photos: []};

async function loadSite(){
  try{
    const res = await fetch(`${API}/api/site`);
    if(!res.ok) throw new Error("API");
    siteData = await res.json();
  }catch(e){
    console.warn("윤스튜디오 백엔드 연결 실패:", e);
  }
  render();
}

function visibleCategories(){
  return (siteData.categories || []).filter(c => c.visible);
}
function visiblePhotos(){
  return (siteData.photos || []).filter(p => p.visible);
}
function categoryPhotos(id){
  return visiblePhotos().filter(p => p.category_id === id);
}

function render(){
  const cats = visibleCategories();
  const photos = visiblePhotos();
  const featured = photos.find(p => p.featured) || photos[0];

  if(featured){
    document.getElementById("heroMedia").innerHTML =
      `<img src="${escapeAttr(featured.image_url)}" alt="${escapeAttr(featured.title || "윤스튜디오 대표 촬영 사진")}">`;
  }

  const drawer = document.getElementById("drawerCategories");
  drawer.innerHTML = cats.length
    ? cats.map(c => `<a href="#works" data-filter="${c.id}">${escapeHtml(c.name)}</a>`).join("")
    : `<a href="#works">가족사진</a><a href="#works">프로필</a><a href="#works">증명·여권</a><a href="#works">광고·제품</a>`;

  const fallbackServices = [
    {name:"가족사진", slug:"FAMILY"},
    {name:"프로필", slug:"PORTRAIT"},
    {name:"증명·여권", slug:"ID · PASSPORT"},
    {name:"광고·제품", slug:"COMMERCIAL"}
  ];
  const services = cats.length ? cats : fallbackServices.map((x,i)=>({...x,id:`fallback-${i}`}));

  const serviceGrid = document.getElementById("serviceGrid");
  serviceGrid.innerHTML = services.map((c, idx) => {
    const cover = cats.length ? categoryPhotos(c.id)[0] : null;
    return `<article class="service-card" ${cats.length ? `data-filter="${c.id}"` : ""}>
      ${cover
        ? `<img src="${escapeAttr(cover.image_url)}" alt="${escapeAttr(c.name)}">`
        : `<div class="placeholder hero-placeholder"><div class="hero-placeholder-mark">${String(idx+1).padStart(2,"0")}</div></div>`}
      <div class="service-overlay">
        <small>${escapeHtml((c.slug || "YUN STUDIO").toUpperCase())}</small>
        <strong>${escapeHtml(c.name)}</strong>
      </div>
    </article>`;
  }).join("");

  const chips = document.getElementById("filterChips");
  if(cats.length){
    chips.innerHTML = `<button class="chip active" data-filter="all">ALL</button>` +
      cats.map(c => `<button class="chip" data-filter="${c.id}">${escapeHtml(c.name)}</button>`).join("");
  }else{
    chips.innerHTML = "";
  }

  bindFilters();
  renderGallery("all");
}

function renderGallery(filter){
  const cats = new Map(visibleCategories().map(c => [c.id, c]));
  const items = visiblePhotos().filter(p => filter === "all" || String(p.category_id) === String(filter));
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("emptyState");

  gallery.innerHTML = items.map(p => `<figure class="gallery-item" data-photo-id="${p.id}" role="button" tabindex="0" aria-label="${escapeAttr(p.title || "사진")} 크게 보기">
    <img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.title || "윤스튜디오 촬영 사진")}" loading="lazy">
    <figcaption class="gallery-caption">
      <small>${escapeHtml((cats.get(p.category_id) || {}).name || "YUN STUDIO")}</small>
      <strong>${escapeHtml(p.title || "")}</strong>
    </figcaption>
  </figure>`).join("");

  empty.hidden = items.length > 0;

  gallery.querySelectorAll(".gallery-item").forEach((item, index) => {
    const open = () => openSiteLightbox(items, index);
    item.addEventListener("click", open);
    item.addEventListener("keydown", e => {
      if(e.key === "Enter" || e.key === " "){
        e.preventDefault();
        open();
      }
    });
  });
}

function bindFilters(){
  document.querySelectorAll("[data-filter]").forEach(el => {
    el.onclick = () => {
      const id = el.dataset.filter;
      document.querySelectorAll(".chip").forEach(x => x.classList.toggle("active", x.dataset.filter === id));
      renderGallery(id);
      if(el.closest(".service-card")){
        document.getElementById("works").scrollIntoView({behavior:"smooth"});
      }
      if(el.closest(".drawer")) closeDrawer();
    };
  });
}

function escapeHtml(v=""){
  return String(v).replace(/[&<>"']/g, ch => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
  }[ch]));
}
function escapeAttr(v=""){ return escapeHtml(v); }

const drawer = document.getElementById("drawer");
function openDrawer(){drawer.classList.add("open");drawer.setAttribute("aria-hidden","false");document.body.style.overflow="hidden"}
function closeDrawer(){drawer.classList.remove("open");drawer.setAttribute("aria-hidden","true");document.body.style.overflow=""}
document.getElementById("menuBtn").addEventListener("click", openDrawer);
document.getElementById("drawerClose").addEventListener("click", closeDrawer);
document.addEventListener("keydown", e => { if(e.key === "Escape") closeDrawer(); });

function initStudioMap(){
  const mapElement = document.getElementById("studioMap");
  if(!mapElement || typeof L === "undefined") return;

  // 충주시 예성로 352. 위치 보정이 필요하면 아래 두 좌표만 수정하면 됩니다.
  const studioPosition = [36.98773, 127.93411];
  const map = L.map(mapElement, {
    center: studioPosition,
    zoom: 17,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    keyboard: true,
    attributionControl: true
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);

  L.control.zoom({position: "topright"}).addTo(map);

  const markerIcon = L.divIcon({
    className: "yun-map-marker",
    html: `<div class="yun-marker">
      <span class="yun-marker-pin"><b>Y</b></span>
      <strong class="yun-marker-label">YUN STUDIO<small>CHUNGJU</small></strong>
    </div>`,
    iconSize: [72, 116],
    iconAnchor: [36, 64]
  });

  L.marker(studioPosition, {
    icon: markerIcon,
    title: "윤스튜디오",
    alt: "윤스튜디오 위치"
  }).addTo(map);

  mapElement.addEventListener("focus", () => map.scrollWheelZoom.enable());
  mapElement.addEventListener("blur", () => map.scrollWheelZoom.disable());
  const refreshMapSize = () => map.invalidateSize({pan: false, animate: false});

  // 웹폰트·이미지·반응형 레이아웃으로 지도 칸의 크기가 바뀌어도
  // 타일 위치를 다시 계산해 빈 사각형이 생기지 않도록 합니다.
  requestAnimationFrame(refreshMapSize);
  window.addEventListener("load", refreshMapSize, {once: true});
  window.setTimeout(refreshMapSize, 250);
  window.setTimeout(refreshMapSize, 900);
  window.addEventListener("resize", refreshMapSize, {passive: true});

  if("ResizeObserver" in window){
    const mapResizeObserver = new ResizeObserver(refreshMapSize);
    mapResizeObserver.observe(mapElement);
  }
}

initStudioMap();
loadSite();


let siteLightboxItems = [];
let siteLightboxIndex = 0;
let lightboxTouchStartX = null;

function ensureSiteLightbox(){
  let modal = document.getElementById("siteLightbox");
  if(modal) return modal;

  modal = document.createElement("div");
  modal.id = "siteLightbox";
  modal.className = "photo-lightbox";
  modal.hidden = true;
  modal.setAttribute("role", "dialog");
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("aria-label", "작품 크게 보기");
  modal.innerHTML = `
    <button class="lightbox-close" type="button" aria-label="닫기">×</button>
    <button class="lightbox-nav lightbox-prev" type="button" aria-label="이전 사진">‹</button>
    <figure class="lightbox-figure">
      <img class="lightbox-image" alt="">
      <figcaption class="lightbox-caption">
        <small></small>
        <strong></strong>
        <span></span>
      </figcaption>
    </figure>
    <button class="lightbox-nav lightbox-next" type="button" aria-label="다음 사진">›</button>`;

  modal.querySelector(".lightbox-close").onclick = closeSiteLightbox;
  modal.querySelector(".lightbox-prev").onclick = () => moveSiteLightbox(-1);
  modal.querySelector(".lightbox-next").onclick = () => moveSiteLightbox(1);
  modal.addEventListener("click", e => {
    if(e.target === modal) closeSiteLightbox();
  });
  modal.addEventListener("touchstart", e => {
    lightboxTouchStartX = e.changedTouches[0].clientX;
  }, {passive:true});
  modal.addEventListener("touchend", e => {
    if(lightboxTouchStartX === null) return;
    const distance = e.changedTouches[0].clientX - lightboxTouchStartX;
    lightboxTouchStartX = null;
    if(Math.abs(distance) > 55) moveSiteLightbox(distance > 0 ? -1 : 1);
  }, {passive:true});
  document.body.appendChild(modal);
  return modal;
}

function openSiteLightbox(items, index){
  siteLightboxItems = items;
  siteLightboxIndex = index;
  const modal = ensureSiteLightbox();
  modal.hidden = false;
  document.body.classList.add("lightbox-open");
  renderSiteLightbox();
  modal.querySelector(".lightbox-close").focus();
}

function renderSiteLightbox(){
  if(!siteLightboxItems.length) return closeSiteLightbox();
  siteLightboxIndex =
    (siteLightboxIndex + siteLightboxItems.length) % siteLightboxItems.length;
  const photo = siteLightboxItems[siteLightboxIndex];
  const category = visibleCategories().find(c => c.id === photo.category_id);
  const modal = ensureSiteLightbox();
  const image = modal.querySelector(".lightbox-image");
  image.src = photo.image_url;
  image.alt = photo.title || "윤스튜디오 촬영 사진";
  modal.querySelector(".lightbox-caption small").textContent =
    category?.name || "YUN STUDIO";
  modal.querySelector(".lightbox-caption strong").textContent = photo.title || "";
  modal.querySelector(".lightbox-caption span").textContent = photo.description || "";
  const showNav = siteLightboxItems.length > 1;
  modal.querySelector(".lightbox-prev").hidden = !showNav;
  modal.querySelector(".lightbox-next").hidden = !showNav;
}

function moveSiteLightbox(step){
  siteLightboxIndex += step;
  renderSiteLightbox();
}

function closeSiteLightbox(){
  const modal = document.getElementById("siteLightbox");
  if(!modal || modal.hidden) return;
  modal.hidden = true;
  modal.querySelector(".lightbox-image").removeAttribute("src");
  document.body.classList.remove("lightbox-open");
}

document.addEventListener("keydown", e => {
  const modal = document.getElementById("siteLightbox");
  if(!modal || modal.hidden) return;
  if(e.key === "Escape") closeSiteLightbox();
  if(e.key === "ArrowLeft") moveSiteLightbox(-1);
  if(e.key === "ArrowRight") moveSiteLightbox(1);
});
