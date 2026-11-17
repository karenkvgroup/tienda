const {brandOf,catOf}=require('./lib');
const BASE='https://essencedubai.com.ar';
const dec=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#0?39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const meta=(h,p)=>{const m=h.match(new RegExp('<meta[^>]+(?:property|name)="'+p+'"[^>]+content="([^"]*)"','i'))||h.match(new RegExp('<meta[^>]+content="([^"]*)"[^>]+(?:property|name)="'+p+'"','i'));return m?dec(m[1]):''};
const txt=h=>dec(h.replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|li|h\d)>/gi,'\n').replace(/<[^>]+>/g,'')).split('\n').map(x=>x.trim()).filter(Boolean).join('\n');
const key=s=>s.toUpperCase().replace(/[^A-Z0-9]/g,'');
function parse(h){const name=meta(h,'og:title').trim(),price=Math.round(Number(meta(h,'tiendanube:price')))||0;
 const g=[...new Set([...h.matchAll(/https:\/\/acdn-us\.mitiendanube\.com\/stores\/[\d\/]+\/products\/[^"'\s)]+?-1024-1024\.webp/g)].map(m=>m[0]))];
 const og=meta(h,'og:image:secure_url').replace(/-\d+-0\.webp/,'-1024-1024.webp'),image=og||g[0]||'';
 const dm=h.match(/<div[^>]*class="[^"]*user-content[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
 return{name,price,image,images:[...new Set([image,...g].filter(Boolean))],desc:dm?txt(dm[1]):'',soldOut:!/Agregar al carrito/i.test(h)}}
module.exports=(db,save)=>{const st={running:false,done:0,total:0,msg:'Sin ejecutar'};
 const get=async u=>{const r=await fetch(u,{headers:{'User-Agent':'Mozilla/5.0'}});if(!r.ok)throw new Error(u+' → '+r.status);return r.text()};
 async function run(){if(st.running)return;Object.assign(st,{running:true,done:0,total:0,msg:'Leyendo el listado…'});
  try{const urls=new Set();
   for(let pg=1;pg<=60;pg++){const h=await get(BASE+'/productos/?page='+pg),n=urls.size;
    for(const m of h.matchAll(/href="(https:\/\/essencedubai\.com\.ar\/productos\/[^"?#]+\/)"/g))urls.add(m[1]);if(urls.size===n)break}
   const L=[...urls];st.total=L.length;if(!L.length)throw new Error('No se encontraron productos');let i=0;
   await Promise.all(Array.from({length:4},async()=>{while(i<L.length){const u=L[i++];
    try{const d=parse(await get(u));if(!d.name||!d.price)continue;const db_=db();
     let p=db_.products.find(x=>x.src===u)||db_.products.find(x=>key(x.name)===key(d.name));
     if(!p){p={id:db_.pid++,name:d.name,brand:brandOf(d.name),category:catOf(d.name),promo:0,tag:'',volume:'',published:true};db_.products.push(p)}
     Object.assign(p,{src:u,price:d.price,image:d.image||p.image,images:d.images.length?d.images:p.images||[],desc:d.desc||p.desc||''});
     p.stock=d.soldOut?0:(p.stock===0?null:p.stock??null);
     const v=d.name.match(/(\d+)\s?ML/i);if(v&&!p.volume)p.volume=v[1]+' ml'}catch(e){}
    st.done++;st.msg=`Importando ${st.done} de ${L.length}…`}}));
   save();st.msg=`Listo: ${st.done} productos revisados`}
  catch(e){st.msg='No se pudo importar: '+e.message+' (revisá tu conexión a internet)'}
  st.running=false}
 return{st,run}};
module.exports.parse=parse;
