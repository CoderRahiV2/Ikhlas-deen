self.addEventListener('install',e=>{self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(self.clients.claim());});
self.addEventListener('push',e=>{
 let data={title:'ইখলাস — জুমার স্মরণিকা',body:'আগামীকাল শুক্রবার। বেশি বেশি দরুদে ইবরাহিম পাঠ করুন।',url:'/'};
 try{data={...data,...e.data.json()}}catch{}
 e.waitUntil(self.registration.showNotification(data.title,{body:data.body,icon:'/icon.svg',badge:'/icon.svg',data:{url:data.url},vibrate:[100,50,100]}));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{for(const c of list){if('focus'in c){c.navigate(e.notification.data?.url||'/');return c.focus();}}return clients.openWindow(e.notification.data?.url||'/');}));});
