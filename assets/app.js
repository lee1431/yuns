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

  gallery.innerHTML = items.map(p => `<figure class="gallery-item">
    <img src="${escapeAttr(p.image_url)}" alt="${escapeAttr(p.title || "윤스튜디오 촬영 사진")}" loading="lazy">
    <figcaption class="gallery-caption">
      <small>${escapeHtml((cats.get(p.category_id) || {}).name || "YUN STUDIO")}</small>
      <strong>${escapeHtml(p.title || "")}</strong>
    </figcaption>
  </figure>`).join("");

  empty.hidden = items.length > 0;
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
  const studioPosition = [36.98145, 127.92855];
  const map = L.map(mapElement, {
    center: studioPosition,
    zoom: 17,
    zoomControl: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    keyboard: true,
    attributionControl: true
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
    subdomains: "abcd",
    maxZoom: 20,
    attribution: "&copy; OpenStreetMap &copy; CARTO"
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
  window.addEventListener("resize", () => map.invalidateSize(), {passive: true});
}

initStudioMap();
loadSite();
