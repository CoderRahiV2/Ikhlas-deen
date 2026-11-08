
import { getStore } from "@netlify/blobs";
import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

const users=getStore("ikhlas-users");
const data=getStore("ikhlas-data");
const books=getStore("ikhlas-books");
const pushes=getStore("ikhlas-push");
const secret=()=>process.env.IKHLAS_SESSION_SECRET||"";
const json=(body,status=200,headers={})=>Response.json(body,{status,headers});
const fail=(message,status=400)=>json({error:message},status);
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
function sign(payload){const part=b64(payload);return part+"."+createHmac("sha256",secret()).update(part).digest("base64url");}
function verify(token){if(!secret()||!token)return null;try{const [p,s]=token.split(".");const expected=createHmac("sha256",secret()).update(p).digest();const got=Buffer.from(s,"base64url");if(got.length!==expected.length||!timingSafeEqual(got,expected))return null;const v=JSON.parse(Buffer.from(p,"base64url"));return v.exp>Date.now()?v:null;}catch{return null;}}
function auth(req){return verify((req.headers.get("authorization")||"").replace(/^Bearer\s+/i,""));}
const userKey=u=>"user:"+u.toLowerCase();
const weekKey=()=>{const d=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Dhaka"}));const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;};
const randomId=()=>randomBytes(16).toString("hex");
async function allKeys(store,prefix){const r=await store.list({prefix});return r.blobs||[];}
async function readJson(store,key,def=null){return await store.get(key,{type:"json"})??def;}
function safeUser(u){return {id:u.id,username:u.username,displayName:u.displayName||u.username,role:u.role};}
async function currentUser(req){const p=auth(req);if(!p)return null;const u=await readJson(users,userKey(p.username));return u&&u.id===p.sub?u:null;}

export default async req=>{
 if(!secret())return fail("Netlify Environment Variable IKHLAS_SESSION_SECRET সেটআপ করুন।",503);
 const url=new URL(req.url),path=url.pathname.replace(/^\/api\/?/,"");
 try{
  if(path==="auth"&&req.method==="POST"){
   const {username,password}=await req.json();const name=String(username||"").trim();
   if(!/^[a-zA-Z0-9_]{3,24}$/.test(name))return fail("ইউজারনেম ৩-২৪ অক্ষরের ইংরেজি অক্ষর, সংখ্যা বা _ হতে হবে।");
   if(typeof password!=="string"||password.length<8)return fail("পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।");
   const key=userKey(name);let u=await readJson(users,key);
   const adminName=process.env.IKHLAS_ADMIN_USERNAME||"";
   const adminPass=process.env.IKHLAS_ADMIN_PASSWORD||"";
   if(!u){
    if(name.toLowerCase()!==adminName.toLowerCase())return fail("এই ইউজারনেমের অ্যাকাউন্ট নেই। অ্যাডমিনের কাছ থেকে অ্যাকাউন্ট নিন।",401);
    if(!adminPass||password!==adminPass)return fail("অ্যাডমিন পাসওয়ার্ড সঠিক নয়।",401);
    u={id:"admin-"+randomId(),username:name,displayName:name,role:"admin",salt:"",hash:""};
    await users.setJSON(key,u);
   }
   if(u.role==="admin"){if(password!==adminPass)return fail("পাসওয়ার্ড সঠিক নয়।",401);}
   else{
    const salt=u.salt,hash=scryptSync(password,salt,64).toString("hex");
    if(!timingSafeEqual(Buffer.from(hash,"hex"),Buffer.from(u.hash,"hex")))return fail("পাসওয়ার্ড সঠিক নয়।",401);
   }
   const token=sign({sub:u.id,username:u.username,exp:Date.now()+30*86400000});
   return json({token,user:safeUser(u)});
  }
  if(path==="register"&&req.method==="POST"){
   const {username,password,displayName:requestedDisplayName}=await req.json();const name=String(username||"").trim();
   if(!/^[a-zA-Z0-9_]{3,24}$/.test(name)||typeof password!=="string"||password.length<8)return fail("ইউজারনেম ৩-২৪ অক্ষর এবং পাসওয়ার্ড কমপক্ষে ৮ অক্ষর হতে হবে।");
   if(name.toLowerCase()===(process.env.IKHLAS_ADMIN_USERNAME||"").toLowerCase())return fail("এই ইউজারনেম সংরক্ষিত।");
   const key=userKey(name);if(await readJson(users,key))return fail("এই ইউজারনেম আগে থেকেই ব্যবহৃত হচ্ছে۔",409);
   const salt=randomBytes(16).toString("hex");const displayName=String(requestedDisplayName||name).trim().slice(0,40)||name;const u={id:randomId(),username:name,displayName,role:"member",salt,hash:scryptSync(password,salt,64).toString("hex")};
   await users.setJSON(key,u);const token=sign({sub:u.id,username:u.username,exp:Date.now()+30*86400000});return json({token,user:safeUser(u)},201);
  }
  if(path==="profile"&&req.method==="POST"){
   const u=await currentUser(req);if(!u)return fail("প্রথমে লগইন করুন।",401);
   const {displayName}=await req.json();const name=String(displayName||"").trim();if(name.length<2||name.length>40)return fail("প্রদর্শিত নাম ২ থেকে ৪০ অক্ষরের মধ্যে দিন।");
   u.displayName=name;await users.setJSON(userKey(u.username),u);return json({ok:true,user:safeUser(u)});
  }
  if(path==="books"&&req.method==="GET"){
   const items=await allKeys(books,"book:");const list=[];
   for(const item of items){const b=await readJson(books,item.key);if(b)list.push({id:b.id,title:b.title,author:b.author,category:b.category});}
   list.sort((a,b)=>a.title.localeCompare(b.title));return json({books:list});
  }
  if(path==="books"&&req.method==="POST"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন বই আপলোড করতে পারবেন।",403);
   const form=await req.formData(),file=form.get("file");if(!(file instanceof File))return fail("PDF ফাইল পাওয়া যায়নি।");
   if(file.type!=="application/pdf"||file.size>12*1024*1024)return fail("শুধু ১২ MB পর্যন্ত PDF ফাইল আপলোড করুন।");
   const title=String(form.get("title")||"").trim(),category=String(form.get("category")||"");
   if(!title||!["novel","book","hadith"].includes(category))return fail("বইয়ের নাম বা ক্যাটাগরি সঠিক নয়।");
   const id=randomId(),key=`pdf:${id}`;await books.set(key,Buffer.from(await file.arrayBuffer()),{metadata:{contentType:"application/pdf",title}});
   await books.setJSON(`book:${id}`,{id,title,author:String(form.get("author")||""),category,key,createdAt:new Date().toISOString()});
   return json({ok:true,id},201);
  }
  if(path==="admin/dashboard"&&req.method==="GET"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন এই তথ্য দেখতে পারবেন।",403);
   const userItems=await allKeys(users,"user:"),bookItems=await allKeys(books,"book:"),durudItems=await allKeys(data,"durud:");
   const members=[];for(const item of userItems){const person=await readJson(users,item.key);if(person)members.push({id:person.id,username:person.username,displayName:person.displayName||person.username,role:person.role});}
   const bookList=[];for(const item of bookItems){const b=await readJson(books,item.key);if(b)bookList.push({id:b.id,title:b.title,author:b.author||"",category:b.category,createdAt:b.createdAt||""});}
   members.sort((a,b)=>a.username.localeCompare(b.username));bookList.sort((a,b)=>a.title.localeCompare(b.title));
   return json({stats:{members:members.length,books:bookList.length,durudRecords:durudItems.length},members,books:bookList});
  }
  if(path.startsWith("admin/book/")&&req.method==="DELETE"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন বই মুছতে পারবেন।",403);
   const id=path.split("/").pop();if(!/^[a-f0-9]{32}$/.test(id))return fail("বইয়ের আইডি সঠিক নয়।");
   const meta=await readJson(books,`book:${id}`);if(!meta)return fail("বই পাওয়া যায়নি।",404);
   if(meta.key)await books.delete(meta.key);await books.delete(`book:${id}`);return json({ok:true,message:"বই মুছে ফেলা হয়েছে।"});
  }
  if(path==="admin/upload-init"&&req.method==="POST"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন আপলোড করতে পারবেন।",403);
   const body=await req.json();const title=String(body.title||"").trim(),category=String(body.category||"book"),size=Number(body.size),author=String(body.author||"");
   if(!title||!["novel","book","hadith"].includes(category)||!Number.isInteger(size)||size<1||size>12*1024*1024)return fail("বইয়ের তথ্য বা ফাইলের সাইজ সঠিক নয়।");
   const id=randomId(),chunkSize=3*1024*1024,totalChunks=Math.ceil(size/chunkSize);
   await data.setJSON(`upload:${id}`,{id,title,author,category,size,totalChunks,owner:u.id,createdAt:Date.now()});
   return json({uploadId:id,chunkSize,totalChunks},201);
  }
  if(path.startsWith("admin/upload-chunk/")&&req.method==="PUT"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন আপলোড করতে পারবেন।",403);
   const parts=path.split("/");const uploadId=parts[2],indexText=parts[3];const session=await readJson(data,`upload:${uploadId}`),index=Number(indexText);
   if(!session||session.owner!==u.id||!Number.isInteger(index)||index<0||index>=session.totalChunks)return fail("আপলোড সেশন পাওয়া যায়নি।",404);
   const bytes=Buffer.from(await req.arrayBuffer());const expected=index===session.totalChunks-1?session.size-index*3*1024*1024:3*1024*1024;
   if(bytes.length!==expected)return fail("ফাইলের অংশ সঠিকভাবে আসেনি।");
   await data.set(`upload:${uploadId}:${index}`,bytes);return json({ok:true,index});
  }
  if(path.startsWith("admin/upload-complete/")&&req.method==="POST"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন আপলোড সম্পন্ন করতে পারবেন।",403);
   const uploadId=path.split("/").pop(),session=await readJson(data,`upload:${uploadId}`);if(!session||session.owner!==u.id)return fail("আপলোড সেশন পাওয়া যায়নি।",404);
   const chunks=[];for(let i=0;i<session.totalChunks;i++){const part=await data.get(`upload:${uploadId}:${i}`,{type:"arrayBuffer"});if(!part)return fail(`ফাইলের ${i+1} নম্বর অংশ পাওয়া যায়নি।`);chunks.push(Buffer.from(part));}
   const file=Buffer.concat(chunks);if(file.length!==session.size||file.subarray(0,5).toString()!=="%PDF-")return fail("ফাইলটি সঠিক PDF নয়।");
   const id=randomId(),key=`pdf:${id}`;await books.set(key,file,{metadata:{contentType:"application/pdf",title:session.title}});
   await books.setJSON(`book:${id}`,{id,title:session.title,author:session.author,category:session.category,key,createdAt:new Date().toISOString()});
   for(let i=0;i<session.totalChunks;i++)await data.delete(`upload:${uploadId}:${i}`);await data.delete(`upload:${uploadId}`);
   return json({ok:true,id},201);
  }
  if(path==="book"&&req.method==="GET"){
   const id=url.searchParams.get("id");if(!/^[a-f0-9]{32}$/.test(id||""))return fail("বই পাওয়া যায়নি।",404);
   const b=await readJson(books,`book:${id}`);if(!b)return fail("বই পাওয়া যায়নি।",404);
   const blob=await books.get(b.key,{type:"arrayBuffer"});if(!blob)return fail("PDF পাওয়া যায়নি।",404);
   return new Response(blob,{headers:{"Content-Type":"application/pdf","Content-Disposition":"inline","Cache-Control":"public, max-age=300","X-Content-Type-Options":"nosniff"}});
  }
  if(path==="durud"&&req.method==="POST"){
   const u=await currentUser(req);if(!u)return fail("প্রথমে লগইন করুন।",401);
   const {amount}=await req.json();if(amount!==1)return fail("একবারে একটি দরুদ যোগ করা যাবে।");
   const wk=weekKey(),id=randomId();await data.setJSON(`durud:${wk}:${u.id}:${Date.now()}:${id}`,{userId:u.id,username:u.username,displayName:u.displayName||u.username,dhikr:"ibrahim",amount:1,at:new Date().toISOString()});
   const mine=await allKeys(data,`durud:${wk}:${u.id}:`);return json({ok:true,mine:mine.length});
  }
  if(path==="cleanup-durud"&&req.method==="POST"){
   const u=await currentUser(req);if(u?.role!=="admin")return fail("শুধু অ্যাডমিন প্রতিযোগিতার ডেটা পরিষ্কার করতে পারবেন।",403);
   let cursor,removed=0;
   do{
    const result=await data.list({prefix:"durud:",...(cursor?{cursor}:{})});
    for(const item of result.blobs||[]){await data.delete(item.key);removed+=1;}
    cursor=result.cursor||result.next_cursor||null;
   }while(cursor);
   return json({ok:true,removed,message:`প্রতিযোগিতার ${removed}টি রেকর্ড পরিষ্কার করা হয়েছে।`});
  }
  if(path==="leaderboard"&&req.method==="GET"){
   const wk=weekKey(),items=await allKeys(data,`durud:${wk}:`),totals=new Map();const u=await currentUser(req);
   for(const item of items){
    const row=await readJson(data,item.key);if(!row)continue;
    const current=totals.get(row.userId)||{userId:row.userId,displayName:row.displayName||row.username||"ইখলাস সদস্য",total:0};
    current.total+=Number(row.amount||0);totals.set(row.userId,current);
   }
   const entries=[...totals.values()].sort((a,b)=>b.total-a.total||a.displayName.localeCompare(b.displayName));
   const totalCount=entries.reduce((sum,row)=>sum+row.total,0);
   const mine=u?(totals.get(u.id)?.total||0):0;
   return json({week:wk,entries,mine,totalCount,totalParticipants:entries.length});
  }
  if(path==="push-key"&&req.method==="GET")return json({publicKey:process.env.VAPID_PUBLIC_KEY||""});
  if(path==="push"&&req.method==="POST"){
   const u=await currentUser(req);if(!u)return fail("প্রথমে লগইন করুন।",401);
   const {subscription}=await req.json();if(!subscription?.endpoint||!subscription?.keys?.p256dh||!subscription?.keys?.auth)return fail("Push subscription সঠিক নয়।");
   await pushes.setJSON(`push:${u.id}`,{userId:u.id,subscription});return json({ok:true});
  }
  return fail("API route পাওয়া যায়নি।",404);
 }catch(e){console.error(e);return fail("সার্ভারে সমস্যা হয়েছে। পরে আবার চেষ্টা করুন।",500);}
};
export const config={path:"/api/*"};
