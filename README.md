
# ইখলাস (IKHLAS) — Netlify-only backend

এই সংস্করণে Supabase/Firebase/অন্য কোনো database backend নেই। API, authentication, বই/PDF storage, দরুদ গণনা এবং leaderboard Netlify Functions + Netlify Blobs দিয়ে পরিচালিত হয়। লাইট/ডার্ক থিম পছন্দ ডিভাইসে সংরক্ষিত থাকে।

## Deploy (Backend-সহ — গুরুত্বপূর্ণ)

**শুধু Netlify-র ওয়েবসাইটে ZIP drag & drop করলে frontend প্রকাশ হতে পারে, কিন্তু `netlify/functions`-এর backend functions নির্ভরযোগ্যভাবে deploy হয় না।** Backend চালু করতে নিচের যেকোনো একটি পদ্ধতি ব্যবহার করুন।

### পদ্ধতি A: Netlify CLI (GitHub ছাড়াই)
1. ZIP extract করে কম্পিউটারে `ikhlas-netlify-only` ফোল্ডার খুলুন।
2. Node.js LTS ইনস্টল করে ওই ফোল্ডারে Terminal/Command Prompt খুলুন।
3. চালান: `npm install`
4. চালান: `npx netlify login`
5. চালান: `npx netlify link` এবং আপনার আগে তৈরি করা Netlify site নির্বাচন করুন।
6. Netlify Dashboard → Site configuration → Environment variables-এ নিচের তিনটি variable যোগ করুন।
7. Terminal-এ চালান: `npx netlify deploy --build --prod`

এই কমান্ড frontend build করে `dist` এবং `netlify/functions` একসঙ্গে production-এ deploy করবে।

### পদ্ধতি B: Git repository
1. ZIP extract করে সব ফাইল GitHub repository-তে push করুন।
2. Netlify → Add new site → Import from Git দিয়ে repository connect করুন।
3. Build command: `npm run build`; Publish directory: `dist`; Functions directory: `netlify/functions`। `netlify.toml`-এও এগুলো সেট করা আছে।
4. নিচের environment variables যোগ করে production deploy করুন।

### Required Netlify environment variables
- `IKHLAS_SESSION_SECRET`: অন্তত ৩২ অক্ষরের random secret।
- `IKHLAS_ADMIN_USERNAME`: আপনার পছন্দের admin username (যেমন `asraradmin`)।
- `IKHLAS_ADMIN_PASSWORD`: শক্তিশালী admin password (কমপক্ষে ৮ অক্ষর)।

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PDF_API_URL` বা Supabase keys এই manual-cleanup সংস্করণে প্রয়োজন নেই। Environment variable পরিবর্তনের পর নতুন deploy করতে হবে।

## Admin login
অ্যাপের Login-এ `IKHLAS_ADMIN_USERNAME` এবং `IKHLAS_ADMIN_PASSWORD` দিয়ে লগইন করুন। অ্যাডমিন ড্যাশবোর্ড থেকে PDF upload করতে পারবেন। PDF সর্বোচ্চ ৪ MB রাখা হয়েছে, কারণ upload Netlify Function request body দিয়ে যায়।

## Member accounts ও প্রদর্শিত নাম
সদস্যরা অ্যাপ থেকেই নতুন অ্যাকাউন্ট খুলতে পারবেন। রেজিস্ট্রেশনের সময় দেওয়া প্রদর্শিত নাম লিডারবোর্ডে দেখাবে; প্রতিযোগিতা পাতায় পরে নাম পরিবর্তন করেও সংরক্ষণ করা যাবে। ইউজারনেম/পাসওয়ার্ড দিয়ে আবার লগইন করলে একই অ্যাকাউন্ট ও আগের সংরক্ষিত তথ্য পাওয়া যাবে। লগইন/লগআউট কোনো সদস্যের অ্যাকাউন্ট বা বইয়ের তথ্য মুছে দেয় না।

## প্রতিযোগিতার ডেটা ম্যানুয়ালি পরিষ্কার

অ্যাডমিন অ্যাকাউন্ট দিয়ে লগইন করে লাইব্রেরি পেজের অ্যাডমিন প্যানেলে **“সব প্রতিযোগিতার গণনা পরিষ্কার করুন”** বাটন ব্যবহার করুন। নিশ্চিতকরণের পর সব `durud:` রেকর্ড মুছে যাবে। সদস্য অ্যাকাউন্ট, প্রোফাইল/প্রদর্শিত নাম ও PDF বই মুছবে না। এই কাজটি শুধু অ্যাডমিন করতে পারবেন।

## Important technical notes
- Netlify Blobs key/value object storage হিসেবে ব্যবহৃত। দরুদ প্রতিটি click আলাদা append-only record হিসেবে সংরক্ষিত হয়; এতে একই counter-এ concurrent overwrite এড়ানো যায়। খুব বড় ট্রাফিক হলে Netlify Database/Postgres-এ migration করা উচিত।
- দরুদ প্রতিযোগিতার পাবলিক লিডারবোর্ডে লগইন ছাড়াই সব অংশগ্রহণকারীর প্রদর্শিত নাম, প্রত্যেকের সাপ্তাহিক দরুদ সংখ্যা, মোট দরুদ এবং অংশগ্রহণকারীর সংখ্যা দেখা যায়। তালিকাটি প্রতি ৩০ সেকেন্ডে রিফ্রেশ হয়; প্রতিটি সারিতে “মাশাআল্লাহ” নয়, বরং উপরে সবার জন্য সম্মানজনক “মাশাআল্লাহ! আল্লাহ সবার আমল কবুল করুন” বার্তাটি দেখানো হয়।
- সদস্যের রেজিস্ট্রেশন ফর্মে প্রদর্শিত নাম যোগ করা হয়েছে; পুরোনো সদস্যরা প্রতিযোগিতা পাতায় নাম সেট/পরিবর্তন করতে পারবেন।
- Web Push সমর্থন browser/device অনুযায়ী আলাদা। ব্যবহারকারীকে notification permission দিতে হবে।
- PDF storage public file URL হিসেবে expose করা হয়নি; PDF কেবল function endpoint দিয়ে stream হয়।
- হাদিসের উদ্ধৃতি ও রেফারেন্স প্রকাশের আগে যোগ্য আলেম/সম্পাদক দিয়ে যাচাই করুন।
- Footer credit: **Developed by Almas & Asrar**.


## থিম পরিবর্তন

Header-এর `☾ ডার্ক` / `☀ লাইট` বাটনে চাপ দিয়ে থিম বদলানো যাবে। পছন্দটি একই ব্রাউজারে `localStorage`-এ সংরক্ষিত থাকে।


## Admin Dashboard

Deploy the complete project (including Netlify Functions) using Netlify CLI or a Git-connected build. After setting `IKHLAS_SESSION_SECRET`, `IKHLAS_ADMIN_USERNAME`, and `IKHLAS_ADMIN_PASSWORD`, redeploy. Open `https://YOUR-SITE.netlify.app/admin` and sign in with the configured admin username/password. The dashboard provides member and book lists, permanent PDF deletion, PDF uploads up to 12 MB using 3 MB chunks, and manual Durood competition reset. Admin authorization is checked server-side on every admin API request.

The 12 MB upload uses small authenticated chunks to avoid sending the entire PDF through one Netlify Function request. Keep Netlify Functions and Blobs enabled; a static drag-and-drop publish alone does not deploy the backend.
