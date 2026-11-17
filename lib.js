const fs=require('fs'),path=require('path');
const BR=['AL HARAMAIN','AL SHAMS','AFNAN','ARMAF','BHARARA','CHER','KARSEELL','XERJOFF','LATTAFA','VICTORIA SECRET',"VICTORIA'S SECRET",'MAISON ALHAMBRA','PARIS CORNER','FRENCH AVENUE','RASASI','BIDAYA','RAYHAAN','ORIENTICA','CAROLINA HERRERA','PACO RABANNE','ESSENCE DUBAI'];
const cap=s=>s.toLowerCase().replace(/(^|\s)\S/g,c=>c.toUpperCase());
const brandOf=n=>{const u=n.toUpperCase(),b=BR.find(x=>u.startsWith(x));return b?cap(b):cap(u.split(' ')[0])};
const catOf=n=>{const u=n.toUpperCase();return/^(CHER|KARSEELL)/.test(u)?'Cosmética':/^VICTORIA/.test(u)?"Victoria's Secret":/DESODORANTE/.test(u)?'Desodorantes':'Perfumes'};
const seed=()=>fs.readFileSync(path.join(__dirname,'seed.txt'),'utf8').split('\n').filter(Boolean).map((l,i)=>{const[n,p,s]=l.split('|');return{id:i+1,name:n,brand:brandOf(n),category:catOf(n),price:+p,promo:0,stock:s===undefined?null:+s,image:'',images:[],desc:'',volume:'',tag:'',published:true}});
module.exports={brandOf,catOf,seed};
