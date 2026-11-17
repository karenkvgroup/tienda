const http=require('http'),fs=require('fs'),path=require('path'),crypto=require('crypto');
const {seed}=require('./lib'),mkImp=require('./importer');
const D=path.join(__dirname,'data'),F=path.join(D,'db.json'),P=path.join(__dirname,'public');
const ST=['Pendiente de preparación','Pago pendiente','Pago confirmado','En preparación','Despachado','En tránsito','Entregado','Cancelado'];
fs.mkdirSync(D,{recursive:true});
let db;const save=()=>{fs.writeFileSync(F+'.tmp',JSON.stringify(db));fs.renameSync(F+'.tmp',F)};
const hp=(pw,s)=>crypto.scryptSync(pw,s,32).toString('hex');
if(fs.existsSync(F))db=JSON.parse(fs.readFileSync(F));else{
 const pw=process.env.ADMIN_PASS||crypto.randomBytes(6).toString('hex'),s=crypto.randomBytes(8).toString('hex');
 db={products:seed(),orders:[],seq:1,pid:seed().length+1,admin:{salt:s,hash:hp(pw,s)},cfg:{name:'KV Group Perfumerías & Beauty',brand:'KV Group',heroTitle:'El arte de la perfumería',heroText:'Fragancias de Oriente Medio y diseñador, cosmética y belleza para vos y para tu centro de estética.',whatsapp:'5493416519208',bank:{banco:'',titular:'',cbu:'',alias:'',cuit:'',instrucciones:''},soldOutText:'Sin stock',lastUnitsText:'Últimas unidades',lastUnitsFrom:3,transferDiscount:10,freeShippingFrom:300000,shippingFlat:0,plans:[{cuotas:1,interes:0},{cuotas:3,interes:0},{cuotas:6,interes:0}],coupons:[],mpLink:''}};
 save();console.log('ADMIN  clave inicial:',pw)}
const imp=mkImp(()=>db,save);
const tok=new Map(),fails=new Map();
function quote(items,code,method,cuotas){
 if(!Array.isArray(items)||!items.length)throw'Carrito vacío';
 let sub=0;const lines=items.map(i=>{const p=db.products.find(x=>x.id==i.id&&x.published!==false),q=Math.floor(i.qty);
  if(!p||!(q>=1))throw'Producto inválido';if(p.stock!=null&&p.stock<q)throw'Sin stock suficiente: '+p.name;
  const u=p.promo>0&&p.promo<p.price&&(!p.until||p.until>=new Date().toISOString().slice(0,10))?p.promo:p.price;sub+=u*q;return{id:p.id,name:p.name,qty:q,unit:u}});
 const c=db.cfg,cp=c.coupons.find(x=>x.active&&x.code.toLowerCase()===String(code||'').toLowerCase());
 const dc=cp?Math.round(sub*cp.pct/100):0,base=sub-dc;
 const dt=method==='transferencia'&&c.transferDiscount>0&&(!cp||cp.stack)?Math.round(base*c.transferDiscount/100):0;
 const ship=c.freeShippingFrom>0&&base>=c.freeShippingFrom?0:c.shippingFlat;
 let t=base-dt+ship,plan={cuotas:1,interes:0};
 if(method==='tarjeta')plan=c.plans.find(p=>p.cuotas==cuotas)||plan;
 const int=Math.round(t*plan.interes/100);t+=int;
 return{lines,sub,coupon:cp?cp.code:null,couponDisc:dc,transferDisc:dt,ship,interest:int,cuotas:plan.cuotas,cuota:Math.round(t/plan.cuotas),total:t,missingFree:c.freeShippingFrom>0?Math.max(0,c.freeShippingFrom-base):0}}
const pub=()=>{const{coupons,...r}=db.cfg;return{...r,bank:undefined}};
const body=r=>new Promise((ok,no)=>{let b='';r.on('data',d=>{b+=d;if(b.length>3e6){no('Muy grande');r.destroy()}});r.on('end',()=>{try{ok(b?JSON.parse(b):{})}catch{no('JSON inválido')}})});
const out=(s,c,o)=>{s.writeHead(c,{'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'});s.end(JSON.stringify(o))};
const T={'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.png':'image/png'};
http.createServer(async(q,s)=>{try{
 const u=new URL(q.url,'http://x'),p=u.pathname,m=q.method;
 if(!p.startsWith('/api')){const f=p==='/'?'index.html':p==='/admin'?'admin.html':p==='/logo.png'?'logo.png':['/catalog.js','/quote.js'].includes(p)?p.slice(1):null;
  if(!f){s.writeHead(404);return s.end('No encontrado')}
  s.writeHead(200,{'Content-Type':T[path.extname(f)],'X-Frame-Options':'DENY'});return s.end(fs.readFileSync(path.join(P,f)))}
 if(m==='GET'&&p==='/api/products')return out(s,200,db.products.filter(x=>x.published!==false).map(({src,...r})=>r));
 if(m==='GET'&&p==='/api/config')return out(s,200,pub());
 if(m==='POST'&&p==='/api/quote'){const b=await body(q);return out(s,200,quote(b.items,b.coupon,b.method,b.cuotas))}
 if(m==='POST'&&p==='/api/order'){const b=await body(q),c=b.customer||{};
  for(const k of['name','email','phone','cp','provincia','localidad','calle'])if(!String(c[k]||'').trim())throw'Falta completar: '+k;
  if(!/^\S+@\S+\.\S+$/.test(c.email))throw'Email inválido';
  if(!['transferencia','tarjeta'].includes(b.method))throw'Medio de pago inválido';
  const r=quote(b.items,b.coupon,b.method,b.cuotas);
  r.lines.forEach(l=>{{const pr=db.products.find(x=>x.id==l.id);if(pr.stock!=null)pr.stock-=l.qty}});
  const g=b.gift&&b.gift.isGift?{isGift:true,to:String(b.gift.to||''),address:String(b.gift.address||''),msg:String(b.gift.msg||''),wrap:!!b.gift.wrap}:null;
  const o={id:db.seq++,date:new Date().toISOString(),status:'Pago pendiente',method:b.method,customer:Object.fromEntries(['name','doc','email','phone','whatsapp','cp','provincia','localidad','calle','notes'].map(k=>[k,String(c[k]||'').slice(0,200)])),gift:g,...r,tracking:{carrier:'',number:''},paid:false};
  db.orders.push(o);save();return out(s,200,{order:o,bank:b.method==='transferencia'?db.cfg.bank:null,mpLink:db.cfg.mpLink})}
 if(m==='POST'&&p==='/api/admin/login'){const ip=q.socket.remoteAddress,f=fails.get(ip)||{n:0,t:Date.now()};
  if(Date.now()-f.t>6e4){f.n=0;f.t=Date.now()}if(f.n>=5)throw'Demasiados intentos, esperá un minuto';
  const b=await body(q),a=Buffer.from(hp(String(b.password||''),db.admin.salt),'hex');
  if(!crypto.timingSafeEqual(a,Buffer.from(db.admin.hash,'hex'))){f.n++;fails.set(ip,f);throw'Clave incorrecta'}
  const t=crypto.randomBytes(24).toString('hex');tok.set(t,Date.now()+864e5);return out(s,200,{token:t})}
 if(p.startsWith('/api/admin')){const t=(q.headers.authorization||'').slice(7);if(!tok.has(t)||tok.get(t)<Date.now())return out(s,401,{error:'No autorizado'});
  if(m==='GET'&&p==='/api/admin/data')return out(s,200,{products:db.products,orders:db.orders,cfg:db.cfg,statuses:ST});
  const b=m==='GET'?{}:await body(q);
  if(m==='POST'&&p==='/api/admin/product'){const n=v=>Math.max(0,Math.round(Number(v)||0));
   const old=db.products.find(x=>x.id==b.id)||{},o={...old,id:b.id||db.pid++,name:String(b.name||'').trim(),brand:String(b.brand||''),category:String(b.category||''),desc:String(b.desc||''),volume:String(b.volume||''),tag:String(b.tag||''),image:String(b.image||''),price:n(b.price),promo:n(b.promo),stock:(b.stock===''||b.stock==null)?null:n(b.stock),published:b.published!==false};
   const pc=Number(b.pct);if(pc>0&&pc<100)o.promo=Math.round(o.price*(1-pc/100));o.until=/^\d{4}-\d\d-\d\d$/.test(b.until||'')?b.until:'';if(!o.name||!o.price)throw'Nombre y precio son obligatorios';const i=db.products.findIndex(x=>x.id==o.id);i<0?db.products.push(o):db.products[i]=o;save();return out(s,200,o)}
  if(m==='POST'&&p==='/api/admin/discount'){const pc=Number(b.pct)||0;let k=0;db.products.forEach(x=>{if((!b.category||x.category===b.category)&&(!b.brand||x.brand===b.brand)){if(b.clear||pc<=0||pc>=100){x.promo=0;x.until=''}else{x.promo=Math.round(x.price*(1-pc/100));x.until=/^\d{4}-\d\d-\d\d$/.test(b.until||'')?b.until:''}k++}});save();return out(s,200,{count:k})}
  if(m==='POST'&&p==='/api/admin/delete'){db.products=db.products.filter(x=>x.id!=b.id);save();return out(s,200,{ok:1})}
  if(m==='POST'&&p==='/api/admin/order'){const o=db.orders.find(x=>x.id==b.id);if(!o)throw'No existe';
   if(b.status){if(!ST.includes(b.status))throw'Estado inválido';if(b.status==='Cancelado'&&o.status!=='Cancelado')o.lines.forEach(l=>{const pr=db.products.find(x=>x.id==l.id);if(pr&&pr.stock!=null)pr.stock+=l.qty});o.status=b.status;o.paid=['Pago confirmado','En preparación','Despachado','En tránsito','Entregado'].includes(b.status)}
   if(b.tracking)o.tracking={carrier:String(b.tracking.carrier||''),number:String(b.tracking.number||'')};save();return out(s,200,o)}
  if(m==='POST'&&p==='/api/admin/config'){const c=db.cfg,n=Number;
   Object.assign(c,{name:String(b.name||c.name),brand:String(b.brand||c.brand),soldOutText:String(b.soldOutText||'Sin stock'),lastUnitsText:String(b.lastUnitsText||'Últimas unidades'),lastUnitsFrom:Math.max(0,Number(b.lastUnitsFrom)||0),heroTitle:String(b.heroTitle||''),heroText:String(b.heroText||''),whatsapp:String(b.whatsapp||'').replace(/\D/g,''),bank:{...c.bank,...b.bank},transferDiscount:n(b.transferDiscount)||0,freeShippingFrom:n(b.freeShippingFrom)||0,shippingFlat:n(b.shippingFlat)||0,mpLink:String(b.mpLink||''),
   plans:(b.plans||[]).map(x=>({cuotas:Math.max(1,n(x.cuotas)|0),interes:Math.max(0,n(x.interes)||0)})),coupons:(b.coupons||[]).map(x=>({code:String(x.code),pct:Math.min(100,Math.max(0,n(x.pct)||0)),stack:!!x.stack,active:x.active!==false})).filter(x=>x.code)});
   save();return out(s,200,c)}
  if(m==='POST'&&p==='/api/admin/import'){imp.run();return out(s,200,imp.st)}
  if(m==='GET'&&p==='/api/admin/import')return out(s,200,imp.st);
  if(m==='POST'&&p==='/api/admin/password'){if(String(b.password||'').length<8)throw'Mínimo 8 caracteres';const sl=crypto.randomBytes(8).toString('hex');db.admin={salt:sl,hash:hp(b.password,sl)};save();return out(s,200,{ok:1})}}
 out(s,404,{error:'No encontrado'})}catch(e){out(s,400,{error:typeof e==='string'?e:'Error'})}}).listen(process.env.PORT||3000,()=>{if(db.products.some(p=>!p.image))setTimeout(()=>imp.run(),500);console.log('Tienda en http://localhost:'+(process.env.PORT||3000))});
